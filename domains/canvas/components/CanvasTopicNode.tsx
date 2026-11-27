'use client';

import React, { memo, useEffect, useRef, useState } from 'react';
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

const SHADOW_CLASS: Record<NonNullable<NonNullable<CanvasNodePosition['topicConfig']>['shadow']>, string> = {
  none: '',
  sm: 'drop-shadow-sm',
  md: 'drop-shadow-[0_10px_20px_rgba(0,0,0,0.32)]',
  glow: 'drop-shadow-[0_0_20px_rgba(99,102,241,0.42)]',
};

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
  const typo = resolveTypography(node.typography, DEFAULT_TOPIC_TYPOGRAPHY, node.fontSize);

  // Atualiza posições dos handles quando o formato ou tamanho do tópico muda
  useEffect(() => {
    const t = setTimeout(() => updateNodeInternals(id), 35);
    return () => clearTimeout(t);
  }, [id, shape, node.width, node.height, typo.fontSize, updateNodeInternals]);

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

  const isSvgPolygon = shape === 'diamond' || shape === 'hexagon';
  const isAspectLocked = shape === 'square' || shape === 'circle';
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
        minWidth={shape === 'diamond' ? 130 : 100}
        minHeight={shape === 'diamond' ? 96 : 44}
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

      {/* 4 Pontos de Conexão (no Losango ficam exatamente nos 4 vértices de Decisão) */}
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

      {/* Botão rápido "+ Subtópico" no hover/seleção */}
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

      {/* Camada de forma geométrica */}
      {isSvgPolygon ? (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        >
          {shape === 'diamond' ? (
            <polygon
              points="50,2 98,50 50,98 2,50"
              fill={fillStyle}
              stroke={borderStyle === 'none' ? 'transparent' : strokeHex}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDash}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
          ) : (
            <polygon
              points="20,2 80,2 98,50 80,98 20,98 2,50"
              fill={fillStyle}
              stroke={borderStyle === 'none' ? 'transparent' : strokeHex}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDash}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
          )}
          {selected && (
            shape === 'diamond' ? (
              <polygon
                points="50,2 98,50 50,98 2,50"
                fill="none"
                stroke="#818cf8"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                strokeDasharray="4 3"
              />
            ) : (
              <polygon
                points="20,2 80,2 98,50 80,98 20,98 2,50"
                fill="none"
                stroke="#818cf8"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                strokeDasharray="4 3"
              />
            )
          )}
        </svg>
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

      {/* Conteúdo textual (sempre centralizado e legível, com recuo seguro dentro de losango/hexágono) */}
      <div
        style={{
          color: textColor,
          fontSize: `${typo.fontSize}px`,
          lineHeight: typo.lineHeight,
          fontFamily: getFontFamilyCss(typo.fontFamily),
          ['--kc-fx-color' as string]: typo.effectColor,
          ['--kc-fx-start' as string]: textColor,
        }}
        className={`relative z-10 flex w-full flex-col justify-center ${alignClass} ${
          shape === 'diamond'
            ? 'max-w-[64%] px-2 py-2'
            : shape === 'hexagon'
            ? 'max-w-[72%] px-2 py-2'
            : shape === 'circle' || shape === 'ellipse'
            ? 'max-w-[82%] px-3 py-2'
            : PADDING_CLASS[node.padding ?? 'sm']
        }`}
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