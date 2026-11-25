'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Viewport } from '@xyflow/react';
import {
  PenTool,
  Highlighter,
  ArrowUpRight,
  Square,
  Circle,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Sparkles,
  Check,
  Minus,
} from 'lucide-react';
import { CanvasStroke, StrokePoint, StrokeTool } from '@/domains/knowledge/types';
import { useKnowledgeStore } from '@/domains/knowledge/store/useKnowledgeStore';
import { useUiStore } from '@/domains/ui/store/useUiStore';

type ActiveDrawTool = StrokeTool | 'eraser';

const INK_COLORS = [
  '#f4f4f5',
  '#1f2328',
  '#818cf8',
  '#38bdf8',
  '#34d399',
  '#facc15',
  '#fb923c',
  '#fb7185',
];

const WIDTH_PRESETS = [
  { label: 'Fina', value: 2.5 },
  { label: 'Média', value: 5 },
  { label: 'Grossa', value: 9 },
];

function pointsToSmoothPath(points: StrokePoint[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)} L ${(p.x + 0.1).toFixed(1)} ${(p.y + 0.1).toFixed(1)}`;
  }

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    d += ` Q ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}, ${midX.toFixed(1)} ${midY.toFixed(1)}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  return d;
}

function distToSegment(p: StrokePoint, a: StrokePoint, b: StrokePoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function hitTestStroke(stroke: CanvasStroke, pt: StrokePoint, tolerance: number): boolean {
  const pts = stroke.points;
  if (pts.length === 0) return false;
  const threshold = tolerance + stroke.width / 2;

  if (stroke.tool === 'rect' || stroke.tool === 'ellipse') {
    const start = pts[0];
    const end = pts[pts.length - 1];
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);

    if (pt.x < minX - threshold || pt.x > maxX + threshold || pt.y < minY - threshold || pt.y > maxY + threshold) {
      return false;
    }

    if (stroke.tool === 'rect') {
      return (
        Math.abs(pt.x - minX) <= threshold ||
        Math.abs(pt.x - maxX) <= threshold ||
        Math.abs(pt.y - minY) <= threshold ||
        Math.abs(pt.y - maxY) <= threshold
      );
    }

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const rx = Math.max(1, (maxX - minX) / 2);
    const ry = Math.max(1, (maxY - minY) / 2);
    const norm = Math.sqrt(((pt.x - cx) / rx) ** 2 + ((pt.y - cy) / ry) ** 2);
    const normTol = threshold / Math.min(rx, ry);
    return Math.abs(norm - 1) <= Math.max(0.18, normTol);
  }

  if (pts.length === 1) {
    return Math.hypot(pt.x - pts[0].x, pt.y - pts[0].y) <= threshold;
  }

  for (let i = 0; i < pts.length - 1; i++) {
    if (distToSegment(pt, pts[i], pts[i + 1]) <= threshold) return true;
  }
  return false;
}

function renderStrokeElement(
  stroke: Pick<CanvasStroke, 'tool' | 'color' | 'width' | 'opacity' | 'points'>,
  key: string
) {
  const pts = stroke.points;
  if (pts.length === 0) return null;

  const commonProps = {
    stroke: stroke.color,
    strokeWidth: stroke.width,
    strokeOpacity: stroke.opacity,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  if (stroke.tool === 'pen' || stroke.tool === 'highlighter') {
    return <path key={key} d={pointsToSmoothPath(pts)} {...commonProps} />;
  }

  const start = pts[0];
  const end = pts[pts.length - 1];

  if (stroke.tool === 'line') {
    return <line key={key} x1={start.x} y1={start.y} x2={end.x} y2={end.y} {...commonProps} />;
  }

  if (stroke.tool === 'arrow') {
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const headLen = Math.max(12, stroke.width * 3.4);
    const x1 = end.x - headLen * Math.cos(angle - Math.PI / 6);
    const y1 = end.y - headLen * Math.sin(angle - Math.PI / 6);
    const x2 = end.x - headLen * Math.cos(angle + Math.PI / 6);
    const y2 = end.y - headLen * Math.sin(angle + Math.PI / 6);
    return (
      <g key={key}>
        <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} {...commonProps} />
        <path d={`M ${x1} ${y1} L ${end.x} ${end.y} L ${x2} ${y2}`} {...commonProps} />
      </g>
    );
  }

  if (stroke.tool === 'rect') {
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    const h = Math.abs(end.y - start.y);
    return <rect key={key} x={x} y={y} width={w} height={h} rx={8} {...commonProps} />;
  }

  if (stroke.tool === 'ellipse') {
    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;
    const rx = Math.abs(end.x - start.x) / 2;
    const ry = Math.abs(end.y - start.y) / 2;
    return <ellipse key={key} cx={cx} cy={cy} rx={rx} ry={ry} {...commonProps} />;
  }

  return null;
}

