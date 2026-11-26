'use client';

import React, { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import { ArrowUpRight, Layers } from 'lucide-react';
import { useKnowledgeStore } from '@/domains/knowledge/store/useKnowledgeStore';
import { useUiStore } from '@/domains/ui/store/useUiStore';
import { PanoramaSectionFrame } from '../utils/panoramaLayout';

interface PanoramaSectionNodeData {
  section: PanoramaSectionFrame;
}

export const PanoramaSectionNode = memo(function PanoramaSectionNode({
  data,
}: NodeProps & { data: PanoramaSectionNodeData }) {
  const selectHierarchy = useKnowledgeStore((s) => s.selectHierarchy);
  const { theme, clearTransientCanvasUi } = useUiStore();
  const { section } = data;

  const isPaper = theme === 'paper';

  return (
    <div
      className={`pointer-events-none flex h-full w-full flex-col rounded-3xl border transition-colors ${
        isPaper
          ? 'border-stone-300/90 bg-white/45 shadow-sm'
          : 'border-zinc-800/80 bg-[#141720]/45 shadow-2xl shadow-black/20'
      }`}
    >
      <div
        className={`pointer-events-auto flex items-center justify-between gap-3 rounded-t-3xl border-b px-5 py-3 ${
          isPaper
            ? 'border-stone-200/90 bg-stone-100/75'
            : 'border-zinc-800/75 bg-[#161A23]/80'
        }`}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400">
            <Layers className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            {section.subtitle && (
              <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                {section.subtitle}
              </p>
            )}
            <h4
              className={`truncate text-sm font-semibold tracking-tight ${
                isPaper ? 'text-zinc-800' : 'text-zinc-100'
              }`}
            >
              {section.title}
            </h4>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
              isPaper ? 'bg-stone-200/80 text-stone-600' : 'bg-zinc-800/90 text-zinc-400'
            }`}
          >
            {section.itemCount} {section.itemCount === 1 ? 'item' : 'itens'}
          </span>
        </div>

        {section.hierarchyId && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              clearTransientCanvasUi();
              selectHierarchy(section.hierarchyId);
            }}
            className="nodrag nopan flex shrink-0 items-center gap-1 rounded-xl border border-indigo-500/35 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold text-indigo-400 transition hover:bg-indigo-600 hover:text-white"
            title={`Abrir apenas o mapa de "${section.title}"`}
          >
            Abrir mapa <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
});