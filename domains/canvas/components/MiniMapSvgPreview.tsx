'use client';

import React, { memo, useId, useMemo } from 'react';
import { CanvasNodePosition, KnowledgeCardMeta } from '@/domains/knowledge/types';
import { ExplorerMiniMapData } from '../utils/canvasExplorerLayout';
import { hexToRgbaString } from '../utils/contrast';

const CARD_HEX: Record<KnowledgeCardMeta['color'], string> = {
  default: '#6366f1',
  amber: '#f59e0b',
  emerald: '#10b981',
  sky: '#0ea5e9',
  rose: '#f43f5e',
  violet: '#8b5cf6',
};

function getApproxDims(n: CanvasNodePosition): { w: number; h: number } {
  if (n.nodeType === 'group') return { w: n.width || 600, h: n.height || 340 };
  if (n.nodeType === 'topic') return { w: n.width || 210, h: n.height || 74 };
  if (n.nodeType === 'text') return { w: n.width || 260, h: n.height || 86 };
  if (n.nodeType === 'image') return { w: n.width || 220, h: n.height || 180 };
  return { w: n.width || 340, h: n.height || 220 };
}

interface MiniMapSvgPreviewProps {
  data: ExplorerMiniMapData;
  accentColor: string;
  theme: 'dark' | 'paper';
}

