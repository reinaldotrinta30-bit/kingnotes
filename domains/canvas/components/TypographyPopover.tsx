'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Type, RotateCcw, Minus, Plus } from 'lucide-react';
import { TextTypographyConfig } from '@/domains/knowledge/types';
import {
  DEFAULT_CARD_TYPOGRAPHY,
  TYPOGRAPHY_LIMITS,
  resolveTypography,
} from '@/domains/knowledge/utils/defaults';

interface TypographyPopoverProps {
  value?: TextTypographyConfig;
  legacyFontSize?: number;
  defaults?: Required<TextTypographyConfig>;
  onChange: (next: Required<TextTypographyConfig>) => void;
  onReset: () => void;
  align?: 'left' | 'right';
  compact?: boolean;
}

export function TypographyPopover({
  value,
  legacyFontSize,
  defaults = DEFAULT_CARD_TYPOGRAPHY,
  onChange,
  onReset,
  align = 'left',
  compact = false,
}: TypographyPopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const current = resolveTypography(value, defaults, legacyFontSize);

  const isCustomized =
    current.fontSize !== defaults.fontSize ||
    current.lineHeight !== defaults.lineHeight ||
    current.paragraphSpacing !== defaults.paragraphSpacing;

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const updateField = (patch: Partial<TextTypographyConfig>) => {
    onChange(resolveTypography({ ...current, ...patch }, defaults));
  };

  return (
    <div ref={rootRef} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 rounded-lg border transition ${
          compact ? 'px-1.5 py-1 text-[11px]' : 'px-2 py-1 text-[11px]'
        } ${
          open || isCustomized
            ? 'border-indigo-500/60 bg-indigo-500/15 text-indigo-200'
            : 'border-zinc-800 bg-[#0F1115] text-zinc-300 hover:border-zinc-700 hover:text-zinc-100'
        }`}
        title="Formatação de texto: tamanho da fonte, entrelinha e espaçamento entre parágrafos"
      >
        <Type className="h-3.5 w-3.5 text-indigo-400" />
        <span className="font-mono text-[10.5px]">{current.fontSize}px</span>
      </button>

      {open && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className={`absolute top-full z-[150] mt-2 w-64 space-y-3.5 rounded-2xl border border-zinc-800 bg-[#161920]/98 p-3.5 text-left shadow-2xl backdrop-blur-xl ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
              Tipografia do Bloco
            </span>
            <button
              type="button"
              onClick={() => onReset()}
              disabled={!isCustomized}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-35"
              title="Restaurar tipografia padrão"
            >
              <RotateCcw className="h-3 w-3" /> Padrão
            </button>
          </div>

          {/* 1. Tamanho da fonte */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">Tamanho da fonte</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => updateField({ fontSize: current.fontSize - 1 })}
                  className="rounded bg-zinc-800/90 p-0.5 text-zinc-300 hover:bg-zinc-700"
                  title="Diminuir 1px"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-10 text-center font-mono text-[11px] font-semibold text-zinc-100">
                  {current.fontSize}px
                </span>
                <button
                  type="button"
                  onClick={() => updateField({ fontSize: current.fontSize + 1 })}
                  className="rounded bg-zinc-800/90 p-0.5 text-zinc-300 hover:bg-zinc-700"
                  title="Aumentar 1px"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>
            <input
              type="range"
              min={TYPOGRAPHY_LIMITS.fontSize.min}
              max={TYPOGRAPHY_LIMITS.fontSize.max}
              step={1}
              value={current.fontSize}
              onChange={(e) => updateField({ fontSize: Number(e.target.value) })}
              className="w-full accent-indigo-500"
            />
          </div>

          {/* 2. Espaçamento entre linhas */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">Espaço entre linhas</span>
              <span className="font-mono text-[11px] font-semibold text-zinc-100">
                {current.lineHeight.toFixed(2)}×
              </span>
            </div>
            <input
              type="range"
              min={TYPOGRAPHY_LIMITS.lineHeight.min}
              max={TYPOGRAPHY_LIMITS.lineHeight.max}
              step={0.05}
              value={current.lineHeight}
              onChange={(e) => updateField({ lineHeight: Number(e.target.value) })}
              className="w-full accent-indigo-500"
            />
          </div>

          {/* 3. Espaçamento entre parágrafos */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">Espaço entre parágrafos</span>
              <span className="font-mono text-[11px] font-semibold text-zinc-100">
                {current.paragraphSpacing}px
              </span>
            </div>
            <input
              type="range"
              min={TYPOGRAPHY_LIMITS.paragraphSpacing.min}
              max={TYPOGRAPHY_LIMITS.paragraphSpacing.max}
              step={1}
              value={current.paragraphSpacing}
              onChange={(e) => updateField({ paragraphSpacing: Number(e.target.value) })}
              className="w-full accent-indigo-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}