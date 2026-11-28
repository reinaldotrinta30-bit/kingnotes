import {
  CanvasNodePosition,
  CardTitleStyle,
  KnowledgeCardMeta,
  TextTypographyConfig,
  TopicNodeConfig,
  TopicShape,
} from '@/domains/knowledge/types';
import {
  DEFAULT_CARD_TYPOGRAPHY,
  DEFAULT_TEXT_TYPOGRAPHY,
  DEFAULT_TOPIC_TYPOGRAPHY,
  resolveCardTitleStyle,
  resolveTypography,
} from '@/domains/knowledge/utils/defaults';

export interface InheritedVisualStyle {
  sourceType: CanvasNodePosition['nodeType'];
  accentHex?: string;
  cardColor?: KnowledgeCardMeta['color'];
  typography?: TextTypographyConfig;
  titleStyle?: CardTitleStyle;
  textColor?: string;
  textAlign?: CanvasNodePosition['textAlign'];
  bgColor?: string;
  bgOpacity?: CanvasNodePosition['bgOpacity'];
  borderStyle?: CanvasNodePosition['borderStyle'];
  borderWidth?: CanvasNodePosition['borderWidth'];
  paperStyle?: KnowledgeCardMeta['paperStyle'];
  sketch?: boolean;
  doubleBorder?: boolean;
  shadow?: TopicNodeConfig['shadow'];
  topicShape?: TopicShape;
  padding?: CanvasNodePosition['padding'];
  defaultEdgeStyle?: TopicNodeConfig['defaultEdgeStyle'];
}

const CARD_COLOR_TO_HEX: Record<KnowledgeCardMeta['color'], string> = {
  default: '#6366f1',
  amber: '#f59e0b',
  emerald: '#10b981',
  sky: '#0ea5e9',
  rose: '#f43f5e',
  violet: '#8b5cf6',
};

function hexToCardColor(hex?: string): KnowledgeCardMeta['color'] {
  switch ((hex ?? '').toLowerCase()) {
    case '#f59e0b':
    case '#eab308':
    case '#f97316':
      return 'amber';
    case '#10b981':
    case '#22c55e':
    case '#14b8a6':
      return 'emerald';
    case '#0ea5e9':
    case '#38bdf8':
    case '#3b82f6':
      return 'sky';
    case '#f43f5e':
    case '#ec4899':
    case '#ef4444':
      return 'rose';
    case '#8b5cf6':
    case '#a855f7':
    case '#6366f1':
    case '#818cf8':
      return 'violet';
    default:
      return 'default';
  }
}

function toCardBorderStyle(
  borderStyle?: CanvasNodePosition['borderStyle']
): KnowledgeCardMeta['borderStyle'] | undefined {
  if (!borderStyle) return undefined;
  if (borderStyle === 'dotted') return 'dashed';
  return borderStyle;
}

/**
 * Extrai a assinatura visual (fonte, tamanho, cor, efeito lettering, borda, alinhamento)
 * de qualquer nó pai do Canvas para padronizar os ramos filhos.
 */