interface DrawingLayerProps {
  isActive: boolean;
  viewport: Viewport;
  screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number };
  onBeforeMutate: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onClose: () => void;
}

export function DrawingLayer({
  isActive,
  viewport,
  screenToFlowPosition,
  onBeforeMutate,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onClose,
}: DrawingLayerProps) {
  const { canvasStrokes, addCanvasStroke, deleteCanvasStroke, clearCanvasStrokes } =
    useKnowledgeStore();
  const { theme, openConfirm, addToast } = useUiStore();

  const [tool, setTool] = useState<ActiveDrawTool>('pen');
  const [color, setColor] = useState(theme === 'paper' ? '#1f2328' : '#818cf8');
  const [strokeWidth, setStrokeWidth] = useState(3.5);
  const [stabilization, setStabilization] = useState(true);
  const [spaceHeld, setSpaceHeld] = useState(false);

  const [draftStroke, setDraftStroke] = useState<Pick<
    CanvasStroke,
    'tool' | 'color' | 'width' | 'opacity' | 'points'
  > | null>(null);

  const isPointerDownRef = useRef(false);
  const erasedInGestureRef = useRef(false);
  const draftRef = useRef(draftStroke);
  draftRef.current = draftStroke;

  useEffect(() => {
    if (!isActive) {
      setSpaceHeld(false);
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setSpaceHeld(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [isActive, onClose]);

  const eraseAtPoint = useCallback(
    (pt: StrokePoint) => {
      const tolerance = 14 / Math.max(0.25, viewport.zoom);
      const hits = canvasStrokes.filter((stroke) => hitTestStroke(stroke, pt, tolerance));
      if (hits.length === 0) return;

      // Salva 1 único snapshot por passada da borracha para Ctrl+Z restaurar tudo de uma vez
      if (!erasedInGestureRef.current) {
        onBeforeMutate();
        erasedInGestureRef.current = true;
      }

      for (const stroke of hits) {
        deleteCanvasStroke(stroke.id);
      }
    },
    [canvasStrokes, viewport.zoom, deleteCanvasStroke, onBeforeMutate]
  );

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isActive || spaceHeld || e.button === 2) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    isPointerDownRef.current = true;
    erasedInGestureRef.current = false;

    const flowPt = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const pt: StrokePoint = {
      x: Math.round(flowPt.x * 10) / 10,
      y: Math.round(flowPt.y * 10) / 10,
      pressure: e.pressure || 0.5,
    };

    if (tool === 'eraser') {
      eraseAtPoint(pt);
      return;
    }

    const isHighlighter = tool === 'highlighter';
    const effectiveWidth = isHighlighter ? Math.max(18, strokeWidth * 4.2) : strokeWidth;

    setDraftStroke({
      tool,
      color,
      width: effectiveWidth,
      opacity: isHighlighter ? 0.34 : 0.96,
      points: [pt],
    });
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isPointerDownRef.current || !isActive || spaceHeld) return;
    e.stopPropagation();

    const flowPt = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const rawPt: StrokePoint = {
      x: Math.round(flowPt.x * 10) / 10,
      y: Math.round(flowPt.y * 10) / 10,
      pressure: e.pressure || 0.5,
    };

    if (tool === 'eraser') {
      eraseAtPoint(rawPt);
      return;
    }

    setDraftStroke((prev) => {
      if (!prev) return null;

      if (prev.tool !== 'pen' && prev.tool !== 'highlighter') {
        return { ...prev, points: [prev.points[0], rawPt] };
      }

      const last = prev.points[prev.points.length - 1];
      const dist = Math.hypot(rawPt.x - last.x, rawPt.y - last.y);
      if (dist < 1.8) return prev;

      const alpha = stabilization ? 0.38 : 0.9;
      const smoothed: StrokePoint = {
        x: Math.round((last.x + (rawPt.x - last.x) * alpha) * 10) / 10,
        y: Math.round((last.y + (rawPt.y - last.y) * alpha) * 10) / 10,
        pressure: rawPt.pressure,
      };

      return { ...prev, points: [...prev.points, smoothed] };
    });
  };

  const handlePointerUp = async (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;
    erasedInGestureRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignora
    }

    const finished = draftRef.current;
    setDraftStroke(null);

    if (finished && finished.points.length >= 1) {
      onBeforeMutate();
      await addCanvasStroke(finished);
    }
  };

  const handleClearAll = () => {
    if (canvasStrokes.length === 0) return;
    openConfirm({
      title: 'Limpar todos os desenhos?',
      description: `Todos os ${canvasStrokes.length} traços desta área de trabalho serão apagados. Você poderá desfazer com Ctrl+Z.`,
      confirmLabel: 'Limpar desenhos',
      variant: 'danger',
      onConfirm: async () => {
        onBeforeMutate();
        await clearCanvasStrokes();
        addToast({
          message: 'Camada de desenho limpa',
          action: { label: 'Desfazer', onClick: () => onUndo() },
        });
      },
    });
  };

  return (
    <>
      <svg
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`absolute inset-0 h-full w-full touch-none select-none ${
          isActive && !spaceHeld
            ? tool === 'eraser'
              ? 'pointer-events-auto z-30 cursor-cell'
              : 'pointer-events-auto z-30 cursor-crosshair'
            : 'pointer-events-none z-[15]'
        }`}
      >
        <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}>
          {canvasStrokes.map((stroke) => renderStrokeElement(stroke, stroke.id))}
          {draftStroke && renderStrokeElement(draftStroke, 'active-draft')}
        </g>
      </svg>

      {isActive && (
        <div className="pointer-events-auto absolute left-1/2 top-3 z-40 flex w-max max-w-[95vw] -translate-x-1/2 items-center gap-1.5 rounded-2xl border border-indigo-500/40 bg-[#161920]/95 px-2.5 py-1.5 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-0.5 rounded-xl bg-[#0F1115] p-0.5">
            {(
              [
                { id: 'pen', icon: PenTool, title: 'Caneta livre (Stylus / Mouse)' },
                { id: 'highlighter', icon: Highlighter, title: 'Marca-texto livre' },
                { id: 'line', icon: Minus, title: 'Linha reta' },
                { id: 'arrow', icon: ArrowUpRight, title: 'Seta livre' },
                { id: 'rect', icon: Square, title: 'Retângulo' },
                { id: 'ellipse', icon: Circle, title: 'Elipse / Círculo' },
                { id: 'eraser', icon: Eraser, title: 'Borracha (arraste sobre o traço)' },
              ] as Array<{ id: ActiveDrawTool; icon: React.ComponentType<{ className?: string }>; title: string }>
            ).map(({ id, icon: Icon, title }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTool(id)}
                title={title}
                className={`rounded-lg p-1.5 transition ${
                  tool === id
                    ? id === 'eraser'
                      ? 'bg-rose-600 text-white'
                      : 'bg-indigo-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-zinc-800" />

          <div className="flex items-center gap-1 px-0.5">
            {INK_COLORS.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => {
                  setColor(hex);
                  if (tool === 'eraser') setTool('pen');
                }}
                title="Cor da tinta"
                className={`h-4 w-4 rounded-full border transition hover:scale-125 ${
                  color === hex && tool !== 'eraser'
                    ? 'scale-110 border-white ring-2 ring-indigo-500/60'
                    : 'border-zinc-700'
                }`}
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>

          <div className="h-4 w-px bg-zinc-800" />

          <div className="flex items-center gap-0.5 rounded-xl bg-[#0F1115] p-0.5">
            {WIDTH_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setStrokeWidth(preset.value)}
                title={`Espessura ${preset.label}`}
                className={`flex h-6 w-6 items-center justify-center rounded-lg transition ${
                  strokeWidth === preset.value
                    ? 'bg-indigo-600/25 text-indigo-300'
                    : 'text-zinc-400 hover:bg-zinc-800'
                }`}
              >
                <span
                  className="rounded-full bg-current"
                  style={{ width: preset.value + 2, height: preset.value + 2 }}
                />
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setStabilization((v) => !v)}
            title="Estabilização suave de traço (remove tremores)"
            className={`flex items-center gap-1 rounded-xl px-2 py-1 text-[11px] font-medium transition ${
              stabilization
                ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/35'
                : 'text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            <Sparkles className="h-3 w-3" /> Suave
          </button>

          <div className="h-4 w-px bg-zinc-800" />

          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-30"
            title="Desfazer (Ctrl+Z)"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-30"
            title="Refazer (Ctrl+Y)"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            disabled={canvasStrokes.length === 0}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-500/15 hover:text-rose-400 disabled:opacity-30"
            title="Limpar camada de desenho"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="ml-0.5 flex items-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-emerald-500"
            title="Concluir desenho (Esc • Segure Espaço para mover a tela)"
          >
            <Check className="h-3.5 w-3.5" /> Concluir
          </button>
        </div>
      )}
    </>
  );
}