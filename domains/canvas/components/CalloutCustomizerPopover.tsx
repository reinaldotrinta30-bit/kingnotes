'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  MessageSquareText,
  Eye,
  EyeOff,
  AlertTriangle,
  Wand2,
  RotateCcw,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';
import {
  CalloutEmphasis,
  CalloutPosition,
  CalloutPreset,
  CardCalloutConfig,
} from '@/domains/knowledge/types';
import { DEFAULT_CALLOUT_CONFIG } from '@/domains/knowledge/utils/defaults';
import {
  MEETS_WCAG_AA,
  getContrastRatio,
  suggestAccessibleTextColor,
} from '../utils/contrast';
import { CALLOUT_PRESETS, resolveCalloutVisualColors } from './CalloutBadge';

const QUICK_ICONS = ['', '⚠️', '🎯', '💡', '📌', '⚖️', '🔥', 'none'];
const SWATCH_COLORS = ['#f59e0b', '#f43f5e', '#f97316', '#0ea5e9', '#10b981', '#6366f1', '#a855f7', '#27272a'];
const TEXT_SWATCHES = ['', '#fde68a', '#ffffff', '#18181b', '#fecdd3', '#bae6fd', '#a7f3d0', '#c7d2fe'];

const POSITION_OPTIONS: Array<{ id: CalloutPosition; label: string }> = [
  { id: 'bottom', label: 'Rodapé' },
  { id: 'top', label: 'Topo' },
  { id: 'side', label: 'Lateral' },
  { id: 'inline', label: 'No texto' },
  { id: 'badge', label: 'Etiqueta' },
  { id: 'alert-box', label: 'Caixa Alerta' },
];

interface CalloutCustomizerPopoverProps {
  value: CardCalloutConfig;
  theme: 'dark' | 'paper';
  onChange: (next: CardCalloutConfig) => void;
  align?: 'left' | 'right';
  compact?: boolean;
}

