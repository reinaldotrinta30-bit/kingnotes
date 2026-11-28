'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  Position,
  getBezierPath,
  getStraightPath,
  useReactFlow,
} from '@xyflow/react';
import { Tag, X, RotateCw } from 'lucide-react';
import {
  CanvasEdgePathType,
  EdgeArrowType,
  EdgeLabelStyle,
  EdgeLineStyle,
  EdgeWaypoint,
} from '@/domains/knowledge/types';
import { useKnowledgeStore } from '@/domains/knowledge/store/useKnowledgeStore';
import { useUiStore } from '@/domains/ui/store/useUiStore';
import { hexToRgbaString } from '../utils/contrast';
import { getFontFamilyCss, getTextEffectClass } from '../utils/studyFonts';

interface EditableEdgeData {
  pathStyle?: CanvasEdgePathType;
  edgeStyle?: 'solid' | 'dashed' | 'animated';
  lineStyle?: EdgeLineStyle;
  strokeWidth?: number;
  arrowStart?: EdgeArrowType;
  arrowEnd?: EdgeArrowType;
  routingMode?: 'auto' | 'manual';
  waypoints?: EdgeWaypoint[];
  labelPosition?: number;
  labelStyle?: EdgeLabelStyle;
  labelOffset?: { x: number; y: number };
  projectionOffset?: { dx: number; dy: number };
  color?: string;
  onResetToAuto?: (edgeId: string) => void;
}

interface Pt {
  x: number;
  y: number;
}

function dirOf(pos: Position): { x: number; y: number } {
  switch (pos) {
    case Position.Left:
      return { x: -1, y: 0 };
    case Position.Right:
      return { x: 1, y: 0 };
    case Position.Top:
      return { x: 0, y: -1 };
    case Position.Bottom:
      return { x: 0, y: 1 };
  }
}

function computeAutoOrthogonalWaypoints(
  sx: number,
  sy: number,
  sPos: Position,
  tx: number,
  ty: number,
  tPos: Position
): Pt[] {
  const sd = dirOf(sPos);
  const td = dirOf(tPos);
  const dist = Math.hypot(tx - sx, ty - sy);
  const stub = Math.min(28, Math.max(14, dist / 4));

  const s1 = { x: sx + sd.x * stub, y: sy + sd.y * stub };
  const t1 = { x: tx + td.x * stub, y: ty + td.y * stub };
  const srcHoriz = sd.x !== 0;
  const tgtHoriz = td.x !== 0;

  if (srcHoriz && tgtHoriz) {
    const facingWithRoom =
      (sd.x === 1 && td.x === -1 && s1.x <= t1.x) ||
      (sd.x === -1 && td.x === 1 && s1.x >= t1.x);
    if (facingWithRoom) {
      if (Math.abs(sy - ty) < 2) return [];
      const midX = Math.round((sx + tx) / 2);
      return [
        { x: midX, y: sy },
        { x: midX, y: ty },
      ];
    }
    if (sd.x === td.x) {
      const outerX = Math.round(sd.x === 1 ? Math.max(s1.x, t1.x) : Math.min(s1.x, t1.x));
      return [
        { x: outerX, y: sy },
        { x: outerX, y: ty },
      ];
    }
    const midY = Math.abs(sy - ty) < 40 ? Math.round(sy - 56) : Math.round((sy + ty) / 2);
    return [
      { x: Math.round(s1.x), y: sy },
      { x: Math.round(s1.x), y: midY },
      { x: Math.round(t1.x), y: midY },
      { x: Math.round(t1.x), y: ty },
    ];
  }

  if (!srcHoriz && !tgtHoriz) {
    const facingWithRoom =
      (sd.y === 1 && td.y === -1 && s1.y <= t1.y) ||
      (sd.y === -1 && td.y === 1 && s1.y >= t1.y);
    if (facingWithRoom) {
      if (Math.abs(sx - tx) < 2) return [];
      const midY = Math.round((sy + ty) / 2);
      return [
        { x: sx, y: midY },
        { x: tx, y: midY },
      ];
    }
    if (sd.y === td.y) {
      const outerY = Math.round(sd.y === 1 ? Math.max(s1.y, t1.y) : Math.min(s1.y, t1.y));
      return [
        { x: sx, y: outerY },
        { x: tx, y: outerY },
      ];
    }
    const midX = Math.abs(sx - tx) < 40 ? Math.round(sx + 56) : Math.round((sx + tx) / 2);
    return [
      { x: sx, y: Math.round(s1.y) },
      { x: midX, y: Math.round(s1.y) },
      { x: midX, y: Math.round(t1.y) },
      { x: tx, y: Math.round(t1.y) },
    ];
  }

  if (srcHoriz && !tgtHoriz) {
    if ((tx - sx) * sd.x >= 12 && (sy - ty) * td.y >= 12) {
      return [{ x: tx, y: sy }];
    }
    return [
      { x: Math.round(s1.x), y: sy },
      { x: Math.round(s1.x), y: Math.round(t1.y) },
      { x: tx, y: Math.round(t1.y) },
    ];
  }

  if ((ty - sy) * sd.y >= 12 && (sx - tx) * td.x >= 12) {
    return [{ x: sx, y: ty }];
  }
  return [
    { x: sx, y: Math.round(s1.y) },
    { x: Math.round(t1.x), y: Math.round(s1.y) },
    { x: Math.round(t1.x), y: ty },
  ];
}

function adaptOrthogonalWaypointsToEndpoints(
  wps: Pt[],
  sx: number,
  sy: number,
  sPos: Position,
  tx: number,
  ty: number,
  tPos: Position
): Pt[] {
  if (wps.length === 0) return [];
  const srcHoriz = sPos === Position.Left || sPos === Position.Right;
  const tgtHoriz = tPos === Position.Left || tPos === Position.Right;

  if (wps.length === 1) {
    if (srcHoriz && !tgtHoriz) return [{ x: tx, y: sy }];
    if (!srcHoriz && tgtHoriz) return [{ x: sx, y: ty }];
    if (srcHoriz && tgtHoriz) {
      return [
        { x: wps[0].x, y: sy },
        { x: wps[0].x, y: ty },
      ];
    }
    return [
      { x: sx, y: wps[0].y },
      { x: tx, y: wps[0].y },
    ];
  }

  const out = wps.map((p) => ({ ...p }));
  if (srcHoriz) out[0] = { x: out[0].x, y: sy };
  else out[0] = { x: sx, y: out[0].y };

  const last = out.length - 1;
  if (tgtHoriz) out[last] = { x: out[last].x, y: ty };
  else out[last] = { x: tx, y: out[last].y };

  return out;
}