export const MiniMapSvgPreview = memo(function MiniMapSvgPreview({
  data,
  accentColor,
  theme,
}: MiniMapSvgPreviewProps) {
  const uid = useId().replace(/:/g, '');
  const isPaper = theme === 'paper';
  const { nodes, edges, strokes, cardsById } = data;

  const projected = useMemo(() => {
    if (nodes.length === 0 && strokes.length === 0) return null;

    const viewW = 360;
    const viewH = 186;
    const padX = 20;
    const padY = 18;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const boxMap = new Map<string, { x: number; y: number; w: number; h: number }>();

    for (const n of nodes) {
      const { w, h } = getApproxDims(n);
      boxMap.set(n.id, { x: n.x, y: n.y, w, h });
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + w);
      maxY = Math.max(maxY, n.y + h);
    }

    for (const st of strokes) {
      for (const pt of st.points) {
        minX = Math.min(minX, pt.x);
        minY = Math.min(minY, pt.y);
        maxX = Math.max(maxX, pt.x);
        maxY = Math.max(maxY, pt.y);
      }
    }

    if (!Number.isFinite(minX)) return null;

    const contentW = Math.max(120, maxX - minX);
    const contentH = Math.max(80, maxY - minY);
    const scale = Math.min(
      0.34,
      (viewW - padX * 2) / contentW,
      (viewH - padY * 2) / contentH
    );

    const drawW = contentW * scale;
    const drawH = contentH * scale;
    const offX = (viewW - drawW) / 2 - minX * scale;
    const offY = (viewH - drawH) / 2 - minY * scale;

    const tx = (x: number) => Math.round((x * scale + offX) * 10) / 10;
    const ty = (y: number) => Math.round((y * scale + offY) * 10) / 10;

    return { scale, tx, ty, boxMap };
  }, [nodes, strokes]);

  if (!projected) {
    return (
      <div
        className={`flex h-full w-full flex-col items-center justify-center gap-1.5 text-center ${
          isPaper ? 'bg-stone-100/80 text-stone-400' : 'bg-[#0C0F14] text-zinc-500'
        }`}
      >
        <div
          style={{ borderColor: hexToRgbaString(accentColor, 0.35) }}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-dashed"
        >
          <span
            style={{ backgroundColor: hexToRgbaString(accentColor, 0.55) }}
            className="h-2 w-2 rounded-full"
          />
        </div>
        <span className="text-[11px] font-medium">Mapa em branco</span>
        <span className="text-[10px] opacity-70">Clique em Expandir para construir</span>
      </div>
    );
  }

  const { scale, tx, ty, boxMap } = projected;
  const groups = nodes.filter((n) => n.nodeType === 'group');
  const foregroundNodes = nodes.filter((n) => n.nodeType !== 'group');

  return (
    <svg
      viewBox="0 0 360 186"
      className={`h-full w-full select-none ${isPaper ? 'bg-[#F7F6F2]' : 'bg-[#0C0F14]'}`}
    >
      <defs>
        <pattern id={`mm-dots-${uid}`} width="14" height="14" patternUnits="userSpaceOnUse">
          <circle
            cx="2"
            cy="2"
            r="0.8"
            fill={isPaper ? 'rgba(120,113,108,0.22)' : 'rgba(148,163,184,0.16)'}
          />
        </pattern>
      </defs>

      <rect width="360" height="186" fill={`url(#mm-dots-${uid})`} />

      {/* 1. Grupos ao fundo */}
      {groups.map((g) => {
        const b = boxMap.get(g.id)!;
        const gColor = g.color ?? '#6366f1';
        return (
          <rect
            key={g.id}
            x={tx(b.x)}
            y={ty(b.y)}
            width={Math.max(18, b.w * scale)}
            height={Math.max(14, b.h * scale)}
            rx={6}
            fill={hexToRgbaString(gColor, 0.08)}
            stroke={hexToRgbaString(gColor, 0.45)}
            strokeWidth={1}
            strokeDasharray="3 2"
          />
        );
      })}

      {/* 2. Conexões entre os blocos */}
      {edges.map((e) => {
        const sb = boxMap.get(e.sourceNodeId);
        const tb = boxMap.get(e.targetNodeId);
        if (!sb || !tb) return null;
        const x1 = tx(sb.x + sb.w / 2);
        const y1 = ty(sb.y + sb.h / 2);
        const x2 = tx(tb.x + tb.w / 2);
        const y2 = ty(tb.y + tb.h / 2);
        const mx = (x1 + x2) / 2;
        return (
          <path
            key={e.id}
            d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
            fill="none"
            stroke={e.color ?? '#6366f1'}
            strokeOpacity={0.85}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        );
      })}

      {/* 3. Traços livres (Caneta) */}
      {strokes.map((st) => {
        if (st.points.length < 2) return null;
        const pts = st.points.map((p) => `${tx(p.x)},${ty(p.y)}`).join(' ');
        return (
          <polyline
            key={st.id}
            points={pts}
            fill="none"
            stroke={st.color}
            strokeOpacity={st.opacity}
            strokeWidth={Math.max(1, st.width * scale)}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}

      {/* 4. Cards, Tópicos, Textos e Imagens em miniatura fiel */}
      {foregroundNodes.map((n) => {
        const b = boxMap.get(n.id)!;
        const x = tx(b.x);
        const y = ty(b.y);
        const w = Math.max(14, b.w * scale);
        const h = Math.max(10, b.h * scale);

        if (n.nodeType === 'topic') {
          const tColor = n.bgColor ?? n.color ?? accentColor;
          const shape = n.topicConfig?.shape ?? 'rounded';
          const rx =
            shape === 'capsule' || shape === 'circle' || shape === 'ellipse'
              ? h / 2
              : shape === 'rect'
              ? 1.5
              : 5;

          return (
            <g key={n.id}>
              {shape === 'diamond' ? (
                <polygon
                  points={`${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}`}
                  fill={hexToRgbaString(tColor, 0.35)}
                  stroke={tColor}
                  strokeWidth={1.2}
                />
              ) : (
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  rx={rx}
                  fill={hexToRgbaString(tColor, 0.32)}
                  stroke={tColor}
                  strokeWidth={1.2}
                />
              )}
              {w > 30 && n.label && (
                <text
                  x={x + w / 2}
                  y={y + h / 2 + 2.5}
                  textAnchor="middle"
                  fontSize={Math.min(7.5, Math.max(5.5, h * 0.32))}
                  fontWeight={600}
                  fill={isPaper ? '#18181b' : '#f4f4f5'}
                >
                  {n.label.length > 16 ? `${n.label.slice(0, 14)}…` : n.label}
                </text>
              )}
            </g>
          );
        }

        if (n.nodeType === 'text') {
          const tColor = n.color ?? '#f59e0b';
          return (
            <g key={n.id}>
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                rx={3}
                fill={hexToRgbaString(tColor, 0.16)}
                stroke={hexToRgbaString(tColor, 0.55)}
                strokeWidth={0.9}
              />
              <line
                x1={x + 4}
                y1={y + h * 0.42}
                x2={x + Math.max(6, w - 6)}
                y2={y + h * 0.42}
                stroke={isPaper ? '#52525b' : '#a1a1aa'}
                strokeWidth={1.2}
                strokeLinecap="round"
              />
            </g>
          );
        }

        if (n.nodeType === 'image') {
          return (
            <g key={n.id}>
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                rx={4}
                fill={hexToRgbaString('#10b981', 0.18)}
                stroke="#10b981"
                strokeWidth={1}
              />
              <circle cx={x + w * 0.34} cy={y + h * 0.36} r={Math.min(3, w * 0.1)} fill="#34d399" />
            </g>
          );
        }

        // Knowledge Card em miniatura
        const card = n.cardId ? cardsById[n.cardId] : undefined;
        const cHex = card ? CARD_HEX[card.color] : '#6366f1';
        return (
          <g key={n.id}>
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              rx={5}
              fill={isPaper ? '#ffffff' : '#181C24'}
              stroke={hexToRgbaString(cHex, 0.8)}
              strokeWidth={1.2}
            />
            <rect
              x={x + 3}
              y={y + 3}
              width={Math.max(4, w - 6)}
              height={Math.min(5, h * 0.22)}
              rx={1.5}
              fill={hexToRgbaString(cHex, 0.45)}
            />
            {w > 34 && h > 22 && card?.title ? (
              <text
                x={x + 4}
                y={y + Math.min(16, h * 0.52)}
                fontSize={6.2}
                fontWeight={600}
                fill={isPaper ? '#27272a' : '#e4e4e7'}
              >
                {card.title.length > 15 ? `${card.title.slice(0, 13)}…` : card.title}
              </text>
            ) : null}
            {h > 26 && (
              <>
                <line
                  x1={x + 4}
                  y1={y + h * 0.68}
                  x2={x + Math.max(8, w - 8)}
                  y2={y + h * 0.68}
                  stroke={isPaper ? '#d4d4d8' : '#3f3f46'}
                  strokeWidth={1.2}
                  strokeLinecap="round"
                />
                <line
                  x1={x + 4}
                  y1={y + h * 0.82}
                  x2={x + Math.max(6, w * 0.62)}
                  y2={y + h * 0.82}
                  stroke={isPaper ? '#e4e4e7' : '#27272a'}
                  strokeWidth={1.2}
                  strokeLinecap="round"
                />
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
});