export function extractInheritedStyle(
  sourceNode: CanvasNodePosition | undefined,
  cardsById: Record<string, KnowledgeCardMeta>
): InheritedVisualStyle | null {
  if (!sourceNode) return null;

  if (sourceNode.nodeType === 'knowledgeCard' && sourceNode.cardId) {
    const card = cardsById[sourceNode.cardId];
    if (!card) return null;

    const resolvedTitle = resolveCardTitleStyle(card);
    const resolvedTypo = resolveTypography(card.typography, DEFAULT_CARD_TYPOGRAPHY);

    return {
      sourceType: 'knowledgeCard',
      accentHex: CARD_COLOR_TO_HEX[card.color],
      cardColor: card.color,
      typography: card.typography ? { ...resolvedTypo } : undefined,
      titleStyle: card.titleStyle ? { ...card.titleStyle } : undefined,
      textColor: resolvedTitle.color || undefined,
      textAlign: resolvedTitle.textAlign,
      borderStyle: card.borderStyle,
      borderWidth: card.borderWidth,
      paperStyle: card.paperStyle,
      padding: sourceNode.padding,
    };
  }

  if (sourceNode.nodeType === 'topic') {
    const accentHex = sourceNode.bgColor ?? sourceNode.color ?? '#6366f1';
    const resolvedTypo = resolveTypography(
      sourceNode.typography,
      DEFAULT_TOPIC_TYPOGRAPHY,
      sourceNode.fontSize
    );
    const ts = sourceNode.topicConfig?.textStyle;

    const mergedTitleStyle: CardTitleStyle = {
      ...(ts ?? {}),
      fontFamily: ts?.fontFamily ?? resolvedTypo.fontFamily,
      fontSize: ts?.fontSize ?? resolvedTypo.fontSize,
      color: ts?.color ?? sourceNode.textColor,
      textAlign: ts?.textAlign ?? sourceNode.textAlign ?? 'center',
      textEffect: ts?.textEffect ?? resolvedTypo.textEffect,
      effectColor: ts?.effectColor ?? resolvedTypo.effectColor,
    };

    return {
      sourceType: 'topic',
      accentHex,
      cardColor: hexToCardColor(accentHex),
      typography: {
        ...resolvedTypo,
        fontFamily: mergedTitleStyle.fontFamily ?? resolvedTypo.fontFamily,
        fontSize: mergedTitleStyle.fontSize ?? resolvedTypo.fontSize,
        textEffect: mergedTitleStyle.textEffect ?? resolvedTypo.textEffect,
        effectColor: mergedTitleStyle.effectColor ?? resolvedTypo.effectColor,
      },
      titleStyle: mergedTitleStyle,
      textColor: mergedTitleStyle.color,
      textAlign: mergedTitleStyle.textAlign,
      bgColor: sourceNode.bgColor ?? accentHex,
      bgOpacity: sourceNode.bgOpacity,
      borderStyle: sourceNode.borderStyle,
      borderWidth: sourceNode.borderWidth,
      sketch: sourceNode.sketch,
      doubleBorder: sourceNode.topicConfig?.doubleBorder,
      shadow: sourceNode.topicConfig?.shadow,
      topicShape: sourceNode.topicConfig?.shape,
      padding: sourceNode.padding,
      defaultEdgeStyle: sourceNode.topicConfig?.defaultEdgeStyle
        ? { ...sourceNode.topicConfig.defaultEdgeStyle }
        : undefined,
    };
  }

  if (sourceNode.nodeType === 'text') {
    const accentHex = sourceNode.bgColor ?? sourceNode.color ?? '#6366f1';
    const resolvedTypo = resolveTypography(
      sourceNode.typography,
      DEFAULT_TEXT_TYPOGRAPHY,
      sourceNode.fontSize
    );

    const hasCustomTypo =
      Boolean(sourceNode.typography) || Boolean(sourceNode.fontSize) || Boolean(sourceNode.textColor);

    return {
      sourceType: 'text',
      accentHex,
      cardColor:
        sourceNode.bgOpacity && sourceNode.bgOpacity !== 'transparent'
          ? hexToCardColor(accentHex)
          : 'default',
      typography: hasCustomTypo ? { ...resolvedTypo } : undefined,
      titleStyle: hasCustomTypo
        ? {
            fontFamily: resolvedTypo.fontFamily,
            fontSize: Math.max(13, Math.min(36, resolvedTypo.fontSize)),
            color: sourceNode.textColor,
            textAlign: sourceNode.textAlign ?? 'left',
            textEffect: resolvedTypo.textEffect,
            effectColor: resolvedTypo.effectColor,
          }
        : undefined,
      textColor: sourceNode.textColor,
      textAlign: sourceNode.textAlign,
      bgColor: sourceNode.bgColor,
      bgOpacity: sourceNode.bgOpacity,
      borderStyle: sourceNode.borderStyle,
      borderWidth: sourceNode.borderWidth,
      sketch: sourceNode.sketch,
      padding: sourceNode.padding,
    };
  }

  return {
    sourceType: sourceNode.nodeType,
    accentHex: sourceNode.color,
    cardColor: hexToCardColor(sourceNode.color),
    textAlign: sourceNode.textAlign,
    borderStyle: sourceNode.borderStyle,
    borderWidth: sourceNode.borderWidth,
  };
}

