import {
  CanvasConnection,
  CardCalloutConfig,
  KnowledgeCardMeta,
  TextTypographyConfig,
  CardTitleStyle,
} from '../types';

export const TYPOGRAPHY_LIMITS = {
  fontSize: { min: 11, max: 48 },
  lineHeight: { min: 1.1, max: 2.4 },
  paragraphSpacing: { min: 0, max: 28 },
} as const;

export const DEFAULT_CARD_TYPOGRAPHY: Required<TextTypographyConfig> = {
  fontFamily: 'default',
  textEffect: 'none',
  effectColor: '#0f172a',
  fontSize: 13,
  lineHeight: 1.55,
  paragraphSpacing: 6,
};

export const DEFAULT_TEXT_TYPOGRAPHY: Required<TextTypographyConfig> = {
  fontFamily: 'default',
  textEffect: 'none',
  effectColor: '#0f172a',
  fontSize: 15,
  lineHeight: 1.48,
  paragraphSpacing: 6,
};

export const DEFAULT_TOPIC_TYPOGRAPHY: Required<TextTypographyConfig> = {
  fontFamily: 'default',
  textEffect: 'none',
  effectColor: '#0f172a',
  fontSize: 15,
  lineHeight: 1.3,
  paragraphSpacing: 4,
};

export function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

export function resolveTypography(
  typography?: TextTypographyConfig,
  defaults: Required<TextTypographyConfig> = DEFAULT_CARD_TYPOGRAPHY,
  legacyFontSize?: number
): Required<TextTypographyConfig> {
  const rawFont = typography?.fontSize ?? legacyFontSize ?? defaults.fontSize;
  const rawLine = typography?.lineHeight ?? defaults.lineHeight;
  const rawSpace = typography?.paragraphSpacing ?? defaults.paragraphSpacing;

 return {
  fontSize: Math.round(
    clampNumber(rawFont, TYPOGRAPHY_LIMITS.fontSize.min, TYPOGRAPHY_LIMITS.fontSize.max, defaults.fontSize)
  ),
  lineHeight:
    Math.round(
      clampNumber(
        rawLine,
        TYPOGRAPHY_LIMITS.lineHeight.min,
        TYPOGRAPHY_LIMITS.lineHeight.max,
        defaults.lineHeight
      ) * 100
    ) / 100,
  paragraphSpacing: Math.round(
    clampNumber(
      rawSpace,
      TYPOGRAPHY_LIMITS.paragraphSpacing.min,
      TYPOGRAPHY_LIMITS.paragraphSpacing.max,
      defaults.paragraphSpacing
    )
  ),

  fontFamily: typography?.fontFamily ?? defaults.fontFamily,
textEffect: typography?.textEffect ?? defaults.textEffect,
effectColor: typography?.effectColor ?? defaults.effectColor,
};
}

export const DEFAULT_CALLOUT_CONFIG: Required<
  Omit<CardCalloutConfig, 'text' | 'bgColor' | 'textColor' | 'borderColor' | 'icon'>
> = {
  visible: true,
  preset: 'highlight',
  position: 'bottom',
  emphasis: 'medium',
  align: 'left',
};

/**
 * Retrocompatibilidade: cards antigos que possuem apenas `card.notes`
 * continuam exibindo o bloco amarelo padrão até serem personalizados.
 */
export function resolveCardCallout(
  card: Pick<KnowledgeCardMeta, 'notes' | 'callout'>
): CardCalloutConfig {
  const text = card.callout?.text ?? card.notes ?? '';
  return {
    ...DEFAULT_CALLOUT_CONFIG,
    ...card.callout,
    text,
    visible: card.callout?.visible ?? true,
  };
}

export function resolveEdgeStrokeWidth(edge: Pick<CanvasConnection, 'strokeWidth'>): number {
  return clampNumber(edge.strokeWidth ?? 1.75, 1, 8, 1.75);
}

export interface ResolvedCardTitleStyle {
  fontFamily: NonNullable<CardTitleStyle['fontFamily']>;
  fontSize: number;
  color: string;
  bgColor: string;
  textAlign: NonNullable<CardTitleStyle['textAlign']>;
  textEffect: NonNullable<CardTitleStyle['textEffect']>;
  effectColor: string;
  fontWeight: NonNullable<CardTitleStyle['fontWeight']>;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  textTransform: NonNullable<CardTitleStyle['textTransform']>;
  letterSpacing: number;
  underlineColor: string;
  underlineStyle: NonNullable<CardTitleStyle['underlineStyle']>;
  highlightColor: string;
}

export const DEFAULT_CARD_TITLE_STYLE: ResolvedCardTitleStyle = {
  fontFamily: 'default',
  fontSize: 15,
  color: '',
  bgColor: '',
  textAlign: 'left',
  textEffect: 'none',
  effectColor: '#0f172a',
  fontWeight: 'bold',
  italic: false,
  underline: false,
  strikethrough: false,
  textTransform: 'none',
  letterSpacing: 0,
  underlineColor: '',
  underlineStyle: 'solid',
  highlightColor: '',
};

export function resolveCardTitleStyle(meta?: {
  titleStyle?: CardTitleStyle;
  typography?: TextTypographyConfig;
}): ResolvedCardTitleStyle {
  const ts = meta?.titleStyle;
  return {
    fontFamily: ts?.fontFamily ?? meta?.typography?.fontFamily ?? DEFAULT_CARD_TITLE_STYLE.fontFamily,
    fontSize: Math.max(12, Math.min(44, Math.round(ts?.fontSize ?? DEFAULT_CARD_TITLE_STYLE.fontSize))),
    color: ts?.color ?? '',
    bgColor: ts?.bgColor ?? '',
    textAlign: ts?.textAlign ?? DEFAULT_CARD_TITLE_STYLE.textAlign,
    textEffect: ts?.textEffect ?? meta?.typography?.textEffect ?? DEFAULT_CARD_TITLE_STYLE.textEffect,
    effectColor:
      ts?.effectColor ?? meta?.typography?.effectColor ?? DEFAULT_CARD_TITLE_STYLE.effectColor,
    fontWeight: ts?.fontWeight ?? DEFAULT_CARD_TITLE_STYLE.fontWeight,
    italic: ts?.italic ?? DEFAULT_CARD_TITLE_STYLE.italic,
    underline: ts?.underline ?? DEFAULT_CARD_TITLE_STYLE.underline,
    strikethrough: ts?.strikethrough ?? DEFAULT_CARD_TITLE_STYLE.strikethrough,
    textTransform: ts?.textTransform ?? DEFAULT_CARD_TITLE_STYLE.textTransform,
    letterSpacing: Math.round(clampNumber(ts?.letterSpacing ?? 0, -0.04, 0.22, 0) * 100) / 100,
    underlineColor: ts?.underlineColor ?? '',
    underlineStyle: ts?.underlineStyle ?? DEFAULT_CARD_TITLE_STYLE.underlineStyle,
    highlightColor: ts?.highlightColor ?? '',
  };
}