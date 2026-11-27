'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Type,
  RotateCcw,
  Minus,
  Plus,
  Sparkles,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Italic,
  Underline as UnderlineIcon,
} from 'lucide-react';
import {
  CardTitleStyle,
  StudyFontId,
  TextEffectId,
  TextTypographyConfig,
} from '@/domains/knowledge/types';
import {
  DEFAULT_CARD_TITLE_STYLE,
  DEFAULT_CARD_TYPOGRAPHY,
  TYPOGRAPHY_LIMITS,
  resolveCardTitleStyle,
  resolveTypography,
} from '@/domains/knowledge/utils/defaults';
import {
  EFFECT_COLOR_SWATCHES,
  STUDY_FONT_OPTIONS,
  TEXT_EFFECT_OPTIONS,
} from '../utils/studyFonts';

const TITLE_TEXT_COLORS = ['', '#ffffff', '#18181b', '#818cf8', '#38bdf8', '#34d399', '#fbbf24', '#fb7185'];

interface TypographyPopoverProps {
  value?: TextTypographyConfig;
  legacyFontSize?: number;
  defaults?: Required<TextTypographyConfig>;
  onChange: (next: Required<TextTypographyConfig>) => void;
  onReset: () => void;
  titleStyle?: CardTitleStyle;
  onTitleStyleChange?: (next: CardTitleStyle) => void;
  onTitleStyleReset?: () => void;
  hideSpacingControls?: boolean;
  align?: 'left' | 'right';
  compact?: boolean;
}

