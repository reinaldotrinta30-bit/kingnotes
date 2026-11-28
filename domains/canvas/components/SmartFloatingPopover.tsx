'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface SmartFloatingPopoverProps {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  width?: number;
  estimatedHeight?: number;
  align?: 'left' | 'right' | 'center';
  /** Quando o elemento está no meio da tela e o painel é alto, encaixa na lateral livre para não cobrir o elemento nem colidir com o Dock */
  preferSideWhenCramped?: boolean;
  className?: string;
  children: React.ReactNode;
}

interface ComputedPos {
  top: number;
  left: number;
  maxHeight: number;
  width?: number;
  ready: boolean;
}

const VIEWPORT_PAD = 12;
const GAP = 8;
const DOCK_SAFE_BOTTOM = 78;

export function SmartFloatingPopover({
  open,
  anchorRef,
  onClose,
  width,
  estimatedHeight = 320,
  align = 'left',
  preferSideWhenCramped = false,
  className = '',
  children,
}: SmartFloatingPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<ComputedPos>({
    top: 16,
    left: 16,
    maxHeight: 520,
    width,
    ready: false,
  });

  const recomputePosition = useCallback(() => {
    if (typeof window === 'undefined') return;
    const anchor = anchorRef.current;
    if (!anchor) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = anchor.getBoundingClientRect();
    const popEl = popoverRef.current;

    const measuredW = width
      ? Math.min(width, vw - VIEWPORT_PAD * 2)
      : Math.min(popEl?.offsetWidth || 260, vw - VIEWPORT_PAD * 2);

    const naturalH = popEl ? Math.max(popEl.scrollHeight, 60) : estimatedHeight;

    const spaceBelowFull = vh - rect.bottom - GAP - VIEWPORT_PAD;
    const spaceBelowSafe = vh - DOCK_SAFE_BOTTOM - rect.bottom - GAP;
    const spaceAbove = rect.top - GAP - VIEWPORT_PAD;
    const spaceRight = vw - rect.right - 14 - VIEWPORT_PAD;
    const spaceLeft = rect.left - 14 - VIEWPORT_PAD;

    const calcAlignedLeft = () => {
      let rawLeft = rect.left;
      if (align === 'right') rawLeft = rect.right - measuredW;
      else if (align === 'center') rawLeft = rect.left + rect.width / 2 - measuredW / 2;
      return Math.max(VIEWPORT_PAD, Math.min(vw - measuredW - VIEWPORT_PAD, rawLeft));
    };

    // 1) Se couber confortavelmente abaixo sem invadir o Dock inferior, abre abaixo
    const fitsComfortablyBelow =
      spaceBelowSafe >= Math.min(naturalH, preferSideWhenCramped ? 460 : 280);

    if (fitsComfortablyBelow) {
      setPos({
        top: Math.round(rect.bottom + GAP),
        left: Math.round(calcAlignedLeft()),
        maxHeight: Math.max(160, Math.round(spaceBelowSafe)),
        width: width ? measuredW : undefined,
        ready: true,
      });
      return;
    }

    // 2) Para painéis altos no centro da tela (ex.: Fonte & Lettering), desliza para a lateral livre
    if (preferSideWhenCramped && (spaceRight >= measuredW || spaceLeft >= measuredW)) {
      const openOnRight = spaceRight >= measuredW && (spaceRight >= spaceLeft || align !== 'right');
      const left = openOnRight
        ? Math.min(vw - measuredW - VIEWPORT_PAD, rect.right + 14)
        : Math.max(VIEWPORT_PAD, rect.left - measuredW - 14);

      const availH = vh - VIEWPORT_PAD * 2;
      const clampedH = Math.min(naturalH, availH);
      const idealTop = rect.top - 28;
      const top = Math.max(VIEWPORT_PAD, Math.min(vh - clampedH - VIEWPORT_PAD, idealTop));

      setPos({
        top: Math.round(top),
        left: Math.round(left),
        maxHeight: Math.max(220, Math.round(availH)),
        width: width ? measuredW : undefined,
        ready: true,
      });
      return;
    }

    // 3) Se houver mais espaço acima do botão, abre acima
    if (spaceAbove > spaceBelowFull && spaceAbove >= 140) {
      const maxH = Math.round(spaceAbove);
      const renderedH = Math.min(naturalH, maxH);
      setPos({
        top: Math.max(VIEWPORT_PAD, Math.round(rect.top - GAP - renderedH)),
        left: Math.round(calcAlignedLeft()),
        maxHeight: Math.max(120, maxH),
        width: width ? measuredW : undefined,
        ready: true,
      });
      return;
    }

    // 4) Fallback em telas muito estreitas/baixas: encaixa com folga dentro da viewport inteira
    const availH = vh - VIEWPORT_PAD * 2;
    const clampedH = Math.min(naturalH, availH);
    const top = Math.max(VIEWPORT_PAD, Math.min(vh - clampedH - VIEWPORT_PAD, rect.bottom + GAP));
    setPos({
      top: Math.round(top),
      left: Math.round(calcAlignedLeft()),
      maxHeight: Math.max(180, Math.round(availH)),
      width: width ? measuredW : undefined,
      ready: true,
    });
  }, [anchorRef, width, estimatedHeight, align, preferSideWhenCramped]);

  useLayoutEffect(() => {
    if (!open) return;
    recomputePosition();
    const raf = requestAnimationFrame(recomputePosition);
    return () => cancelAnimationFrame(raf);
  }, [open, recomputePosition]);

  // Recalcula automaticamente ao redimensionar a janela ou mudar a altura interna (ex.: trocar aba / abrir cor)
  useEffect(() => {
    if (!open) return;
    const onViewportChange = () => recomputePosition();
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);

    const el = popoverRef.current;
    const ro = el ? new ResizeObserver(() => recomputePosition()) : null;
    if (el && ro) ro.observe(el);

    return () => {
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
      ro?.disconnect();
    };
  }, [open, recomputePosition]);

  // Fecha ao clicar fora ou apertar Escape
  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleKey);
    };
  }, [open, anchorRef, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        maxHeight: pos.maxHeight,
        width: pos.width,
        visibility: pos.ready ? 'visible' : 'hidden',
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        const tag = (e.target as HTMLElement).tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
          e.preventDefault();
        }
      }}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      className={`kc-no-scrollbar nodrag nowheel z-[9999] overflow-y-auto ${className}`}
    >
      {children}
    </div>,
    document.body
  );
}