function simplifyOrthogonalPolyline(pts: Pt[]): Pt[] {
  if (pts.length <= 2) return pts;

  const deduped: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const prev = deduped[deduped.length - 1];
    if (Math.hypot(pts[i].x - prev.x, pts[i].y - prev.y) >= 2 || i === pts.length - 1) {
      deduped.push(pts[i]);
    }
  }

  if (deduped.length <= 2) return deduped;

  const cleaned: Pt[] = [deduped[0]];
  for (let i = 1; i < deduped.length - 1; i++) {
    const a = cleaned[cleaned.length - 1];
    const b = deduped[i];
    const c = deduped[i + 1];
    const sameX = Math.abs(a.x - b.x) < 1.5 && Math.abs(b.x - c.x) < 1.5;
    const sameY = Math.abs(a.y - b.y) < 1.5 && Math.abs(b.y - c.y) < 1.5;
    if (!sameX && !sameY) cleaned.push(b);
  }
  cleaned.push(deduped[deduped.length - 1]);
  return cleaned;
}

function buildPolylinePath(
  pts: Pt[],
  pathStyle: CanvasEdgePathType
): string {
  if (pts.length < 2) return '';

  if (pathStyle === 'straight') {
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  }

  if (pathStyle === 'default' || pathStyle === 'organic') {
    if (pts.length === 2) {
      return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} L ${pts[1].x.toFixed(1)} ${pts[1].y.toFixed(1)}`;
    }
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  }

  const radius = 12;
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const next = pts[i + 1];

    const v1x = prev.x - curr.x;
    const v1y = prev.y - curr.y;
    const len1 = Math.hypot(v1x, v1y);

    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;
    const len2 = Math.hypot(v2x, v2y);

    const r = Math.min(radius, len1 / 2, len2 / 2);
    if (r < 2) {
      d += ` L ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
      continue;
    }

    const startX = curr.x + (v1x / len1) * r;
    const startY = curr.y + (v1y / len1) * r;
    const endX = curr.x + (v2x / len2) * r;
    const endY = curr.y + (v2y / len2) * r;

    d += ` L ${startX.toFixed(1)} ${startY.toFixed(1)} Q ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}, ${endX.toFixed(1)} ${endY.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  return d;
}

function sampleCubicBezier(p0: Pt, cp1: Pt, cp2: Pt, p3: Pt, steps: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const inv = 1 - u;
    pts.push({
      x:
        inv * inv * inv * p0.x +
        3 * inv * inv * u * cp1.x +
        3 * inv * u * u * cp2.x +
        u * u * u * p3.x,
      y:
        inv * inv * inv * p0.y +
        3 * inv * inv * u * cp1.y +
        3 * inv * u * u * cp2.y +
        u * u * u * p3.y,
    });
  }
  return pts;
}

function parseAutoBezierToSamples(svgPath: string, fallback: Pt[]): Pt[] {
  const match = svgPath.match(
    /M\s*([-\d.]+)[,\s]+([-\d.]+)\s*C\s*([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)/i
  );
  if (!match) return fallback;
  return sampleCubicBezier(
    { x: Number(match[1]), y: Number(match[2]) },
    { x: Number(match[3]), y: Number(match[4]) },
    { x: Number(match[5]), y: Number(match[6]) },
    { x: Number(match[7]), y: Number(match[8]) },
    28
  );
}

function sampleManualCurvePoints(pts: Pt[]): Pt[] {
  if (pts.length <= 2) return pts;
  const out: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const cp2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    const segSamples = sampleCubicBezier(p1, cp1, cp2, p2, 14);
    if (i > 0) segSamples.shift();
    out.push(...segSamples);
  }
  return out;
}

function normalizeReadableAngle(rad: number): number {
  let deg = (rad * 180) / Math.PI;
  if (deg > 90) deg -= 180;
  if (deg < -90) deg += 180;
  return Math.round(deg);
}

function getPointAtProgress(
  pts: Pt[],
  t: number
): { x: number; y: number; isHoriz: boolean; angleDeg: number } {
  if (pts.length === 0) return { x: 0, y: 0, isHoriz: true, angleDeg: 0 };
  if (pts.length === 1) return { x: pts[0].x, y: pts[0].y, isHoriz: true, angleDeg: 0 };

  const clampedT = Math.max(0.08, Math.min(0.92, t));
  let total = 0;
  const segLengths: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const len = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    segLengths.push(len);
    total += len;
  }

  if (total < 0.001) return { x: pts[0].x, y: pts[0].y, isHoriz: true, angleDeg: 0 };

  const targetDist = total * clampedT;
  let acc = 0;
  for (let i = 0; i < segLengths.length; i++) {
    if (acc + segLengths[i] >= targetDist && segLengths[i] > 0) {
      const localT = (targetDist - acc) / segLengths[i];
      const a = pts[i];
      const b = pts[i + 1];
      return {
        x: a.x + (b.x - a.x) * localT,
        y: a.y + (b.y - a.y) * localT,
        isHoriz: Math.abs(b.y - a.y) <= Math.abs(b.x - a.x),
        angleDeg: normalizeReadableAngle(Math.atan2(b.y - a.y, b.x - a.x)),
      };
    }
    acc += segLengths[i];
  }
  const last = pts[pts.length - 1];
  return { x: last.x, y: last.y, isHoriz: true, angleDeg: 0 };
}

function projectPointToProgress(pts: Pt[], target: Pt): number {
  if (pts.length < 2) return 0.5;

  let total = 0;
  const segLengths: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const len = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    segLengths.push(len);
    total += len;
  }
  if (total < 0.001) return 0.5;

  let bestDistSq = Infinity;
  let bestArcLen = total / 2;
  let acc = 0;

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;

    if (lenSq > 0) {
      const localT = Math.max(
        0,
        Math.min(1, ((target.x - a.x) * dx + (target.y - a.y) * dy) / lenSq)
      );
      const projX = a.x + dx * localT;
      const projY = a.y + dy * localT;
      const distSq = (target.x - projX) ** 2 + (target.y - projY) ** 2;

      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestArcLen = acc + segLengths[i] * localT;
      }
    }
    acc += segLengths[i];
  }

  return Math.round(Math.max(0.08, Math.min(0.92, bestArcLen / total)) * 1000) / 1000;
}

function buildOrganicAutoPath(
  sx: number,
  sy: number,
  sPos: Position,
  tx: number,
  ty: number,
  tPos: Position
): string {
  const sd = dirOf(sPos);
  const td = dirOf(tPos);
  const dx = tx - sx;
  const dy = ty - sy;
  const dist = Math.hypot(dx, dy);
  const tension = Math.min(115, Math.max(38, dist * 0.36));

  let cp1x = sx + sd.x * tension;
  let cp1y = sy + sd.y * tension;
  let cp2x = tx + td.x * tension;
  let cp2y = ty + td.y * tension;

  const nearlyHorizontal = Math.abs(dy) < 28 && sd.x !== 0 && td.x !== 0;
  const nearlyVertical = Math.abs(dx) < 28 && sd.y !== 0 && td.y !== 0;
  if (nearlyHorizontal) {
    const bow = Math.min(30, Math.max(14, dist * 0.12));
    cp1y -= bow;
    cp2y -= bow * 0.55;
  } else if (nearlyVertical) {
    const bow = Math.min(30, Math.max(14, dist * 0.12));
    cp1x += bow;
    cp2x += bow * 0.55;
  }

  return `M ${sx.toFixed(1)},${sy.toFixed(1)} C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)}`;
}

function renderSvgMarker(markerId: string, type: EdgeArrowType, color: string) {
  if (type === 'none') return null;

  if (type === 'dot') {
    return (
      <marker
        id={markerId}
        viewBox="0 0 10 10"
        refX="5"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <circle cx="5" cy="5" r="3.5" fill={color} />
      </marker>
    );
  }

  if (type === 'arrow') {
    return (
      <marker
        id={markerId}
        viewBox="0 0 12 12"
        refX="10"
        refY="6"
        markerWidth="8"
        markerHeight="8"
        orient="auto-start-reverse"
      >
        <path
          d="M 2 2 L 10 6 L 2 10"
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </marker>
    );
  }

  if (type === 'hand') {
    return (
      <marker
        id={markerId}
        viewBox="0 0 16 16"
        refX="12.5"
        refY="8"
        markerWidth="9.5"
        markerHeight="9.5"
        orient="auto-start-reverse"
      >
        <path
          d="M 3 3.2 Q 7.8 6.4 13.2 8 Q 7.8 9.8 3.4 12.8"
          fill="none"
          stroke={color}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </marker>
    );
  }

  return (
    <marker
      id={markerId}
      viewBox="0 0 12 12"
      refX="9.5"
      refY="6"
      markerWidth="8"
      markerHeight="8"
      orient="auto-start-reverse"
    >
      <path d="M 1.5 2 L 10.5 6 L 1.5 10 z" fill={color} />
    </marker>
  );
}

function resolveLabelAppearance(
  ls: EdgeLabelStyle | undefined,
  edgeColor: string,
  theme: 'dark' | 'paper'
): { bg: string; text: string; border: string; borderStyle: 'solid' | 'dashed' | 'none' } {
  const preset = ls?.preset ?? 'auto';
  const canvasSurface = theme === 'paper' ? '#F7F6F2' : '#0F1115';
  const defaultInk = theme === 'paper' ? '#18181b' : '#e4e4e7';
  const accent = ls?.bgColor || edgeColor;

  if (preset === 'transparent') {
    return {
      bg: hexToRgbaString(canvasSurface, 0.88),
      text: ls?.textColor || (theme === 'paper' ? '#18181b' : '#f4f4f5'),
      border: 'transparent',
      borderStyle: 'none',
    };
  }

  if (preset === 'neutral') {
    return {
      bg: canvasSurface,
      text: ls?.textColor || defaultInk,
      border: ls?.borderColor || (theme === 'paper' ? '#d6d3d1' : '#27272a'),
      borderStyle: ls?.borderStyle ?? 'solid',
    };
  }

  if (preset === 'tinted') {
    return {
      bg: theme === 'paper' ? '#ffffff' : '#161920',
      text: ls?.textColor || defaultInk,
      border: ls?.borderColor || hexToRgbaString(accent, 0.7),
      borderStyle: ls?.borderStyle ?? 'solid',
    };
  }

  if (preset === 'solid') {
    return {
      bg: accent,
      text: ls?.textColor || '#ffffff',
      border: ls?.borderColor || accent,
      borderStyle: ls?.borderStyle ?? 'solid',
    };
  }

  if (preset === 'custom') {
    return {
      bg: ls?.bgColor || canvasSurface,
      text: ls?.textColor || defaultInk,
      border: ls?.borderColor || accent,
      borderStyle: ls?.borderStyle ?? 'solid',
    };
  }

  return {
    bg: canvasSurface,
    text: ls?.textColor || defaultInk,
    border: ls?.borderColor || hexToRgbaString(edgeColor, theme === 'paper' ? 0.55 : 0.65),
    borderStyle: ls?.borderStyle ?? 'solid',
  };
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
  label,
  selected,
  data,
}: EdgeProps) {
  const { screenToFlowPosition, setNodes, setEdges } = useReactFlow();
  const updateCanvasEdge = useKnowledgeStore((s) => s.updateCanvasEdge);
  const {
    theme,
    selectedEdgeLabelId,
    setSelectedEdgeLabelId,
    editingEdgeLabelId,
    setEditingEdgeLabelId,
  } = useUiStore();

  const uid = useId().replace(/:/g, '');
  const edgeData = (data as EditableEdgeData | undefined) ?? {};
  const pathStyle = edgeData.pathStyle ?? 'smoothstep';
  const color = edgeData.color ?? '#6366f1';
  const strokeWidth = edgeData.strokeWidth ?? 2;
  const lineStyle: EdgeLineStyle =
    edgeData.lineStyle ?? (edgeData.edgeStyle === 'dashed' ? 'dashed' : 'solid');
  const arrowStart: EdgeArrowType = edgeData.arrowStart ?? 'none';
  const arrowEnd: EdgeArrowType = edgeData.arrowEnd ?? 'arrowclosed';
  const proj = edgeData.projectionOffset ?? { dx: 0, dy: 0 };
  const labelStyle = edgeData.labelStyle;

  const isLabelSelected = selectedEdgeLabelId === id;
  const isEditing = editingEdgeLabelId === id;

  const storedWaypoints = useMemo(
    () => (edgeData.waypoints ?? []).map((w) => ({ x: w.x + proj.dx, y: w.y + proj.dy })),
    [edgeData.waypoints, proj.dx, proj.dy]
  );

  const [isHovered, setIsHovered] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [liveWaypoints, setLiveWaypoints] = useState<Pt[] | null>(null);
  const [liveLabelProgress, setLiveLabelProgress] = useState<number | null>(null);
  const [liveRotation, setLiveRotation] = useState<number | null>(null);
  const [liveSize, setLiveSize] = useState<{ width?: number; height?: number } | null>(null);
  const [draft, setDraft] = useState(typeof label === 'string' ? label : '');

  const labelBoxRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const justDraggedLabelRef = useRef(false);

  // Sincroniza rascunho e foco ao iniciar edição (seja por duplo clique ou pelo botão da barra)
  useEffect(() => {
    if (isEditing) {
      setDraft(typeof label === 'string' ? label : '');
      const t = setTimeout(() => {
        textareaRef.current?.focus();
        textareaRef.current?.select();
      }, 16);
      return () => clearTimeout(t);
    }
  }, [isEditing, label]);

  const enterHover = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setIsHovered(true);
  };

  const leaveHover = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 160);
  };

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setLiveWaypoints(null);
  }, [edgeData.waypoints, edgeData.routingMode, pathStyle]);

  useEffect(() => {
    setLiveLabelProgress(null);
  }, [edgeData.labelPosition]);

  useEffect(() => {
    setLiveRotation(null);
    setLiveSize(null);
  }, [labelStyle?.rotation, labelStyle?.autoRotate, labelStyle?.width, labelStyle?.height]);

  const selectOnlyThisLabel = () => {
    setNodes((nds) => (nds.some((n) => n.selected) ? nds.map((n) => ({ ...n, selected: false })) : nds));
    setEdges((eds) => eds.map((ed) => ({ ...ed, selected: ed.id === id })));
    setSelectedEdgeLabelId(id);
  };

  const isManualStored = edgeData.routingMode === 'manual' && storedWaypoints.length > 0;
  const effectiveWaypoints = useMemo(() => {
    if (liveWaypoints !== null) return liveWaypoints;
    if (pathStyle === 'smoothstep') {
      if (isManualStored) {
        return adaptOrthogonalWaypointsToEndpoints(
          storedWaypoints,
          sourceX,
          sourceY,
          sourcePosition,
          targetX,
          targetY,
          targetPosition
        );
      }
      return computeAutoOrthogonalWaypoints(
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition
      );
    }
    return isManualStored ? storedWaypoints : [];
  }, [
    liveWaypoints,
    pathStyle,
    isManualStored,
    storedWaypoints,
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  ]);

  const fullPolyline: Pt[] = useMemo(
    () => [{ x: sourceX, y: sourceY }, ...effectiveWaypoints, { x: targetX, y: targetY }],
    [sourceX, sourceY, effectiveWaypoints, targetX, targetY]
  );

  const { edgePath, sampledPoints } = useMemo(() => {
    if (pathStyle === 'smoothstep') {
      return {
        edgePath: buildPolylinePath(fullPolyline, 'smoothstep'),
        sampledPoints: fullPolyline,
      };
    }

    if (effectiveWaypoints.length > 0) {
      return {
        edgePath: buildPolylinePath(fullPolyline, pathStyle),
        sampledPoints:
          pathStyle === 'default' || pathStyle === 'organic'
            ? sampleManualCurvePoints(fullPolyline)
            : fullPolyline,
      };
    }

    if (pathStyle === 'organic') {
      const path = buildOrganicAutoPath(
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition
      );
      return {
        edgePath: path,
        sampledPoints: parseAutoBezierToSamples(path, fullPolyline),
      };
    }

    const params = {
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    };

    if (pathStyle === 'straight') {
      const [path] = getStraightPath(params);
      return { edgePath: path, sampledPoints: fullPolyline };
    }

    const [path] = getBezierPath(params);
    return {
      edgePath: path,
      sampledPoints: parseAutoBezierToSamples(path, fullPolyline),
    };
  }, [
    pathStyle,
    fullPolyline,
    effectiveWaypoints.length,
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  ]);

  const labelProgress = liveLabelProgress ?? edgeData.labelPosition ?? 0.5;
  const labelAnchor = useMemo(
    () => getPointAtProgress(sampledPoints, labelProgress),
    [sampledPoints, labelProgress]
  );

  const effectiveRotation =
    liveRotation !== null
      ? liveRotation
      : labelStyle?.autoRotate
      ? labelAnchor.angleDeg
      : labelStyle?.rotation ?? 0;

  const effectiveWidth = liveSize?.width ?? labelStyle?.width;
  const effectiveHeight = liveSize?.height ?? labelStyle?.height;

  const dragSegmentRef = useRef<{
    workPts: Pt[];
    idxA: number;
    idxB: number;
    axis: 'x' | 'y';
  } | null>(null);

  const dragVertexRef = useRef<{ index: number; points: Pt[] } | null>(null);
  const rotateLabelRef = useRef<{ latestAngle: number } | null>(null);

  const resizeLabelRef = useRef<{
    mode: 'right' | 'bottom' | 'corner';
    startLocalX: number;
    startLocalY: number;
    startW: number;
    startH: number;
    latestW?: number;
    latestH?: number;
  } | null>(null);

  const persistWaypoints = (innerDisplayPts: Pt[]) => {
    const clean = innerDisplayPts.map((p) => ({
      x: Math.round(p.x - proj.dx),
      y: Math.round(p.y - proj.dy),
    }));
    updateCanvasEdge(id, {
      routingMode: clean.length > 0 ? 'manual' : 'auto',
      waypoints: clean,
    });
  };

  const hasLabel = typeof label === 'string' && label.trim().length > 0;

  // --- 1. AJUSTADORES DISCRETOS DE SEGMENTO ORTOGONAL ---
  const orthogonalSegments = useMemo(() => {
    if (pathStyle !== 'smoothstep' || (!selected && !isHovered)) return [];
    const list: Array<{
      segIdx: number;
      x: number;
      y: number;
      axis: 'x' | 'y';
    }> = [];

    for (let i = 0; i < fullPolyline.length - 1; i++) {
      const a = fullPolyline[i];
      const b = fullPolyline[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const isOnlySegment = fullPolyline.length === 2;
      if (!isOnlySegment && len < 22) continue;
      if (isOnlySegment && len < 16) continue;

      const isHoriz = Math.abs(b.y - a.y) <= Math.abs(b.x - a.x);
      let hx = (a.x + b.x) / 2;
      let hy = (a.y + b.y) / 2;

      if (hasLabel && Math.hypot(hx - labelAnchor.x, hy - labelAnchor.y) < 32) {
        if (len > 76) {
          const ux = (b.x - a.x) / len;
          const uy = (b.y - a.y) / len;
          hx = a.x + ux * Math.min(len * 0.22, 24);
          hy = a.y + uy * Math.min(len * 0.22, 24);
        } else if (isLabelSelected) {
          continue;
        }
      }

      list.push({
        segIdx: i,
        x: hx,
        y: hy,
        axis: isHoriz ? 'y' : 'x',
      });
    }
    return list;
  }, [
    pathStyle,
    selected,
    isHovered,
    fullPolyline,
    hasLabel,
    isLabelSelected,
    labelAnchor.x,
    labelAnchor.y,
  ]);

  const handleSegmentPointerDown = (
    segIdx: number,
    axis: 'x' | 'y',
    e: React.PointerEvent<HTMLButtonElement>
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);

    const work = fullPolyline.map((p) => ({ ...p }));
    let idxA = segIdx;
    let idxB = segIdx + 1;
    const lastIndex = work.length - 1;

    if (idxA === 0) {
      const p0 = work[0];
      const p1 = work[1];
      const segLen = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      const step = Math.min(24, Math.max(10, segLen * 0.25));
      const ux = segLen > 0 ? (p1.x - p0.x) / segLen : 1;
      const uy = segLen > 0 ? (p1.y - p0.y) / segLen : 0;
      const stubPt = { x: Math.round(p0.x + ux * step), y: Math.round(p0.y + uy * step) };
      work.splice(1, 0, { ...stubPt }, { ...stubPt });
      idxA = 2;
      idxB += 2;
    }

    if (idxB === work.length - 1 && (lastIndex === segIdx + 1 || idxB === work.length - 1)) {
      const pEnd = work[work.length - 1];
      const pPrev = work[work.length - 2];
      const segLen = Math.hypot(pEnd.x - pPrev.x, pEnd.y - pPrev.y);
      const step = Math.min(24, Math.max(10, segLen * 0.25));
      const ux = segLen > 0 ? (pPrev.x - pEnd.x) / segLen : -1;
      const uy = segLen > 0 ? (pPrev.y - pEnd.y) / segLen : 0;
      const stubPt = { x: Math.round(pEnd.x + ux * step), y: Math.round(pEnd.y + uy * step) };
      work.splice(work.length - 1, 0, { ...stubPt }, { ...stubPt });
      idxB = work.length - 3;
    }

    dragSegmentRef.current = { workPts: work, idxA, idxB, axis };
    setLiveWaypoints(work.slice(1, -1));
  };

  const handleSegmentPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragSegmentRef.current;
    if (!drag) return;
    e.stopPropagation();

    const flowPt = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const next = drag.workPts.map((p) => ({ ...p }));

    if (drag.axis === 'x') {
      let targetVal = Math.round(flowPt.x);
      if (Math.abs(targetVal - sourceX) < 6) targetVal = Math.round(sourceX);
      else if (Math.abs(targetVal - targetX) < 6) targetVal = Math.round(targetX);
      next[drag.idxA].x = targetVal;
      next[drag.idxB].x = targetVal;
    } else {
      let targetVal = Math.round(flowPt.y);
      if (Math.abs(targetVal - sourceY) < 6) targetVal = Math.round(sourceY);
      else if (Math.abs(targetVal - targetY) < 6) targetVal = Math.round(targetY);
      next[drag.idxA].y = targetVal;
      next[drag.idxB].y = targetVal;
    }

    drag.workPts = next;
    setLiveWaypoints(next.slice(1, -1));
  };

  const handleSegmentPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragSegmentRef.current;
    if (!drag) return;
    e.stopPropagation();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignora
    }
    const simplified = simplifyOrthogonalPolyline(drag.workPts);
    dragSegmentRef.current = null;
    const inner = simplified.slice(1, -1);
    setLiveWaypoints(inner);
    persistWaypoints(inner);
  };

  // --- 2. AJUSTADORES DISCRETOS (MODOS CURVA / RETA) ---
  const freeSegmentMidpoints = useMemo(() => {
    if (pathStyle === 'smoothstep' || !selected) return [];
    const mids: Array<{ insertIndex: number; x: number; y: number }> = [];
    for (let i = 0; i < fullPolyline.length - 1; i++) {
      const a = fullPolyline[i];
      const b = fullPolyline[i + 1];
      if (Math.hypot(b.x - a.x, b.y - a.y) < 36) continue;
      mids.push({ insertIndex: i, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    }
    return mids;
  }, [pathStyle, selected, fullPolyline]);

  const handleVertexPointerDown = (index: number, e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const startPoints = effectiveWaypoints.map((p) => ({ ...p }));
    dragVertexRef.current = { index, points: startPoints };
    setLiveWaypoints(startPoints);
  };

  const handleFreeMidpointPointerDown = (
    insertIndex: number,
    midX: number,
    midY: number,
    e: React.PointerEvent<HTMLButtonElement>
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const next = effectiveWaypoints.map((p) => ({ ...p }));
    next.splice(insertIndex, 0, { x: midX, y: midY });
    dragVertexRef.current = { index: insertIndex, points: next };
    setLiveWaypoints(next);
  };

  const handleVertexPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragVertexRef.current) return;
    e.stopPropagation();
    const flowPt = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const { index, points } = dragVertexRef.current;
    const updated = points.map((p, idx) =>
      idx === index ? { x: Math.round(flowPt.x), y: Math.round(flowPt.y) } : p
    );
    dragVertexRef.current.points = updated;
    setLiveWaypoints(updated);
  };

  const handleVertexPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragVertexRef.current) return;
    e.stopPropagation();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignora
    }
    const finalPts = dragVertexRef.current.points;
    dragVertexRef.current = null;
    persistWaypoints(finalPts);
  };

  const handleRemoveVertex = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = effectiveWaypoints.filter((_, idx) => idx !== index);
    setLiveWaypoints(next);
    persistWaypoints(next);
  };

  // --- 3. ARRASTO DO RÓTULO VIA WINDOW LISTENERS (NUNCA BLOQUEIA CLICK / DBLCLICK) ---
  const handleLabelPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || isEditing) return;
    // Ignora se clicou em botões internos (excluir, girar, redimensionar)
    if ((e.target as HTMLElement).closest('button')) return;
    e.stopPropagation();

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    let moved = false;
    let latestProgress = labelProgress;
    const pointsSnapshot = sampledPoints;

    const onWinMove = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - startClientX, ev.clientY - startClientY) > 4) {
        moved = true;
      }
      if (moved) {
        const flowPt = screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
        latestProgress = projectPointToProgress(pointsSnapshot, flowPt);
        setLiveLabelProgress(latestProgress);
      }
    };

    const onWinUp = () => {
      window.removeEventListener('pointermove', onWinMove);
      window.removeEventListener('pointerup', onWinUp);
      window.removeEventListener('pointercancel', onWinUp);

      if (moved) {
        justDraggedLabelRef.current = true;
        setTimeout(() => {
          justDraggedLabelRef.current = false;
        }, 60);
        updateCanvasEdge(id, {
          labelPosition: latestProgress,
          labelOffset: undefined,
        });
      }
    };

    window.addEventListener('pointermove', onWinMove);
    window.addEventListener('pointerup', onWinUp);
    window.addEventListener('pointercancel', onWinUp);
  };

  // --- 4. ROTAÇÃO INTERATIVA DO RÓTULO ---
  const handleRotatePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    rotateLabelRef.current = { latestAngle: effectiveRotation };
    setLiveRotation(effectiveRotation);
  };

  const handleRotatePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!rotateLabelRef.current) return;
    e.stopPropagation();
    const flowPt = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    let angle = Math.round(
      (Math.atan2(flowPt.y - labelAnchor.y, flowPt.x - labelAnchor.x) * 180) / Math.PI + 90
    );
    if (angle > 180) angle -= 360;
    if (angle < -180) angle += 360;

    const snapTargets = [0, 45, 90, 135, 180, -180, -135, -90, -45, labelAnchor.angleDeg];
    for (const snap of snapTargets) {
      if (Math.abs(angle - snap) <= 4) {
        angle = snap;
        break;
      }
    }

    rotateLabelRef.current.latestAngle = angle;
    setLiveRotation(angle);
  };

  const handleRotatePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const rot = rotateLabelRef.current;
    if (!rot) return;
    e.stopPropagation();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignora
    }
    rotateLabelRef.current = null;
    updateCanvasEdge(id, {
      labelStyle: {
        ...labelStyle,
        rotation: rot.latestAngle,
        autoRotate: false,
      },
    });
  };

  // --- 5. REDIMENSIONAMENTO HORIZONTAL / VERTICAL DO RÓTULO ---
  const toLocalLabelCoords = (clientX: number, clientY: number) => {
    const flowPt = screenToFlowPosition({ x: clientX, y: clientY });
    const vx = flowPt.x - labelAnchor.x;
    const vy = flowPt.y - labelAnchor.y;
    const rad = (effectiveRotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return {
      lx: vx * cos + vy * sin,
      ly: -vx * sin + vy * cos,
    };
  };

  const handleResizePointerDown = (
    mode: 'right' | 'bottom' | 'corner',
    e: React.PointerEvent<HTMLButtonElement>
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const { lx, ly } = toLocalLabelCoords(e.clientX, e.clientY);
    const box = labelBoxRef.current;
    const startW = effectiveWidth ?? (box ? Math.round(box.offsetWidth) : 84);
    const startH = effectiveHeight ?? (box ? Math.round(box.offsetHeight) : 26);

    resizeLabelRef.current = {
      mode,
      startLocalX: lx,
      startLocalY: ly,
      startW,
      startH,
      latestW: effectiveWidth,
      latestH: effectiveHeight,
    };
  };

  const handleResizePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const res = resizeLabelRef.current;
    if (!res) return;
    e.stopPropagation();
    const { lx, ly } = toLocalLabelCoords(e.clientX, e.clientY);
    const nextSize: { width?: number; height?: number } = {
      width: res.latestW,
      height: res.latestH,
    };

    if (res.mode === 'right' || res.mode === 'corner') {
      const w = Math.round(Math.max(48, Math.min(380, res.startW + (lx - res.startLocalX) * 2)));
      nextSize.width = w;
      res.latestW = w;
    }
    if (res.mode === 'bottom' || res.mode === 'corner') {
      const h = Math.round(Math.max(24, Math.min(240, res.startH + (ly - res.startLocalY) * 2)));
      nextSize.height = h;
      res.latestH = h;
    }

    setLiveSize(nextSize);
  };

  const handleResizePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const res = resizeLabelRef.current;
    if (!res) return;
    e.stopPropagation();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignora
    }
    resizeLabelRef.current = null;
    updateCanvasEdge(id, {
      labelStyle: {
        ...labelStyle,
        ...(res.latestW !== undefined ? { width: res.latestW } : {}),
        ...(res.latestH !== undefined ? { height: res.latestH } : {}),
      },
    });
  };

  const startEditingAt = (e: React.MouseEvent, customProgress?: number) => {
    e.stopPropagation();
    if (customProgress !== undefined && !hasLabel) {
      setLiveLabelProgress(customProgress);
    }
    selectOnlyThisLabel();
    setDraft(typeof label === 'string' ? label : '');
    setEditingEdgeLabelId(id);
  };

  const handleDoubleClickPath = (e: React.MouseEvent) => {
    const flowPt = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const clickT = projectPointToProgress(sampledPoints, flowPt);
    startEditingAt(e, clickT);
  };

  const commitLabel = () => {
    setEditingEdgeLabelId(null);
    const trimmed = draft.trim();
    const prevLabel = typeof label === 'string' ? label : '';
    if (trimmed !== prevLabel || (trimmed && liveLabelProgress !== null)) {
      updateCanvasEdge(id, {
        label: trimmed || undefined,
        labelPosition: trimmed ? liveLabelProgress ?? edgeData.labelPosition ?? 0.5 : undefined,
        labelOffset: undefined,
      });
    }
    if (!trimmed) setSelectedEdgeLabelId(null);
    setLiveLabelProgress(null);
  };

  const handleClearLabelOnly = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEdgeLabelId(null);
    setDraft('');
    setLiveLabelProgress(null);
    setSelectedEdgeLabelId(null);
    updateCanvasEdge(id, {
      label: undefined,
      labelPosition: undefined,
      labelStyle: undefined,
      labelOffset: undefined,
    });
  };

  const dashArray =
    lineStyle === 'dashed' ? '7 5' : lineStyle === 'dotted' ? '2 5' : undefined;

  const markerStartId = `kc-ms-${uid}`;
  const markerEndId = `kc-me-${uid}`;
  const labelVisual = resolveLabelAppearance(labelStyle, color, theme);

  const addIconX = labelAnchor.x + (labelAnchor.isHoriz ? 0 : 15);
  const addIconY = labelAnchor.y + (labelAnchor.isHoriz ? -15 : 0);
  const isOrganic = pathStyle === 'organic';
  const organicFilterId = `kc-eof-${uid}`;

  return (
    <>
      <defs>
        {isOrganic && (
          <filter id={organicFilterId} x="-8%" y="-8%" width="116%" height="116%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.03"
              numOctaves="2"
              seed="5"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="1.8"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        )}
        {renderSvgMarker(markerStartId, arrowStart, color)}
        {renderSvgMarker(markerEndId, arrowEnd, color)}
      </defs>

      <BaseEdge
        id={id}
        path={edgePath}
        markerStart={arrowStart !== 'none' ? `url(#${markerStartId})` : undefined}
        markerEnd={arrowEnd !== 'none' ? `url(#${markerEndId})` : undefined}
        style={{
          ...style,
          stroke: color,
          strokeWidth: selected
            ? Math.max(isOrganic ? 3.2 : 2.3, strokeWidth + 0.6)
            : isOrganic
            ? Math.max(2.6, strokeWidth + 0.5)
            : strokeWidth,
          strokeDasharray: dashArray,
          strokeLinecap: isOrganic ? 'round' : undefined,
          strokeLinejoin: isOrganic ? 'round' : undefined,
          filter: isOrganic ? `url(#${organicFilterId})` : undefined,
        }}
      />

      {/* Área invisível confortável para hover e duplo clique direto na linha */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={22}
        className="react-flow__edge-interaction cursor-pointer"
        onMouseEnter={enterHover}
        onMouseLeave={leaveHover}
        onDoubleClick={handleDoubleClickPath}
        onContextMenu={(e) => e.preventDefault()}
      />

      <EdgeLabelRenderer>
        {/* 1. AJUSTADORES DISCRETOS DE SEGMENTO ORTOGONAL (FILETE NA COR DA SETA) */}
        {pathStyle === 'smoothstep' &&
          orthogonalSegments.map((seg) => (
            <button
              key={`oseg-${seg.segIdx}`}
              type="button"
              onMouseEnter={enterHover}
              onMouseLeave={leaveHover}
              onPointerDown={(e) => handleSegmentPointerDown(seg.segIdx, seg.axis, e)}
              onPointerMove={handleSegmentPointerMove}
              onPointerUp={handleSegmentPointerUp}
              onDoubleClick={(e) => {
                e.stopPropagation();
                edgeData.onResetToAuto?.(id);
              }}
              onContextMenu={(e) => e.preventDefault()}
              style={{
                position: 'absolute',
                left: seg.x,
                top: seg.y,
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'all',
              }}
              className={`group/grip nodrag nopan z-40 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-transparent ${
                seg.axis === 'x' ? 'cursor-ew-resize' : 'cursor-ns-resize'
              }`}
              title="Arraste para ajustar o trajeto • Duplo clique para restaurar o melhor caminho automático"
            >
              <span
                style={{ backgroundColor: color }}
                className={`rounded-full opacity-55 ring-1 ring-white/70 transition-all duration-150 group-hover/grip:opacity-100 ${
                  seg.axis === 'x' ? 'h-3.5 w-[3px]' : 'h-[3px] w-3.5'
                }`}
              />
            </button>
          ))}

        {/* 2. AJUSTADORES DISCRETOS (MODOS CURVA / RETA) */}
        {pathStyle !== 'smoothstep' &&
          freeSegmentMidpoints.map((mid) => (
            <button
              key={`fmid-${mid.insertIndex}`}
              type="button"
              onMouseEnter={enterHover}
              onMouseLeave={leaveHover}
              onPointerDown={(e) => handleFreeMidpointPointerDown(mid.insertIndex, mid.x, mid.y, e)}
              onPointerMove={handleVertexPointerMove}
              onPointerUp={handleVertexPointerUp}
              onContextMenu={(e) => e.preventDefault()}
              style={{
                position: 'absolute',
                left: mid.x,
                top: mid.y,
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'all',
              }}
              className="group/fmid nodrag nopan z-40 flex h-4 w-4 cursor-grab items-center justify-center rounded-full bg-transparent active:cursor-grabbing"
              title="Arraste para dobrar a conexão"
            >
              <span
                style={{ borderColor: color }}
                className="h-1.5 w-1.5 rounded-full border bg-[#161920] opacity-60 transition-transform duration-100 group-hover/fmid:scale-125 group-hover/fmid:opacity-100"
              />
            </button>
          ))}

        {pathStyle !== 'smoothstep' &&
          selected &&
          effectiveWaypoints.map((wp, idx) => (
            <button
              key={`fwp-${idx}`}
              type="button"
              onMouseEnter={enterHover}
              onMouseLeave={leaveHover}
              onPointerDown={(e) => handleVertexPointerDown(idx, e)}
              onPointerMove={handleVertexPointerMove}
              onPointerUp={handleVertexPointerUp}
              onDoubleClick={(e) => handleRemoveVertex(idx, e)}
              onContextMenu={(e) => e.preventDefault()}
              style={{
                position: 'absolute',
                left: wp.x,
                top: wp.y,
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'all',
              }}
              className="group/fwp nodrag nopan z-50 flex h-4 w-4 cursor-grab items-center justify-center rounded-full bg-transparent active:cursor-grabbing"
              title="Arraste para mover • Duplo clique para remover"
            >
              <span
                style={{ backgroundColor: color }}
                className="h-2 w-2 rounded-full border border-white/90 opacity-85 transition-transform duration-100 group-hover/fwp:scale-125 group-hover/fwp:opacity-100"
              />
            </button>
          ))}

        {/* 3. RÓTULO DA CONEXÃO: CLIQUE ESQUERDO PERSONALIZA, DUPLO CLIQUE EDITA, ARRASTO DESLIZA NA SETA */}
        {(hasLabel || isEditing) && (
          <div
            onMouseEnter={enterHover}
            onMouseLeave={leaveHover}
            onPointerDown={hasLabel ? handleLabelPointerDown : undefined}
            onClick={(e) => {
              e.stopPropagation();
              if (isEditing || justDraggedLabelRef.current) return;
              selectOnlyThisLabel();
            }}
            onDoubleClick={(e) => {
              if (!isEditing) startEditingAt(e);
            }}
            onContextMenu={(e) => {
              if (!isEditing) e.preventDefault();
            }}
            style={{
              position: 'absolute',
              left: labelAnchor.x,
              top: labelAnchor.y,
              transform: `translate(-50%, -50%) rotate(${effectiveRotation}deg)`,
              pointerEvents: 'all',
            }}
            className="group/lbl nodrag nopan z-50"
          >
            {/* Alça superior de rotação */}
            {hasLabel && isLabelSelected && !isEditing && (
              <div className="pointer-events-none absolute -top-6 left-1/2 flex -translate-x-1/2 flex-col items-center">
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={handleRotatePointerDown}
                  onPointerMove={handleRotatePointerMove}
                  onPointerUp={handleRotatePointerUp}
                  onContextMenu={(e) => e.preventDefault()}
                  className="pointer-events-auto flex h-4 w-4 cursor-grab items-center justify-center rounded-full border border-indigo-400 bg-[#161920] text-indigo-300 shadow-md transition hover:bg-indigo-600 hover:text-white active:cursor-grabbing"
                  title="Arraste para girar o rótulo"
                >
                  <RotateCw className="h-2.5 w-2.5" />
                </button>
                <span className="h-2 w-px bg-indigo-400/70" />
                {liveRotation !== null && (
                  <span className="absolute -top-5 rounded bg-[#161920]/95 px-1.5 py-0.5 font-mono text-[9px] text-indigo-200 shadow">
                    {liveRotation}°
                  </span>
                )}
              </div>
            )}

            {isEditing ? (
              <textarea
                ref={textareaRef}
                rows={effectiveHeight && effectiveHeight > 44 ? 3 : 1}
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
                    setEditingEdgeLabelId(null);
                    setLiveLabelProgress(null);
                  }
                }}
                style={{
                  width: effectiveWidth ?? 148,
                  minHeight: effectiveHeight ?? 28,
                  fontSize: `${labelStyle?.fontSize ?? 11}px`,
                  textAlign: labelStyle?.textAlign ?? 'center',
                  fontFamily: getFontFamilyCss(labelStyle?.fontFamily),
                  ['--kc-fx-color' as string]: labelStyle?.effectColor ?? '#0f172a',
                  ['--kc-fx-start' as string]: labelVisual.text,
                }}
                placeholder="Rótulo..."
                className="resize-none rounded-lg border border-indigo-500 bg-[#161920] px-2 py-1 font-medium text-zinc-100 shadow-xl focus:outline-none"
              />
            ) : (
              <div
                ref={labelBoxRef}
                style={{
                  backgroundColor: labelVisual.bg,
                  color: labelVisual.text,
                  borderColor: isLabelSelected ? '#818cf8' : labelVisual.border,
                  borderStyle: labelVisual.borderStyle === 'none' ? 'solid' : labelVisual.borderStyle,
                  borderWidth: labelVisual.borderStyle === 'none' && !isLabelSelected ? 0 : 1,
                  fontSize: `${labelStyle?.fontSize ?? 11}px`,
                  fontWeight:
                    labelStyle?.fontWeight === 'bold'
                      ? 700
                      : labelStyle?.fontWeight === 'normal'
                      ? 400
                      : 500,
                  textAlign: labelStyle?.textAlign ?? 'center',
                  width: effectiveWidth ? `${effectiveWidth}px` : undefined,
                  height: effectiveHeight ? `${effectiveHeight}px` : undefined,
                  fontFamily: getFontFamilyCss(labelStyle?.fontFamily),
                  ['--kc-fx-color' as string]: labelStyle?.effectColor ?? '#0f172a',
                  ['--kc-fx-start' as string]: labelVisual.text,
                }}
                title="Clique para personalizar • Arraste ao longo da seta • Duplo clique para editar texto"
                className={`relative flex cursor-grab items-center justify-center rounded-md px-2 py-0.5 shadow-sm transition active:cursor-grabbing ${
                  isLabelSelected ? 'ring-2 ring-indigo-500/60' : ''
                }`}
              >
                <span
                  style={{
                    fontStyle: labelStyle?.italic ? 'italic' : 'normal',
                    textDecorationLine:
                      [
                        labelStyle?.underline && labelStyle.underlineStyle !== 'brush'
                          ? 'underline'
                          : '',
                        labelStyle?.strikethrough ? 'line-through' : '',
                      ]
                        .filter(Boolean)
                        .join(' ') || 'none',
                    textDecorationStyle:
                      labelStyle?.underline && labelStyle.underlineStyle !== 'brush'
                        ? labelStyle.underlineStyle ?? 'solid'
                        : undefined,
                    textDecorationColor:
                      labelStyle?.underline &&
                      labelStyle.underlineStyle !== 'brush' &&
                      labelStyle.underlineColor
                        ? labelStyle.underlineColor
                        : undefined,
                    textUnderlineOffset:
                      labelStyle?.underline && labelStyle.underlineStyle !== 'brush'
                        ? '3px'
                        : undefined,
                    textDecorationThickness:
                      labelStyle?.underline && labelStyle.underlineStyle !== 'brush'
                        ? '2px'
                        : undefined,
                    ...(labelStyle?.underline && labelStyle.underlineStyle === 'brush'
                      ? {
                          ['--kc-ul-color' as string]:
                            labelStyle.underlineColor || labelVisual.text,
                        }
                      : {}),
                  }}
                  className={`w-full select-none whitespace-pre-wrap break-words leading-snug ${getTextEffectClass(
                    labelStyle?.textEffect
                  )} ${
                    labelStyle?.underline && labelStyle.underlineStyle === 'brush'
                      ? 'kc-ul kc-ul-brush'
                      : ''
                  }`}
                >
                  {label}
                </span>

                {/* Excluir apenas o rótulo */}
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={handleClearLabelOnly}
                  onContextMenu={(e) => e.preventDefault()}
                  title="Remover apenas o rótulo (mantém a conexão)"
                  aria-label="Remover rótulo da conexão"
                  className={`absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full border border-zinc-700 bg-[#161920] text-zinc-400 shadow transition hover:border-rose-500/60 hover:bg-rose-500/20 hover:text-rose-400 ${
                    isLabelSelected ? 'opacity-100' : 'opacity-0 group-hover/lbl:opacity-100'
                  }`}
                >
                  <X className="h-2.5 w-2.5" />
                </button>

                {/* Alças de redimensionamento horizontal, vertical e canto */}
                {isLabelSelected && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => handleResizePointerDown('right', e)}
                      onPointerMove={handleResizePointerMove}
                      onPointerUp={handleResizePointerUp}
                      onContextMenu={(e) => e.preventDefault()}
                      className="absolute -right-1.5 top-1/2 h-3.5 w-1.5 -translate-y-1/2 cursor-ew-resize rounded-full bg-indigo-400 shadow"
                      title="Arraste para ajustar largura"
                    />
                    <button
                      type="button"
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => handleResizePointerDown('bottom', e)}
                      onPointerMove={handleResizePointerMove}
                      onPointerUp={handleResizePointerUp}
                      onContextMenu={(e) => e.preventDefault()}
                      className="absolute -bottom-1.5 left-1/2 h-1.5 w-3.5 -translate-x-1/2 cursor-ns-resize rounded-full bg-indigo-400 shadow"
                      title="Arraste para ajustar altura"
                    />
                    <button
                      type="button"
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => handleResizePointerDown('corner', e)}
                      onPointerMove={handleResizePointerMove}
                      onPointerUp={handleResizePointerUp}
                      onContextMenu={(e) => e.preventDefault()}
                      className="absolute -bottom-1.5 -right-1.5 h-2.5 w-2.5 cursor-nwse-resize rounded-sm border border-white bg-indigo-500 shadow"
                      title="Arraste para redimensionar livremente"
                    />
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* 4. MICRO-ÍCONE SUTIL PARA ADICIONAR RÓTULO (APENAS NO HOVER QUANDO NÃO HÁ TEXTO) */}
        {!hasLabel && !isEditing && isHovered && (
          <button
            type="button"
            onMouseEnter={enterHover}
            onMouseLeave={leaveHover}
            onClick={(e) => startEditingAt(e, 0.5)}
            onContextMenu={(e) => e.preventDefault()}
            style={{
              position: 'absolute',
              left: addIconX,
              top: addIconY,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'all',
            }}
            title="Adicionar rótulo (ou duplo clique na conexão)"
            aria-label="Adicionar rótulo na conexão"
            className={`nodrag nopan z-50 flex h-4 w-4 items-center justify-center rounded-full border shadow-sm backdrop-blur-md transition-colors ${
              theme === 'paper'
                ? 'border-stone-300 bg-white/95 text-stone-500 hover:border-indigo-500 hover:text-indigo-600'
                : 'border-zinc-700/90 bg-[#161920]/95 text-zinc-400 hover:border-indigo-400 hover:text-indigo-300'
            }`}
          >
            <Tag className="h-2.5 w-2.5" />
          </button>
        )}
      </EdgeLabelRenderer>
    </>
  );
}