export function TypographyPopover({
  value,
  legacyFontSize,
  defaults = DEFAULT_CARD_TYPOGRAPHY,
  onChange,
  onReset,
  titleStyle,
  onTitleStyleChange,
  onTitleStyleReset,
  hideSpacingControls = false,
  align = 'left',
  compact = false,
}: TypographyPopoverProps) {
  const [open, setOpen] = useState(false);
  const [targetTab, setTargetTab] = useState<'body' | 'title'>('body');
  const rootRef = useRef<HTMLDivElement>(null);

  const supportsTitleTab = Boolean(onTitleStyleChange);
  const current = resolveTypography(value, defaults, legacyFontSize);
  const currentTitle = resolveCardTitleStyle({ titleStyle, typography: value });

  const isBodyCustomized =
    current.fontSize !== defaults.fontSize ||
    current.lineHeight !== defaults.lineHeight ||
    current.paragraphSpacing !== defaults.paragraphSpacing ||
    current.fontFamily !== defaults.fontFamily ||
    current.textEffect !== defaults.textEffect;

  const isTitleCustomized = Boolean(
    titleStyle &&
      (titleStyle.fontFamily !== undefined ||
        titleStyle.fontSize !== undefined ||
        titleStyle.color !== undefined ||
        titleStyle.textAlign !== undefined ||
        titleStyle.textEffect !== undefined ||
        titleStyle.italic !== undefined ||
        titleStyle.underline !== undefined)
  );

  const activeFontLabel =
    STUDY_FONT_OPTIONS.find((f) => f.id === current.fontFamily)?.label ?? 'Padrão';

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

  const updateBodyField = (patch: Partial<TextTypographyConfig>) => {
    onChange(resolveTypography({ ...current, ...patch }, defaults));
  };

  const updateTitleField = (patch: Partial<CardTitleStyle>) => {
    if (!onTitleStyleChange) return;
    onTitleStyleChange({
      ...currentTitle,
      color: currentTitle.color || undefined,
      ...patch,
    });
  };

  return (
    <div ref={rootRef} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-lg border transition ${
          compact ? 'px-1.5 py-1 text-[11px]' : 'px-2 py-1 text-[11px]'
        } ${
          open || isBodyCustomized || isTitleCustomized
            ? 'border-indigo-500/60 bg-indigo-500/15 text-indigo-200'
            : 'border-zinc-800 bg-[#0F1115] text-zinc-300 hover:border-zinc-700 hover:text-zinc-100'
        }`}
        title="Personalizar fonte de caderno, lettering, tamanho e espaçamentos"
      >
        <Type className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
        {!compact && current.fontFamily !== 'default' && (
          <span className="max-w-[66px] truncate font-medium">{activeFontLabel}</span>
        )}
        <span className="font-mono text-[10.5px]">{current.fontSize}px</span>
      </button>

      {open && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className={`absolute top-full z-[150] mt-2 max-h-[78vh] w-80 space-y-3.5 overflow-y-auto rounded-2xl border border-zinc-800 bg-[#161920]/98 p-4 text-left shadow-2xl backdrop-blur-xl ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {/* Cabeçalho */}
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-200">
              Fonte & Lettering
            </span>
            <button
              type="button"
              onClick={() => {
                if (targetTab === 'title' && onTitleStyleReset) onTitleStyleReset();
                else onReset();
              }}
              disabled={targetTab === 'title' ? !isTitleCustomized : !isBodyCustomized}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-35"
              title="Restaurar padrão"
            >
              <RotateCcw className="h-3 w-3" /> Padrão
            </button>
          </div>

          {/* Seletor Corpo vs Título (quando for um Card) */}
          {supportsTitleTab && (
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-zinc-800 bg-[#0F1115] p-1">
              <button
                type="button"
                onClick={() => setTargetTab('title')}
                className={`rounded-lg py-1.5 text-[11px] font-semibold transition ${
                  targetTab === 'title'
                    ? 'bg-indigo-600/25 text-indigo-200'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Título do Card
              </button>
              <button
                type="button"
                onClick={() => setTargetTab('body')}
                className={`rounded-lg py-1.5 text-[11px] font-semibold transition ${
                  targetTab === 'body'
                    ? 'bg-indigo-600/25 text-indigo-200'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Corpo do Texto
              </button>
            </div>
          )}

          {targetTab === 'title' && supportsTitleTab ? (
            /* ABA TÍTULO DO CARD */
            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Fonte do Título
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {STUDY_FONT_OPTIONS.map((font) => (
                    <button
                      key={font.id}
                      type="button"
                      onClick={() => updateTitleField({ fontFamily: font.id as StudyFontId })}
                      style={{ fontFamily: font.cssFamily }}
                      className={`rounded-lg border px-2 py-1.5 text-xs transition ${
                        currentTitle.fontFamily === font.id
                          ? 'border-indigo-500 bg-indigo-600/20 text-indigo-100'
                          : 'border-zinc-800 bg-[#0F1115] text-zinc-300 hover:border-zinc-700 hover:text-white'
                      }`}
                    >
                      {font.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  <Sparkles className="h-3 w-3 text-amber-400" /> Efeito Lettering
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {TEXT_EFFECT_OPTIONS.map((fx) => (
                    <button
                      key={fx.id}
                      type="button"
                      onClick={() => updateTitleField({ textEffect: fx.id as TextEffectId })}
                      className={`rounded-lg border px-2 py-1 text-[11px] font-medium transition ${
                        currentTitle.textEffect === fx.id
                          ? 'border-amber-500/70 bg-amber-500/15 text-amber-200'
                          : 'border-zinc-800 bg-[#0F1115] text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {fx.label}
                    </button>
                  ))}
                </div>

                {currentTitle.textEffect !== 'none' && (
                  <div className="flex items-center justify-between gap-1.5 rounded-xl border border-zinc-800 bg-[#0F1115] px-2.5 py-1.5">
                    <span className="text-[10px] text-zinc-500">Cor efeito</span>
                    <div className="flex items-center gap-1">
                      {EFFECT_COLOR_SWATCHES.map((sw) => (
                        <button
                          key={sw.hex}
                          type="button"
                          title={sw.label}
                          onClick={() => updateTitleField({ effectColor: sw.hex })}
                          className={`h-4 w-4 rounded-full border transition hover:scale-125 ${
                            currentTitle.effectColor === sw.hex
                              ? 'scale-110 border-white'
                              : 'border-zinc-700'
                          }`}
                          style={{ backgroundColor: sw.hex }}
                        />
                      ))}
                      <input
                        type="color"
                        value={currentTitle.effectColor}
                        onChange={(e) => updateTitleField({ effectColor: e.target.value })}
                        className="h-4 w-4 cursor-pointer rounded border-0 bg-transparent p-0"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Cor do Título */}
              <div className="flex items-center justify-between gap-1.5 rounded-xl border border-zinc-800 bg-[#0F1115] px-2.5 py-1.5">
                <span className="text-[10px] font-semibold uppercase text-zinc-500">Cor</span>
                <div className="flex items-center gap-1">
                  {TITLE_TEXT_COLORS.map((hex) => (
                    <button
                      key={`tt-${hex || 'auto'}`}
                      type="button"
                      onClick={() => updateTitleField({ color: hex || undefined })}
                      className={`flex h-4 w-4 items-center justify-center rounded-full border text-[8px] font-bold text-zinc-400 transition hover:scale-125 ${
                        currentTitle.color === hex ? 'scale-110 border-white' : 'border-zinc-700'
                      }`}
                      style={hex ? { backgroundColor: hex } : undefined}
                      title={hex ? `Cor ${hex}` : 'Cor padrão do tema'}
                    >
                      {!hex && 'A'}
                    </button>
                  ))}
                  <input
                    type="color"
                    value={currentTitle.color || '#ffffff'}
                    onChange={(e) => updateTitleField({ color: e.target.value })}
                    className="h-4 w-4 cursor-pointer rounded border-0 bg-transparent p-0"
                  />
                </div>
              </div>

              {/* Tamanho do Título */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-400">Tamanho do título</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateTitleField({ fontSize: Math.max(12, currentTitle.fontSize - 1) })}
                      className="rounded bg-zinc-800/90 p-0.5 text-zinc-300 hover:bg-zinc-700"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-10 text-center font-mono text-[11px] font-semibold text-zinc-100">
                      {currentTitle.fontSize}px
                    </span>
                    <button
                      type="button"
                      onClick={() => updateTitleField({ fontSize: Math.min(44, currentTitle.fontSize + 1) })}
                      className="rounded bg-zinc-800/90 p-0.5 text-zinc-300 hover:bg-zinc-700"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min={12}
                  max={44}
                  step={1}
                  value={currentTitle.fontSize}
                  onChange={(e) => updateTitleField({ fontSize: Number(e.target.value) })}
                  className="w-full accent-indigo-500"
                />
              </div>

              {/* Alinhamento + Estilo (Itálico / Sublinhado) */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-1 gap-1 rounded-lg border border-zinc-800 bg-[#0F1115] p-0.5">
                  {(
                    [
                      { id: 'left', icon: AlignLeft },
                      { id: 'center', icon: AlignCenter },
                      { id: 'right', icon: AlignRight },
                    ] as const
                  ).map(({ id, icon: Icon }) => (
                    <button
                      key={`ta-${id}`}
                      type="button"
                      onClick={() => updateTitleField({ textAlign: id })}
                      className={`flex flex-1 items-center justify-center rounded-md py-1 transition ${
                        currentTitle.textAlign === id
                          ? 'bg-indigo-600/30 text-indigo-200'
                          : 'text-zinc-400 hover:text-zinc-100'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </button>
                  ))}
                </div>

                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => updateTitleField({ italic: !currentTitle.italic })}
                    className={`rounded-lg border p-1.5 transition ${
                      currentTitle.italic
                        ? 'border-indigo-500 bg-indigo-600/25 text-indigo-200'
                        : 'border-zinc-800 bg-[#0F1115] text-zinc-400 hover:text-white'
                    }`}
                    title="Itálico"
                  >
                    <Italic className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateTitleField({ underline: !currentTitle.underline })}
                    className={`rounded-lg border p-1.5 transition ${
                      currentTitle.underline
                        ? 'border-indigo-500 bg-indigo-600/25 text-indigo-200'
                        : 'border-zinc-800 bg-[#0F1115] text-zinc-400 hover:text-white'
                    }`}
                    title="Sublinhado"
                  >
                    <UnderlineIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ABA CORPO / ELEMENTO GERAL */
            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Estilo de Fonte
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {STUDY_FONT_OPTIONS.map((font) => (
                    <button
                      key={font.id}
                      type="button"
                      onClick={() => updateBodyField({ fontFamily: font.id as StudyFontId })}
                      style={{ fontFamily: font.cssFamily }}
                      className={`rounded-lg border px-2 py-1.5 text-xs transition ${
                        current.fontFamily === font.id
                          ? 'border-indigo-500 bg-indigo-600/20 text-indigo-100'
                          : 'border-zinc-800 bg-[#0F1115] text-zinc-300 hover:border-zinc-700 hover:text-white'
                      }`}
                    >
                      {font.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  <Sparkles className="h-3 w-3 text-amber-400" /> Efeito Lettering
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {TEXT_EFFECT_OPTIONS.map((fx) => (
                    <button
                      key={fx.id}
                      type="button"
                      onClick={() => updateBodyField({ textEffect: fx.id as TextEffectId })}
                      className={`rounded-lg border px-2 py-1 text-[11px] font-medium transition ${
                        current.textEffect === fx.id
                          ? 'border-amber-500/70 bg-amber-500/15 text-amber-200'
                          : 'border-zinc-800 bg-[#0F1115] text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {fx.label}
                    </button>
                  ))}
                </div>

                {current.textEffect !== 'none' && (
                  <div className="flex items-center justify-between gap-1.5 rounded-xl border border-zinc-800 bg-[#0F1115] px-2.5 py-1.5">
                    <span className="text-[10px] text-zinc-500">Cor efeito</span>
                    <div className="flex items-center gap-1">
                      {EFFECT_COLOR_SWATCHES.map((sw) => (
                        <button
                          key={sw.hex}
                          type="button"
                          title={sw.label}
                          onClick={() => updateBodyField({ effectColor: sw.hex })}
                          className={`h-4 w-4 rounded-full border transition hover:scale-125 ${
                            current.effectColor === sw.hex
                              ? 'scale-110 border-white'
                              : 'border-zinc-700'
                          }`}
                          style={{ backgroundColor: sw.hex }}
                        />
                      ))}
                      <input
                        type="color"
                        value={current.effectColor}
                        onChange={(e) => updateBodyField({ effectColor: e.target.value })}
                        className="h-4 w-4 cursor-pointer rounded border-0 bg-transparent p-0"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="h-px bg-zinc-800/80" />

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-400">Tamanho da fonte</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateBodyField({ fontSize: current.fontSize - 1 })}
                      className="rounded bg-zinc-800/90 p-0.5 text-zinc-300 hover:bg-zinc-700"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-10 text-center font-mono text-[11px] font-semibold text-zinc-100">
                      {current.fontSize}px
                    </span>
                    <button
                      type="button"
                      onClick={() => updateBodyField({ fontSize: current.fontSize + 1 })}
                      className="rounded bg-zinc-800/90 p-0.5 text-zinc-300 hover:bg-zinc-700"
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
                  onChange={(e) => updateBodyField({ fontSize: Number(e.target.value) })}
                  className="w-full accent-indigo-500"
                />
              </div>

              {!hideSpacingControls && (
                <>
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
                      onChange={(e) => updateBodyField({ lineHeight: Number(e.target.value) })}
                      className="w-full accent-indigo-500"
                    />
                  </div>

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
                      onChange={(e) =>
                        updateBodyField({ paragraphSpacing: Number(e.target.value) })
                      }
                      className="w-full accent-indigo-500"
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}