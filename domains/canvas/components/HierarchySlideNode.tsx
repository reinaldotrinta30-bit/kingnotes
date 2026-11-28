'use client';

import React, { memo, useEffect, useState } from 'react';
import { NodeProps } from '@xyflow/react';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  FolderOpen,
  Layers,
  GitBranch,
} from 'lucide-react';
import { useUiStore } from '@/domains/ui/store/useUiStore';
import { HierarchyAvatar } from '@/domains/hierarchy/components/HierarchyAvatar';
import { ExplorerSlideCardItem } from '../utils/canvasExplorerLayout';
import { MiniMapSvgPreview } from './MiniMapSvgPreview';
import { hexToRgbaString } from '../utils/contrast';

interface HierarchySlideNodeData {
  card: ExplorerSlideCardItem;
  onOpenHierarchy: (hierarchyId: string | null) => void;
  onOpenDirectMap: () => void;
}

export const HierarchySlideNode = memo(function HierarchySlideNode({
  data,
}: NodeProps & { data: HierarchySlideNodeData }) {
  const theme = useUiStore((s) => s.theme);
  const { card, onOpenHierarchy, onOpenDirectMap } = data;
  const isPaper = theme === 'paper';

  const [slideIndex, setSlideIndex] = useState(0);
  const totalSlides = card.slides.length;

  useEffect(() => {
    if (slideIndex >= totalSlides) setSlideIndex(0);
  }, [slideIndex, totalSlides]);

  const activeSlide = card.slides[slideIndex] ?? card.slides[0];
  const hasMultipleSlides = totalSlides > 1;

  const handlePrevSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSlideIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  };

  const handleNextSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSlideIndex((prev) => (prev + 1) % totalSlides);
  };

  const handleOpenGroup = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (card.isDirectParentSlice || !card.node) {
      onOpenDirectMap();
      return;
    }
    onOpenHierarchy(card.node.id);
  };

  const handleExpandActiveSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeSlide || activeSlide.isDirectMap || !activeSlide.hierarchyId) {
      onOpenDirectMap();
      return;
    }
    onOpenHierarchy(activeSlide.hierarchyId);
  };

  return (
    <div
      style={{
        borderColor: hexToRgbaString(card.accentColor, isPaper ? 0.36 : 0.42),
      }}
      className={`nodrag nopan group flex h-full w-full select-none flex-col overflow-hidden rounded-2xl border shadow-xl backdrop-blur-md transition-all duration-200 ${
        isPaper
          ? 'bg-white/95 hover:shadow-2xl'
          : 'bg-[#161A23]/95 hover:shadow-2xl hover:shadow-black/45'
      }`}
    >
      {/* CABEÇALHO DO AGRUPAMENTO (ASSUNTO / SUBASSUNTO) */}
      <div
        onDoubleClick={handleOpenGroup}
        className={`flex cursor-pointer items-center justify-between gap-2.5 border-b px-3.5 py-2.5 ${
          isPaper
            ? 'border-stone-200/90 bg-stone-50/90'
            : 'border-zinc-800/80 bg-[#12151C]/90'
        }`}
        title={
          card.subChildCount > 0
            ? `Duplo clique para entrar em "${card.title}" e ver todos os seus subníveis`
            : `Duplo clique para abrir o mapa completo de "${card.title}"`
        }
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {card.node ? (
            <HierarchyAvatar
              node={card.node}
              depth={card.depth}
              indexInLevel={card.indexInLevel}
              inheritedColor={card.accentColor}
              size="sm"
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800/80 text-zinc-300">
              <Layers className="h-3.5 w-3.5" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h4
              className={`truncate text-[13px] font-bold tracking-tight ${
                isPaper ? 'text-zinc-900' : 'text-zinc-100'
              }`}
            >
              {card.title}
            </h4>
            <p className="truncate text-[10.5px] text-zinc-400">
              {card.subChildCount > 0
                ? `${card.subChildCount} ${card.subChildCount === 1 ? 'subnível' : 'subníveis'} • ${
                    card.itemCount
                  } ${card.itemCount === 1 ? 'item' : 'itens'}`
                : `${card.levelLabel} • ${card.itemCount} ${
                    card.itemCount === 1 ? 'item' : 'itens'
                  }`}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {card.dueCount > 0 && (
            <span
              title={`${card.dueCount} cards para revisar`}
              className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-zinc-950"
            >
              {card.dueCount}
            </span>
          )}

          {card.subChildCount > 0 && (
            <button
              type="button"
              onClick={handleOpenGroup}
              className="flex items-center gap-1 rounded-lg border border-zinc-700/80 bg-[#0F1115]/90 px-2 py-1 text-[10.5px] font-medium text-zinc-300 transition hover:border-indigo-500/60 hover:text-white"
              title={`Entrar em "${card.title}" para ver todos os subníveis lado a lado`}
            >
              <FolderOpen className="h-3 w-3" style={{ color: card.accentColor }} />
              Abrir
            </button>
          )}
        </div>
      </div>

      {/* TELA DO MINI-SLIDE PASSÁVEL (PRÉVIA VETORIAL AO VIVO DO MAPA) */}
      <div
        onDoubleClick={handleExpandActiveSlide}
        className="relative min-h-0 flex-1 cursor-pointer overflow-hidden"
        title="Duplo clique ou clique no ícone Expandir para abrir este mapa completo"
      >
        {activeSlide && (
          <MiniMapSvgPreview
            data={activeSlide.preview}
            accentColor={card.accentColor}
            theme={theme}
          />
        )}

        {/* Botão flutuante de EXPANDIR o slide atual para tela inteira */}
        <button
          type="button"
          onClick={handleExpandActiveSlide}
          className="absolute right-2.5 top-2.5 z-20 flex items-center gap-1 rounded-xl border border-indigo-400/50 bg-[#161920]/90 px-2.5 py-1 text-[11px] font-semibold text-indigo-200 shadow-lg backdrop-blur-md transition hover:scale-105 hover:bg-indigo-600 hover:text-white"
          title={`Expandir "${activeSlide?.title ?? card.title}"`}
          aria-label="Expandir mapa do slide atual"
        >
          <Maximize2 className="h-3 w-3" />
          <span>Expandir</span>
        </button>

        {/* Contador discreto no topo esquerdo quando há múltiplos slides */}
        {hasMultipleSlides && (
          <span className="pointer-events-none absolute left-2.5 top-2.5 z-20 rounded-full border border-zinc-700/80 bg-[#161920]/85 px-2 py-0.5 font-mono text-[10px] font-semibold text-zinc-200 backdrop-blur-md">
            {slideIndex + 1} / {totalSlides}
          </span>
        )}

        {/* Setas de navegação Anterior / Próximo sobre a miniatura */}
        {hasMultipleSlides && (
          <>
            <button
              type="button"
              onClick={handlePrevSlide}
              className="absolute left-2 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-700/90 bg-[#161920]/90 text-zinc-200 shadow-lg backdrop-blur-md transition hover:scale-110 hover:border-indigo-400 hover:bg-indigo-600 hover:text-white"
              title="Slide anterior"
              aria-label="Slide anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={handleNextSlide}
              className="absolute right-2 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-700/90 bg-[#161920]/90 text-zinc-200 shadow-lg backdrop-blur-md transition hover:scale-110 hover:border-indigo-400 hover:bg-indigo-600 hover:text-white"
              title="Próximo slide"
              aria-label="Próximo slide"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* RODAPÉ DO SLIDE: NOME DO SUBASSUNTO ATUAL + PAGINAÇÃO POR PONTOS */}
      <div
        className={`flex items-center justify-between gap-2 border-t px-3.5 py-2 ${
          isPaper
            ? 'border-stone-200/90 bg-stone-50/90'
            : 'border-zinc-800/80 bg-[#12151C]/90'
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {hasMultipleSlides && (
            <GitBranch className="h-3 w-3 shrink-0" style={{ color: card.accentColor }} />
          )}
          <span
            className={`truncate text-[11.5px] font-semibold ${
              isPaper ? 'text-zinc-800' : 'text-zinc-200'
            }`}
            title={activeSlide?.title}
          >
            {activeSlide?.title}
          </span>
          {activeSlide && activeSlide.subChildCount > 0 && (
            <span className="shrink-0 rounded bg-indigo-500/15 px-1.5 py-0.5 text-[9.5px] font-semibold text-indigo-300">
              +{activeSlide.subChildCount} sub
            </span>
          )}
        </div>

        {/* Pontos de paginação clicáveis quando há múltiplos slides */}
        {hasMultipleSlides ? (
          <div className="flex shrink-0 items-center gap-1">
            {card.slides.slice(0, 7).map((sl, i) => (
              <button
                key={sl.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSlideIndex(i);
                }}
                title={sl.title}
                className={`h-1.5 rounded-full transition-all ${
                  i === slideIndex ? 'w-4 bg-indigo-400' : 'w-1.5 bg-zinc-600 hover:bg-zinc-400'
                }`}
              />
            ))}
            {card.slides.length > 7 && (
              <span className="ml-0.5 text-[9.5px] text-zinc-500">…</span>
            )}
          </div>
        ) : (
          <span className="shrink-0 text-[10.5px] text-zinc-500">
            {activeSlide?.itemCount ?? 0}{' '}
            {(activeSlide?.itemCount ?? 0) === 1 ? 'item' : 'itens'}
          </span>
        )}
      </div>
    </div>
  );
});