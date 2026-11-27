'use client';

import React, { memo, useEffect, useId, useRef, useState } from 'react';
import { Handle, Position, NodeProps, NodeResizer, useUpdateNodeInternals } from '@xyflow/react';
import { Plus } from 'lucide-react';
import { CanvasNodePosition, TopicShape } from '@/domains/knowledge/types';
import { DEFAULT_TOPIC_TYPOGRAPHY, resolveTypography } from '@/domains/knowledge/utils/defaults';
import { useKnowledgeStore } from '@/domains/knowledge/store/useKnowledgeStore';
import { useUiStore } from '@/domains/ui/store/useUiStore';
import { hexToRgbaString } from '../utils/contrast';
import { getFontFamilyCss, getTextEffectClass } from '../utils/studyFonts';

const HANDLES = [
  { pos: Position.Top, id: 'top' },
  { pos: Position.Right, id: 'right' },
  { pos: Position.Bottom, id: 'bottom' },
  { pos: Position.Left, id: 'left' },
];

const BORDER_WIDTH_PX: Record<NonNullable<CanvasNodePosition['borderWidth']>, number> = {
  thin: 1.5,
  medium: 2.5,
  thick: 4,
};

const PADDING_CLASS: Record<NonNullable<CanvasNodePosition['padding']>, string> = {
  none: 'px-2 py-1',
  sm: 'px-3.5 py-2',
  md: 'px-5 py-3',
  lg: 'px-7 py-4',
};

const SHADOW_CLASS: Record<
  NonNullable<NonNullable<CanvasNodePosition['topicConfig']>['shadow']>,
  string
> = {
  none: '',
  sm: 'drop-shadow-sm',
  md: 'drop-shadow-[0_10px_20px_rgba(0,0,0,0.32)]',
  glow: 'drop-shadow-[0_0_20px_rgba(99,102,241,0.42)]',
};

const CLOUD_PATH =
  'M 28,64 C 10,60 12,30 36,28 C 42,8 78,4 94,20 C 110,4 150,8 158,28 C 186,28 192,58 174,66 C 192,82 178,108 150,104 C 138,118 106,118 96,104 C 84,118 52,118 42,102 C 14,104 6,80 28,64 Z';

const SPEECH_PATH =
  'M 24,6 L 176,6 Q 194,6 194,24 L 194,74 Q 194,92 176,92 L 66,92 L 36,115 L 48,92 L 24,92 Q 6,92 6,74 L 6,24 Q 6,6 24,6 Z';

interface CanvasTopicNodeData {
  node: CanvasNodePosition;
  onQuickSubtopic?: (parentId: string) => void;
}

