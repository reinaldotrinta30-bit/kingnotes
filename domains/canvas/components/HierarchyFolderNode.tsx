'use client';

import React, { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import { ArrowUpRight, FolderOpen, Layers } from 'lucide-react';
import { useUiStore } from '@/domains/ui/store/useUiStore';
import { HierarchyAvatar } from '@/domains/hierarchy/components/HierarchyAvatar';
import { ExplorerFolderItem } from '../utils/canvasExplorerLayout';
import { hexToRgbaString } from '../utils/contrast';

interface HierarchyFolderNodeData {
  folder: ExplorerFolderItem;
  onOpenHierarchy: (hierarchyId: string | null) => void;
  onOpenDirectMap: () => void;
}

export const HierarchyFolderNode = memo(function HierarchyFolderNode({
  data,
}: NodeProps & { data: HierarchyFolderNodeData }) {
  const theme = useUiStore((s) => s.theme);
  const { folder, onOpenHierarchy, onOpenDirectMap } = data;
  const isPaper = theme === 'paper';

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (folder.isGeneralFallback || !folder.node) {
      onOpenDirectMap();
      return;
    }
    onOpenHierarchy(folder.node.id);
  };

  return (
    <div
      onDoubleClick={handleOpen}
      className="nodrag nopan group relative flex h-full w-full cursor-pointer select-none flex-col pt-3.5 transition-transform duration-200 hover:-translate-y-1"
      title={`Duplo clique para abrir "${folder.title}"`}
    >
      {/* Aba superior estilo Pasta */}
      <div
        style={{
          backgroundColor: hexToRgbaString(folder.accentColor, isPaper ? 0.24 : 0.28),
          borderColor: hexToRgbaString(folder.accentColor, 0.5),
        }}
        className="ml-4 h-4 w-28 rounded-t-xl border border-b-0 transition-colors group-hover:brightness-110"
      />

      {/* Corpo principal da Pasta */}
      <div
        style={{
          borderColor: hexToRgbaString(folder.accentColor, isPaper ? 0.38 : 0.42),
        }}
        className={`relative flex flex-1 flex-col justify-between overflow-hidden rounded-2xl rounded-tl-xl border p-4 shadow-xl backdrop-blur-md transition-all duration-200 ${
          isPaper
            ? 'bg-white/95 hover:shadow-2xl'
            : 'bg-[#161A23]/95 hover:bg-[#1A1F2B] hover:shadow-2xl hover:shadow-black/40'
        }`}
      >
        {/* Faixa de brilho sutil no topo */}
        <div
          style={{
            background: `linear-gradient(90deg, ${folder.accentColor}, transparent)`,
          }}
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px] opacity-75"
        />

        {/* Cabeçalho: Avatar/Capa + Nome + Badge de revisão */}
        <div className="flex items-start gap-3">
          {folder.node ? (
            <HierarchyAvatar
              node={folder.node}
              depth={0}
              inheritedColor={folder.accentColor}
              size="lg"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800/80 text-zinc-300">
              <Layers className="h-6 w-6" />
            </div>
          )}

          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-start justify-between gap-2">
              <h3
                className={`line-clamp-2 text-[14.5px] font-bold leading-snug tracking-tight ${
                  isPaper ? 'text-zinc-900' : 'text-zinc-100'
                }`}
              >
                {folder.title}
              </h3>

              {folder.dueCount > 0 && (
                <span
                  title={`${folder.dueCount} cards para revisar`}
                  className="shrink-0 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-zinc-950 shadow-sm"
                >
                  {folder.dueCount}
                </span>
              )}
            </div>

            <p className="mt-1 text-[11px] font-medium text-zinc-400">
              {folder.childCount > 0
                ? `${folder.childCount} ${folder.childLabel} • ${folder.itemCount} ${
                    folder.itemCount === 1 ? 'item' : 'itens'
                  }`
                : `${folder.itemCount} ${folder.itemCount === 1 ? 'item' : 'itens'}`}
            </p>
          </div>
        </div>

        {/* Prévia compacta dos Assuntos internos */}
        <div className="my-2.5 flex flex-wrap gap-1.5">
          {folder.childPreviews.length > 0 ? (
            <>
              {folder.childPreviews.map((sub, i) => (
                <span
                  key={sub.id}
                  className={`max-w-[126px] truncate rounded-lg border px-2 py-0.5 text-[10.5px] font-medium ${
                    isPaper
                      ? 'border-stone-200 bg-stone-100 text-stone-700'
                      : 'border-zinc-800 bg-[#0F1115]/90 text-zinc-300'
                  }`}
                >
                  <span style={{ color: folder.accentColor }} className="mr-1 font-mono text-[9.5px]">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {sub.title}
                </span>
              ))}
              {folder.childCount > folder.childPreviews.length && (
                <span className="rounded-lg bg-zinc-800/70 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                  +{folder.childCount - folder.childPreviews.length}
                </span>
              )}
            </>
          ) : (
            <span className="text-[11px] italic text-zinc-500">
              {folder.isGeneralFallback
                ? 'Itens fora de disciplinas'
                : 'Duplo clique para abrir o mapa'}
            </span>
          )}
        </div>

        {/* Rodapé com ação direta */}
        <div
          className={`flex items-center justify-between border-t pt-2 ${
            isPaper ? 'border-stone-200/80' : 'border-zinc-800/80'
          }`}
        >
          <span className="flex items-center gap-1.5 text-[10.5px] text-zinc-500">
            <FolderOpen className="h-3.5 w-3.5" style={{ color: folder.accentColor }} />
            Duplo clique para entrar
          </span>

          <button
            type="button"
            onClick={handleOpen}
            className="flex items-center gap-1 rounded-lg border border-indigo-500/35 bg-indigo-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-indigo-300 transition hover:bg-indigo-600 hover:text-white"
          >
            Abrir <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
});