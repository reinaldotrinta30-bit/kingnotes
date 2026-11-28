'use client';

import React from 'react';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Minus,
  Plus,
  Sparkles,
} from 'lucide-react';
import {
  CardTitleStyle,
  StudyFontId,
  TextEffectId,
  TextTypographyConfig,
} from '@/domains/knowledge/types';
import { resolveCardTitleStyle } from '@/domains/knowledge/utils/defaults';
import {
  EFFECT_COLOR_SWATCHES,
  STUDY_FONT_OPTIONS,
  TEXT_EFFECT_OPTIONS,
} from '../utils/studyFonts';

const TITLE_TEXT_COLORS = [
  '',
  '#ffffff',
  '#18181b',
  '#818cf8',
  '#38bdf8',
  '#34d399',
  '#fbbf24',
  '#fb7185',
];

const TITLE_BG_COLORS = [
  '',
  '#6366f1',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#f43f5e',
  '#a855f7',
  '#3f3f46',
];

const UNDERLINE_COLORS = ['', '#ef4444', '#f59e0b', '#10b981', '#38bdf8', '#a855f7', '#ec4899'];

const UNDERLINE_STYLES: Array<{
  id: NonNullable<CardTitleStyle['underlineStyle']>;
  label: string;
}> = [
  { id: 'solid', label: 'Sólido' },
  { id: 'brush', label: 'Pincel' },
  { id: 'wavy', label: 'Ondulado' },
  { id: 'double', label: 'Duplo' },
  { id: 'dashed', label: 'Tracej.' },
];

interface CardTitleStyleControlsProps {
  value?: CardTitleStyle;
  fallbackTypography?: TextTypographyConfig;
  onChange: (next: CardTitleStyle) => void;
  hideBannerBg?: boolean;
}