export const CanvasTopicNode = memo(function CanvasTopicNode({
  id,
  data,
  selected,
}: NodeProps & { data: CanvasTopicNodeData }) {
  const updateNodeInternals = useUpdateNodeInternals();
  const persistNodePositions = useKnowledgeStore((s) => s.persistNodePositions);
  const updateCanvasNode = useKnowledgeStore((s) => s.updateCanvasNode);
  const { theme, editingTopicNodeId, setEditingTopicNodeId } = useUiStore();

  const uid = useId().replace(/:/g, '');
  const sketchFilterId = `kc-tsk-${uid}`;

  const { node, onQuickSubtopic } = data;
  const isEditing = editingTopicNodeId === id;

  const [draft, setDraft] = useState(node.label ?? 'Novo Tópico');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isEditing) {
      setDraft(node.label ?? '');
    }
  }, [node.label, isEditing]);

  useEffect(() => {
    if (isEditing) {
      const t = setTimeout(() => {
        textareaRef.current?.focus();
        textareaRef.current?.select();
      }, 20);
      return () => clearTimeout(t);
    }
  }, [isEditing]);

  const shape: TopicShape = node.topicConfig?.shape ?? 'rounded';
  const shadow = node.topicConfig?.shadow ?? 'md';
  const icon = node.topicConfig?.icon;
  const isSketch = Boolean(node.sketch);
  const hasDoubleBorder = Boolean(node.topicConfig?.doubleBorder);
  const typo = resolveTypography(node.typography, DEFAULT_TOPIC_TYPOGRAPHY, node.fontSize);

  useEffect(() => {
    const t = setTimeout(() => updateNodeInternals(id), 35);
    return () => clearTimeout(t);
  }, [id, shape, node.width, node.height, typo.fontSize, isSketch, hasDoubleBorder, updateNodeInternals]);

  const bgOpacity = node.bgOpacity ?? 'tinted';
  const accentHex = node.bgColor ?? node.color ?? '#6366f1';
  const strokeHex = node.color ?? '#6366f1';
  const borderStyle = node.borderStyle ?? 'solid';
  const strokeWidth = borderStyle === 'none' ? 0 : BORDER_WIDTH_PX[node.borderWidth ?? 'medium'];
  const strokeDash =
    borderStyle === 'dashed' ? '7 5' : borderStyle === 'dotted' ? '2 4' : undefined;

  const fillStyle =
    bgOpacity === 'transparent'
      ? 'transparent'
      : bgOpacity === 'solid'
      ? accentHex
      : bgOpacity === 'tinted'
      ? hexToRgbaString(accentHex, theme === 'paper' ? 0.2 : 0.22)
      : hexToRgbaString(accentHex, theme === 'paper' ? 0.1 : 0.1);

  const defaultTextColor =
    bgOpacity === 'solid' ? '#ffffff' : theme === 'paper' ? '#18181b' : '#f4f4f5';
  const textColor = node.textColor || defaultTextColor;

  const isAspectLocked = shape === 'square' || shape === 'circle';
  const isCustomSvgShape =
    shape === 'diamond' ||
    shape === 'hexagon' ||
    shape === 'cloud' ||
    shape === 'banner' ||
    shape === 'speech' ||
    shape === 'sticky-tape';

  const useSvgSurface = isCustomSvgShape || isSketch || hasDoubleBorder;

  const textAlign = node.textAlign ?? 'center';
  const alignClass =
    textAlign === 'left'
      ? 'text-left items-start'
      : textAlign === 'right'
      ? 'text-right items-end'
      : 'text-center items-center';

  const cssShapeRadius: Partial<Record<TopicShape, string>> = {
    rect: 'rounded-none',
    rounded: 'rounded-2xl',
    square: 'rounded-xl',
    circle: 'rounded-full',
    ellipse: 'rounded-[50%]',
    capsule: 'rounded-full',
  };

  const commitLabel = () => {
    const clean = draft.trim() || 'Tópico';
    if (clean !== (node.label ?? '')) {
      updateCanvasNode(id, { label: clean });
    }
    setEditingTopicNodeId(null);
  };

  const renderSvgShapeLayer = () => {
    const effectiveStroke = borderStyle === 'none' ? 'transparent' : strokeHex;
    const filterAttr = isSketch ? `url(#${sketchFilterId})` : undefined;

    const filterDefs = isSketch ? (
      <defs>
        <filter id={sketchFilterId} x="-6%" y="-6%" width="112%" height="112%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.032"
            numOctaves="2"
            seed="7"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="2.2"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    ) : null;

    if (shape === 'cloud') {
      return (
        <svg
          viewBox="0 0 200 120"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        >
          {filterDefs}
          <g filter={filterAttr}>
            <path
              d={CLOUD_PATH}
              fill={fillStyle}
              stroke={effectiveStroke}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDash}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
            {hasDoubleBorder && borderStyle !== 'none' && (
              <g transform="translate(100, 60) scale(0.91, 0.87) translate(-100, -60)">
                <path
                  d={CLOUD_PATH}
                  fill="none"
                  stroke={effectiveStroke}
                  strokeWidth={1.3}
                  strokeOpacity={0.68}
                  strokeDasharray="5 4"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            )}
          </g>
          {selected && (
            <path
              d={CLOUD_PATH}
              fill="none"
              stroke="#818cf8"
              strokeWidth={1.8}
              strokeDasharray="4 3"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
      );
    }

    if (shape === 'banner') {
      const tailFill =
        bgOpacity === 'transparent'
          ? 'transparent'
          : hexToRgbaString(accentHex, bgOpacity === 'solid' ? 0.72 : 0.14);
      const foldFill =
        bgOpacity === 'transparent' ? 'transparent' : hexToRgbaString(accentHex, 0.45);

      return (
        <svg
          viewBox="0 0 200 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        >
          {filterDefs}
          <g filter={filterAttr}>
            <path
              d="M 28,28 L 4,28 L 15,55 L 4,84 L 36,84 L 36,74"
              fill={tailFill}
              stroke={effectiveStroke}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDash}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
            <path
              d="M 172,28 L 196,28 L 185,55 L 196,84 L 164,84 L 164,74"
              fill={tailFill}
              stroke={effectiveStroke}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDash}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
            <polygon points="24,74 36,74 36,84" fill={foldFill} />
            <polygon points="176,74 164,74 164,84" fill={foldFill} />
            <rect
              x="24"
              y="12"
              width="152"
              height="62"
              rx="6"
              fill={fillStyle}
              stroke={effectiveStroke}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDash}
              vectorEffect="non-scaling-stroke"
            />
            {hasDoubleBorder && borderStyle !== 'none' && (
              <rect
                x="29"
                y="17"
                width="142"
                height="52"
                rx="4"
                fill="none"
                stroke={effectiveStroke}
                strokeWidth={1.2}
                strokeOpacity={0.65}
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </g>
          {selected && (
            <rect
              x="22"
              y="10"
              width="156"
              height="66"
              rx="7"
              fill="none"
              stroke="#818cf8"
              strokeWidth={1.8}
              strokeDasharray="4 3"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
      );
    }

    if (shape === 'speech') {
      return (
        <svg
          viewBox="0 0 200 120"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        >
          {filterDefs}
          <g filter={filterAttr}>
            <path
              d={SPEECH_PATH}
              fill={fillStyle}
              stroke={effectiveStroke}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDash}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
            {hasDoubleBorder && borderStyle !== 'none' && (
              <rect
                x="12"
                y="12"
                width="176"
                height="74"
                rx="13"
                fill="none"
                stroke={effectiveStroke}
                strokeWidth={1.2}
                strokeOpacity={0.62}
                strokeDasharray="5 4"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </g>
          {selected && (
            <path
              d={SPEECH_PATH}
              fill="none"
              stroke="#818cf8"
              strokeWidth={1.8}
              strokeDasharray="4 3"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
      );
    }

    if (shape === 'sticky-tape') {
      const foldFill =
        bgOpacity === 'transparent' ? 'transparent' : hexToRgbaString(accentHex, 0.38);
      const tapeFill =
        theme === 'paper'
          ? hexToRgbaString(strokeHex, 0.28)
          : hexToRgbaString('#f8fafc', 0.22);

      return (
        <svg
          viewBox="0 0 200 120"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        >
          {filterDefs}
          <g filter={filterAttr}>
            <path
              d="M 6,14 L 194,14 L 194,100 L 176,116 L 6,116 Z"
              fill={fillStyle}
              stroke={effectiveStroke}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDash}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
            <polygon
              points="176,116 176,100 194,100"
              fill={foldFill}
              stroke={effectiveStroke}
              strokeWidth={Math.max(1, strokeWidth - 0.5)}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
            {hasDoubleBorder && borderStyle !== 'none' && (
              <rect
                x="12"
                y="21"
                width="176"
                height="88"
                fill="none"
                stroke={effectiveStroke}
                strokeWidth={1.2}
                strokeOpacity={0.55}
                strokeDasharray="5 4"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </g>
          <rect
            x="66"
            y="2"
            width="68"
            height="19"
            rx="2"
            transform="rotate(-2.2 100 11)"
            fill={tapeFill}
            stroke={hexToRgbaString(strokeHex, 0.4)}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          {selected && (
            <rect
              x="4"
              y="12"
              width="192"
              height="106"
              fill="none"
              stroke="#818cf8"
              strokeWidth={1.8}
              strokeDasharray="4 3"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
      );
    }

    if (shape === 'diamond' || shape === 'hexagon') {
      const pts = shape === 'diamond' ? '50,2 98,50 50,98 2,50' : '20,2 80,2 98,50 80,98 20,98 2,50';
      const innerPts =
        shape === 'diamond' ? '50,10 90,50 50,90 10,50' : '24,9 76,9 91,50 76,91 24,91 9,50';

      return (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        >
          {filterDefs}
          <g filter={filterAttr}>
            <polygon
              points={pts}
              fill={fillStyle}
              stroke={effectiveStroke}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDash}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
            {hasDoubleBorder && borderStyle !== 'none' && (
              <polygon
                points={innerPts}
                fill="none"
                stroke={effectiveStroke}
                strokeWidth={1.2}
                strokeOpacity={0.65}
                strokeDasharray="4 3"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </g>
          {selected && (
            <polygon
              points={pts}
              fill="none"
              stroke="#818cf8"
              strokeWidth={1.8}
              vectorEffect="non-scaling-stroke"
              strokeDasharray="4 3"
            />
          )}
        </svg>
      );
    }

    if (shape === 'circle' || shape === 'ellipse') {
      return (
        <svg
          viewBox="0 0 200 120"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        >
          {filterDefs}
          <g filter={filterAttr}>
            <ellipse
              cx="100"
              cy="60"
              rx="96"
              ry="56"
              fill={fillStyle}
              stroke={effectiveStroke}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDash}
              vectorEffect="non-scaling-stroke"
            />
            {hasDoubleBorder && borderStyle !== 'none' && (
              <ellipse
                cx="100"
                cy="60"
                rx="89"
                ry="49"
                fill="none"
                stroke={effectiveStroke}
                strokeWidth={1.2}
                strokeOpacity={0.65}
                strokeDasharray="5 4"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </g>
          {selected && (
            <ellipse
              cx="100"
              cy="60"
              rx="97"
              ry="57"
              fill="none"
              stroke="#818cf8"
              strokeWidth={1.8}
              strokeDasharray="4 3"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
      );
    }

    const rx =
      shape === 'rect' ? 0 : shape === 'capsule' ? 56 : shape === 'square' ? 14 : 20;

    return (
      <svg
        viewBox="0 0 200 120"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      >
        {filterDefs}
        <g filter={filterAttr}>
          <rect
            x="4"
            y="4"
            width="192"
            height="112"
            rx={rx}
            fill={fillStyle}
            stroke={effectiveStroke}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDash}
            vectorEffect="non-scaling-stroke"
          />
          {hasDoubleBorder && borderStyle !== 'none' && (
            <rect
              x="10"
              y="10"
              width="180"
              height="100"
              rx={Math.max(0, rx - 5)}
              fill="none"
              stroke={effectiveStroke}
              strokeWidth={1.2}
              strokeOpacity={0.65}
              strokeDasharray="5 4"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </g>
        {selected && (
          <rect
            x="2"
            y="2"
            width="196"
            height="116"
            rx={rx}
            fill="none"
            stroke="#818cf8"
            strokeWidth={1.8}
            strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
    );
  };

  const contentBoxClass =
    shape === 'diamond'
      ? 'max-w-[64%] px-2 py-2'
      : shape === 'hexagon'
      ? 'max-w-[72%] px-2 py-2'
      : shape === 'cloud'
      ? 'max-w-[72%] px-3 py-3'
      : shape === 'banner'
      ? 'max-w-[72%] px-2 pb-3 pt-1'
      : shape === 'speech'
      ? 'max-w-[84%] px-3 pb-5 pt-2'
      : shape === 'sticky-tape'
      ? 'max-w-[88%] px-4 pb-3 pt-6'
      : shape === 'circle' || shape === 'ellipse'
      ? 'max-w-[82%] px-3 py-2'
      : PADDING_CLASS[node.padding ?? 'sm'];

  return (
    <div
      onDoubleClick={(e) => {
        e.stopPropagation();
        setDraft(node.label ?? '');
        setEditingTopicNodeId(id);
      }}
      className={`group relative flex h-full w-full items-center justify-center ${SHADOW_CLASS[shadow]} transition-transform`}
    >
      <NodeResizer
        isVisible={selected || isEditing}
        keepAspectRatio={isAspectLocked}
        minWidth={shape === 'cloud' ? 170 : shape === 'diamond' ? 130 : 100}
        minHeight={shape === 'cloud' ? 105 : shape === 'diamond' ? 96 : 44}
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
            },
          ]);
        }}
      />

      {!isEditing &&
        HANDLES.map((h) => (
          <React.Fragment key={h.id}>
            <Handle
              type="target"
              position={h.pos}
              id={`t-${h.id}`}
              className={`!z-50 !h-3 !w-3 !border-2 !border-[#161920] !bg-indigo-400 transition-opacity ${
                selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
            />
            <Handle
              type="source"
              position={h.pos}
              id={`s-${h.id}`}
              className={`!z-50 !h-3 !w-3 !border-2 !border-[#161920] !bg-indigo-400 transition-opacity ${
                selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
            />
          </React.Fragment>
        ))}

      {!isEditing && onQuickSubtopic && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onQuickSubtopic(id);
          }}
          className={`nodrag nopan absolute -right-3 top-1/2 z-50 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-indigo-400/80 bg-[#161920] text-indigo-300 shadow-lg transition hover:scale-110 hover:bg-indigo-600 hover:text-white ${
            selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          title="Criar subtópico conectado (ou aperte Tab)"
          aria-label="Criar subtópico conectado"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      )}

      {useSvgSurface ? (
        renderSvgShapeLayer()
      ) : (
        <div
          style={{
            backgroundColor: fillStyle,
            borderWidth: strokeWidth,
            borderStyle: borderStyle === 'none' ? 'solid' : borderStyle,
            borderColor: borderStyle === 'none' ? 'transparent' : strokeHex,
          }}
          className={`pointer-events-none absolute inset-0 ${cssShapeRadius[shape] ?? 'rounded-2xl'} ${
            bgOpacity !== 'transparent' ? 'backdrop-blur-md' : ''
          } ${selected ? 'ring-2 ring-indigo-400/90 ring-offset-1 ring-offset-transparent' : ''}`}
        />
      )}

      <div
        style={{
          color: textColor,
          fontSize: `${typo.fontSize}px`,
          lineHeight: typo.lineHeight,
          fontFamily: getFontFamilyCss(typo.fontFamily),
          ['--kc-fx-color' as string]: typo.effectColor,
          ['--kc-fx-start' as string]: textColor,
        }}
        className={`relative z-10 flex w-full flex-col justify-center ${alignClass} ${contentBoxClass}`}
      >
        {isEditing ? (
          <textarea
            ref={textareaRef}
            rows={2}
            value={draft}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                commitLabel();
              }
              if (e.key === 'Escape') {
                setEditingTopicNodeId(null);
              }
            }}
            style={{
              textAlign,
              color: textColor,
              fontSize: `${typo.fontSize}px`,
              lineHeight: typo.lineHeight,
              fontFamily: getFontFamilyCss(typo.fontFamily),
            }}
            className="nodrag nowheel w-full resize-none bg-transparent font-semibold focus:outline-none"
          />
        ) : (
          <div className="flex max-w-full items-center justify-center gap-1.5 font-semibold tracking-tight">
            {icon && <span className="shrink-0 text-[1.05em] leading-none">{icon}</span>}
            <span className={`whitespace-pre-wrap break-words ${getTextEffectClass(typo.textEffect)}`}>
              {node.label || 'Duplo clique...'}
            </span>
          </div>
        )}

        {shape === 'diamond' && !isEditing && (
          <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-widest opacity-55">
            Decisão
          </span>
        )}
      </div>
    </div>
  );
});