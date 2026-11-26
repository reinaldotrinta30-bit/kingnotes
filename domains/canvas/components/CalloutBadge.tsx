'use client';

import React from 'react';
import {
  AlertTriangle,
  Info,
  Sparkles,
  StickyNote,
  Tag,
  ShieldAlert,
  Bookmark,
} from 'lucide-react';
import { CalloutPreset, CardCalloutConfig } from '@/domains/knowledge/types';
import { ClozeText } from '@/domains/review/components/ClozeText';
import { hexToRgbaString } from '../utils/contrast';

export interface CalloutVisualPreset {
  label: string;
  defaultBgHex: string;
  defaultBorderHex: string;
  darkTextHex: string;
  paperTextHex: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const CALLOUT_PRESETS: Record<CalloutPreset, CalloutVisualPreset> = {
  highlight: {
    label: 'Destaque',
    defaultBgHex: '#f59e0b',
    defaultBorderHex: '#f59e0b',
    darkTextHex: '#fde68a',
    paperTextHex: '#78350f',
    icon: Sparkles,
  },
  alert: {
    label: 'Alerta',
    defaultBgHex: '#f43f5e',
    defaultBorderHex: '#f43f5e',
    darkTextHex: '#fecdd3',
    paperTextHex: '#881337',
    icon: ShieldAlert,
  },
  warning: {
    label: 'Atenção',
    defaultBgHex: '#f97316',
    defaultBorderHex: '#f97316',
    darkTextHex: '#fed7aa',
    paperTextHex: '#7c2d12',
    icon: AlertTriangle,
  },
  info: {
    label: 'Informação',
    defaultBgHex: '#0ea5e9',
    defaultBorderHex: '#0ea5e9',
    darkTextHex: '#bae6fd',
    paperTextHex: '#0c4a6e',
    icon: Info,
  },
  note: {
    label: 'Nota',
    defaultBgHex: '#6366f1',
    defaultBorderHex: '#6366f1',
    darkTextHex: '#c7d2fe',
    paperTextHex: '#312e81',
    icon: StickyNote,
  },
  tag: {
    label: 'Etiqueta',
    defaultBgHex: '#10b981',
    defaultBorderHex: '#10b981',
    darkTextHex: '#a7f3d0',
    paperTextHex: '#064e3b',
    icon: Tag,
  },
  custom: {
    label: 'Personalizado',
    defaultBgHex: '#f59e0b',
    defaultBorderHex: '#f59e0b',
    darkTextHex: '#fde68a',
    paperTextHex: '#78350f',
    icon: Bookmark,
  },
};

export function resolveCalloutVisualColors(
  config: CardCalloutConfig,
  theme: 'dark' | 'paper'
): { bgStyle: string; borderStyle: string; textStyle: string } {
  const presetKey: CalloutPreset = config.preset ?? 'highlight';
  const preset = CALLOUT_PRESETS[presetKey];
  const emphasis = config.emphasis ?? 'medium';

  const bgAlpha =
    emphasis === 'strong'
      ? theme === 'paper'
        ? 0.24
        : 0.28
      : emphasis === 'subtle'
      ? theme === 'paper'
        ? 0.08
        : 0.07
      : theme === 'paper'
      ? 0.14
      : 0.13;

  const borderAlpha = emphasis === 'strong' ? 0.85 : emphasis === 'subtle' ? 0.25 : 0.45;

  const baseBg = config.bgColor || preset.defaultBgHex;
  const baseBorder = config.borderColor || config.bgColor || preset.defaultBorderHex;

  // No modo personalizado com cor de fundo sólida escolhida e destaque forte, aplica o hex direto
  const bgStyle =
    presetKey === 'custom' && config.bgColor && emphasis === 'strong'
      ? config.bgColor
      : hexToRgbaString(baseBg, bgAlpha);

  const borderStyle = hexToRgbaString(baseBorder, borderAlpha);
  const textStyle =
    config.textColor || (theme === 'paper' ? preset.paperTextHex : preset.darkTextHex);

  return { bgStyle, borderStyle, textStyle };
}

interface CalloutBadgeProps {
  config: CardCalloutConfig;
  theme: 'dark' | 'paper';
  className?: string;
}

export function CalloutBadge({ config, theme, className = '' }: CalloutBadgeProps) {
  const text = (config.text ?? '').trim();
  if (!text || config.visible === false) return null;

  const presetKey: CalloutPreset = config.preset ?? 'highlight';
  const preset = CALLOUT_PRESETS[presetKey];
  const position = config.position ?? 'bottom';
  const align = config.align ?? 'left';
  const IconComp = preset.icon;

  const { bgStyle, borderStyle, textStyle } = resolveCalloutVisualColors(config, theme);

  const alignClass =
    align === 'center' ? 'text-center justify-center' : align === 'right' ? 'text-right justify-end' : 'text-left justify-start';

  const isPill = position === 'badge' || presetKey === 'tag';
  const isAlertBox = position === 'alert-box';
  const isInlineBlock = position === 'inline';

  const renderIcon = () => {
    if (config.icon === 'none') return null;
    if (config.icon) {
      return <span className="shrink-0 text-[12px] leading-none">{config.icon}</span>;
    }
    return <IconComp className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-90" />;
  };

  if (isPill) {
    return (
      <div className={`flex ${alignClass} ${className}`}>
        <span
          style={{
            backgroundColor: bgStyle,
            borderColor: borderStyle,
            color: textStyle,
          }}
          className="inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium leading-snug"
        >
          {renderIcon()}
          <span className="break-words">
            <ClozeText text={text} />
          </span>
        </span>
      </div>
    );
  }

  if (isInlineBlock) {
    return (
      <div
        style={{
          backgroundColor: bgStyle,
          borderLeftColor: borderStyle,
          color: textStyle,
        }}
        className={`flex items-start gap-2 rounded-r-lg border-l-[3px] px-2.5 py-1.5 text-[11.5px] leading-snug ${alignClass} ${className}`}
      >
        {renderIcon()}
        <div className="min-w-0 flex-1 break-words">
          <ClozeText text={text} />
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: bgStyle,
        borderColor: borderStyle,
        color: textStyle,
      }}
      className={`flex items-start gap-2 rounded-lg border px-2.5 ${
        isAlertBox ? 'py-2 border-2 font-medium shadow-sm' : 'py-1.5'
      } text-[11.5px] leading-snug ${alignClass} ${className}`}
    >
      {renderIcon()}
      <div className="min-w-0 flex-1 break-words">
        {isAlertBox && (
          <span className="mr-1.5 text-[10px] font-bold uppercase tracking-wider opacity-90">
            {preset.label}:
          </span>
        )}
        <ClozeText text={text} />
      </div>
    </div>
  );
}