'use client';

import React, { memo, useEffect, useRef, useState } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';
import { Image as ImageIcon, Check, RotateCcw, ZoomIn } from 'lucide-react';
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

interface CanvasImageNodeData {
  node: CanvasNodePosition;
}

export const CanvasImageNode = memo(function CanvasImageNode({
  id,
  data,
  selected,
}: NodeProps & { data: CanvasImageNodeData }) {
  const persistNodePositions = useKnowledgeStore((s) => s.persistNodePositions);
  const updateCanvasNode = useKnowledgeStore((s) => s.updateCanvasNode);
  const { croppingImageNodeId, setCroppingImageNodeId } = useUiStore();
  const { node } = data;

  const isCropping = croppingImageNodeId === id;

  const [imgUrl, setImgUrl] = useState<string | null>(() =>
    node.blobId ? blobUrlCache.get(node.blobId) ?? null : null
  );
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(node.caption ?? '');

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
    setCaptionDraft(node.caption ?? '');
  }, [node.caption]);

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
  const radiusClass = RADIUS_CLASS[node.borderRadius ?? 'xl'];
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

  const commitCaption = () => {
    setEditingCaption(false);
    const clean = captionDraft.trim();
    if (clean !== (node.caption ?? '')) {
      updateCanvasNode(id, { caption: clean });
    }
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

  return (
    /* Raiz SEM overflow-hidden para nunca cortar os ganchos de conexão */
    <div
      className={`group relative flex h-full w-full flex-col ${radiusClass} transition-shadow ${
        isCropping
          ? 'ring-2 ring-amber-400 shadow-2xl shadow-amber-500/20'
          : selected
          ? 'ring-2 ring-indigo-500 shadow-indigo-500/20'
          : 'hover:shadow-2xl'
      }`}
    >
      <NodeResizer
        isVisible={selected}
        keepAspectRatio={Boolean(node.keepAspectRatio)}
        minWidth={80}
        minHeight={60}
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

      {/* Container interno com borda e recorte (overflow-hidden só aqui dentro) */}
      <div
        style={{
          borderWidth,
          borderStyle: borderStyle === 'none' ? 'solid' : borderStyle,
          borderColor: borderStyle === 'none' ? 'transparent' : borderColor,
        }}
        className={`flex h-full w-full flex-col overflow-hidden ${radiusClass} bg-[#161920]/70 shadow-xl backdrop-blur-sm`}
      >
        <div
          onPointerDown={handleCropPointerDown}
          onPointerMove={handleCropPointerMove}
          onPointerUp={handleCropPointerUp}
          onPointerCancel={handleCropPointerUp}
          onWheel={handleCropWheel}
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (!isCropping) setEditingCaption(true);
          }}
          className={`relative flex min-h-0 flex-1 items-center justify-center overflow-hidden ${
            isCropping ? 'nodrag nowheel cursor-grab active:cursor-grabbing' : ''
          } ${borderStyle === 'none' || isCropping ? 'p-0' : 'p-1'}`}
        >
          {imgUrl ? (
            <img
              src={imgUrl}
              alt={node.caption || 'Imagem no Canvas'}
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

        {/* Legenda Opcional */}
        {(editingCaption || node.caption) && !isCropping && (
          <div className="nodrag shrink-0 border-t border-zinc-800/70 bg-[#161920]/90 px-3 py-1.5">
            {editingCaption ? (
              <input
                autoFocus
                value={captionDraft}
                onChange={(e) => setCaptionDraft(e.target.value)}
                onBlur={commitCaption}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitCaption();
                  if (e.key === 'Escape') setEditingCaption(false);
                }}
                placeholder="Escreva uma legenda..."
                className="w-full bg-transparent text-center text-[11.5px] font-medium text-zinc-100 focus:outline-none"
              />
            ) : (
              <p
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingCaption(true);
                }}
                title="Duplo clique para editar legenda"
                className="cursor-text truncate text-center text-[11.5px] font-medium text-zinc-300"
              >
                {node.caption}
              </p>
            )}
          </div>
        )}
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