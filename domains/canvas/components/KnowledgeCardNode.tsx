'use client';

import React, { memo, useEffect, useState } from 'react';
import {
  Handle,
  Position,
  NodeProps,
  NodeResizer,
  useReactFlow,
  useUpdateNodeInternals,
} from '@xyflow/react';
import { Pin, Star, Flame, Plus, Minus, Eye, EyeOff, Maximize2 } from 'lucide-react';
import { CanvasNodePosition, KnowledgeCardMeta } from '@/domains/knowledge/types';
import { resolveCardCallout, resolveCardTitleStyle, } from '@/domains/knowledge/utils/defaults';
import { useKnowledgeStore } from '@/domains/knowledge/store/useKnowledgeStore';
import { useUiStore } from '@/domains/ui/store/useUiStore';
import { InlineCardEditor } from './InlineCardEditor';
import { CardRichPreview } from './CardRichPreview';
import { CalloutBadge } from './CalloutBadge';
import { cn } from '@/lib/utils';
import { getFontFamilyCss, getTextEffectClass } from '../utils/studyFonts';

const COLOR_ACCENT: Record<KnowledgeCardMeta['color'], string> = {
  default: 'border-zinc-800/90 bg-[#161920]/95 hover:border-zinc-600/90',
  amber: 'border-amber-500/40 bg-[#1B1813]/95 hover:border-amber-400/75',
  emerald: 'border-emerald-500/40 bg-[#121C18]/95 hover:border-emerald-400/75',
  sky: 'border-sky-500/40 bg-[#121A22]/95 hover:border-sky-400/75',
  rose: 'border-rose-500/40 bg-[#1E1418]/95 hover:border-rose-400/75',
  violet: 'border-violet-500/40 bg-[#181624]/95 hover:border-violet-400/75',
};

const PAPER_CLASS: Record<NonNullable<KnowledgeCardMeta['paperStyle']>, string> = {
  plain: '',
  lined: 'kc-paper-lined',
  grid: 'kc-paper-grid',
  dotted: 'kc-paper-dotted',
  cornell: 'kc-paper-cornell',
};

const BORDER_WIDTH_CLASS: Record<NonNullable<KnowledgeCardMeta['borderWidth']>, string> = {
  thin: 'border',
  medium: 'border-2',
  thick: 'border-[3px]',
};

const BORDER_STYLE_CLASS: Record<NonNullable<KnowledgeCardMeta['borderStyle']>, string> = {
  solid: 'border-solid',
  dashed: 'border-dashed',
  none: '!border-transparent',
};

const CARD_PADDING_CLASS: Record<NonNullable<CanvasNodePosition['padding']>, string> = {
  none: 'p-2',
  sm: 'p-2.5',
  md: 'p-3.5',
  lg: 'p-5',
};

interface CardNodeData {
  card: KnowledgeCardMeta;
  sizingMode?: 'auto' | 'custom';
  padding?: CanvasNodePosition['padding'];
  isCollapsed?: boolean;
  onOpen: (cardId: string) => void;
  onSaveViewport?: () => void;
}

const HANDLES = [
  { pos: Position.Top, id: 'top' },
  { pos: Position.Right, id: 'right' },
  { pos: Position.Bottom, id: 'bottom' },
  { pos: Position.Left, id: 'left' },
];

