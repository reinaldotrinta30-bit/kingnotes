import {
  CanvasConnection,
  CardCalloutConfig,
  KnowledgeCardMeta,
  TextTypographyConfig,
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