/** Converte o estilo herdado para um novo Knowledge Card */
export function buildInheritedCardStyle(inherited: InheritedVisualStyle | null): {
  initialStyle?: Partial<
    Pick<
      KnowledgeCardMeta,
      'color' | 'typography' | 'titleStyle' | 'borderStyle' | 'borderWidth' | 'paperStyle'
    >
  >;
  initialPadding?: CanvasNodePosition['padding'];
} {
  if (!inherited) return {};

  const initialStyle: Partial<
    Pick<
      KnowledgeCardMeta,
      'color' | 'typography' | 'titleStyle' | 'borderStyle' | 'borderWidth' | 'paperStyle'
    >
  > = {};

  if (inherited.cardColor) initialStyle.color = inherited.cardColor;
  if (inherited.typography) initialStyle.typography = { ...inherited.typography };
  if (inherited.titleStyle) initialStyle.titleStyle = { ...inherited.titleStyle };
  if (inherited.borderStyle) initialStyle.borderStyle = toCardBorderStyle(inherited.borderStyle);
  if (inherited.borderWidth) initialStyle.borderWidth = inherited.borderWidth;
  if (inherited.paperStyle) initialStyle.paperStyle = inherited.paperStyle;

  return {
    initialStyle: Object.keys(initialStyle).length > 0 ? initialStyle : undefined,
    initialPadding: inherited.padding,
  };
}

/** Converte o estilo herdado para um novo Tópico */
export function buildInheritedTopicStyle(
  inherited: InheritedVisualStyle | null,
  fallbackColor: string
): {
  shape: TopicShape;
  color: string;
  initialStyle?: Partial<
    Pick<
      CanvasNodePosition,
      | 'bgColor'
      | 'bgOpacity'
      | 'borderStyle'
      | 'borderWidth'
      | 'sketch'
      | 'textColor'
      | 'textAlign'
      | 'fontSize'
      | 'typography'
      | 'padding'
      | 'topicConfig'
    >
  >;
} {
  const color = inherited?.accentHex ?? fallbackColor;
  const shape: TopicShape =
    inherited?.sourceType === 'topic' && inherited.topicShape ? inherited.topicShape : 'rounded';

  if (!inherited) {
    return { shape, color };
  }

  const fontSize =
    inherited.titleStyle?.fontSize ??
    inherited.typography?.fontSize ??
    DEFAULT_TOPIC_TYPOGRAPHY.fontSize;
  const fontFamily =
    inherited.titleStyle?.fontFamily ??
    inherited.typography?.fontFamily ??
    DEFAULT_TOPIC_TYPOGRAPHY.fontFamily;
  const textEffect =
    inherited.titleStyle?.textEffect ??
    inherited.typography?.textEffect ??
    DEFAULT_TOPIC_TYPOGRAPHY.textEffect;
  const effectColor =
    inherited.titleStyle?.effectColor ??
    inherited.typography?.effectColor ??
    DEFAULT_TOPIC_TYPOGRAPHY.effectColor;

  const textStyle: CardTitleStyle = {
    ...(inherited.titleStyle ?? {}),
    fontFamily,
    fontSize,
    color: inherited.titleStyle?.color ?? inherited.textColor,
    textAlign: inherited.titleStyle?.textAlign ?? inherited.textAlign ?? 'center',
    textEffect,
    effectColor,
  };

  return {
    shape,
    color,
    initialStyle: {
      bgColor: inherited.bgColor ?? color,
      ...(inherited.sourceType === 'topic' && inherited.bgOpacity
        ? { bgOpacity: inherited.bgOpacity }
        : {}),
      ...(inherited.borderStyle ? { borderStyle: inherited.borderStyle } : {}),
      ...(inherited.borderWidth ? { borderWidth: inherited.borderWidth } : {}),
      ...(inherited.sketch !== undefined ? { sketch: inherited.sketch } : {}),
      ...(textStyle.color ? { textColor: textStyle.color } : {}),
      textAlign: textStyle.textAlign ?? 'center',
      fontSize,
      typography: {
        ...DEFAULT_TOPIC_TYPOGRAPHY,
        ...(inherited.typography ?? {}),
        fontSize,
        fontFamily,
        textEffect,
        effectColor,
      },
      ...(inherited.padding ? { padding: inherited.padding } : {}),
      topicConfig: {
        shape,
        shadow: inherited.shadow ?? 'md',
        doubleBorder: inherited.doubleBorder ?? shape === 'cloud',
        textStyle,
        defaultEdgeStyle: inherited.defaultEdgeStyle ?? {
          edgeType: 'default',
          color,
          lineStyle: 'solid',
        },
      },
    },
  };
}