export const KnowledgeCardNode = memo(function KnowledgeCardNode({
  id,
  data,
  selected,
}: NodeProps & { data: CardNodeData }) {
  const { getNodes, getEdges, setNodes, setEdges, fitView } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const persistNodePositions = useKnowledgeStore((s) => s.persistNodePositions);
  const {
    theme,
    highlightedCardId,
    canvasRecallMode,
    canvasSpotlight,
    preferences,
    inlineEditingCardId,
    setInlineEditingCardId,
    isCanvasZoomedOut,
  } = useUiStore();

  const density = preferences.cardDensity;
  const isZoomedOut = isCanvasZoomedOut;

  const {
    card,
    sizingMode = 'custom',
    padding = 'md',
    onOpen,
    onSaveViewport,
    isCollapsed = false,
  } = data;

  const isAutoSize = sizingMode === 'auto';
  const isEditingInline = inlineEditingCardId === card.id;
  const isHighlighted = highlightedCardId === card.id;

  const [isRevealed, setIsRevealed] = useState(false);
  useEffect(() => {
    setIsRevealed(false);
  }, [canvasRecallMode]);

  // Mantém os pontos de conexão sincronizados quando o tamanho automático/tipografia muda
  useEffect(() => {
    const t = setTimeout(() => updateNodeInternals(id), 40);
    return () => clearTimeout(t);
  }, [
    id,
    sizingMode,
    padding,
    card.typography?.fontSize,
    card.typography?.lineHeight,
    card.typography?.paragraphSpacing,
    card.callout?.position,
    card.callout?.visible,
    isEditingInline,
    updateNodeInternals,
  ]);

  const matchesSpotlight = (() => {
    if (canvasSpotlight === 'none') return true;
    if (canvasSpotlight === 'critical') return card.importance !== 'normal';
    if (canvasSpotlight === 'pinned') return card.isPinned;
    if (canvasSpotlight === 'favorites') return card.isFavorite;
    if (canvasSpotlight === 'due') {
      return !card.nextReviewAt || card.nextReviewAt <= Date.now() + 24 * 60 * 60 * 1000;
    }
    return true;
  })();

  const isDimmedBySpotlight = canvasSpotlight !== 'none' && !matchesSpotlight && !isEditingInline;
  const isSpotlightHit = canvasSpotlight !== 'none' && matchesSpotlight;

  const edges = getEdges();
  const hasChildren = edges.some((e) => e.source === id);

  const handleToggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextCollapsed = !isCollapsed;
    const allNodes = getNodes();
    const allEdges = getEdges();

    let updatedNodes = allNodes.map((n) =>
      n.id === id ? { ...n, data: { ...n.data, isCollapsed: nextCollapsed } } : n
    );

    const hiddenSet = new Set<string>();
    const traverse = (nId: string, shouldHide: boolean) => {
      if (shouldHide) hiddenSet.add(nId);
      const target = updatedNodes.find((n) => n.id === nId);
      const collapsed = Boolean((target?.data as CardNodeData | undefined)?.isCollapsed);
      const children = allEdges.filter((edge) => edge.source === nId).map((edge) => edge.target);
      children.forEach((childId) => traverse(childId, shouldHide || collapsed));
    };

    const roots = updatedNodes.filter(
      (n) =>
        n.type !== 'canvasGroup' &&
        n.type !== 'panoramaSection' &&
        !allEdges.some((edge) => edge.target === n.id)
    );
    roots.forEach((r) => traverse(r.id, false));

    updatedNodes = updatedNodes.map((n) => ({ ...n, hidden: hiddenSet.has(n.id) }));
    const updatedEdges = allEdges.map((edge) => ({
      ...edge,
      hidden: hiddenSet.has(edge.source) || hiddenSet.has(edge.target),
    }));

    setNodes(updatedNodes);
    setEdges(updatedEdges);
    setTimeout(() => fitView({ duration: 500, padding: 0.2 }), 40);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isEditingInline) return;
    e.preventDefault();
    e.stopPropagation();
    onSaveViewport?.();

    const allNodes = getNodes();
    const allEdges = getEdges();
    const current = allNodes.find((n) => n.id === id);
    const selectedNodes = allNodes.filter(
      (n) => n.selected && n.type !== 'canvasGroup' && n.type !== 'panoramaSection'
    );

    let nodesToFit = [];
    if (current?.selected && selectedNodes.length > 1) {
      nodesToFit = selectedNodes;
    } else {
      const descendants = new Set<string>([id]);
      const queue = [id];
      while (queue.length > 0) {
        const curr = queue.shift()!;
        allEdges
          .filter((edge) => edge.source === curr)
          .forEach((edge) => {
            if (!descendants.has(edge.target)) {
              descendants.add(edge.target);
              queue.push(edge.target);
            }
          });
      }
      nodesToFit = allNodes.filter((n) => descendants.has(n.id));
    }

    fitView({ nodes: nodesToFit, duration: 600, padding: 0.15 });
  };

  const shouldMaskBody = canvasRecallMode && !isRevealed && !isEditingInline;
  const paperClass = PAPER_CLASS[card.paperStyle ?? 'plain'];
  const borderWidthClass = BORDER_WIDTH_CLASS[card.borderWidth ?? 'thin'];
  const borderStyleClass = BORDER_STYLE_CLASS[card.borderStyle ?? 'solid'];
  const paddingClass = CARD_PADDING_CLASS[padding];

  const callout = resolveCardCallout(card);
  const titleStyle = resolveCardTitleStyle(card);
  const calloutVisible = Boolean((callout.text ?? '').trim()) && callout.visible !== false;
  const calloutPos = callout.position ?? 'bottom';
  const hasFooterTags = card.tags.length > 0 || (canvasRecallMode && isRevealed);

  return (
    <div
      onContextMenu={handleContextMenu}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setInlineEditingCardId(card.id);
      }}
      className={cn(
        'group relative flex w-full flex-col justify-between rounded-2xl text-zinc-100 shadow-lg backdrop-blur-md transition-all duration-200',
        isAutoSize ? 'h-auto min-h-[72px]' : 'h-full min-h-[84px]',
        'min-w-[180px]',
        paddingClass,
        isEditingInline && 'z-50 ring-2 ring-indigo-500/90 shadow-2xl shadow-indigo-500/20',
        borderWidthClass,
        borderStyleClass,
        COLOR_ACCENT[card.color],
        paperClass,
        selected && !isEditingInline && 'ring-2 ring-indigo-500/80 shadow-indigo-500/20',
        isSpotlightHit && 'ring-2 ring-amber-400/75 shadow-[0_0_28px_rgba(245,158,11,0.22)]',
        isDimmedBySpotlight && 'opacity-20 saturate-0 hover:opacity-65',
        isHighlighted &&
          'scale-[1.03] ring-2 ring-indigo-400 shadow-[0_0_36px_rgba(99,102,241,0.55)]'
      )}
    >
      <NodeResizer
        isVisible={(selected || isEditingInline) && !isZoomedOut}
        minWidth={180}
        minHeight={72}
        lineClassName="!border-indigo-500/80"
        handleClassName="!h-2.5 !w-2.5 !rounded-sm !border-indigo-400 !bg-[#161920]"
        onResizeEnd={(_, params) => {
          persistNodePositions([
            {
              id,
              x: Math.round(params.x),
              y: Math.round(params.y),
              width: Math.round(params.width),
              height: Math.round(params.height),
              sizingMode: 'custom',
            },
          ]);
        }}
      />

      {hasChildren && !isZoomedOut && !isEditingInline && (
        <button
          type="button"
          onClick={handleToggleCollapse}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="absolute -right-2.5 -top-2.5 z-50 flex h-5 w-5 items-center justify-center rounded-full border border-indigo-400/70 bg-[#161920] text-indigo-300 shadow-md transition hover:scale-110 hover:bg-indigo-600 hover:text-white"
          title={isCollapsed ? 'Expandir ramo' : 'Recolher ramo'}
        >
          {isCollapsed ? <Plus className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
        </button>
      )}

      {HANDLES.map((h) => (
        <React.Fragment key={h.id}>
          <Handle
            type="target"
            position={h.pos}
            id={`t-${h.id}`}
            className="!z-40 !h-3 !w-3 !border-2 !border-[#161920] !bg-indigo-400 opacity-0 transition-opacity group-hover:opacity-100"
          />
          <Handle
            type="source"
            position={h.pos}
            id={`s-${h.id}`}
            className="!z-40 !h-3 !w-3 !border-2 !border-[#161920] !bg-indigo-400 opacity-0 transition-opacity group-hover:opacity-100"
          />
        </React.Fragment>
      ))}

      {card.emoji && (
        <div className="pointer-events-none absolute -left-3 -top-3.5 z-40 flex h-7 w-7 items-center justify-center rounded-xl border border-zinc-700/80 bg-[#161920] text-sm shadow-lg">
          {card.emoji}
        </div>
      )}

      {/* MODO 1: EDIÇÃO DIRETA INLINE */}
      {isEditingInline ? (
        <InlineCardEditor
          cardId={card.id}
          onFinish={() => setInlineEditingCardId(null)}
          onOpenDetails={() => {
            setInlineEditingCardId(null);
            onOpen(card.id);
          }}
        />
      ) : isZoomedOut ? (
        /* MODO 2: ZOOM MACRO (< 48%) */
        <div className="flex flex-1 flex-col items-center justify-center p-2 text-center">
          <h3 className="line-clamp-3 text-[20px] font-bold leading-snug tracking-tight text-zinc-100">
            {card.title}
          </h3>
          {card.importance === 'critical' && (
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-3 py-0.5 text-xs font-semibold text-rose-300">
              <Flame className="h-3.5 w-3.5" /> Crítico
            </span>
          )}
        </div>
      ) : (
        /* MODO 3: VISUALIZAÇÃO LIMPA E COMPACTA NO CANVAS */
        <>
          <div className={cn('flex min-h-0 flex-1 flex-col', !isAutoSize && 'overflow-hidden')}>
            {/* Cabeçalho do Card */}
            <div className="mb-1.5 flex shrink-0 items-start justify-between gap-2">
              <h3
                style={{
                  fontFamily: getFontFamilyCss(titleStyle.fontFamily),
                  fontSize: `${titleStyle.fontSize}px`,
                  color: titleStyle.color || undefined,
                  textAlign: titleStyle.textAlign,
                  fontStyle: titleStyle.italic ? 'italic' : 'normal',
                  textDecoration: titleStyle.underline ? 'underline' : 'none',
                  ['--kc-fx-color' as string]: titleStyle.effectColor,
                  ['--kc-fx-start' as string]: titleStyle.color || '#f4f4f5',
                }}
                className={cn(
                  'min-w-0 flex-1 line-clamp-2 font-bold leading-snug tracking-tight text-zinc-100',
                  getTextEffectClass(titleStyle.textEffect)
                )}
              >
                {card.title}
              </h3>
              <div className="flex shrink-0 items-center gap-1 text-zinc-400">
                {card.importance === 'critical' && (
                  <span title="Alta incidência em prova">
                    <Flame className="h-3.5 w-3.5 text-rose-400" />
                  </span>
                )}
                {card.isPinned && (
                  <span title="Card fixado">
                    <Pin className="h-3.5 w-3.5 text-indigo-400" />
                  </span>
                )}
                {card.isFavorite && (
                  <span title="Favorito">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  </span>
                )}
              </div>
            </div>

            {/* Observação no Topo ou como Etiqueta */}
            {density !== 'compact' && calloutVisible && (calloutPos === 'top' || calloutPos === 'badge') && (
              <CalloutBadge config={callout} theme={theme} className="mb-2" />
            )}

            {/* Corpo + Posições Lateral / Inline / Rodapé / Alerta */}
            {density !== 'compact' && (
              <div
                className={cn(
                  'relative flex min-h-0 flex-1 flex-col',
                  !isAutoSize && 'overflow-hidden'
                )}
              >
                <div
                  className={cn(
                    'kc-no-scrollbar min-h-0 flex-1 transition-all duration-200',
                    !isAutoSize && 'overflow-y-auto',
                    shouldMaskBody && 'pointer-events-none select-none opacity-35 blur-[7px]',
                    calloutVisible && calloutPos === 'side' && 'flex flex-col gap-2 sm:flex-row'
                  )}
                >
                  <div className="min-w-0 flex-1">
                    {calloutVisible && calloutPos === 'inline' && (
                      <CalloutBadge config={callout} theme={theme} className="mb-2" />
                    )}

                    <CardRichPreview
                      cardId={card.id}
                      updatedAt={card.updatedAt}
                      fallbackExcerpt={card.excerpt}
                      typography={card.typography}
                    />

                    {calloutVisible && (calloutPos === 'bottom' || calloutPos === 'alert-box') && (
                      <CalloutBadge config={callout} theme={theme} className="mt-2" />
                    )}
                  </div>

                  {calloutVisible && calloutPos === 'side' && (
                    <div className="w-full shrink-0 sm:w-[38%] sm:max-w-[165px]">
                      <CalloutBadge config={callout} theme={theme} />
                    </div>
                  )}
                </div>

                {shouldMaskBody && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsRevealed(true);
                    }}
                    className="nodrag absolute inset-0 flex flex-col items-center justify-center rounded-xl border border-dashed border-indigo-500/40 bg-[#0F1115]/60 text-xs font-semibold text-indigo-300 backdrop-blur-[2px] transition hover:border-indigo-400 hover:bg-indigo-500/15"
                  >
                    <Eye className="mb-1 h-4 w-4" />
                    Tente lembrar • Clique para revelar
                  </button>
                )}
              </div>
            )}
          </div>

          {/* RODAPÉ SIMPLIFICADO: sem botão textual "Editar"; apenas tags (se houver) + ícone discreto */}
          {hasFooterTags ? (
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-zinc-800/70 pt-1.5">
              <div className="flex flex-wrap gap-1 overflow-hidden">
                {card.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-zinc-800/85 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300"
                  >
                    #{tag}
                  </span>
                ))}
              </div>

              <div className="flex shrink-0 items-center gap-0.5">
                {canvasRecallMode && isRevealed && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsRevealed(false);
                    }}
                    className="nodrag nopan flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-800 hover:text-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                    title="Ocultar novamente"
                    aria-label="Ocultar conteúdo novamente"
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(card.id);
                  }}
                  className="nodrag nopan flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 opacity-60 transition hover:bg-zinc-800/90 hover:text-indigo-300 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                  title="Edição avançada (tela ampliada, anexos, flashcards e metadados)"
                  aria-label="Abrir edição avançada do card"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpen(card.id);
              }}
              className="nodrag nopan absolute bottom-2 right-2 z-20 flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 opacity-0 transition hover:bg-zinc-800/90 hover:text-indigo-300 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 group-hover:opacity-75 group-focus-within:opacity-100"
              title="Edição avançada (tela ampliada, anexos, flashcards e metadados)"
              aria-label="Abrir edição avançada do card"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}
        </>
      )}
    </div>
  );
});