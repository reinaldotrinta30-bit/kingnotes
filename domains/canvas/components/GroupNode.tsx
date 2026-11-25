'use client';

import React, { memo, useEffect, useState } from 'react';
import { NodeProps, NodeResizer } from '@xyflow/react';
import { CanvasNodePosition } from '@/domains/knowledge/types';
import { useKnowledgeStore } from '@/domains/knowledge/store/useKnowledgeStore';

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return `rgba(99, 102, 241, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const BORDER_WIDTH_PX: Record<NonNullable<CanvasNodePosition['borderWidth']>, number> = {
  thin: 1,
  medium: 2,
  thick: 4,
};

interface GroupNodeData {
  node: CanvasNodePosition;
}

export const GroupNode = memo(function GroupNode({
  id,
  data,
  selected,
}: NodeProps & { data: GroupNodeData }) {
  const renameCanvasGroup = useKnowledgeStore((s) => s.renameCanvasGroup);
  const persistNodePositions = useKnowledgeStore((s) => s.persistNodePositions);
  const { node } = data;

  const [title, setTitle] = useState(node.label ?? 'Novo Agrupamento');

  useEffect(() => {
    setTitle(node.label ?? 'Novo Agrupamento');
  }, [node.label]);

  const borderColor = node.color ?? '#6366f1';
  const fillHex = node.bgColor ?? borderColor;
  const opacityMode = node.bgOpacity ?? 'subtle';
  const bgAlpha = opacityMode === 'transparent' ? 0 : opacityMode === 'tinted' ? 0.14 : 0.05;

  const borderStyle = node.borderStyle ?? 'dashed';
  const borderWidth = borderStyle === 'none' ? 0 : BORDER_WIDTH_PX[node.borderWidth ?? 'medium'];

  return (
    <div
      style={{
        backgroundColor: bgAlpha === 0 ? 'transparent' : hexToRgba(fillHex, bgAlpha),
        borderColor: borderStyle === 'none' ? 'transparent' : hexToRgba(borderColor, selected ? 0.9 : 0.48),
        borderWidth,
        borderStyle: borderStyle === 'none' ? 'solid' : borderStyle,
      }}
      className={`h-full w-full rounded-2xl p-3.5 transition-colors ${
        selected ? 'shadow-[0_0_30px_rgba(99,102,241,0.16)]' : ''
      }`}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={260}
        minHeight={180}
        lineClassName="!border-indigo-500"
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

      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: borderColor }}
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => renameCanvasGroup(id, title)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          style={{ color: borderColor }}
          className="nodrag w-full bg-transparent text-xs font-bold uppercase tracking-wider focus:outline-none"
          placeholder="Nome da seção..."
        />
      </div>
    </div>
  );
});