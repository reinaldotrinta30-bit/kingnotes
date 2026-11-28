'use client';

import React, { memo, useEffect, useRef, useState } from 'react';
import {
  Handle,
  Position,
  NodeProps,
  NodeResizer,
  useUpdateNodeInternals,
} from '@xyflow/react';
import { Image as ImageIcon, Check, RotateCcw, ZoomIn, Plus } from 'lucide-react';
import { CanvasNodePosition } from '@/domains/knowledge/types';
import { getKnowledgeRepository } from '@/infrastructure/persistence/repositoryFactory';
import { useKnowledgeStore } from '@/domains/knowledge/store/useKnowledgeStore';
import { useUiStore } from '@/domains/ui/store/useUiStore';

const blobUrlCache = new Map<string, string>();

const HANDLES = [
  { pos: Position.Top, id: 'top' },
  { pos: Position.Right, id: 'right' },
  { pos: Position.Bottom, id: 'bottom' },
  { pos: Position.Left, id: 'left' },
];

const BORDER_WIDTH_PX: Record<NonNullable<CanvasNodePosition['borderWidth']>, number> = {
  thin: 1,
  medium: 2,
  thick: 4,
};

const RADIUS_CLASS: Record<NonNullable<CanvasNodePosition['borderRadius']>, string> = {
  none: 'rounded-none',
  md: 'rounded-lg',
  xl: 'rounded-2xl',
  full: 'rounded-full',
};

type CaptionPosition = NonNullable<CanvasNodePosition['captionPosition']>;
type CaptionSlot = 'main' | 'top';

interface CanvasImageNodeData {
  node: CanvasNodePosition;
}