export function CardTitleStyleControls({
  value,
  fallbackTypography,
  onChange,
  hideBannerBg = false,
}: CardTitleStyleControlsProps) {
  const current = resolveCardTitleStyle({
    titleStyle: value,
    typography: fallbackTypography,
  });

  const patchTitle = (patch: Partial<CardTitleStyle>) => {
    onChange({
      ...current,
      color: current.color || undefined,
      bgColor: current.bgColor || undefined,
      underlineColor: current.underlineColor || undefined,
      highlightColor: current.highlightColor || undefined,
      ...patch,
    });
  };

  return (
    <div className="space-y-3.5">
      {/* 1. Alinhamento completo (Esquerda / Centro / Direita / Justificado) */}
      <div className="space-y-1.5">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Alinhamento & Estilo
        </span>
        <div className="flex items-center gap-1.5">
          <div className="flex flex-1 gap-0.5 rounded-lg border border-zinc-800 bg-[#0F1115] p-0.5">
            {(
              [
                { id: 'left', icon: AlignLeft, title: 'Alinhar à esquerda' },
                { id: 'center', icon: AlignCenter, title: 'Centralizar' },
                { id: 'right', icon: AlignRight, title: 'Alinhar à direita' },
                { id: 'justify', icon: AlignJustify, title: 'Justificar' },
              ] as const
            ).map(({ id, icon: Icon, title }) => (
              <button
                key={`ta-${id}`}
                type="button"
                title={title}
                onClick={() => patchTitle({ textAlign: id })}
                className={`flex flex-1 items-center justify-center rounded-md py-1.5 transition ${
                  current.textAlign === id
                    ? 'bg-indigo-600/30 text-indigo-200'
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => patchTitle({ italic: !current.italic })}
            className={`rounded-lg border p-1.5 transition ${
              current.italic
                ? 'border-indigo-500 bg-indigo-600/25 text-indigo-200'
                : 'border-zinc-800 bg-[#0F1115] text-zinc-400 hover:text-white'
            }`}
            title="Itálico"
          >
            <Italic className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => patchTitle({ underline: !current.underline })}
            className={`rounded-lg border p-1.5 transition ${
              current.underline
                ? 'border-indigo-500 bg-indigo-600/25 text-indigo-200'
                : 'border-zinc-800 bg-[#0F1115] text-zinc-400 hover:text-white'
            }`}
            title="Sublinhado (abre opções de estilo e cor)"
          >
            <UnderlineIcon className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => patchTitle({ strikethrough: !current.strikethrough })}
            className={`rounded-lg border p-1.5 transition ${
              current.strikethrough
                ? 'border-indigo-500 bg-indigo-600/25 text-indigo-200'
                : 'border-zinc-800 bg-[#0F1115] text-zinc-400 hover:text-white'
            }`}
            title="Tachado"
          >
            <Strikethrough className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Peso + Caixa (Normal / MAIÚSCULAS / Capitalizado) */}
        <div className="grid grid-cols-2 gap-1.5">
          <div className="flex gap-0.5 rounded-lg border border-zinc-800 bg-[#0F1115] p-0.5">
            {(
              [
                { id: 'normal', label: 'Normal' },
                { id: 'semibold', label: 'Semi' },
                { id: 'bold', label: 'Negrito' },
              ] as const
            ).map((w) => (
              <button
                key={`tw-${w.id}`}
                type="button"
                onClick={() => patchTitle({ fontWeight: w.id })}
                className={`flex-1 rounded-md py-1 text-[10px] font-medium transition ${
                  current.fontWeight === w.id
                    ? 'bg-indigo-600/30 text-indigo-200'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>

          <div className="flex gap-0.5 rounded-lg border border-zinc-800 bg-[#0F1115] p-0.5">
            {(
              [
                { id: 'none', label: 'Aa', title: 'Normal' },
                { id: 'uppercase', label: 'AA', title: 'MAIÚSCULAS' },
                { id: 'capitalize', label: 'Ab', title: 'Iniciais Maiúsculas' },
              ] as const
            ).map((tc) => (
              <button
                key={`ttc-${tc.id}`}
                type="button"
                title={tc.title}
                onClick={() => patchTitle({ textTransform: tc.id })}
                className={`flex-1 rounded-md py-1 text-[10.5px] font-semibold transition ${
                  current.textTransform === tc.id
                    ? 'bg-indigo-600/30 text-indigo-200'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {tc.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Opções avançadas de Sublinhado (aparece automaticamente quando Sublinhado está ligado) */}
      {current.underline && (
        <div className="space-y-2 rounded-xl border border-indigo-500/25 bg-[#0F1115] p-2.5">
          <div className="grid grid-cols-5 gap-1">
            {UNDERLINE_STYLES.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => patchTitle({ underlineStyle: st.id })}
                className={`rounded-md border py-1 text-[9.5px] font-medium transition ${
                  current.underlineStyle === st.id
                    ? 'border-indigo-500 bg-indigo-600/25 text-indigo-200'
                    : 'border-zinc-800 bg-[#161920] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] text-zinc-500">Cor do traço</span>
            <div className="flex items-center gap-1">
              {UNDERLINE_COLORS.map((hex) => (
                <button
                  key={`tul-${hex || 'auto'}`}
                  type="button"
                  onClick={() => patchTitle({ underlineColor: hex || undefined })}
                  className={`flex h-4 w-4 items-center justify-center rounded-full border text-[8px] font-bold text-zinc-400 transition hover:scale-125 ${
                    current.underlineColor === hex ? 'scale-110 border-white' : 'border-zinc-700'
                  }`}
                  style={hex ? { backgroundColor: hex } : undefined}
                  title={hex ? `Cor ${hex}` : 'Cor do texto'}
                >
                  {!hex && 'A'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. Fonte do Título */}
      <div className="space-y-1.5">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Fonte do Título
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          {STUDY_FONT_OPTIONS.map((font) => (
            <button
              key={font.id}
              type="button"
              onClick={() => patchTitle({ fontFamily: font.id as StudyFontId })}
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

      {/* 3. Tamanho + Espaçamento entre letras */}
      <div className="space-y-2.5">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-400">Tamanho do título</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => patchTitle({ fontSize: Math.max(12, current.fontSize - 1) })}
                className="rounded bg-zinc-800/90 p-0.5 text-zinc-300 hover:bg-zinc-700"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="w-10 text-center font-mono text-[11px] font-semibold text-zinc-100">
                {current.fontSize}px
              </span>
              <button
                type="button"
                onClick={() => patchTitle({ fontSize: Math.min(44, current.fontSize + 1) })}
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
            value={current.fontSize}
            onChange={(e) => patchTitle({ fontSize: Number(e.target.value) })}
            className="w-full accent-indigo-500"
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-400">Espaço entre letras</span>
            <span className="font-mono text-[11px] font-semibold text-zinc-100">
              {current.letterSpacing === 0
                ? 'Padrão'
                : `${current.letterSpacing > 0 ? '+' : ''}${current.letterSpacing.toFixed(2)}em`}
            </span>
          </div>
          <input
            type="range"
            min={-0.04}
            max={0.2}
            step={0.01}
            value={current.letterSpacing}
            onChange={(e) => patchTitle({ letterSpacing: Number(e.target.value) })}
            className="w-full accent-indigo-500"
          />
        </div>
      </div>

      {/* 4. Cor do Texto e Faixa/Fundo do Título */}
      <div className="space-y-2 rounded-xl border border-zinc-800 bg-[#0F1115] p-2.5">
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[10px] font-semibold uppercase text-zinc-500">Cor</span>
          <div className="flex items-center gap-1">
            {TITLE_TEXT_COLORS.map((hex) => (
              <button
                key={`tt-${hex || 'auto'}`}
                type="button"
                onClick={() => patchTitle({ color: hex || undefined })}
                className={`flex h-4 w-4 items-center justify-center rounded-full border text-[8px] font-bold text-zinc-400 transition hover:scale-125 ${
                  current.color === hex ? 'scale-110 border-white' : 'border-zinc-700'
                }`}
                style={hex ? { backgroundColor: hex } : undefined}
                title={hex ? `Cor ${hex}` : 'Cor padrão do tema'}
              >
                {!hex && 'A'}
              </button>
            ))}
            <input
              type="color"
              value={current.color || '#ffffff'}
              onChange={(e) => patchTitle({ color: e.target.value })}
              className="h-4 w-4 cursor-pointer rounded border-0 bg-transparent p-0"
              title="Cor personalizada do texto"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[10px] font-semibold uppercase text-zinc-500">Marca</span>
          <div className="flex items-center gap-1">
            {[
              { label: 'Sem marca-texto', value: '' },
              { label: 'Amarelo', value: 'rgba(250, 204, 21, 0.36)' },
              { label: 'Verde', value: 'rgba(52, 211, 153, 0.32)' },
              { label: 'Azul', value: 'rgba(56, 189, 248, 0.32)' },
              { label: 'Rosa', value: 'rgba(251, 113, 133, 0.34)' },
              { label: 'Roxo', value: 'rgba(167, 139, 250, 0.34)' },
            ].map((hl) => (
              <button
                key={`thlc-${hl.label}`}
                type="button"
                title={hl.label}
                onClick={() => patchTitle({ highlightColor: hl.value || undefined })}
                className={`flex h-4 w-4 items-center justify-center rounded border text-[8px] font-bold text-zinc-400 transition hover:scale-125 ${
                  current.highlightColor === hl.value ? 'scale-110 border-white' : 'border-zinc-700'
                }`}
                style={hl.value ? { backgroundColor: hl.value } : undefined}
              >
                {!hl.value && '✕'}
              </button>
            ))}
          </div>
        </div>

        {!hideBannerBg && (
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10px] font-semibold uppercase text-zinc-500">Faixa</span>
          <div className="flex items-center gap-1">
            {TITLE_BG_COLORS.map((hex) => (
              <button
                key={`tbg-${hex || 'none'}`}
                type="button"
                onClick={() => patchTitle({ bgColor: hex || undefined })}
                className={`flex h-4 w-4 items-center justify-center rounded border text-[8px] font-bold text-zinc-400 transition hover:scale-125 ${
                  current.bgColor === hex ? 'scale-110 border-white' : 'border-zinc-700'
                }`}
                style={hex ? { backgroundColor: hex } : undefined}
                title={hex ? `Fundo destaque ${hex}` : 'Sem faixa de fundo'}
              >
                {!hex && '✕'}
              </button>
            ))}
            <input
              type="color"
              value={current.bgColor || '#6366f1'}
              onChange={(e) => patchTitle({ bgColor: e.target.value })}
              className="h-4 w-4 cursor-pointer rounded border-0 bg-transparent p-0"
              title="Cor personalizada da faixa"
            />
          </div>
          </div>
        )}
      </div>

      {/* 5. Efeito Lettering */}
      <div className="space-y-1.5">
        <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          <Sparkles className="h-3 w-3 text-amber-400" /> Efeito Lettering
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          {TEXT_EFFECT_OPTIONS.map((fx) => (
            <button
              key={fx.id}
              type="button"
              onClick={() => patchTitle({ textEffect: fx.id as TextEffectId })}
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
                  onClick={() => patchTitle({ effectColor: sw.hex })}
                  className={`h-4 w-4 rounded-full border transition hover:scale-125 ${
                    current.effectColor === sw.hex ? 'scale-110 border-white' : 'border-zinc-700'
                  }`}
                  style={{ backgroundColor: sw.hex }}
                />
              ))}
              <input
                type="color"
                value={current.effectColor}
                onChange={(e) => patchTitle({ effectColor: e.target.value })}
                className="h-4 w-4 cursor-pointer rounded border-0 bg-transparent p-0"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}