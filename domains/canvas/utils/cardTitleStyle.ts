import type React from 'react';
import { ResolvedCardTitleStyle } from '@/domains/knowledge/utils/defaults';
import { hexToRgbaString } from './contrast';
import { getFontFamilyCss, getTextEffectClass } from './studyFonts';

export interface CardTitleRenderProps {
  hasBannerBg: boolean;
  wrapperStyle: React.CSSProperties;
  wrapperClassName: string;
  textStyle: React.CSSProperties;
  textClassName: string;
}

export function buildCardTitleRenderProps(
  ts: ResolvedCardTitleStyle,
  options?: { fontSizeOverride?: number }
): CardTitleRenderProps {
  const hasBannerBg = Boolean(ts.bgColor);
  const isBrushUnderline = ts.underline && ts.underlineStyle === 'brush';

  const decoLines: string[] = [];
  if (ts.underline && !isBrushUnderline) decoLines.push('underline');
  if (ts.strikethrough) decoLines.push('line-through');

  const fontWeightNum =
    ts.fontWeight === 'normal' ? 400 : ts.fontWeight === 'semibold' ? 600 : 700;

  const wrapperStyle: React.CSSProperties = {
    textAlign: ts.textAlign,
    ...(hasBannerBg
      ? {
          backgroundColor: hexToRgbaString(ts.bgColor, 0.18),
          borderColor: hexToRgbaString(ts.bgColor, 0.45),
        }
      : {}),
  };

  const wrapperClassName = hasBannerBg
    ? 'rounded-xl border px-3 py-1.5 transition-colors'
    : '';

  const textStyle: React.CSSProperties = {
    fontFamily: getFontFamilyCss(ts.fontFamily),
    fontSize: `${options?.fontSizeOverride ?? ts.fontSize}px`,
    fontWeight: fontWeightNum,
    fontStyle: ts.italic ? 'italic' : 'normal',
    textTransform: ts.textTransform === 'none' ? undefined : ts.textTransform,
    letterSpacing: ts.letterSpacing !== 0 ? `${ts.letterSpacing}em` : undefined,
    textAlign: ts.textAlign,
    color: ts.color || undefined,
    textDecorationLine: decoLines.length > 0 ? decoLines.join(' ') : 'none',
    textDecorationStyle:
      ts.underline && !isBrushUnderline ? ts.underlineStyle : undefined,
    textDecorationColor:
      ts.underline && !isBrushUnderline && ts.underlineColor
        ? ts.underlineColor
        : undefined,
    textUnderlineOffset: ts.underline && !isBrushUnderline ? '4px' : undefined,
    textDecorationThickness: ts.underline && !isBrushUnderline ? '2px' : undefined,
    ['--kc-fx-color' as string]: ts.effectColor,
    ['--kc-fx-start' as string]: ts.color || '#f4f4f5',
    ...(isBrushUnderline
      ? { ['--kc-ul-color' as string]: ts.underlineColor || ts.color || '#f59e0b' }
      : {}),
  };

  const classes = [
    getTextEffectClass(ts.textEffect),
    isBrushUnderline ? 'kc-ul kc-ul-brush' : '',
  ].filter(Boolean);

  return {
    hasBannerBg,
    wrapperStyle,
    wrapperClassName,
    textStyle,
    textClassName: classes.join(' '),
  };
}