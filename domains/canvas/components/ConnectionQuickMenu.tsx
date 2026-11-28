'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { StickyNote, Shapes, Type, ImagePlus, Sticker } from 'lucide-react';

export type ConnectionQuickItemType = 'card' | 'topic' | 'text' | 'image' | 'element';

interface ConnectionQuickMenuProps {
  isOpen: boolean;
  screenX: number;
  screenY: number;
  onSelect: (type: ConnectionQuickItemType) => void;
  onClose: () => void;
}

const QUICK_OPTIONS: Array<{
  id: ConnectionQuickItemType;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  hoverBgClass: string;
}> = [
  {
    id: 'card',
    title: 'Card',
    icon: StickyNote,
    colorClass: 'text-indigo-400',
    hoverBgClass: 'hover:bg-indigo-500/20 hover:text-indigo-200',
  },
  {
    id: 'topic',
    title: 'Tópico',
    icon: Shapes,
    colorClass: 'text-violet-400',
    hoverBgClass: 'hover:bg-violet-500/20 hover:text-violet-200',
  },
  {
    id: 'text',
    title: 'Texto',
    icon: Type,
    colorClass: 'text-amber-400',
    hoverBgClass: 'hover:bg-amber-500/20 hover:text-amber-200',
  },
  {
    id: 'image',
    title: 'Imagem',
    icon: ImagePlus,
    colorClass: 'text-sky-400',
    hoverBgClass: 'hover:bg-sky-500/20 hover:text-sky-200',
  },
  {
    id: 'element',
    title: 'Elementos',
    icon: Sticker,
    colorClass: 'text-emerald-400',
    hoverBgClass: 'hover:bg-emerald-500/20 hover:text-emerald-200',
  },
];

export function ConnectionQuickMenu({
  isOpen,
  screenX,
  screenY,
  onSelect,
  onClose,
}: ConnectionQuickMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleOutside);
    }, 30);
    window.addEventListener('keydown', handleKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const menuW = 224;
  const menuH = 52;
  const pad = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const left = Math.max(pad, Math.min(vw - menuW - pad, Math.round(screenX - menuW / 2)));
  const fitsBelow = screenY + 18 + menuH <= vh - pad;
  const top = fitsBelow
    ? Math.round(screenY + 16)
    : Math.max(pad, Math.round(screenY - menuH - 16));

  return createPortal(
    <>
      {/* Ponto-âncora luminoso exatamente onde a conexão foi solta */}
      <div
        style={{
          position: 'fixed',
          left: screenX,
          top: screenY,
          transform: 'translate(-50%, -50%)',
        }}
        className="pointer-events-none fixed z-[9998] h-3 w-3 rounded-full border-2 border-white bg-indigo-500 shadow-[0_0_16px_rgba(99,102,241,0.9)]"
      />

      {/* Cápsula flutuante minimalista somente com ícones */}
      <div
        ref={menuRef}
        style={{ position: 'fixed', left, top }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
        className="z-[9999] flex items-center gap-1 rounded-2xl border border-indigo-500/45 bg-[#161920]/96 p-1.5 shadow-[0_16px_42px_rgba(0,0,0,0.55)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
      >
        {QUICK_OPTIONS.map(({ id, title, icon: Icon, colorClass, hoverBgClass }) => (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            title={title}
            aria-label={`Conectar novo ${title}`}
            className={`group flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-150 hover:scale-110 active:scale-95 ${colorClass} ${hoverBgClass}`}
          >
            <Icon className="h-[18px] w-[18px]" />
          </button>
        ))}
      </div>
    </>,
    document.body
  );
}