export const CanvasImageNode = memo(function CanvasImageNode({
  id,
  data,
  selected,
}: NodeProps & { data: CanvasImageNodeData }) {
  const updateNodeInternals = useUpdateNodeInternals();
  const persistNodePositions = useKnowledgeStore((s) => s.persistNodePositions);
  const updateCanvasNode = useKnowledgeStore((s) => s.updateCanvasNode);
  const { croppingImageNodeId, setCroppingImageNodeId } = useUiStore();
  const { node } = data;

  const isCropping = croppingImageNodeId === id;
  const captionPosition: CaptionPosition = node.captionPosition ?? 'bottom';
  const isHorizontal = captionPosition === 'left' || captionPosition === 'right';
  const isSplitTopBottom = captionPosition === 'top-bottom';

  const [imgUrl, setImgUrl] = useState<string | null>(() =>
    node.blobId ? blobUrlCache.get(node.blobId) ?? null : null
  );
  const [editingSlot, setEditingSlot] = useState<CaptionSlot | null>(null);
  const [mainDraft, setMainDraft] = useState(node.caption ?? '');
  const [topDraft, setTopDraft] = useState(node.captionTop ?? '');

  // Estado local suave durante o arraste do corte/enquadramento
  const [liveCrop, setLiveCrop] = useState({
    zoom: node.cropZoom ?? 1,
    x: node.cropX ?? 0,
    y: node.cropY ?? 0,
  });

  const panDragRef = useRef<{
    startClientX: number;
    startClientY: number;
    originX: number;
    originY: number;
    boxW: number;
    boxH: number;
  } | null>(null);

  useEffect(() => {
    setLiveCrop({
      zoom: node.cropZoom ?? 1,
      x: node.cropX ?? 0,
      y: node.cropY ?? 0,
    });
  }, [node.cropZoom, node.cropX, node.cropY]);

  useEffect(() => {
    if (editingSlot !== 'main') setMainDraft(node.caption ?? '');
  }, [node.caption, editingSlot]);

  useEffect(() => {
    if (editingSlot !== 'top') setTopDraft(node.captionTop ?? '');
  }, [node.captionTop, editingSlot]);

  useEffect(() => {
    const t = setTimeout(() => updateNodeInternals(id), 35);
    return () => clearTimeout(t);
  }, [id, captionPosition, node.caption, node.captionTop, editingSlot, updateNodeInternals]);

  // Sai do modo corte se a imagem perder seleção
  useEffect(() => {
    if (!selected && isCropping) {
      setCroppingImageNodeId(null);
    }
  }, [selected, isCropping, setCroppingImageNodeId]);

  useEffect(() => {
    if (!node.blobId) return;
    const cached = blobUrlCache.get(node.blobId);
    if (cached) {
      setImgUrl(cached);
      return;
    }

    let active = true;
    getKnowledgeRepository()
      .getBlob(node.blobId)
      .then((blob) => {
        if (!active || !blob) return;
        const url = URL.createObjectURL(blob);
        blobUrlCache.set(node.blobId!, url);
        setImgUrl(url);
      });

    return () => {
      active = false;
    };
  }, [node.blobId]);

  const borderStyle = node.borderStyle ?? 'solid';
  const borderWidth = borderStyle === 'none' ? 0 : BORDER_WIDTH_PX[node.borderWidth ?? 'thin'];
  const borderColor = node.color ?? '#3f3f46';
  const rawRadiusClass = RADIUS_CLASS[node.borderRadius ?? 'xl'];
  const fitClass =
    node.imageFit === 'fill'
      ? 'object-fill'
      : node.imageFit === 'cover' || isCropping
      ? 'object-cover'
      : 'object-contain';

  const rotation = node.rotation ?? 0;
  const flipX = node.flipX ? -1 : 1;
  const flipY = node.flipY ? -1 : 1;
  const opacity = node.opacity ?? 1;

  const hasMainCaption = Boolean((node.caption ?? '').trim());
  const hasTopCaption = Boolean((node.captionTop ?? '').trim());

  const showTopBlock =
    !isCropping &&
    ((captionPosition === 'top' && (hasMainCaption || editingSlot === 'main')) ||
      (isSplitTopBottom && (hasTopCaption || editingSlot === 'top' || selected)));

  const showBottomBlock =
    !isCropping &&
    ((captionPosition === 'bottom' && (hasMainCaption || editingSlot === 'main')) ||
      (isSplitTopBottom && (hasMainCaption || editingSlot === 'main' || selected)));

  const showLeftBlock =
    !isCropping && captionPosition === 'left' && (hasMainCaption || editingSlot === 'main');

  const showRightBlock =
    !isCropping && captionPosition === 'right' && (hasMainCaption || editingSlot === 'main');

  const hasAnyVisibleCaption =
    showTopBlock || showBottomBlock || showLeftBlock || showRightBlock;

  // Se o usuário usar recorte circular ("full") junto com legenda, mantém a legenda legível sem cortar cantos
  const outerRadiusClass =
    node.borderRadius === 'full' && hasAnyVisibleCaption ? 'rounded-2xl' : rawRadiusClass;
  const imageWrapRadiusClass =
    node.borderRadius === 'full' && hasAnyVisibleCaption ? 'rounded-full' : '';

  const effectiveTextAlign = node.textAlign ?? (isHorizontal ? 'left' : 'center');

  const commitSlot = (slot: CaptionSlot) => {
    setEditingSlot(null);
    if (slot === 'top') {
      const clean = topDraft.trim();
      if (clean !== (node.captionTop ?? '')) {
        updateCanvasNode(id, { captionTop: clean });
      }
      return;
    }
    const clean = mainDraft.trim();
    if (clean !== (node.caption ?? '')) {
      updateCanvasNode(id, { caption: clean });
    }
  };

  const cancelSlot = (slot: CaptionSlot) => {
    setEditingSlot(null);
    if (slot === 'top') setTopDraft(node.captionTop ?? '');
    else setMainDraft(node.caption ?? '');
  };

  // Arraste interno para mover o enquadramento no modo Cortar
  const handleCropPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isCropping) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    panDragRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      originX: liveCrop.x,
      originY: liveCrop.y,
      boxW: Math.max(1, rect.width),
      boxH: Math.max(1, rect.height),
    };
  };

  const handleCropPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isCropping || !panDragRef.current) return;
    e.stopPropagation();
    const { startClientX, startClientY, originX, originY, boxW, boxH } = panDragRef.current;
    const dxPct = ((e.clientX - startClientX) / boxW) * 100;
    const dyPct = ((e.clientY - startClientY) / boxH) * 100;
    const limit = Math.max(25, (liveCrop.zoom - 1) * 55 + 30);

    setLiveCrop((prev) => ({
      ...prev,
      x: Math.max(-limit, Math.min(limit, Math.round((originX + dxPct) * 10) / 10)),
      y: Math.max(-limit, Math.min(limit, Math.round((originY + dyPct) * 10) / 10)),
    }));
  };

  const handleCropPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!panDragRef.current) return;
    e.stopPropagation();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignora
    }
    panDragRef.current = null;
    updateCanvasNode(id, {
      imageFit: 'cover',
      cropZoom: liveCrop.zoom,
      cropX: liveCrop.x,
      cropY: liveCrop.y,
    });
  };

  const handleCropWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!isCropping) return;
    e.stopPropagation();
    const delta = e.deltaY < 0 ? 0.12 : -0.12;
    const nextZoom = Math.max(1, Math.min(4, Math.round((liveCrop.zoom + delta) * 100) / 100));
    setLiveCrop((prev) => ({ ...prev, zoom: nextZoom }));
    updateCanvasNode(id, { imageFit: 'cover', cropZoom: nextZoom });
  };

  const renderCaptionBlock = (
    slot: CaptionSlot,
    placement: 'top' | 'bottom' | 'left' | 'right'
  ) => {
    const isEditingThis = editingSlot === slot;
    const textValue = slot === 'top' ? node.captionTop ?? '' : node.caption ?? '';
    const draftValue = slot === 'top' ? topDraft : mainDraft;
    const setDraftValue = slot === 'top' ? setTopDraft : setMainDraft;
    const hasText = Boolean(textValue.trim());

    const edgeBorderClass =
      placement === 'top'
        ? 'border-b border-zinc-800/75'
        : placement === 'bottom'
        ? 'border-t border-zinc-800/75'
        : placement === 'left'
        ? 'border-r border-zinc-800/75'
        : 'border-l border-zinc-800/75';

    const sizeClass =
      placement === 'left' || placement === 'right'
        ? 'w-[42%] min-w-[112px] max-w-[280px] h-full flex flex-col justify-center'
        : isSplitTopBottom
        ? 'w-full max-h-[34%]'
        : 'w-full max-h-[45%]';

    // Em modo Topo + Embaixo, se um dos lados ainda estiver vazio, mostra gatilho sutil apenas enquanto selecionado
    if (!isEditingThis && !hasText) {
      return (
        <div
          className={`nodrag shrink-0 ${edgeBorderClass} bg-[#161920]/75 px-2.5 py-1 text-center`}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setEditingSlot(slot);
            }}
            className="inline-flex items-center gap-1 text-[10.5px] font-medium text-zinc-400 transition hover:text-indigo-300"
          >
            <Plus className="h-3 w-3" />
            {slot === 'top' ? 'Adicionar texto acima' : 'Adicionar texto abaixo'}
          </button>
        </div>
      );
    }

    return (
      <div
        onClick={(e) => {
          if (isEditingThis) e.stopPropagation();
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (!isEditingThis) setEditingSlot(slot);
        }}
        className={`kc-no-scrollbar nodrag shrink-0 overflow-y-auto ${edgeBorderClass} ${sizeClass} bg-[#161920]/92 px-3 py-2 ${
          isEditingThis ? 'nowheel' : ''
        }`}
      >
        {isEditingThis ? (
          <div className="flex flex-col gap-1.5">
            <textarea
              autoFocus
              rows={placement === 'left' || placement === 'right' ? 4 : 3}
              value={draftValue}
              onChange={(e) => setDraftValue(e.target.value)}
              onBlur={() => commitSlot(slot)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  commitSlot(slot);
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelSlot(slot);
                }
              }}
              style={{ textAlign: effectiveTextAlign }}
              placeholder={
                slot === 'top'
                  ? 'Escreva o texto acima da imagem...'
                  : 'Escreva uma legenda ou parágrafos...'
              }
              className="nodrag nowheel w-full resize-none bg-transparent text-[12px] leading-relaxed text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
            />
            <div className="flex items-center justify-between gap-2 border-t border-zinc-800/70 pt-1">
              <span className="text-[9.5px] text-zinc-500">
                Enter: linha • Ctrl+Enter: salvar
              </span>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation();
                  commitSlot(slot);
                }}
                className="flex items-center gap-0.5 rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-emerald-500"
              >
                <Check className="h-3 w-3" /> OK
              </button>
            </div>
          </div>
        ) : (
          <p
            style={{ textAlign: effectiveTextAlign }}
            title="Duplo clique para editar legenda"
            className="cursor-text whitespace-pre-wrap break-words text-[12px] font-medium leading-relaxed text-zinc-200"
          >
            {textValue}
          </p>
        )}
      </div>
    );
  };

  return (
    /* Raiz SEM overflow-hidden para nunca cortar os ganchos de conexão */
    <div
      className={`group relative flex h-full w-full flex-col ${outerRadiusClass} transition-shadow ${
        isCropping
          ? 'ring-2 ring-amber-400 shadow-2xl shadow-amber-500/20'
          : selected
          ? 'ring-2 ring-indigo-500 shadow-indigo-500/20'
          : borderStyle === 'none' && !hasAnyVisibleCaption
          ? ''
          : 'hover:shadow-2xl'
      }`}
    >
      <NodeResizer
        isVisible={selected}
        keepAspectRatio={Boolean(node.keepAspectRatio)}
        minWidth={isHorizontal && hasAnyVisibleCaption ? 220 : 80}
        minHeight={hasAnyVisibleCaption ? 96 : 60}
        lineClassName={isCropping ? '!border-amber-400' : '!border-indigo-500'}
        handleClassName={
          isCropping
            ? '!h-3 !w-3 !rounded-sm !border-amber-400 !bg-[#161920]'
            : '!h-2.5 !w-2.5 !rounded-sm !border-indigo-400 !bg-[#161920]'
        }
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

      {/* 4 Alças de Conexão com z-50 (sempre acima das bordas do NodeResizer) */}
      {!isCropping &&
        HANDLES.map((h) => (
          <React.Fragment key={h.id}>
            <Handle
              type="target"
              position={h.pos}
              id={`t-${h.id}`}
              className={`!z-50 !h-3.5 !w-3.5 !border-2 !border-[#161920] !bg-indigo-400 transition-opacity ${
                selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
            />
            <Handle
              type="source"
              position={h.pos}
              id={`s-${h.id}`}
              className={`!z-50 !h-3.5 !w-3.5 !border-2 !border-[#161920] !bg-indigo-400 transition-opacity ${
                selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
            />
          </React.Fragment>
        ))}

      {/* Container interno com borda, recorte e layout adaptativo da legenda */}
      <div
        style={{
          borderWidth,
          borderStyle: borderStyle === 'none' ? 'solid' : borderStyle,
          borderColor: borderStyle === 'none' ? 'transparent' : borderColor,
        }}
        className={`flex h-full w-full ${
          isHorizontal ? 'flex-row' : 'flex-col'
        } overflow-hidden ${outerRadiusClass} ${
          borderStyle === 'none' && !hasAnyVisibleCaption
            ? 'bg-transparent shadow-none'
            : 'bg-[#161920]/70 shadow-xl backdrop-blur-sm'
        }`}
      >
        {/* Legenda no Topo (modo Topo ou Topo + Embaixo) */}
        {showTopBlock && renderCaptionBlock(isSplitTopBottom ? 'top' : 'main', 'top')}

        {/* Legenda na Esquerda */}
        {showLeftBlock && renderCaptionBlock('main', 'left')}

        {/* Área da Imagem / Elemento (isolada em flex-1 para preservar 100% do corte e zoom) */}
        <div
          onPointerDown={handleCropPointerDown}
          onPointerMove={handleCropPointerMove}
          onPointerUp={handleCropPointerUp}
          onPointerCancel={handleCropPointerUp}
          onWheel={handleCropWheel}
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (isCropping) return;
            if (isSplitTopBottom && hasMainCaption && !hasTopCaption) {
              setEditingSlot('top');
            } else {
              setEditingSlot('main');
            }
          }}
          className={`relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden ${imageWrapRadiusClass} ${
            isCropping ? 'nodrag nowheel cursor-grab active:cursor-grabbing' : ''
          } ${borderStyle === 'none' || isCropping ? 'p-0' : 'p-1'}`}
        >
          {imgUrl ? (
            <img
              src={imgUrl}
              alt={node.caption || node.captionTop || 'Imagem no Canvas'}
              draggable={false}
              style={{
                opacity,
                transform: `translate(${liveCrop.x}%, ${liveCrop.y}%) scale(${liveCrop.zoom}) rotate(${rotation}deg) scaleX(${flipX}) scaleY(${flipY})`,
              }}
              className={`h-full w-full select-none transition-transform duration-75 ${fitClass}`}
            />
          ) : (
            <div className="flex flex-col items-center gap-1 text-zinc-500">
              <ImageIcon className="h-6 w-6" />
              <span className="text-[11px]">Carregando imagem...</span>
            </div>
          )}

          {/* Grade de terços durante o corte para enquadramento preciso */}
          {isCropping && (
            <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 border border-amber-400/60">
              {Array.from({ length: 9 }).map((_, idx) => (
                <div key={idx} className="border border-amber-300/20" />
              ))}
            </div>
          )}
        </div>

        {/* Legenda na Direita */}
        {showRightBlock && renderCaptionBlock('main', 'right')}

        {/* Legenda Embaixo (modo Embaixo ou Topo + Embaixo) */}
        {showBottomBlock && renderCaptionBlock('main', 'bottom')}
      </div>

      {/* Mini barra flutuante de controle de Zoom/Corte abaixo da imagem */}
      {isCropping && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="nodrag nowheel absolute -bottom-11 left-1/2 z-50 flex w-max -translate-x-1/2 items-center gap-2 rounded-xl border border-amber-400/50 bg-[#161920]/95 px-2.5 py-1.5 text-[11px] shadow-2xl backdrop-blur-xl"
        >
          <ZoomIn className="h-3.5 w-3.5 text-amber-400" />
          <input
            type="range"
            min={1}
            max={4}
            step={0.05}
            value={liveCrop.zoom}
            onChange={(e) => {
              const z = parseFloat(e.target.value);
              setLiveCrop((prev) => ({ ...prev, zoom: z }));
              updateCanvasNode(id, { imageFit: 'cover', cropZoom: z });
            }}
            className="w-24 accent-amber-400"
          />
          <span className="w-8 text-right font-mono text-[10px] text-zinc-300">
            {liveCrop.zoom.toFixed(1)}x
          </span>

          <button
            type="button"
            onClick={() => {
              setLiveCrop({ zoom: 1, x: 0, y: 0 });
              updateCanvasNode(id, { cropZoom: 1, cropX: 0, cropY: 0 });
            }}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            title="Resetar recorte"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setCroppingImageNodeId(null)}
            className="flex items-center gap-1 rounded-lg bg-amber-500 px-2 py-0.5 font-semibold text-zinc-950 hover:bg-amber-400"
          >
            <Check className="h-3 w-3" /> Aplicar
          </button>
        </div>
      )}
    </div>
  );
});