export function CalloutCustomizerPopover({
  value,
  theme,
  onChange,
  align = 'left',
  compact = false,
}: CalloutCustomizerPopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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

  const merged: CardCalloutConfig = {
    ...DEFAULT_CALLOUT_CONFIG,
    ...value,
  };

  const hasText = Boolean((merged.text ?? '').trim().length > 0);
  const isVisible = merged.visible !== false;

  const { bgStyle, textStyle } = resolveCalloutVisualColors(merged, theme);
  const surfaceHex = theme === 'paper' ? '#ffffff' : '#161920';
  const contrastRatio = getContrastRatio(textStyle, bgStyle, surfaceHex);
  const hasLowContrast = contrastRatio < MEETS_WCAG_AA;

  const patch = (partial: Partial<CardCalloutConfig>) => {
    onChange({ ...merged, ...partial });
  };

  return (
    <div ref={rootRef} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 rounded-lg border transition ${
          compact ? 'px-1.5 py-1 text-[11px]' : 'px-2 py-1 text-[11px]'
        } ${
          open || (hasText && isVisible)
            ? 'border-amber-500/50 bg-amber-500/15 text-amber-300'
            : hasText && !isVisible
            ? 'border-zinc-700 bg-zinc-900 text-zinc-400'
            : 'border-zinc-800 bg-[#0F1115] text-zinc-300 hover:border-zinc-700 hover:text-zinc-100'
        }`}
        title="Personalizar Observação Rápida / Pegadinha da Banca"
      >
        <MessageSquareText className="h-3.5 w-3.5 text-amber-400" />
        {!compact && <span>Nota</span>}
        {hasText && !isVisible && <EyeOff className="h-3 w-3 text-zinc-500" />}
      </button>

      {open && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className={`absolute top-full z-[150] mt-2 max-h-[75vh] w-80 space-y-3 overflow-y-auto rounded-2xl border border-zinc-800 bg-[#161920]/98 p-3.5 text-left shadow-2xl backdrop-blur-xl ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {/* Cabeçalho */}
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
              Observação / Pegadinha
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => patch({ visible: !isVisible })}
                className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10.5px] font-medium transition ${
                  isVisible
                    ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
                    : 'bg-amber-500/20 text-amber-300'
                }`}
                title="Ocultar ou mostrar sem apagar o texto"
              >
                {isVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                {isVisible ? 'Visível' : 'Oculta'}
              </button>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...DEFAULT_CALLOUT_CONFIG,
                    text: merged.text ?? '',
                  })
                }
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                title="Restaurar estilo amarelo padrão"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Texto */}
          <div>
            <textarea
              rows={2}
              value={merged.text ?? ''}
              onChange={(e) => patch({ text: e.target.value })}
              placeholder="Escreva a pegadinha de banca, mnemônico ou observação..."
              className="w-full resize-none rounded-xl border border-zinc-800 bg-[#0F1115] px-2.5 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500/60 focus:outline-none"
            />
          </div>

          {/* Estilo / Preset */}
          <div className="space-y-1.5">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Estilo
            </span>
            <div className="grid grid-cols-4 gap-1">
              {(Object.keys(CALLOUT_PRESETS) as CalloutPreset[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    patch({
                      preset: key,
                      ...(key !== 'custom'
                        ? { bgColor: undefined, textColor: undefined, borderColor: undefined }
                        : {}),
                    })
                  }
                  className={`rounded-lg border px-1.5 py-1 text-[10.5px] font-medium transition ${
                    (merged.preset ?? 'highlight') === key
                      ? 'border-indigo-500 bg-indigo-500/20 text-indigo-200'
                      : 'border-zinc-800 bg-[#0F1115] text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {CALLOUT_PRESETS[key].label}
                </button>
              ))}
            </div>
          </div>

          {/* Posição */}
          <div className="space-y-1.5">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Posição no card
            </span>
            <div className="grid grid-cols-3 gap-1">
              {POSITION_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => patch({ position: opt.id })}
                  className={`rounded-lg border px-2 py-1 text-[10.5px] font-medium transition ${
                    (merged.position ?? 'bottom') === opt.id
                      ? 'border-indigo-500 bg-indigo-500/20 text-indigo-200'
                      : 'border-zinc-800 bg-[#0F1115] text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Destaque e Alinhamento */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Destaque
              </span>
              <div className="flex gap-1">
                {(
                  [
                    { id: 'subtle', label: 'Suave' },
                    { id: 'medium', label: 'Médio' },
                    { id: 'strong', label: 'Forte' },
                  ] as Array<{ id: CalloutEmphasis; label: string }>
                ).map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => patch({ emphasis: e.id })}
                    className={`flex-1 rounded-lg border py-1 text-[10px] font-medium transition ${
                      (merged.emphasis ?? 'medium') === e.id
                        ? 'border-indigo-500 bg-indigo-500/20 text-indigo-200'
                        : 'border-zinc-800 bg-[#0F1115] text-zinc-400'
                    }`}
                  >
                    {e.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Alinhamento
              </span>
              <div className="flex gap-1">
                {(
                  [
                    { id: 'left', icon: AlignLeft },
                    { id: 'center', icon: AlignCenter },
                    { id: 'right', icon: AlignRight },
                  ] as const
                ).map(({ id, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => patch({ align: id })}
                    className={`flex flex-1 items-center justify-center rounded-lg border py-1 transition ${
                      (merged.align ?? 'left') === id
                        ? 'border-indigo-500 bg-indigo-500/20 text-indigo-200'
                        : 'border-zinc-800 bg-[#0F1115] text-zinc-400'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Cores (Fundo, Borda e Texto) */}
          <div className="space-y-2 rounded-xl border border-zinc-800/80 bg-[#0F1115] p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase text-zinc-500">Fundo</span>
              <div className="flex items-center gap-1">
                {SWATCH_COLORS.map((hex) => (
                  <button
                    key={`cbg-${hex}`}
                    type="button"
                    onClick={() => patch({ preset: 'custom', bgColor: hex })}
                    className={`h-4 w-4 rounded border transition hover:scale-125 ${
                      merged.bgColor === hex ? 'scale-110 border-white' : 'border-zinc-700'
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
                <input
                  type="color"
                  value={merged.bgColor || '#f59e0b'}
                  onChange={(e) => patch({ preset: 'custom', bgColor: e.target.value })}
                  className="h-4 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
                  title="Escolher cor de fundo personalizada"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase text-zinc-500">Texto</span>
              <div className="flex items-center gap-1">
                {TEXT_SWATCHES.map((hex) => (
                  <button
                    key={`ctx-${hex || 'auto'}`}
                    type="button"
                    onClick={() => patch({ textColor: hex || undefined })}
                    className={`flex h-4 w-4 items-center justify-center rounded-full border text-[8px] font-bold text-zinc-400 transition hover:scale-125 ${
                      (merged.textColor ?? '') === hex ? 'scale-110 border-white' : 'border-zinc-700'
                    }`}
                    style={hex ? { backgroundColor: hex } : undefined}
                    title={hex ? `Cor do texto ${hex}` : 'Cor automática do tema'}
                  >
                    {!hex && 'A'}
                  </button>
                ))}
                <input
                  type="color"
                  value={merged.textColor || '#fde68a'}
                  onChange={(e) => patch({ textColor: e.target.value })}
                  className="h-4 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
                  title="Escolher cor de texto personalizada"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase text-zinc-500">Borda</span>
              <div className="flex items-center gap-1">
                {SWATCH_COLORS.map((hex) => (
                  <button
                    key={`cbd-${hex}`}
                    type="button"
                    onClick={() => patch({ borderColor: hex })}
                    className={`h-4 w-4 rounded-full border transition hover:scale-125 ${
                      merged.borderColor === hex ? 'scale-110 border-white' : 'border-zinc-700'
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Alerta automático de acessibilidade / contraste */}
          {hasLowContrast && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-2.5 py-2 text-[11px] text-rose-200">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                Contraste baixo ({contrastRatio.toFixed(1)}:1)
              </span>
              <button
                type="button"
                onClick={() =>
                  patch({ textColor: suggestAccessibleTextColor(bgStyle, surfaceHex) })
                }
                className="flex shrink-0 items-center gap-1 rounded-lg bg-rose-500 px-2 py-0.5 text-[10.5px] font-semibold text-white hover:bg-rose-400"
              >
                <Wand2 className="h-3 w-3" /> Corrigir
              </button>
            </div>
          )}

          {/* Ícone */}
          <div className="space-y-1">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Ícone
            </span>
            <div className="flex flex-wrap gap-1">
              {QUICK_ICONS.map((ic) => (
                <button
                  key={ic || 'default'}
                  type="button"
                  onClick={() => patch({ icon: ic || undefined })}
                  className={`rounded-lg border px-2 py-1 text-[11px] transition ${
                    (merged.icon ?? '') === ic
                      ? 'border-indigo-500 bg-indigo-500/20 text-indigo-200'
                      : 'border-zinc-800 bg-[#0F1115] text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  {ic === '' ? 'Auto' : ic === 'none' ? 'Sem' : ic}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}