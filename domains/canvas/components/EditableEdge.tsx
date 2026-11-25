'use client';

import React, { useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
  getSmoothStepPath,
} from '@xyflow/react';
import { Trash2, Sparkles, Minus, Tag } from 'lucide-react';
import { useKnowledgeStore } from '@/domains/knowledge/store/useKnowledgeStore';

interface EditableEdgeData {
  pathStyle?: 'smoothstep' | 'default';
  edgeStyle?: 'solid' | 'dashed' | 'animated';
  color?: string;
}

export function EditableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  label,
  selected,
  data,
}: EdgeProps) {
  const updateCanvasEdge = useKnowledgeStore((s) => s.updateCanvasEdge);
  const deleteCanvasEdge = useKnowledgeStore((s) => s.deleteCanvasEdge);

  const edgeData = (data as EditableEdgeData | undefined) ?? {};
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(typeof label === 'string' ? label : '');

  const pathParams = {
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  };

  const [edgePath, labelX, labelY] =
    edgeData.pathStyle === 'default'
      ? getBezierPath(pathParams)
      : getSmoothStepPath({ ...pathParams, borderRadius: 16 });

  const startEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(typeof label === 'string' ? label : '');
    setIsEditing(true);
  };

  const commitLabel = () => {
    setIsEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== (typeof label === 'string' ? label : '')) {
      updateCanvasEdge(id, { label: trimmed || undefined });
    }
  };

  const cycleStyle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const order: Array<'solid' | 'dashed' | 'animated'> = ['solid', 'dashed', 'animated'];
    const current = edgeData.edgeStyle ?? 'solid';
    const next = order[(order.indexOf(current) + 1) % order.length];
    updateCanvasEdge(id, { style: next });
  };

  const hasLabel = typeof label === 'string' && label.trim().length > 0;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: selected ? 2.6 : 1.85,
        }}
      />

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          {isEditing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitLabel();
                if (e.key === 'Escape') setIsEditing(false);
              }}
              placeholder="Ex: exceção, prazo 15d..."
              className="w-40 rounded-lg border border-indigo-500 bg-[#161920] px-2.5 py-1 text-center text-[11px] font-medium text-zinc-100 shadow-xl focus:outline-none"
            />
          ) : (
            <div className="flex items-center gap-1">
              {hasLabel ? (
                <button
                  type="button"
                  onDoubleClick={startEditing}
                  onClick={selected ? startEditing : undefined}
                  title="Duplo clique para editar rótulo da conexão"
                  className={`rounded-lg border px-2 py-0.5 text-[11px] font-medium shadow-md backdrop-blur-md transition ${
                    selected
                      ? 'border-indigo-500 bg-[#161920] text-indigo-200'
                      : 'border-zinc-800 bg-[#161920]/90 text-zinc-300 hover:border-indigo-500/50'
                  }`}
                >
                  {label}
                </button>
              ) : (
                selected && (
                  <button
                    type="button"
                    onClick={startEditing}
                    className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-[#161920]/95 px-2 py-0.5 text-[10.5px] font-medium text-zinc-300 shadow-lg hover:border-indigo-500 hover:text-indigo-200"
                    title="Adicionar texto na seta"
                  >
                    <Tag className="h-3 w-3 text-indigo-400" /> Rótulo
                  </button>
                )
              )}

              {/* Controles rápidos individuais quando a seta está selecionada */}
              {selected && (
                <div className="flex items-center gap-0.5 rounded-lg border border-zinc-800 bg-[#161920]/95 p-0.5 shadow-xl">
                  <button
                    type="button"
                    onClick={cycleStyle}
                    className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-indigo-300"
                    title="Alternar estilo da seta (Sólida / Tracejada / Animada)"
                  >
                    {edgeData.edgeStyle === 'animated' ? (
                      <Sparkles className="h-3 w-3 text-indigo-400" />
                    ) : (
                      <Minus className="h-3 w-3" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteCanvasEdge(id);
                    }}
                    className="rounded p-1 text-zinc-400 hover:bg-rose-500/15 hover:text-rose-400"
                    title="Remover conexão"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}