/** Converte o estilo herdado para um novo Texto Livre */
export function buildInheritedTextStyle(
  inherited: InheritedVisualStyle | null
): Partial<
  Pick<
    CanvasNodePosition,
    | 'color'
    | 'bgColor'
    | 'bgOpacity'
    | 'borderStyle'
    | 'borderWidth'
    | 'sketch'
    | 'textColor'
    | 'textAlign'
    | 'fontSize'
    | 'typography'
    | 'padding'
  >
> | undefined {
  if (!inherited) return undefined;

  const fontSize =
    inherited.typography?.fontSize ??
    inherited.titleStyle?.fontSize ??
    DEFAULT_TEXT_TYPOGRAPHY.fontSize;
  const fontFamily =
    inherited.typography?.fontFamily ??
    inherited.titleStyle?.fontFamily ??
    DEFAULT_TEXT_TYPOGRAPHY.fontFamily;
  const textEffect =
    inherited.typography?.textEffect ??
    inherited.titleStyle?.textEffect ??
    DEFAULT_TEXT_TYPOGRAPHY.textEffect;
  const effectColor =
    inherited.typography?.effectColor ??
    inherited.titleStyle?.effectColor ??
    DEFAULT_TEXT_TYPOGRAPHY.effectColor;

  return {
    ...(inherited.accentHex ? { color: inherited.accentHex } : {}),
    ...(inherited.sourceType === 'text' && inherited.bgColor
      ? { bgColor: inherited.bgColor }
      : inherited.accentHex
      ? { bgColor: inherited.accentHex }
      : {}),
    ...(inherited.sourceType === 'text' && inherited.bgOpacity
      ? { bgOpacity: inherited.bgOpacity }
      : {}),
    ...(inherited.sourceType === 'text' && inherited.borderStyle
      ? { borderStyle: inherited.borderStyle }
      : {}),
    ...(inherited.sourceType === 'text' && inherited.borderWidth
      ? { borderWidth: inherited.borderWidth }
      : {}),
    ...(inherited.sketch !== undefined ? { sketch: inherited.sketch } : {}),
    ...(inherited.textColor ? { textColor: inherited.textColor } : {}),
    ...(inherited.textAlign ? { textAlign: inherited.textAlign } : {}),
    fontSize,
    typography: {
      ...DEFAULT_TEXT_TYPOGRAPHY,
      ...(inherited.typography ?? {}),
      fontSize,
      fontFamily,
      textEffect,
      effectColor,
    },
    ...(inherited.padding ? { padding: inherited.padding } : {}),
  };
}