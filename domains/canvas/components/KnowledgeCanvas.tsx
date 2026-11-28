'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ReactFlow,
  Background,
  MiniMap,
  Connection,
  ConnectionMode,
  SelectionMode,
  Node,
  Edge,
  BackgroundVariant,
  Panel,
  useReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  Viewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Plus,
  Scale,
  BookOpenCheck,
  FolderPlus,
  ImagePlus,
  Hand,
  MousePointer2,
  Focus,
  ZoomIn,
  ZoomOut,
  Maximize,
  Lock,
  Unlock,
  LayoutTemplate,
  GitCommit,
  FileText,
  Copy,
  Trash2,
  Undo2,
  Redo2,
  Flame,
  Eye,
  EyeOff,
  Sparkles,
  PenTool,
  Group,
  Crop,
  RotateCw,
  FlipHorizontal2,
  FlipVertical2,
  RotateCcw,
  Link2,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  ArrowUpRightFromSquare,
  Minimize2,
  FileType,
  Shapes,
  GitBranch,
  Tag,
  Bold,
  ArrowLeft,
  Wand2,
  Pencil,
  FolderTree,
  ChevronRight,
  Sticker,
  X,
} from 'lucide-react';
import { useKnowledgeStore } from '@/domains/knowledge/store/useKnowledgeStore';
import { CanvasSpotlightMode, useUiStore } from '@/domains/ui/store/useUiStore';
import {
  CanvasConnection,
  CanvasNodePosition,
  CanvasStroke,
  KnowledgeCardMeta,
  TopicShape,
  EdgeLineStyle,
  EdgeArrowType,
  EdgeLabelStyle,
  EdgeWaypoint,
  CanvasEdgePathType,
} from '@/domains/knowledge/types';
import { getKnowledgeRepository } from '@/infrastructure/persistence/repositoryFactory';
import { KnowledgeCardNode } from './KnowledgeCardNode';
import { GroupNode } from './GroupNode';
import { CanvasImageNode } from './CanvasImageNode';
import { CanvasTextNode } from './CanvasTextNode';
import { PanoramaSectionNode } from './PanoramaSectionNode';
import { CanvasTopicNode } from './CanvasTopicNode';
import { TypographyPopover } from './TypographyPopover';
import { CalloutCustomizerPopover } from './CalloutCustomizerPopover';
import {
  DEFAULT_CARD_TYPOGRAPHY,
  DEFAULT_TEXT_TYPOGRAPHY,
  DEFAULT_TOPIC_TYPOGRAPHY,
  resolveCardCallout,
} from '@/domains/knowledge/utils/defaults';
import {
  computePanoramaLayout,
  syncActiveProjectionOffsets,
} from '../utils/panoramaLayout';
import { EditableEdge } from './EditableEdge';
import { StickerLibraryPanel } from './StickerLibraryPanel';
import { OutlineEditorView } from './OutlineEditorView';
import { DrawingLayer } from './DrawingLayer';
import { computeMultiAxisLayout, LayoutDirection } from '../utils/autoLayout';
import { prepareCanvasImage } from '../utils/imageBlob';
import {
  getHierarchyBreadcrumb,
  matchesHierarchyContext,
} from '@/domains/knowledge/utils/hierarchyContext';

const nodeTypes = {
  knowledgeCard: KnowledgeCardNode,
  canvasGroup: GroupNode,
  canvasImage: CanvasImageNode,
  canvasText: CanvasTextNode,
  panoramaSection: PanoramaSectionNode,
  canvasTopic: CanvasTopicNode,
};

const edgeTypes = {
  editable: EditableEdge,
};

const EDGE_COLORS = ['#6366f1', '#818cf8', '#38bdf8', '#10b981', '#f59e0b', '#f43f5e', '#a1a1aa'];

const GROUP_PALETTE = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#a855f7', '#71717a'];

const CARD_COLOR_OPTIONS: Array<{ id: KnowledgeCardMeta['color']; dot: string; label: string }> = [
  { id: 'default', dot: '#52525b', label: 'Neutro' },
  { id: 'violet', dot: '#8b5cf6', label: 'Violeta' },
  { id: 'sky', dot: '#0ea5e9', label: 'Azul' },
  { id: 'emerald', dot: '#10b981', label: 'Verde' },
  { id: 'amber', dot: '#f59e0b', label: 'Âmbar' },
  { id: 'rose', dot: '#f43f5e', label: 'Rosa' },
];

const PAPER_OPTIONS: Array<{ id: NonNullable<KnowledgeCardMeta['paperStyle']>; label: string }> = [
  { id: 'plain', label: 'Liso' },
  { id: 'lined', label: 'Pautado' },
  { id: 'grid', label: 'Quadriculado' },
  { id: 'dotted', label: 'Pontilhado' },
  { id: 'cornell', label: 'Cornell' },
];

const SPOTLIGHT_OPTIONS: Array<{ id: CanvasSpotlightMode; label: string }> = [
  { id: 'none', label: 'Desligado (ver tudo)' },
  { id: 'due', label: 'Destacar Vencidos' },
  { id: 'critical', label: 'Destacar Críticos' },
  { id: 'pinned', label: 'Destacar Pins' },
  { id: 'favorites', label: 'Destacar Favoritos' },
];

const QUICK_STICKERS = ['💡', '⚠️', '📌', '🧠', '✅', '⚖️', '🎯'];

function computeBestEdgeHandles(sourceNode: Node, targetNode: Node) {
  const sW = Number(sourceNode.measured?.width || sourceNode.style?.width || 350);
  const sH = Number(sourceNode.measured?.height || sourceNode.style?.height || 240);
  const tW = Number(targetNode.measured?.width || targetNode.style?.width || 350);
  const tH = Number(targetNode.measured?.height || targetNode.style?.height || 240);

  const dx = targetNode.position.x + tW / 2 - (sourceNode.position.x + sW / 2);
  const dy = targetNode.position.y + tH / 2 - (sourceNode.position.y + sH / 2);

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? { s: 's-right', t: 't-left' } : { s: 's-left', t: 't-right' };
  }
  return dy > 0 ? { s: 's-bottom', t: 't-top' } : { s: 's-top', t: 't-bottom' };
}

function CanvasInner() {
  const { screenToFlowPosition, getNodes, getEdges, zoomIn, zoomOut, getViewport, setViewport } =
    useReactFlow();

  const containerRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const {
    theme,
    preferences,
    addToast,
    openConfirm,
    focusRequest,
    clearFocusRequest,
    triggerCardHighlight,
    zenMode,
    canvasRecallMode,
    toggleCanvasRecallMode,
    canvasSpotlight,
    setCanvasSpotlight,
    inlineEditingCardId,
    setInlineEditingCardId,
    setCanvasZoomedOut,
    croppingImageNodeId,
    setCroppingImageNodeId,
    editingTextNodeId,
    setEditingTextNodeId,
    editingTopicNodeId,
    setEditingTopicNodeId,
    selectedEdgeLabelId,
    setSelectedEdgeLabelId,
    editingEdgeLabelId,
    setEditingEdgeLabelId,
    clearTransientCanvasUi,
  } = useUiStore();
  const {
    activeWorkspaceId,
    cardsById,
    canvasNodes,
    canvasEdges,
    canvasStrokes,
    hierarchy,
    selectedHierarchyId,
    selectHierarchy,
    activeCardId,
    openCard,
    createCardOnCanvas,
    createCanvasGroup,
    createCanvasImage,
    updateCanvasNode,
    createCanvasText,
    duplicateCanvasText,
    createCanvasTopic,
    createSubtopic,
    duplicateCanvasTopic,
    updateCanvasEdge,
    deleteCanvasEdge,
    promoteTextNodeToCard,
    convertCardToTextNode,
    undoConvertCardToText,
    persistNodePositions,
    addCanvasEdge,
    updateCanvasEdgesBulk,
    updateCardMeta,
    updateCardsMetaBulk,
    deleteCanvasSelection,
    duplicateCanvasNodes,
    importOutlineToCanvas,
    restoreCanvasSnapshot,
  } = useKnowledgeStore();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const [isOutlineMode, setIsOutlineMode] = useState(false);
  const [outlineDraft, setOutlineDraft] = useState('');

  const [interactionMode, setInteractionMode] = useState<'pan' | 'select' | 'focus'>('pan');
  const [isLocked, setIsLocked] = useState(false);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isDraggingImageFile, setIsDraggingImageFile] = useState(false);
  const [isPlacingText, setIsPlacingText] = useState(false);
  const [liveViewport, setLiveViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [openHeaderMenu, setOpenHeaderMenu] = useState<null | 'layout' | 'edge' | 'spotlight'>(null);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [isStickerPanelOpen, setIsStickerPanelOpen] = useState(false);

  const [globalEdgeType, setGlobalEdgeType] = useState<CanvasEdgePathType>('smoothstep');
  const [globalAnimated, setGlobalAnimated] = useState(false);
  const [globalColor, setGlobalColor] = useState('#6366f1');

  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (zenMode || isOutlineMode) {
      setHeaderSlot(null);
      return;
    }
    setHeaderSlot(document.getElementById('kc-header-tools-slot'));
  }, [zenMode, isOutlineMode]);

  const historyRef = useRef<{
    past: Array<{ nodes: CanvasNodePosition[]; edges: CanvasConnection[]; strokes: CanvasStroke[] }>;
    future: Array<{ nodes: CanvasNodePosition[]; edges: CanvasConnection[]; strokes: CanvasStroke[] }>;
  }>({ past: [], future: [] });
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const clipboardIdsRef = useRef<string[]>([]);
  const viewportHistory = useRef<Viewport[]>([]);
  const lastRightClickRef = useRef<number>(0);

  const connectingNodeId = useRef<string | null>(null);
  const connectingHandleId = useRef<string | null>(null);

  // Motor unificado de movimentação múltipla (Ctrl, Shift, Caixa de Seleção e Grupos)
  const multiDragRef = useRef<{
    anchorNodeId: string;
    anchorStartX: number;
    anchorStartY: number;
    rfMovingIds: Set<string>;
    movingNodeIds: Set<string>;
    extraGroupChildren: Array<{ id: string; startX: number; startY: number }>;
    internalEdgesWithWaypoints: Array<{ id: string; origWaypoints: EdgeWaypoint[] }>;
    frontierAutoEdgeIds: Set<string>;
  } | null>(null);

  const getSmartViewportPos = useCallback(
    (itemW = 350, itemH = 240) => {
      const rect = containerRef.current?.getBoundingClientRect();
      const centerScreen = rect
        ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2 };

      const flowCenter = screenToFlowPosition(centerScreen);
      let x = Math.round(flowCenter.x - itemW / 2);
      let y = Math.round(flowCenter.y - itemH / 2);

      const existing = useKnowledgeStore.getState().canvasNodes;
      let attempts = 0;
      while (
        attempts < 8 &&
        existing.some(
          (n) => n.nodeType !== 'group' && Math.abs(n.x - x) < 36 && Math.abs(n.y - y) < 36
        )
      ) {
        x += 36;
        y += 36;
        attempts += 1;
      }
      return { x, y };
    },
    [screenToFlowPosition]
  );

  const pushHistorySnapshot = useCallback(() => {
    const state = useKnowledgeStore.getState();
    historyRef.current.past.push({
      nodes: state.canvasNodes.map((n) => ({ ...n })),
      edges: state.canvasEdges.map((e) => ({ ...e })),
      strokes: state.canvasStrokes.map((st) => ({ ...st })),
    });
    if (historyRef.current.past.length > 50) historyRef.current.past.shift();
    historyRef.current.future = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const handleQuickSubtopic = useCallback(
    async (
      parentId: string,
      options?: { label?: string; shape?: TopicShape; edgeLabel?: string }
    ) => {
      pushHistorySnapshot();
      const created = await createSubtopic(parentId, options);
      if (created) {
        setEditingTopicNodeId(created.nodeId);
      }
    },
    [pushHistorySnapshot, createSubtopic, setEditingTopicNodeId]
  );

  const handleResetEdgeToAuto = useCallback(
    async (edgeId: string) => {
      const targetEdge = useKnowledgeStore
        .getState()
        .canvasEdges.find((e) => e.id === edgeId);
      if (!targetEdge) return;

      pushHistorySnapshot();
      const allNodes = getNodes();
      const srcNode = allNodes.find((n) => n.id === targetEdge.sourceNodeId);
      const tgtNode = allNodes.find((n) => n.id === targetEdge.targetNodeId);
      const best = srcNode && tgtNode ? computeBestEdgeHandles(srcNode, tgtNode) : null;

      await updateCanvasEdge(edgeId, {
        routingMode: 'auto',
        waypoints: [],
        ...(best ? { sourceHandle: best.s, targetHandle: best.t } : {}),
      });

      addToast(
        { message: 'Conexão restaurada para o melhor caminho automático', variant: 'success' },
        2400
      );
    },
    [pushHistorySnapshot, getNodes, updateCanvasEdge, addToast]
  );

  const handleUndo = useCallback(async () => {
    const prev = historyRef.current.past.pop();
    if (!prev) return;
    const state = useKnowledgeStore.getState();
    historyRef.current.future.push({
      nodes: state.canvasNodes.map((n) => ({ ...n })),
      edges: state.canvasEdges.map((e) => ({ ...e })),
      strokes: state.canvasStrokes.map((st) => ({ ...st })),
    });
    await restoreCanvasSnapshot(prev.nodes, prev.edges, prev.strokes);
    setCanUndo(historyRef.current.past.length > 0);
    setCanRedo(true);
  }, [restoreCanvasSnapshot]);

  const handleRedo = useCallback(async () => {
    const next = historyRef.current.future.pop();
    if (!next) return;
    const state = useKnowledgeStore.getState();
    historyRef.current.past.push({
      nodes: state.canvasNodes.map((n) => ({ ...n })),
      edges: state.canvasEdges.map((e) => ({ ...e })),
      strokes: state.canvasStrokes.map((st) => ({ ...st })),
    });
    await restoreCanvasSnapshot(next.nodes, next.edges, next.strokes);
    setCanUndo(true);
    setCanRedo(historyRef.current.future.length > 0);
  }, [restoreCanvasSnapshot]);

  const saveViewport = useCallback(() => {
    viewportHistory.current.push(getViewport());
  }, [getViewport]);

  const fitCanvasWithMargins = useCallback(
    (options?: { nodeIds?: string[]; duration?: number; maxZoom?: number }) => {
      const container = containerRef.current;
      const allNodes = getNodes().filter((n) => !n.hidden);
      const targets = options?.nodeIds
        ? allNodes.filter((n) => options.nodeIds!.includes(n.id))
        : allNodes;

      const duration = options?.duration ?? 450;

      if (!container || targets.length === 0) {
        const neutral: Viewport = { x: 0, y: 0, zoom: 1 };
        setViewport(neutral, { duration });
        setLiveViewport(neutral);
        return;
      }

      const rect = container.getBoundingClientRect();
      const marginTop = 76;
      const marginBottom = zenMode ? 64 : 108;
      const marginLeft = 72;
      const marginRight = 72;

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const n of targets) {
        const w =
          n.measured?.width ??
          (typeof n.style?.width === 'number' ? n.style.width : 350);
        const h =
          n.measured?.height ??
          (typeof n.style?.height === 'number' && n.style.height > 0 ? n.style.height : 220);

        minX = Math.min(minX, n.position.x);
        minY = Math.min(minY, n.position.y);
        maxX = Math.max(maxX, n.position.x + w);
        maxY = Math.max(maxY, n.position.y + h);
      }

      if (!Number.isFinite(minX)) return;

      const availW = Math.max(160, rect.width - marginLeft - marginRight);
      const availH = Math.max(140, rect.height - marginTop - marginBottom);
      const contentW = Math.max(1, maxX - minX);
      const contentH = Math.max(1, maxY - minY);

      const maxAllowedZoom = options?.maxZoom ?? 1.05;
      const zoom = Math.max(
        0.15,
        Math.min(maxAllowedZoom, availW / contentW, availH / contentH)
      );

      const safeCenterX = marginLeft + availW / 2;
      const safeCenterY = marginTop + availH / 2;
      const contentCenterX = (minX + maxX) / 2;
      const contentCenterY = (minY + maxY) / 2;

      const nextVp: Viewport = {
        x: Math.round((safeCenterX - contentCenterX * zoom) * 10) / 10,
        y: Math.round((safeCenterY - contentCenterY * zoom) * 10) / 10,
        zoom: Math.round(zoom * 1000) / 1000,
      };

      setViewport(nextVp, { duration });
      setLiveViewport(nextVp);
    },
    [getNodes, setViewport, zenMode]
  );

  const insertImageFileToCanvas = useCallback(
    async (file: File, clientPos?: { x: number; y: number }) => {
      if (!file.type.startsWith('image/')) {
        addToast({ message: 'Envie um arquivo de imagem válido (PNG, JPG, WebP).', variant: 'danger' });
        return;
      }

      pushHistorySnapshot();
      const { blob, width, height } = await prepareCanvasImage(file);
      const blobId = `canvas-img-${crypto.randomUUID()}`;
      await getKnowledgeRepository().saveBlob(blobId, blob);

      let pos: { x: number; y: number };
      if (clientPos) {
        const flow = screenToFlowPosition(clientPos);
        pos = { x: Math.round(flow.x - width / 2), y: Math.round(flow.y - height / 2) };
      } else {
        pos = getSmartViewportPos(width, height);
      }

      await createCanvasImage({
        x: pos.x,
        y: pos.y,
        blobId,
        width,
        height,
      });

      addToast({ message: 'Imagem adicionada ao Canvas — você pode redimensionar e conectar!', variant: 'success' }, 2800);
    },
    [addToast, pushHistorySnapshot, screenToFlowPosition, getSmartViewportPos, createCanvasImage]
  );

  // Insere adesivo/elemento SVG (StarNote ou Iconify) salvo 100% offline no IndexedDB
  const insertSvgElementToCanvas = useCallback(
    async ({
      svg,
      width,
      height,
      caption,
    }: {
      svg: string;
      width: number;
      height: number;
      caption: string;
    }) => {
      pushHistorySnapshot();
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const blobId = `canvas-sticker-${crypto.randomUUID()}`;
      await getKnowledgeRepository().saveBlob(blobId, blob);

      const pos = getSmartViewportPos(width, height);
      await createCanvasImage({
        x: pos.x,
        y: pos.y,
        blobId,
        width,
        height,
        caption,
        borderStyle: 'none',
        keepAspectRatio: true,
      });

      addToast({ message: `Elemento "${caption}" inserido no Canvas`, variant: 'success' }, 2200);
    },
    [pushHistorySnapshot, getSmartViewportPos, createCanvasImage, addToast]
  );

  const panorama = useMemo(() => {
    const visibleNodes = canvasNodes.filter((cn) => {
      if (cn.nodeType === 'knowledgeCard') {
        if (!cn.cardId || !cardsById[cn.cardId]) return false;
        return matchesHierarchyContext(cardsById[cn.cardId], selectedHierarchyId, hierarchy);
      }
      return matchesHierarchyContext(cn, selectedHierarchyId, hierarchy);
    });

    const visibleStrokes = canvasStrokes.filter((st) =>
      matchesHierarchyContext(st, selectedHierarchyId, hierarchy)
    );

    return computePanoramaLayout({
      visibleNodes,
      visibleStrokes,
      cardsById,
      hierarchy,
      selectedHierarchyId,
    });
  }, [canvasNodes, canvasStrokes, cardsById, hierarchy, selectedHierarchyId]);

  useEffect(() => {
    syncActiveProjectionOffsets(panorama.nodeOffsets, panorama.strokeOffsets);
  }, [panorama]);

  useEffect(() => {
    setNodes((prevNodes) => {
      const prevMap = new Map(prevNodes.map((n) => [n.id, n]));
      const next: Node[] = [];

      if (panorama.isPanorama) {
        for (const section of panorama.sections) {
          next.push({
            id: section.id,
            type: 'panoramaSection',
            position: { x: section.x, y: section.y },
            zIndex: -20,
            draggable: false,
            selectable: false,
            connectable: false,
            focusable: false,
            style: { width: section.width, height: section.height },
            data: { section },
          });
        }
      }

      const isAnyInlineEditing = Boolean(inlineEditingCardId || editingTextNodeId || editingTopicNodeId);

      for (const cn of canvasNodes) {
        const prev = prevMap.get(cn.id);
        const offset = panorama.nodeOffsets.get(cn.id) ?? { dx: 0, dy: 0 };
        const displayPos = { x: cn.x + offset.dx, y: cn.y + offset.dy };

        if (cn.nodeType === 'group') {
          if (!matchesHierarchyContext(cn, selectedHierarchyId, hierarchy)) continue;
          next.push({
            className: isAnyInlineEditing ? 'kc-edit-dimmed' : undefined,
            id: cn.id,
            type: 'canvasGroup',
            position: displayPos,
            zIndex: -1,
            selected: prev?.selected ?? false,
            style: { width: cn.width || 640, height: cn.height || 360 },
            data: { node: cn },
          });
          continue;
        }

        if (cn.nodeType === 'text') {
          if (!matchesHierarchyContext(cn, selectedHierarchyId, hierarchy)) continue;
          const isEditingThis = editingTextNodeId === cn.id;
          next.push({
            className: isAnyInlineEditing && !isEditingThis ? 'kc-edit-dimmed' : undefined,
            id: cn.id,
            type: 'canvasText',
            position: displayPos,
            zIndex: isEditingThis ? 100 : 10,
            selected: prev?.selected ?? false,
            hidden: prev?.hidden ?? false,
            style: { width: cn.width || 280 },
            data: { node: cn },
          });
          continue;
        }

        if (cn.nodeType === 'topic') {
          if (!matchesHierarchyContext(cn, selectedHierarchyId, hierarchy)) continue;
          const isEditingThis = editingTopicNodeId === cn.id;
          next.push({
            id: cn.id,
            type: 'canvasTopic',
            position: displayPos,
            zIndex: isEditingThis ? 100 : 12,
            className: isAnyInlineEditing && !isEditingThis ? 'kc-edit-dimmed' : undefined,
            selected: prev?.selected ?? false,
            hidden: prev?.hidden ?? false,
            style: { width: cn.width || 210, height: cn.height || 74 },
            data: { node: cn, onQuickSubtopic: handleQuickSubtopic },
          });
          continue;
        }

        if (cn.nodeType === 'image') {
          if (!matchesHierarchyContext(cn, selectedHierarchyId, hierarchy)) continue;
          next.push({
            className: isAnyInlineEditing ? 'kc-edit-dimmed' : undefined,
            id: cn.id,
            type: 'canvasImage',
            position: displayPos,
            selected: prev?.selected ?? false,
            hidden: prev?.hidden ?? false,
            style: { width: cn.width || 280, height: cn.height || 220 },
            data: { node: cn },
          });
          continue;
        }

        if (!cn.cardId) continue;
        const card = cardsById[cn.cardId];
        if (!card) continue;

        if (!matchesHierarchyContext(card, selectedHierarchyId, hierarchy)) {
          continue;
        }

        const isEditingThis = inlineEditingCardId === card.id;
        const isAutoCard = cn.sizingMode === 'auto';
        next.push({
          id: cn.id,
          type: 'knowledgeCard',
          position: displayPos,
          zIndex: isEditingThis ? 100 : undefined,
          className: isAnyInlineEditing && !isEditingThis ? 'kc-edit-dimmed' : undefined,
          selected: prev?.selected ?? false,
          hidden: prev?.hidden ?? false,
          style: isAutoCard
            ? { width: cn.width || 340 }
            : {
                width: cn.width || 350,
                height: cn.height || 240,
              },
          data: {
            card,
            sizingMode: cn.sizingMode ?? 'custom',
            padding: cn.padding ?? 'md',
            isCollapsed: (prev?.data as { isCollapsed?: boolean } | undefined)?.isCollapsed ?? false,
            onOpen: openCard,
            onSaveViewport: saveViewport,
          },
        });
      }
      return next;
    });
  }, [
    canvasNodes,
    cardsById,
    hierarchy,
    selectedHierarchyId,
    panorama,
    inlineEditingCardId,
    editingTextNodeId,
    editingTopicNodeId,
    handleQuickSubtopic,
    openCard,
    saveViewport,
    setNodes,
  ]);

  useEffect(() => {
    const visibleNodeIds = new Set<string>();
    for (const cn of canvasNodes) {
      if (cn.nodeType === 'knowledgeCard') {
        if (
          cn.cardId &&
          cardsById[cn.cardId] &&
          matchesHierarchyContext(cardsById[cn.cardId], selectedHierarchyId, hierarchy)
        ) {
          visibleNodeIds.add(cn.id);
        }
      } else if (matchesHierarchyContext(cn, selectedHierarchyId, hierarchy)) {
        visibleNodeIds.add(cn.id);
      }
    }

    setEdges((prevEdges) => {
      const prevMap = new Map(prevEdges.map((e) => [e.id, e]));
      return canvasEdges
        .filter((e) => visibleNodeIds.has(e.sourceNodeId) && visibleNodeIds.has(e.targetNodeId))
        .map((e) => {
          const srcOff = panorama.nodeOffsets.get(e.sourceNodeId);
          const tgtOff = panorama.nodeOffsets.get(e.targetNodeId);
          const sameOffset =
            srcOff && tgtOff && srcOff.dx === tgtOff.dx && srcOff.dy === tgtOff.dy
              ? srcOff
              : { dx: 0, dy: 0 };

          return {
            id: e.id,
            source: e.sourceNodeId,
            target: e.targetNodeId,
            sourceHandle: e.sourceHandle,
            targetHandle: e.targetHandle,
            type: 'editable',
            data: {
              pathStyle: e.edgeType ?? 'smoothstep',
              edgeStyle: e.style,
              lineStyle: e.lineStyle ?? (e.style === 'dashed' ? 'dashed' : 'solid'),
              strokeWidth: e.strokeWidth ?? 2,
              arrowStart: e.arrowStart ?? 'none',
              arrowEnd: e.arrowEnd ?? 'arrowclosed',
              routingMode: e.routingMode ?? 'auto',
              waypoints: e.waypoints ?? [],
              labelPosition: e.labelPosition,
              labelStyle: e.labelStyle,
              onResetToAuto: handleResetEdgeToAuto,
              labelOffset: e.labelOffset,
              projectionOffset: sameOffset,
              color: e.color ?? '#6366f1',
            },
            label: e.label,
            animated: e.style === 'animated',
            selected: prevMap.get(e.id)?.selected ?? false,
            hidden: prevMap.get(e.id)?.hidden ?? false,
            style: {
              stroke: e.color ?? '#6366f1',
              strokeWidth: e.strokeWidth ?? 2,
            },
          };
        });
    });
  }, [canvasEdges, canvasNodes, cardsById, hierarchy, selectedHierarchyId, panorama, handleResetEdgeToAuto, setEdges]);

  const preEditViewportRef = useRef<Viewport | null>(null);
  const manualMoveDuringEditRef = useRef(false);
  const isProgrammaticMoveRef = useRef(false);
  const activeEditTargetNodeId = useMemo(() => {
    if (editingTopicNodeId) return editingTopicNodeId;
    if (editingTextNodeId) return editingTextNodeId;
    if (inlineEditingCardId) {
      return (
        canvasNodes.find(
          (n) => n.nodeType === 'knowledgeCard' && n.cardId === inlineEditingCardId
        )?.id ?? null
      );
    }
    return null;
  }, [editingTextNodeId, inlineEditingCardId, canvasNodes, editingTopicNodeId]);

  const prevEditTargetRef = useRef<string | null>(null);

  useEffect(() => {
    const prevTarget = prevEditTargetRef.current;
    prevEditTargetRef.current = activeEditTargetNodeId;

    if (activeEditTargetNodeId && prevTarget !== activeEditTargetNodeId) {
      if (!prevTarget) {
        preEditViewportRef.current = getViewport();
        manualMoveDuringEditRef.current = false;
      }

      const timer = setTimeout(() => {
        const container = containerRef.current;
        const targetNode = getNodes().find((n) => n.id === activeEditTargetNodeId);
        if (!container || !targetNode) return;

        const rect = container.getBoundingClientRect();
        const nodeW =
          targetNode.measured?.width ??
          (typeof targetNode.style?.width === 'number' ? targetNode.style.width : 340);
        const nodeH =
          targetNode.measured?.height ??
          (typeof targetNode.style?.height === 'number' && targetNode.style.height > 0
            ? targetNode.style.height
            : 220);

        const fitW = (rect.width * 0.62) / Math.max(180, nodeW);
        const fitH = (rect.height * 0.58) / Math.max(120, nodeH);
        const currentZoom = getViewport().zoom;
        const targetZoom = Math.max(
          0.95,
          Math.min(1.22, Math.max(currentZoom, Math.min(fitW, fitH)))
        );

        const nodeCenterX = targetNode.position.x + nodeW / 2;
        const nodeCenterY = targetNode.position.y + nodeH / 2;

        const nextVp: Viewport = {
          x: Math.round((rect.width / 2 - nodeCenterX * targetZoom) * 10) / 10,
          y: Math.round((rect.height / 2 + 24 - nodeCenterY * targetZoom) * 10) / 10,
          zoom: Math.round(targetZoom * 1000) / 1000,
        };

        isProgrammaticMoveRef.current = true;
        setViewport(nextVp, { duration: 320 });
        setLiveViewport(nextVp);
        setTimeout(() => {
          isProgrammaticMoveRef.current = false;
        }, 420);
      }, 45);

      return () => clearTimeout(timer);
    }

    if (!activeEditTargetNodeId && prevTarget) {
      const savedVp = preEditViewportRef.current;
      const movedManually = manualMoveDuringEditRef.current;
      preEditViewportRef.current = null;
      manualMoveDuringEditRef.current = false;

      if (!savedVp) return;

      if (!movedManually) {
        isProgrammaticMoveRef.current = true;
        setViewport(savedVp, { duration: 300 });
        setLiveViewport(savedVp);
        setTimeout(() => {
          isProgrammaticMoveRef.current = false;
        }, 380);
      } else {
        addToast(
          {
            message: 'Posição atual mantida após edição',
            action: {
              label: 'Restaurar visão anterior',
              onClick: () => {
                setViewport(savedVp, { duration: 320 });
                setLiveViewport(savedVp);
              },
            },
          },
          4200
        );
      }
    }
  }, [activeEditTargetNodeId, getNodes, getViewport, setViewport, addToast]);

  const prevContextKeyRef = useRef<string | null>(null);
  useEffect(() => {
    preEditViewportRef.current = null;
    manualMoveDuringEditRef.current = false;
    historyRef.current = { past: [], future: [] };
    setCanUndo(false);
    setCanRedo(false);
    setIsPlacingText(false);
    setSelectedEdgeLabelId(null);
    setEditingEdgeLabelId(null);
    setNodes((nds) => (nds.some((n) => n.selected) ? nds.map((n) => ({ ...n, selected: false })) : nds));
    setEdges((eds) => (eds.some((e) => e.selected) ? eds.map((e) => ({ ...e, selected: false })) : eds));

    const contextKey = `${activeWorkspaceId ?? ''}::${selectedHierarchyId ?? 'ALL'}`;
    if (prevContextKeyRef.current !== null && prevContextKeyRef.current !== contextKey) {
      const timer = setTimeout(() => {
        fitCanvasWithMargins({ duration: 420, maxZoom: 1.05 });
      }, 90);
      prevContextKeyRef.current = contextKey;
      return () => clearTimeout(timer);
    }
    prevContextKeyRef.current = contextKey;
  }, [activeWorkspaceId, selectedHierarchyId, setSelectedEdgeLabelId, setEditingEdgeLabelId, setNodes, setEdges, fitCanvasWithMargins]);

  const activeBreadcrumb = useMemo(
    () => getHierarchyBreadcrumb(hierarchy, selectedHierarchyId),
    [hierarchy, selectedHierarchyId]
  );

  const quickHierarchyList = useMemo(() => {
    const ordered: Array<{ node: (typeof hierarchy)[number]; depth: number }> = [];
    const visit = (parentId: string | null, depth: number) => {
      const children = hierarchy
        .filter((h) => h.parentId === parentId)
        .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
      for (const child of children) {
        ordered.push({ node: child, depth });
        visit(child.id, depth + 1);
      }
    };
    visit(null, 0);
    return ordered;
  }, [hierarchy]);

  const restoredWorkspaceRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeWorkspaceId || restoredWorkspaceRef.current === activeWorkspaceId) return;
    if (nodes.length === 0) return;
    restoredWorkspaceRef.current = activeWorkspaceId;

    const saved = localStorage.getItem(`kc_vp_${activeWorkspaceId}`);
    if (saved) {
      try {
        const vp = JSON.parse(saved) as Viewport;
        setTimeout(() => {
          setViewport(vp, { duration: 0 });
          setLiveViewport(vp);
        }, 40);
        return;
      } catch {
        // fallback para fitView
      }
    }
    setTimeout(() => fitCanvasWithMargins({ duration: 350, maxZoom: 1.05 }), 90);
  }, [activeWorkspaceId, nodes.length, setViewport, fitCanvasWithMargins]);

  useEffect(() => {
    if (!focusRequest) return;
    const targetCanvasNode = canvasNodes.find((n) => n.cardId === focusRequest.cardId);
    if (targetCanvasNode) {
      setTimeout(() => {
        fitCanvasWithMargins({
          nodeIds: [targetCanvasNode.id],
          duration: 550,
          maxZoom: 1.12,
        });
        triggerCardHighlight(focusRequest.cardId);
      }, 60);
    }
    clearFocusRequest();
  }, [focusRequest, canvasNodes, fitCanvasWithMargins, triggerCardHighlight, clearFocusRequest]);

  useEffect(() => {
    if (!openHeaderMenu && !isContextMenuOpen) return;
    const close = () => {
      setOpenHeaderMenu(null);
      setIsContextMenuOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openHeaderMenu, isContextMenuOpen]);

  useEffect(() => {
    const handlePasteOnCanvas = (e: ClipboardEvent) => {
      if (
        isOutlineMode ||
        activeCardId !== null ||
        inlineEditingCardId !== null ||
        editingTextNodeId !== null ||
        editingTopicNodeId !== null ||
        editingEdgeLabelId !== null ||
        isLocked
      ) {
        return;
      }
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            insertImageFileToCanvas(file);
            return;
          }
        }
      }
    };

    window.addEventListener('paste', handlePasteOnCanvas);
    return () => window.removeEventListener('paste', handlePasteOnCanvas);
  }, [isOutlineMode, activeCardId, inlineEditingCardId, isLocked, editingTextNodeId, editingTopicNodeId, editingEdgeLabelId, insertImageFileToCanvas]);

  const selectedCardNodes = useMemo(
    () => nodes.filter((n) => n.selected && n.type === 'knowledgeCard'),
    [nodes]
  );

  const selectedGroupNodes = useMemo(
    () => nodes.filter((n) => n.selected && n.type === 'canvasGroup'),
    [nodes]
  );

  const selectedImageNodes = useMemo(
    () => nodes.filter((n) => n.selected && n.type === 'canvasImage'),
    [nodes]
  );

  const selectedTextNodes = useMemo(
    () => nodes.filter((n) => n.selected && n.type === 'canvasText'),
    [nodes]
  );

  const selectedTopicNodes = useMemo(
    () => nodes.filter((n) => n.selected && n.type === 'canvasTopic'),
    [nodes]
  );

  const selectedEdges = useMemo(() => edges.filter((e) => e.selected), [edges]);

  const selectedGroupableNodes = useMemo(
    () =>
      nodes.filter(
        (n) =>
          n.selected &&
          (n.type === 'knowledgeCard' ||
            n.type === 'canvasImage' ||
            n.type === 'canvasText' ||
            n.type === 'canvasTopic')
      ),
    [nodes]
  );

  const selectedCardIds = useMemo(
    () =>
      selectedCardNodes
        .map((n) => (n.data as { card?: KnowledgeCardMeta } | undefined)?.card?.id)
        .filter((id): id is string => Boolean(id)),
    [selectedCardNodes]
  );

  const firstSelectedCard = selectedCardIds[0] ? cardsById[selectedCardIds[0]] : undefined;
  const firstSelectedCardCanvasNode =
    selectedCardNodes.length === 1
      ? canvasNodes.find((n) => n.id === selectedCardNodes[0].id) ?? null
      : null;

  const activeGroupRecord =
    selectedGroupNodes.length === 1 &&
    selectedCardNodes.length === 0 &&
    selectedImageNodes.length === 0 &&
    selectedTextNodes.length === 0 &&
    selectedTopicNodes.length === 0
      ? canvasNodes.find((n) => n.id === selectedGroupNodes[0].id) ?? null
      : null;

  const activeImageRecord =
    selectedImageNodes.length === 1 &&
    selectedCardNodes.length === 0 &&
    selectedGroupNodes.length === 0 &&
    selectedTextNodes.length === 0 &&
    selectedTopicNodes.length === 0
      ? canvasNodes.find((n) => n.id === selectedImageNodes[0].id) ?? null
      : null;

  const activeTextRecord =
    selectedTextNodes.length === 1 &&
    selectedCardNodes.length === 0 &&
    selectedGroupNodes.length === 0 &&
    selectedImageNodes.length === 0 &&
    selectedTopicNodes.length === 0
      ? canvasNodes.find((n) => n.id === selectedTextNodes[0].id) ?? null
      : null;

  const activeTopicRecord =
    selectedTopicNodes.length === 1 &&
    selectedCardNodes.length === 0 &&
    selectedGroupNodes.length === 0 &&
    selectedImageNodes.length === 0 &&
    selectedTextNodes.length === 0
      ? canvasNodes.find((n) => n.id === selectedTopicNodes[0].id) ?? null
      : null;

  const activeEdgeRecord =
    selectedEdges.length === 1 &&
    selectedCardNodes.length === 0 &&
    selectedGroupNodes.length === 0 &&
    selectedImageNodes.length === 0 &&
    selectedTextNodes.length === 0 &&
    selectedTopicNodes.length === 0
      ? canvasEdges.find((e) => e.id === selectedEdges[0].id) ?? null
      : null;

  const canShowContextualBar =
    !isLocked &&
    !isOutlineMode &&
    !inlineEditingCardId &&
    !editingTextNodeId &&
    !editingTopicNodeId &&
    !isDrawingMode &&
    interactionMode !== 'focus';

  const activeEdgeLabelRecord = selectedEdgeLabelId
    ? canvasEdges.find((e) => e.id === selectedEdgeLabelId && Boolean(e.label?.trim())) ?? null
    : null;

  const showEdgeLabelToolbar =
    canShowContextualBar && !editingEdgeLabelId && Boolean(activeEdgeLabelRecord);

  const showCardSelectionToolbar =
    canShowContextualBar && !showEdgeLabelToolbar && selectedCardNodes.length > 0;
  const showGroupToolbar =
    canShowContextualBar && !showEdgeLabelToolbar && Boolean(activeGroupRecord);
  const showImageToolbar =
    canShowContextualBar && !showEdgeLabelToolbar && Boolean(activeImageRecord);
  const showTextToolbar =
    canShowContextualBar && !showEdgeLabelToolbar && Boolean(activeTextRecord);
  const showTopicToolbar =
    canShowContextualBar && !showEdgeLabelToolbar && Boolean(activeTopicRecord);
  const showEdgeToolbar =
    canShowContextualBar && !showEdgeLabelToolbar && Boolean(activeEdgeRecord);

  const handleGroupSelectedItems = async () => {
    if (selectedGroupableNodes.length < 2) return;
    pushHistorySnapshot();

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const n of selectedGroupableNodes) {
      const w = Number(n.measured?.width || n.style?.width || 350);
      const h = Number(n.measured?.height || n.style?.height || 240);
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + w);
      maxY = Math.max(maxY, n.position.y + h);
    }

    const padX = 36;
    const padTop = 52;
    const padBottom = 36;

    await createCanvasGroup(
      minX - padX,
      minY - padTop,
      'Nova Seção',
      maxX - minX + padX * 2,
      maxY - minY + padTop + padBottom
    );
    addToast({ message: `${selectedGroupableNodes.length} itens agrupados em uma seção`, variant: 'success' });
  };

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (
        isOutlineMode ||
        activeCardId !== null ||
        inlineEditingCardId !== null ||
        editingTextNodeId !== null ||
        editingTopicNodeId !== null ||
        editingEdgeLabelId !== null ||
        isLocked
      ) {
        return;
      }

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'Escape' && isPlacingText) {
        setIsPlacingText(false);
        return;
      }

      if (e.key === 'Escape' && isStickerPanelOpen) {
        setIsStickerPanelOpen(false);
        return;
      }

      if (e.key === 'Escape' && selectedEdgeLabelId) {
        setSelectedEdgeLabelId(null);
        return;
      }

      if (e.key.toLowerCase() === 't' && !e.ctrlKey && !e.metaKey && !e.altKey && !isDrawingMode) {
        e.preventDefault();
        setIsPlacingText((v) => !v);
        return;
      }

      if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const selTopics = getNodes().filter((n) => n.selected && n.type === 'canvasTopic');
        if (selTopics.length === 1) {
          e.preventDefault();
          handleQuickSubtopic(selTopics[0].id);
          return;
        }
      }

      const cmdOrCtrl = e.metaKey || e.ctrlKey;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedEdgeLabelId) {
          e.preventDefault();
          pushHistorySnapshot();
          const targetId = selectedEdgeLabelId;
          setSelectedEdgeLabelId(null);
          await updateCanvasEdge(targetId, {
            label: undefined,
            labelPosition: undefined,
            labelStyle: undefined,
            labelOffset: undefined,
          });
          addToast({
            message: 'Rótulo removido (conexão mantida)',
            action: { label: 'Desfazer', onClick: () => handleUndo() },
          });
          return;
        }

        const selNodeIds = getNodes().filter((n) => n.selected).map((n) => n.id);
        const selEdgeIds = getEdges().filter((ed) => ed.selected).map((ed) => ed.id);
        if (selNodeIds.length > 0 || selEdgeIds.length > 0) {
          e.preventDefault();
          pushHistorySnapshot();
          await deleteCanvasSelection(selNodeIds, selEdgeIds);
          addToast({
            message: 'Seleção removida do canvas',
            action: { label: 'Desfazer', onClick: () => handleUndo() },
          });
        }
        return;
      }

      if (!cmdOrCtrl) return;
      const key = e.key.toLowerCase();

      if (key === 'c') {
        const selCardIds = getNodes()
          .filter((n) => n.selected && n.type === 'knowledgeCard')
          .map((n) => n.id);
        if (selCardIds.length > 0) {
          e.preventDefault();
          clipboardIdsRef.current = selCardIds;
        }
      } else if (key === 'v' && clipboardIdsRef.current.length > 0) {
        e.preventDefault();
        pushHistorySnapshot();
        await duplicateCanvasNodes(clipboardIdsRef.current);
      } else if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        await handleUndo();
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        await handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOutlineMode,
    activeCardId,
    inlineEditingCardId,
    editingTextNodeId,
    editingTopicNodeId,
    editingEdgeLabelId,
    isLocked,
    isPlacingText,
    isStickerPanelOpen,
    isDrawingMode,
    selectedEdgeLabelId,
    setSelectedEdgeLabelId,
    getNodes,
    getEdges,
    pushHistorySnapshot,
    updateCanvasEdge,
    deleteCanvasSelection,
    duplicateCanvasNodes,
    handleUndo,
    handleRedo,
    addToast,
    handleQuickSubtopic,
  ]);

  const startMultiDrag = useCallback(
    (anchorNode: Node | undefined, draggedNodes?: Node[]) => {
      if (!anchorNode) return;
      pushHistorySnapshot();

      const allFlowNodes = getNodes();
      const baseDragged =
        draggedNodes && draggedNodes.length > 0
          ? draggedNodes
          : anchorNode.selected
          ? allFlowNodes.filter((n) => n.selected && n.type !== 'panoramaSection')
          : [anchorNode];

      const rfMovingIds = new Set(baseDragged.map((n) => n.id));
      const extraGroupChildren: Array<{ id: string; startX: number; startY: number }> = [];
      const extraAddedIds = new Set<string>();

      for (const node of baseDragged) {
        if (node.type !== 'canvasGroup') continue;
        const gW = Number(node.measured?.width || node.style?.width || 640);
        const gH = Number(node.measured?.height || node.style?.height || 360);
        const gx1 = node.position.x;
        const gy1 = node.position.y;
        const gx2 = gx1 + gW;
        const gy2 = gy1 + gH;

        for (const candidate of allFlowNodes) {
          if (
            candidate.hidden ||
            rfMovingIds.has(candidate.id) ||
            extraAddedIds.has(candidate.id)
          ) {
            continue;
          }
          if (
            candidate.type !== 'knowledgeCard' &&
            candidate.type !== 'canvasImage' &&
            candidate.type !== 'canvasText' &&
            candidate.type !== 'canvasTopic'
          ) {
            continue;
          }
          const nw = Number(candidate.measured?.width || candidate.style?.width || 350);
          const nh = Number(candidate.measured?.height || candidate.style?.height || 240);
          const cx = candidate.position.x + nw / 2;
          const cy = candidate.position.y + nh / 2;
          if (cx >= gx1 && cx <= gx2 && cy >= gy1 && cy <= gy2) {
            extraAddedIds.add(candidate.id);
            extraGroupChildren.push({
              id: candidate.id,
              startX: candidate.position.x,
              startY: candidate.position.y,
            });
          }
        }
      }

      const movingNodeIds = new Set<string>([...rfMovingIds, ...extraAddedIds]);

      const storeEdges = useKnowledgeStore.getState().canvasEdges;
      const internalEdgesWithWaypoints: Array<{ id: string; origWaypoints: EdgeWaypoint[] }> = [];
      const frontierAutoEdgeIds = new Set<string>();

      for (const ce of storeEdges) {
        const srcMoves = movingNodeIds.has(ce.sourceNodeId);
        const tgtMoves = movingNodeIds.has(ce.targetNodeId);

        if (srcMoves && tgtMoves) {
          if (ce.waypoints && ce.waypoints.length > 0) {
            internalEdgesWithWaypoints.push({
              id: ce.id,
              origWaypoints: ce.waypoints.map((w) => ({ ...w })),
            });
          }
        } else if (srcMoves !== tgtMoves) {
          if (ce.routingMode !== 'manual') {
            frontierAutoEdgeIds.add(ce.id);
          }
        }
      }

      multiDragRef.current = {
        anchorNodeId: anchorNode.id,
        anchorStartX: anchorNode.position.x,
        anchorStartY: anchorNode.position.y,
        rfMovingIds,
        movingNodeIds,
        extraGroupChildren,
        internalEdgesWithWaypoints,
        frontierAutoEdgeIds,
      };
    },
    [getNodes, pushHistorySnapshot]
  );

  const updateMultiDrag = useCallback(
    (fallbackAnchor?: Node, draggedNodes?: Node[]) => {
      const drag = multiDragRef.current;
      if (!drag) return;

      const currentNodes = getNodes();
      const anchor =
        draggedNodes?.find((n) => n.id === drag.anchorNodeId) ??
        (fallbackAnchor?.id === drag.anchorNodeId ? fallbackAnchor : undefined) ??
        currentNodes.find((n) => n.id === drag.anchorNodeId);

      if (!anchor) return;

      const dx = Math.round(anchor.position.x - drag.anchorStartX);
      const dy = Math.round(anchor.position.y - drag.anchorStartY);

      if (drag.extraGroupChildren.length > 0) {
        const childMap = new Map(drag.extraGroupChildren.map((c) => [c.id, c]));
        setNodes((nds) =>
          nds.map((n) => {
            const c = childMap.get(n.id);
            if (!c) return n;
            return { ...n, position: { x: c.startX + dx, y: c.startY + dy } };
          })
        );
      }

      if (drag.internalEdgesWithWaypoints.length === 0 && drag.frontierAutoEdgeIds.size === 0) {
        return;
      }

      const internalMap = new Map(
        drag.internalEdgesWithWaypoints.map((item) => [item.id, item.origWaypoints])
      );

      const liveNodeMap = new Map(currentNodes.map((n) => [n.id, n]));
      if (draggedNodes) {
        for (const dn of draggedNodes) liveNodeMap.set(dn.id, dn);
      }
      if (fallbackAnchor) liveNodeMap.set(fallbackAnchor.id, fallbackAnchor);
      for (const c of drag.extraGroupChildren) {
        const existing = liveNodeMap.get(c.id);
        if (existing) {
          liveNodeMap.set(c.id, { ...existing, position: { x: c.startX + dx, y: c.startY + dy } });
        }
      }

      setEdges((eds) =>
        eds.map((edge) => {
          const origWps = internalMap.get(edge.id);
          if (origWps) {
            return {
              ...edge,
              data: {
                ...(edge.data ?? {}),
                waypoints: origWps.map((w) => ({ x: w.x + dx, y: w.y + dy })),
              },
            };
          }

          if (drag.frontierAutoEdgeIds.has(edge.id)) {
            const sourceNode = liveNodeMap.get(edge.source);
            const targetNode = liveNodeMap.get(edge.target);
            if (!sourceNode || !targetNode) return edge;
            const best = computeBestEdgeHandles(sourceNode, targetNode);
            if (edge.sourceHandle !== best.s || edge.targetHandle !== best.t) {
              return { ...edge, sourceHandle: best.s, targetHandle: best.t };
            }
          }

          return edge;
        })
      );
    },
    [getNodes, setNodes, setEdges]
  );

  const finishMultiDrag = useCallback(
    async (fallbackAnchor?: Node, draggedNodes?: Node[]) => {
      const drag = multiDragRef.current;
      multiDragRef.current = null;

      const latestNodes = getNodes();
      const latestMap = new Map(latestNodes.map((n) => [n.id, n]));
      if (draggedNodes) {
        for (const dn of draggedNodes) latestMap.set(dn.id, dn);
      }
      if (fallbackAnchor) latestMap.set(fallbackAnchor.id, fallbackAnchor);

      if (!drag) {
        if (fallbackAnchor) {
          await persistNodePositions([
            {
              id: fallbackAnchor.id,
              x: Math.round(fallbackAnchor.position.x),
              y: Math.round(fallbackAnchor.position.y),
            },
          ]);
        }
        return;
      }

      const anchor = latestMap.get(drag.anchorNodeId);
      const dx = anchor ? Math.round(anchor.position.x - drag.anchorStartX) : 0;
      const dy = anchor ? Math.round(anchor.position.y - drag.anchorStartY) : 0;

      const extraMap = new Map(drag.extraGroupChildren.map((c) => [c.id, c]));
      const positionUpdates: Array<{ id: string; x: number; y: number }> = [];

      for (const id of drag.movingNodeIds) {
        const extra = extraMap.get(id);
        if (extra) {
          const finalX = Math.round(extra.startX + dx);
          const finalY = Math.round(extra.startY + dy);
          positionUpdates.push({ id, x: finalX, y: finalY });
          const existing = latestMap.get(id);
          if (existing) latestMap.set(id, { ...existing, position: { x: finalX, y: finalY } });
        } else {
          const node = latestMap.get(id);
          if (node) {
            positionUpdates.push({
              id,
              x: Math.round(node.position.x),
              y: Math.round(node.position.y),
            });
          }
        }
      }

      if (positionUpdates.length > 0) {
        await persistNodePositions(positionUpdates);
      }

      const edgePersistOps: Array<Promise<void>> = [];
      if (dx !== 0 || dy !== 0) {
        for (const item of drag.internalEdgesWithWaypoints) {
          edgePersistOps.push(
            updateCanvasEdge(item.id, {
              waypoints: item.origWaypoints.map((w) => ({ x: w.x + dx, y: w.y + dy })),
            })
          );
        }
      }

      if (drag.frontierAutoEdgeIds.size > 0) {
        const storeEdges = useKnowledgeStore.getState().canvasEdges;
        for (const ce of storeEdges) {
          if (!drag.frontierAutoEdgeIds.has(ce.id)) continue;
          const src = latestMap.get(ce.sourceNodeId);
          const tgt = latestMap.get(ce.targetNodeId);
          if (!src || !tgt) continue;
          const best = computeBestEdgeHandles(src, tgt);
          if (ce.sourceHandle !== best.s || ce.targetHandle !== best.t) {
            edgePersistOps.push(
              updateCanvasEdge(ce.id, { sourceHandle: best.s, targetHandle: best.t })
            );
          }
        }
      }

      if (edgePersistOps.length > 0) {
        await Promise.all(edgePersistOps);
      }
    },
    [getNodes, persistNodePositions, updateCanvasEdge]
  );

  const onNodeDragStart = useCallback(
    (_: unknown, node: Node, draggedNodes?: Node[]) => {
      startMultiDrag(node, draggedNodes);
    },
    [startMultiDrag]
  );

  const onNodeDrag = useCallback(
    (_: unknown, draggedNode: Node, draggedNodes?: Node[]) => {
      updateMultiDrag(draggedNode, draggedNodes);
    },
    [updateMultiDrag]
  );

  const onNodeDragStop = useCallback(
    (_: unknown, node: Node, draggedNodes?: Node[]) => {
      finishMultiDrag(node, draggedNodes);
    },
    [finishMultiDrag]
  );

  const onSelectionDragStart = useCallback(
    (_: unknown, draggedNodes: Node[]) => {
      startMultiDrag(draggedNodes[0], draggedNodes);
    },
    [startMultiDrag]
  );

  const onSelectionDrag = useCallback(
    (_: unknown, draggedNodes: Node[]) => {
      updateMultiDrag(draggedNodes[0], draggedNodes);
    },
    [updateMultiDrag]
  );

  const onSelectionDragStop = useCallback(
    (_: unknown, draggedNodes: Node[]) => {
      finishMultiDrag(draggedNodes[0], draggedNodes);
    },
    [finishMultiDrag]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        pushHistorySnapshot();
        const srcNode = useKnowledgeStore
          .getState()
          .canvasNodes.find((n) => n.id === connection.source);
        const topicEdgePref = srcNode?.topicConfig?.defaultEdgeStyle;
        addCanvasEdge(connection.source, connection.target, undefined, {
          sourceHandle: connection.sourceHandle ?? undefined,
          targetHandle: connection.targetHandle ?? undefined,
          edgeType: topicEdgePref?.edgeType ?? globalEdgeType,
          lineStyle: topicEdgePref?.lineStyle ?? 'solid',
          style: globalAnimated
            ? 'animated'
            : topicEdgePref?.lineStyle === 'dashed'
            ? 'dashed'
            : 'solid',
          color: topicEdgePref?.color ?? globalColor,
        });
      }
    },
    [addCanvasEdge, globalEdgeType, globalAnimated, globalColor, pushHistorySnapshot]
  );

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      if (!newConnection.source || !newConnection.target) return;
      pushHistorySnapshot();
      updateCanvasEdge(oldEdge.id, {
        sourceNodeId: newConnection.source,
        targetNodeId: newConnection.target,
        sourceHandle: newConnection.sourceHandle ?? undefined,
        targetHandle: newConnection.targetHandle ?? undefined,
        routingMode: 'auto',
        waypoints: [],
      });
    },
    [pushHistorySnapshot, updateCanvasEdge]
  );

  const onConnectStart = useCallback(
    (_: MouseEvent | TouchEvent, params: { nodeId: string | null; handleId: string | null }) => {
      connectingNodeId.current = params.nodeId;
      connectingHandleId.current = params.handleId;
    },
    []
  );

  const onConnectEnd = useCallback(
    async (event: MouseEvent | TouchEvent) => {
      if (!connectingNodeId.current) return;
      const sourceId = connectingNodeId.current;
      const sourceHandle = connectingHandleId.current || 's-right';

      const point = 'changedTouches' in event ? event.changedTouches[0] : event;
      const targetEl = document.elementFromPoint(point.clientX, point.clientY);
      const targetIsPane = targetEl?.classList.contains('react-flow__pane');

      connectingNodeId.current = null;
      connectingHandleId.current = null;

      if (!targetIsPane) return;

      pushHistorySnapshot();
      const pos = screenToFlowPosition({ x: point.clientX, y: point.clientY });
      const newCardId = await createCardOnCanvas({
        x: Math.round(pos.x),
        y: Math.round(pos.y - 100),
        title: 'Novo Tópico Conectado',
      });

      const createdNode = useKnowledgeStore
        .getState()
        .canvasNodes.find((n) => n.cardId === newCardId);

      if (createdNode) {
        const cleanSide = sourceHandle.replace('s-', '').replace('t-', '');
        const opposite: Record<string, string> = {
          top: 'bottom',
          bottom: 'top',
          left: 'right',
          right: 'left',
        };
        await addCanvasEdge(sourceId, createdNode.id, undefined, {
          sourceHandle,
          targetHandle: `t-${opposite[cleanSide] || 'left'}`,
          edgeType: globalEdgeType,
          style: globalAnimated ? 'animated' : 'solid',
          color: globalColor,
        });
      }

      setInlineEditingCardId(newCardId);
    },
    [
      screenToFlowPosition,
      createCardOnCanvas,
      addCanvasEdge,
      globalEdgeType,
      globalAnimated,
      globalColor,
      pushHistorySnapshot,
      setInlineEditingCardId,
    ]
  );

  const handlePaneContextMenu = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      e.preventDefault();
      const now = Date.now();
      if (now - lastRightClickRef.current < 400) {
        const prev = viewportHistory.current.pop();
        if (prev) setViewport(prev, { duration: 600 });
        lastRightClickRef.current = 0;
      } else {
        lastRightClickRef.current = now;
      }
    },
    [setViewport]
  );

  const handleApplyLayout = async (direction: LayoutDirection) => {
    if (panorama.isPanorama) {
      setOpenHeaderMenu(null);
      addToast({
        message: 'Os mapas já estão organizados por assunto. Abra um mapa específico para auto-organizar os cards internos.',
      });
      return;
    }
    pushHistorySnapshot();
    const { nodes: laidNodes, edges: laidEdges } = computeMultiAxisLayout(
      getNodes().filter((n) => n.type !== 'canvasGroup'),
      getEdges(),
      direction
    );
    const groupNodes = getNodes().filter((n) => n.type === 'canvasGroup');
    setNodes([...groupNodes, ...laidNodes]);
    setEdges(laidEdges);
    setOpenHeaderMenu(null);

    await persistNodePositions(
      laidNodes.map((n) => ({ id: n.id, x: Math.round(n.position.x), y: Math.round(n.position.y) }))
    );

    const updatedStoreEdges = canvasEdges.map((ce) => {
      const matched = laidEdges.find((le) => le.id === ce.id);
      return matched
        ? {
            ...ce,
            sourceHandle: matched.sourceHandle ?? ce.sourceHandle,
            targetHandle: matched.targetHandle ?? ce.targetHandle,
            routingMode: 'auto' as const,
            waypoints: [],
            updatedAt: Date.now(),
          }
        : ce;
    });
    await updateCanvasEdgesBulk(updatedStoreEdges);
    setTimeout(() => fitCanvasWithMargins({ duration: 450, maxZoom: 1.05 }), 80);
  };

  const handleUpdateAllEdges = async (patch: {
    edgeType?: CanvasEdgePathType;
    animated?: boolean;
    color?: string;
  }) => {
    const nextType = patch.edgeType ?? globalEdgeType;
    const nextAnimated = patch.animated ?? globalAnimated;
    const nextColor = patch.color ?? globalColor;

    setGlobalEdgeType(nextType);
    setGlobalAnimated(nextAnimated);
    setGlobalColor(nextColor);

    const updated = canvasEdges.map((ce) => ({
      ...ce,
      edgeType: nextType,
      style: nextAnimated ? ('animated' as const) : ('solid' as const),
      color: nextColor,
      updatedAt: Date.now(),
    }));
    await updateCanvasEdgesBulk(updated);
  };

  const handleOpenOutlineMode = () => {
    const cardNodes = canvasNodes.filter((n) => n.nodeType === 'knowledgeCard' && n.cardId);
    const lines: string[] = [];
    const visited = new Set<string>();

    const traverse = (nodeId: string, depth: number) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      const cn = cardNodes.find((n) => n.id === nodeId);
      if (!cn || !cn.cardId) return;
      const card = cardsById[cn.cardId];
      if (!card) return;

      lines.push(`${'  '.repeat(depth)}- ${card.title}`);
      const children = canvasEdges
        .filter((e) => e.sourceNodeId === nodeId)
        .map((e) => e.targetNodeId);
      children.forEach((childId) => traverse(childId, depth + 1));
    };

    const roots = cardNodes.filter((n) => !canvasEdges.some((e) => e.targetNodeId === n.id));
    roots.forEach((r) => traverse(r.id, 0));
    cardNodes.forEach((n) => {
      if (!visited.has(n.id)) traverse(n.id, 0);
    });

    setOutlineDraft(lines.join('\n'));
    setIsOutlineMode(true);
  };

  const handleApplyOutline = async (text: string) => {
    pushHistorySnapshot();
    await importOutlineToCanvas(text);
    setIsOutlineMode(false);
    setTimeout(() => {
      handleApplyLayout('horizontal');
    }, 120);
  };

  const handleCreateQuickCard = async (
    template: 'blank' | 'law' | 'jurisprudence',
    title?: string
  ) => {
    pushHistorySnapshot();
    const pos = getSmartViewportPos(340, 180);
    const id = await createCardOnCanvas({
      x: pos.x,
      y: pos.y,
      title,
      template,
    });
    setInlineEditingCardId(id);
  };

  const handleCreateQuickGroup = async () => {
    pushHistorySnapshot();
    const pos = getSmartViewportPos(640, 360);
    await createCanvasGroup(pos.x, pos.y);
  };

  const handleCreateQuickTopic = async (shape: TopicShape = 'rounded') => {
    pushHistorySnapshot();
    const pos = getSmartViewportPos(210, 74);
    const id = await createCanvasTopic({ x: pos.x, y: pos.y, shape });
    if (id) setEditingTopicNodeId(id);
  };

  const handleCreateQuickText = async (
    preset: 'plain' | 'heading' | 'sticky' | 'callout' = 'plain'
  ) => {
    pushHistorySnapshot();
    const pos = getSmartViewportPos(280, 100);
    const id = await createCanvasText({ x: pos.x, y: pos.y, preset });
    if (id) setEditingTextNodeId(id);
  };

  if (isOutlineMode) {
    return (
      <OutlineEditorView
        initialText={outlineDraft}
        onCancel={() => setIsOutlineMode(false)}
        onApply={handleApplyOutline}
      />
    );
  }

  const canvasBgHex = theme === 'paper' ? '#F7F6F2' : '#0F1115';
  const patternColor =
    theme === 'paper'
      ? preferences.canvasBackground === 'grid'
        ? '#e5e0d5'
        : '#cbc6b9'
      : preferences.canvasBackground === 'grid'
      ? '#1b202b'
      : '#242936';

  const headerToolbar = (
    <div className="flex items-center gap-1.5">
      <div className="h-4 w-px bg-zinc-800" />

      <div className="flex items-center gap-0.5 rounded-xl border border-zinc-800/80 bg-[#0F1115] p-0.5">
        {[
          { id: 'pan', icon: Hand, title: 'Mover Canvas (Pan)' },
          { id: 'select', icon: MousePointer2, title: 'Selecionar Múltiplos Itens' },
          { id: 'focus', icon: Focus, title: 'Selecionar com Auto-Zoom' },
        ].map(({ id, icon: Icon, title }) => (
          <button
            key={id}
            type="button"
            onClick={() => setInteractionMode(id as typeof interactionMode)}
            title={title}
            className={`rounded-lg p-1.5 transition ${
              interactionMode === id
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>

      <div className="flex items-center gap-0.5 rounded-xl border border-zinc-800/80 bg-[#0F1115] p-0.5">
        <button type="button" onClick={handleUndo} disabled={!canUndo} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-30" title="Desfazer (Ctrl+Z)">
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={handleRedo} disabled={!canRedo} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-30" title="Refazer (Ctrl+Y)">
          <Redo2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-0.5 rounded-xl border border-zinc-800/80 bg-[#0F1115] p-0.5">
        <button type="button" onClick={() => zoomOut()} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100" title="Afastar"><ZoomOut className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={() => fitCanvasWithMargins({ duration: 450, maxZoom: 1.05 })} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100" title="Enquadrar Tudo com margens"><Maximize className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={() => zoomIn()} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100" title="Aproximar"><ZoomIn className="h-3.5 w-3.5" /></button>
        <button
          type="button"
          onClick={() => setIsLocked((v) => !v)}
          className={`rounded-lg p-1.5 transition ${isLocked ? 'bg-rose-500/20 text-rose-400' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'}`}
          title={isLocked ? 'Desbloquear edição' : 'Travar canvas'}
        >
          {isLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="h-4 w-px bg-zinc-800" />

      {/* Organizar */}
      <div className="relative">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpenHeaderMenu(openHeaderMenu === 'layout' ? null : 'layout');
          }}
          title="Auto-organizar cards"
          className={`group flex items-center rounded-xl px-2 py-1.5 text-xs font-medium transition-all duration-200 ${
            openHeaderMenu === 'layout' ? 'bg-indigo-600/20 text-indigo-300' : 'text-zinc-300 hover:bg-zinc-800'
          }`}
        >
          <LayoutTemplate className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
          <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 ease-out group-hover:ml-1.5 group-hover:max-w-[80px] group-hover:opacity-100">
            Organizar
          </span>
        </button>
        {openHeaderMenu === 'layout' && (
          <div onClick={(e) => e.stopPropagation()} className="absolute left-0 top-full z-50 mt-2 w-48 rounded-xl border border-zinc-800 bg-[#161920] p-1.5 shadow-2xl">
            <button onClick={() => handleApplyLayout('horizontal')} className="w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-zinc-200 hover:bg-indigo-600/20">Horizontal (Árvore)</button>
            <button onClick={() => handleApplyLayout('radial')} className="w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-zinc-200 hover:bg-indigo-600/20">Radial (Ao Redor)</button>
            <button onClick={() => handleApplyLayout('vertical')} className="w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-zinc-200 hover:bg-indigo-600/20">Vertical (Topo-Baixo)</button>
          </div>
        )}
      </div>

      {/* Setas */}
      <div className="relative">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpenHeaderMenu(openHeaderMenu === 'edge' ? null : 'edge');
          }}
          title="Estilo global das setas"
          className={`group flex items-center rounded-xl px-2 py-1.5 text-xs font-medium transition-all duration-200 ${
            openHeaderMenu === 'edge' ? 'bg-indigo-600/20 text-indigo-300' : 'text-zinc-300 hover:bg-zinc-800'
          }`}
        >
          <GitCommit className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
          <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 ease-out group-hover:ml-1.5 group-hover:max-w-[55px] group-hover:opacity-100">
            Setas
          </span>
        </button>
        {openHeaderMenu === 'edge' && (
          <div onClick={(e) => e.stopPropagation()} className="absolute left-0 top-full z-50 mt-2 w-56 space-y-3 rounded-xl border border-zinc-800 bg-[#161920] p-3.5 shadow-2xl">
            <div>
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Formato</span>
              <div className="grid grid-cols-2 gap-1.5">
                <button onClick={() => handleUpdateAllEdges({ edgeType: 'smoothstep' })} className={`rounded-lg py-1.5 text-[11px] font-medium ${globalEdgeType === 'smoothstep' ? 'bg-indigo-600 text-white' : 'bg-zinc-800/80 text-zinc-300'}`}>Ortogonal</button>
                <button onClick={() => handleUpdateAllEdges({ edgeType: 'default' })} className={`rounded-lg py-1.5 text-[11px] font-medium ${globalEdgeType === 'default' ? 'bg-indigo-600 text-white' : 'bg-zinc-800/80 text-zinc-300'}`}>Curva</button>
                <button onClick={() => handleUpdateAllEdges({ edgeType: 'straight' })} className={`rounded-lg py-1.5 text-[11px] font-medium ${globalEdgeType === 'straight' ? 'bg-indigo-600 text-white' : 'bg-zinc-800/80 text-zinc-300'}`}>Reta</button>
                <button onClick={() => handleUpdateAllEdges({ edgeType: 'organic' })} className={`rounded-lg py-1.5 text-[11px] font-medium ${globalEdgeType === 'organic' ? 'bg-indigo-600 text-white' : 'bg-zinc-800/80 text-zinc-300'}`}>Orgânica</button>
              </div>
            </div>
            <div>
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Movimento</span>
              <div className="flex gap-1.5">
                <button onClick={() => handleUpdateAllEdges({ animated: true })} className={`flex-1 rounded-lg py-1.5 text-xs font-medium ${globalAnimated ? 'bg-indigo-600 text-white' : 'bg-zinc-800/80 text-zinc-300'}`}>Animada</button>
                <button onClick={() => handleUpdateAllEdges({ animated: false })} className={`flex-1 rounded-lg py-1.5 text-xs font-medium ${!globalAnimated ? 'bg-indigo-600 text-white' : 'bg-zinc-800/80 text-zinc-300'}`}>Estática</button>
              </div>
            </div>
            <div>
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Cor</span>
              <div className="flex flex-wrap gap-2">
                {EDGE_COLORS.map((hex) => (
                  <button key={hex} onClick={() => handleUpdateAllEdges({ color: hex })} className={`h-5 w-5 rounded-full border-2 ${globalColor === hex ? 'scale-110 border-white' : 'border-transparent opacity-70'}`} style={{ backgroundColor: hex }} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Active Recall */}
      <button
        type="button"
        onClick={() => {
          toggleCanvasRecallMode();
          addToast({
            message: !canvasRecallMode ? 'Active Recall ativado — clique nos cards para revelar' : 'Active Recall desativado',
          }, 2400);
        }}
        title="Testar memória borrando o conteúdo dos cards"
        className={`group flex items-center rounded-xl px-2 py-1.5 text-xs font-medium transition-all duration-200 ${
          canvasRecallMode ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40' : 'text-zinc-300 hover:bg-zinc-800'
        }`}
      >
        {canvasRecallMode ? <EyeOff className="h-3.5 w-3.5 shrink-0 text-amber-400" /> : <Eye className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
        <span className={`overflow-hidden whitespace-nowrap transition-all duration-200 ease-out ${canvasRecallMode ? 'ml-1.5 max-w-[60px] opacity-100' : 'max-w-0 opacity-0 group-hover:ml-1.5 group-hover:max-w-[60px] group-hover:opacity-100'}`}>
          Recall
        </span>
      </button>

      {/* Spotlight */}
      <div className="relative">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpenHeaderMenu(openHeaderMenu === 'spotlight' ? null : 'spotlight');
          }}
          title="Spotlight: destacar cards específicos mantendo o mapa visível"
          className={`group flex items-center rounded-xl px-2 py-1.5 text-xs font-medium transition-all duration-200 ${
            canvasSpotlight !== 'none'
              ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40'
              : openHeaderMenu === 'spotlight'
              ? 'bg-indigo-600/20 text-indigo-300'
              : 'text-zinc-300 hover:bg-zinc-800'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          <span className={`overflow-hidden whitespace-nowrap transition-all duration-200 ease-out ${canvasSpotlight !== 'none' ? 'ml-1.5 max-w-[85px] opacity-100' : 'max-w-0 opacity-0 group-hover:ml-1.5 group-hover:max-w-[80px] group-hover:opacity-100'}`}>
            {canvasSpotlight === 'none'
              ? 'Spotlight'
              : canvasSpotlight === 'due'
              ? 'Vencidos'
              : canvasSpotlight === 'critical'
              ? 'Críticos'
              : canvasSpotlight === 'pinned'
              ? 'Pins'
              : 'Favoritos'}
          </span>
        </button>
        {openHeaderMenu === 'spotlight' && (
          <div onClick={(e) => e.stopPropagation()} className="absolute left-0 top-full z-50 mt-2 w-48 rounded-xl border border-zinc-800 bg-[#161920] p-1.5 shadow-2xl">
            {SPOTLIGHT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setCanvasSpotlight(opt.id);
                  setOpenHeaderMenu(null);
                }}
                className={`w-full rounded-lg px-3 py-2 text-left text-xs font-medium transition ${
                  canvasSpotlight === opt.id ? 'bg-amber-500/20 text-amber-300' : 'text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Caneta & Desenho Livre */}
      <button
        type="button"
        onClick={() => {
          const next = !isDrawingMode;
          setIsDrawingMode(next);
          if (next && inlineEditingCardId) setInlineEditingCardId(null);
        }}
        title="Modo Caneta & Desenho Livre (Stylus / Mouse)"
        className={`group flex items-center rounded-xl px-2 py-1.5 text-xs font-medium transition-all duration-200 ${
          isDrawingMode ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-300 hover:bg-zinc-800'
        }`}
      >
        <PenTool className="h-3.5 w-3.5 shrink-0" />
        <span className={`overflow-hidden whitespace-nowrap transition-all duration-200 ease-out ${isDrawingMode ? 'ml-1.5 max-w-[75px] opacity-100' : 'max-w-0 opacity-0 group-hover:ml-1.5 group-hover:max-w-[75px] group-hover:opacity-100'}`}>
          Desenhar
        </span>
      </button>

      {/* Modo Texto */}
      <button
        type="button"
        onClick={handleOpenOutlineMode}
        title="Modo Estrutura em Texto (- Tópico)"
        className="group flex items-center rounded-xl px-2 py-1.5 text-xs font-medium text-zinc-300 transition-all duration-200 hover:bg-zinc-800"
      >
        <FileText className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
        <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 ease-out group-hover:ml-1.5 group-hover:max-w-[85px] group-hover:opacity-100">
          Modo Texto
        </span>
      </button>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={`kc-canvas-surface relative h-full w-full transition-colors duration-200 ${
        isDraggingImageFile ? 'ring-2 ring-inset ring-indigo-500' : ''
      } ${isPlacingText ? 'cursor-text' : ''}`}
      style={{ backgroundColor: canvasBgHex }}
      onContextMenu={(e) => {
        const target = e.target as HTMLElement | null;
        const isTextInput =
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable);
        if (!isTextInput) {
          e.preventDefault();
        }
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setIsDraggingImageFile(true);
        }
      }}
      onDragLeave={() => setIsDraggingImageFile(false)}
      onDrop={(e) => {
        setIsDraggingImageFile(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) {
          e.preventDefault();
          insertImageFileToCanvas(file, { x: e.clientX, y: e.clientY });
        }
      }}
      onPointerUp={() => {
        if (interactionMode === 'focus') {
          setTimeout(() => {
            const selected = getNodes().filter((n) => n.selected && n.type !== 'canvasGroup');
            if (selected.length > 0) {
              saveViewport();
              fitCanvasWithMargins({ nodeIds: selected.map((n) => n.id), duration: 500, maxZoom: 1.15 });
            }
          }, 100);
        }
      }}
    >
      {headerSlot && createPortal(headerToolbar, headerSlot)}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) insertImageFileToCanvas(file);
        }}
      />

      <ReactFlow
        style={{ backgroundColor: canvasBgHex }}
        onNodeClick={() => {
          if (selectedEdgeLabelId) setSelectedEdgeLabelId(null);
          if (editingEdgeLabelId) setEditingEdgeLabelId(null);
        }}
        onEdgeClick={() => {
          if (selectedEdgeLabelId) setSelectedEdgeLabelId(null);
          if (editingEdgeLabelId) setEditingEdgeLabelId(null);
        }}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onSelectionDragStart={onSelectionDragStart}
        onSelectionDrag={onSelectionDrag}
        onSelectionDragStop={onSelectionDragStop}
        multiSelectionKeyCode={['Control', 'Meta', 'Shift']}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onReconnect={onReconnect}
        edgesReconnectable={!isLocked}
        reconnectRadius={22}
        onPaneContextMenu={handlePaneContextMenu}
        onNodeContextMenu={(e) => e.preventDefault()}
        onEdgeContextMenu={(e) => e.preventDefault()}
        onSelectionContextMenu={(e) => e.preventDefault()}
        onInit={(instance) => {
          setLiveViewport(instance.getViewport());
        }}
        onMoveStart={(event) => {
          if (activeEditTargetNodeId && event && !isProgrammaticMoveRef.current) {
            manualMoveDuringEditRef.current = true;
          }
        }}
        onMove={(_, vp) => {
          setLiveViewport(vp);
          setCanvasZoomedOut(vp.zoom < 0.48);
        }}
        onMoveEnd={(_, vp) => {
          setLiveViewport(vp);
          setCanvasZoomedOut(vp.zoom < 0.48);
          if (activeWorkspaceId) {
            localStorage.setItem(`kc_vp_${activeWorkspaceId}`, JSON.stringify(vp));
          }
        }}
        onPaneClick={async (e) => {
          if (selectedEdgeLabelId || editingEdgeLabelId) {
            setSelectedEdgeLabelId(null);
            setEditingEdgeLabelId(null);
            return;
          }
          if (croppingImageNodeId) {
            setCroppingImageNodeId(null);
            return;
          }
          if (editingTextNodeId) {
            setEditingTextNodeId(null);
            return;
          }
          if (editingTopicNodeId) {
            setEditingTopicNodeId(null);
            return;
          }
          if (inlineEditingCardId) {
            setInlineEditingCardId(null);
            return;
          }
          if (isPlacingText && !isLocked && !isDrawingMode) {
            pushHistorySnapshot();
            const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
            const createdTextId = await createCanvasText({
              x: Math.round(pos.x - 20),
              y: Math.round(pos.y - 18),
              preset: 'plain',
            });
            setIsPlacingText(false);
            if (createdTextId) setEditingTextNodeId(createdTextId);
            return;
          }
          if (e.detail === 2 && !isLocked && !isDrawingMode) {
            pushHistorySnapshot();
            const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
            const createdId = await createCardOnCanvas({
              x: Math.round(pos.x - 175),
              y: Math.round(pos.y - 120),
            });
            setInlineEditingCardId(createdId);
          }
        }}
        deleteKeyCode={null}
        connectionMode={ConnectionMode.Loose}
        panOnDrag={!isLocked && interactionMode === 'pan'}
        selectionOnDrag={!isLocked && (interactionMode === 'select' || interactionMode === 'focus')}
        selectionMode={SelectionMode.Partial}
        nodesDraggable={!isLocked}
        nodesConnectable={!isLocked}
        elementsSelectable={!isLocked}
        onlyRenderVisibleElements
        minZoom={0.15}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
      >
        {(preferences.canvasBackground === 'dots' || preferences.canvasBackground === 'grid') && (
          <Background
            bgColor={canvasBgHex}
            variant={
              preferences.canvasBackground === 'grid'
                ? BackgroundVariant.Lines
                : BackgroundVariant.Dots
            }
            gap={preferences.canvasBackground === 'grid' ? 32 : 24}
            size={preferences.canvasBackground === 'grid' ? 1 : 1.3}
            color={patternColor}
          />
        )}

        {preferences.canvasBackground === 'lined' && (
          <svg
            className="react-flow__background pointer-events-none absolute inset-0 h-full w-full"
            style={{ backgroundColor: canvasBgHex }}
          >
            <defs>
              <pattern
                id="kc-notebook-pautado"
                x={liveViewport.x}
                y={liveViewport.y}
                width={Math.max(12, 32 * liveViewport.zoom)}
                height={Math.max(12, 32 * liveViewport.zoom)}
                patternUnits="userSpaceOnUse"
              >
                <line
                  x1="0"
                  y1={Math.max(12, 32 * liveViewport.zoom)}
                  x2={Math.max(12, 32 * liveViewport.zoom)}
                  y2={Math.max(12, 32 * liveViewport.zoom)}
                  stroke={
                    theme === 'paper'
                      ? 'rgba(96, 165, 250, 0.30)'
                      : 'rgba(148, 163, 184, 0.13)'
                  }
                  strokeWidth={1}
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#kc-notebook-pautado)" />
          </svg>
        )}

        <MiniMap
          pannable
          zoomable
          bgColor={theme === 'paper' ? '#FFFFFF' : '#161920'}
          nodeBorderRadius={6}
          nodeColor={(n) =>
            n.type === 'panoramaSection'
              ? theme === 'paper'
                ? 'rgba(120, 113, 108, 0.14)'
                : 'rgba(99, 102, 241, 0.09)'
              : n.type === 'canvasGroup'
              ? 'rgba(99, 102, 241, 0.14)'
              : n.type === 'canvasImage'
              ? 'rgba(16, 185, 129, 0.55)'
              : n.type === 'canvasText'
              ? 'rgba(245, 158, 11, 0.65)'
              : n.type === 'canvasTopic'
              ? 'rgba(168, 85, 247, 0.72)'
              : theme === 'paper'
              ? 'rgba(99, 102, 241, 0.55)'
              : 'rgba(129, 140, 248, 0.45)'
          }
          maskColor={theme === 'paper' ? 'rgba(232, 228, 218, 0.72)' : 'rgba(15, 17, 21, 0.84)'}
          className="!rounded-2xl !border !border-zinc-800/80 !shadow-xl backdrop-blur-md"
        />

        {/* BARRA CONTEXTUAL 1: CARDS SELECIONADOS */}
        {showCardSelectionToolbar && (
          <Panel position="top-center" className="mt-3 !max-w-none">
            <div className="flex w-max max-w-[95vw] flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-indigo-500/40 bg-[#161920]/95 px-2.5 py-1.5 shadow-2xl backdrop-blur-xl">
              <span className="rounded-lg bg-indigo-500/15 px-2 py-1 text-[11px] font-semibold text-indigo-300">
                {selectedCardNodes.length}{' '}
                {selectedCardNodes.length === 1 ? 'card' : 'cards'}
              </span>

              <div className="h-4 w-px bg-zinc-800" />

              <div className="flex items-center gap-1.5 px-0.5">
                {CARD_COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => updateCardsMetaBulk(selectedCardIds, { color: c.id })}
                    title={`Cor: ${c.label}`}
                    className={`h-4 w-4 rounded-full border transition hover:scale-125 ${
                      firstSelectedCard?.color === c.id ? 'scale-110 border-white' : 'border-zinc-700'
                    }`}
                    style={{ backgroundColor: c.dot }}
                  />
                ))}
              </div>

              <div className="h-4 w-px bg-zinc-800" />

              <TypographyPopover
                value={firstSelectedCard?.typography}
                defaults={DEFAULT_CARD_TYPOGRAPHY}
                onChange={(next) => updateCardsMetaBulk(selectedCardIds, { typography: next })}
                onReset={() => updateCardsMetaBulk(selectedCardIds, { typography: undefined })}
                titleStyle={firstSelectedCard?.titleStyle}
                onTitleStyleChange={(next) =>
                  updateCardsMetaBulk(selectedCardIds, { titleStyle: next })
                }
                onTitleStyleReset={() =>
                  updateCardsMetaBulk(selectedCardIds, { titleStyle: undefined })
                }
              />

              {firstSelectedCard && selectedCardIds.length === 1 && (
                <CalloutCustomizerPopover
                  value={resolveCardCallout(firstSelectedCard)}
                  theme={theme}
                  onChange={(next) =>
                    updateCardMeta(firstSelectedCard.id, {
                      notes: next.text ?? '',
                      callout: next,
                    })
                  }
                />
              )}

              {firstSelectedCardCanvasNode && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const nextMode =
                        firstSelectedCardCanvasNode.sizingMode === 'auto' ? 'custom' : 'auto';
                      updateCanvasNode(firstSelectedCardCanvasNode.id, {
                        sizingMode: nextMode,
                        height:
                          nextMode === 'auto'
                            ? 0
                            : Math.max(160, firstSelectedCardCanvasNode.height || 240),
                      });
                    }}
                    className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition ${
                      firstSelectedCardCanvasNode.sizingMode === 'auto'
                        ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                        : 'border-zinc-800 bg-[#0F1115] text-zinc-300 hover:border-indigo-500/60'
                    }`}
                    title="Alternar entre ajustar automaticamente ao texto ou tamanho manual"
                  >
                    <Minimize2 className="h-3 w-3" />
                    {firstSelectedCardCanvasNode.sizingMode === 'auto' ? 'Auto' : 'Ajustar'}
                  </button>

                  <select
                    value={firstSelectedCardCanvasNode.padding ?? 'md'}
                    onChange={(e) =>
                      updateCanvasNode(firstSelectedCardCanvasNode.id, {
                        padding: e.target.value as CanvasNodePosition['padding'],
                      })
                    }
                    title="Preenchimento interno do card"
                    className="rounded-lg border border-zinc-800 bg-[#0F1115] px-1.5 py-1 text-[11px] font-medium text-zinc-200 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="sm">Margem: Compacta</option>
                    <option value="md">Margem: Padrão</option>
                    <option value="lg">Margem: Ampla</option>
                  </select>
                </>
              )}

              <select
                value={firstSelectedCard?.paperStyle ?? 'plain'}
                onChange={(e) =>
                  updateCardsMetaBulk(selectedCardIds, {
                    paperStyle: e.target.value as KnowledgeCardMeta['paperStyle'],
                  })
                }
                title="Padrão de papel dentro do card"
                className="rounded-lg border border-zinc-800 bg-[#0F1115] px-2 py-1 text-[11px] font-medium text-zinc-200 focus:border-indigo-500 focus:outline-none"
              >
                {PAPER_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    Papel: {opt.label}
                  </option>
                ))}
              </select>

              <button
                onClick={() => {
                  const order: Array<'solid' | 'dashed' | 'none'> = ['solid', 'dashed', 'none'];
                  const curr = firstSelectedCard?.borderStyle ?? 'solid';
                  const next = order[(order.indexOf(curr) + 1) % order.length];
                  updateCardsMetaBulk(selectedCardIds, { borderStyle: next });
                }}
                className="rounded-lg border border-zinc-800 bg-[#0F1115] px-2 py-1 text-[11px] font-medium text-zinc-300 hover:border-indigo-500/60"
                title="Alternar estilo da borda"
              >
                Borda:{' '}
                {(firstSelectedCard?.borderStyle ?? 'solid') === 'solid'
                  ? 'Sólida'
                  : firstSelectedCard?.borderStyle === 'dashed'
                  ? 'Tracejada'
                  : 'Nenhuma'}
              </button>

              <div className="h-4 w-px bg-zinc-800" />

              <div className="flex items-center gap-0.5">
                {QUICK_STICKERS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => updateCardsMetaBulk(selectedCardIds, { emoji })}
                    className="rounded-lg px-1 py-0.5 text-xs transition hover:bg-zinc-800"
                    title={`Adesivo ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
                <button
                  onClick={() => updateCardsMetaBulk(selectedCardIds, { emoji: undefined })}
                  className="rounded-lg px-1 py-0.5 text-[10px] font-medium text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                  title="Remover adesivo"
                >
                  ✕
                </button>
              </div>

              <div className="h-4 w-px bg-zinc-800" />

              {selectedGroupableNodes.length >= 2 && (
                <button
                  onClick={handleGroupSelectedItems}
                  className="flex items-center gap-1 rounded-lg bg-violet-500/15 px-2 py-1 text-[11px] font-semibold text-violet-300 transition hover:bg-violet-600 hover:text-white"
                  title="Envolver todos os itens selecionados em um Grupo"
                >
                  <Group className="h-3.5 w-3.5" /> Agrupar
                </button>
              )}

              {firstSelectedCardCanvasNode && firstSelectedCard && (
                <button
                  type="button"
                  onClick={() => {
                    const targetNodeId = firstSelectedCardCanvasNode.id;
                    openConfirm({
                      title: 'Converter card em Texto Livre?',
                      description: `"${firstSelectedCard.title}" terá conteúdo, formatação, cor, nota/pegadinha e conexões preservados como Texto Livre. Enquanto for Texto Livre, sairá da fila de Revisão SM-2 (você pode desfazer ou reconverter em Card quando quiser).`,
                      confirmLabel: 'Converter em Texto',
                      onConfirm: async () => {
                        const result = await convertCardToTextNode(targetNodeId);
                        if (result) {
                          addToast({
                            message: 'Card convertido em Texto Livre com conexões preservadas',
                            variant: 'success',
                            action: {
                              label: 'Desfazer',
                              onClick: () =>
                                undoConvertCardToText(result.textNodeId, result.undoBundle),
                            },
                          });
                        }
                      },
                    });
                  }}
                  className="flex items-center gap-1 rounded-lg bg-amber-500/15 px-2 py-1 text-[11px] font-semibold text-amber-300 transition hover:bg-amber-500 hover:text-zinc-950"
                  title="Converter este Knowledge Card em Texto Livre preservando conteúdo e conexões"
                >
                  <FileType className="h-3.5 w-3.5" /> Virar Texto
                </button>
              )}

              <button
                onClick={() => updateCardsMetaBulk(selectedCardIds, { importance: 'critical' })}
                className="rounded-lg p-1.5 text-rose-400 transition hover:bg-rose-500/15"
                title="Marcar seleção como Crítico"
              >
                <Flame className="h-3.5 w-3.5" />
              </button>

              <button
                onClick={async () => {
                  pushHistorySnapshot();
                  await duplicateCanvasNodes(selectedCardNodes.map((n) => n.id));
                }}
                className="rounded-lg p-1.5 text-indigo-400 transition hover:bg-zinc-800"
                title="Duplicar seleção"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>

              <button
                onClick={async () => {
                  pushHistorySnapshot();
                  const selNodeIds = getNodes().filter((n) => n.selected).map((n) => n.id);
                  const selEdgeIds = getEdges().filter((ed) => ed.selected).map((ed) => ed.id);
                  await deleteCanvasSelection(selNodeIds, selEdgeIds);
                  addToast({
                    message: 'Seleção removida do canvas',
                    action: { label: 'Desfazer', onClick: () => handleUndo() },
                  });
                }}
                className="rounded-lg p-1.5 text-rose-400 transition hover:bg-rose-500/15"
                title="Excluir seleção (Delete)"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </Panel>
        )}

        {/* BARRA CONTEXTUAL 2: PERSONALIZAÇÃO COMPLETA DO GRUPO */}
        {showGroupToolbar && activeGroupRecord && (
          <Panel position="top-center" className="mt-3 !max-w-none">
            <div className="kc-no-scrollbar flex w-max max-w-[94vw] flex-nowrap items-center gap-2 overflow-x-auto whitespace-nowrap rounded-2xl border border-indigo-500/40 bg-[#161920]/95 px-3 py-1.5 shadow-2xl backdrop-blur-xl">
              <span className="rounded-lg bg-violet-500/15 px-2 py-1 text-[11px] font-semibold text-violet-300">
                Grupo
              </span>

              <div className="h-4 w-px bg-zinc-800" />

              <div className="flex items-center gap-1">
                <span className="mr-1 text-[10px] font-semibold uppercase text-zinc-500">Borda</span>
                {GROUP_PALETTE.map((hex) => (
                  <button
                    key={`gb-${hex}`}
                    onClick={() => updateCanvasNode(activeGroupRecord.id, { color: hex })}
                    className={`h-4 w-4 rounded-full border transition hover:scale-125 ${
                      (activeGroupRecord.color ?? '#6366f1') === hex ? 'scale-110 border-white' : 'border-zinc-700'
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>

              <div className="h-4 w-px bg-zinc-800" />

              <div className="flex items-center gap-1">
                <span className="mr-1 text-[10px] font-semibold uppercase text-zinc-500">Fundo</span>
                {GROUP_PALETTE.map((hex) => (
                  <button
                    key={`gf-${hex}`}
                    onClick={() => updateCanvasNode(activeGroupRecord.id, { bgColor: hex })}
                    className={`h-4 w-4 rounded border transition hover:scale-125 ${
                      (activeGroupRecord.bgColor ?? activeGroupRecord.color ?? '#6366f1') === hex
                        ? 'scale-110 border-white'
                        : 'border-zinc-700'
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>

              <div className="h-4 w-px bg-zinc-800" />

              <select
                value={activeGroupRecord.bgOpacity ?? 'subtle'}
                onChange={(e) =>
                  updateCanvasNode(activeGroupRecord.id, {
                    bgOpacity: e.target.value as CanvasNodePosition['bgOpacity'],
                  })
                }
                className="rounded-lg border border-zinc-800 bg-[#0F1115] px-2 py-1 text-[11px] text-zinc-200 focus:outline-none"
              >
                <option value="transparent">Fundo: 0%</option>
                <option value="subtle">Fundo: Suave</option>
                <option value="tinted">Fundo: Destaque</option>
              </select>

              <select
                value={activeGroupRecord.borderStyle ?? 'dashed'}
                onChange={(e) =>
                  updateCanvasNode(activeGroupRecord.id, {
                    borderStyle: e.target.value as CanvasNodePosition['borderStyle'],
                  })
                }
                className="rounded-lg border border-zinc-800 bg-[#0F1115] px-2 py-1 text-[11px] text-zinc-200 focus:outline-none"
              >
                <option value="dashed">Tracejada</option>
                <option value="solid">Sólida</option>
                <option value="dotted">Pontilhada</option>
                <option value="none">Sem borda</option>
              </select>

              <select
                value={activeGroupRecord.borderWidth ?? 'medium'}
                onChange={(e) =>
                  updateCanvasNode(activeGroupRecord.id, {
                    borderWidth: e.target.value as CanvasNodePosition['borderWidth'],
                  })
                }
                className="rounded-lg border border-zinc-800 bg-[#0F1115] px-2 py-1 text-[11px] text-zinc-200 focus:outline-none"
              >
                <option value="thin">Fina</option>
                <option value="medium">Média</option>
                <option value="thick">Grossa</option>
              </select>

              <div className="h-4 w-px bg-zinc-800" />

              <button
                onClick={async () => {
                  pushHistorySnapshot();
                  await deleteCanvasSelection([activeGroupRecord.id], []);
                  addToast({
                    message: 'Grupo removido (cards mantidos)',
                    action: { label: 'Desfazer', onClick: () => handleUndo() },
                  });
                }}
                className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/15"
                title="Excluir Grupo (os cards dentro dele continuam intactos)"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </Panel>
        )}

        {/* BARRA CONTEXTUAL 3: IMAGEM SOLTA SELECIONADA */}
        {showImageToolbar && activeImageRecord && (
          <Panel position="top-center" className="mt-3 !max-w-none">
            <div className="kc-no-scrollbar flex w-max max-w-[94vw] flex-nowrap items-center gap-2 overflow-x-auto whitespace-nowrap rounded-2xl border border-indigo-500/40 bg-[#161920]/95 px-3 py-1.5 shadow-2xl backdrop-blur-xl">
              <span className="rounded-lg bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold text-emerald-300">
                Imagem
              </span>

              <button
                onClick={() => {
                  const next = croppingImageNodeId === activeImageRecord.id ? null : activeImageRecord.id;
                  if (next) updateCanvasNode(activeImageRecord.id, { imageFit: 'cover' });
                  setCroppingImageNodeId(next);
                }}
                className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                  croppingImageNodeId === activeImageRecord.id
                    ? 'bg-amber-500 text-zinc-950'
                    : 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
                }`}
                title="Arraste por dentro e dê zoom para recortar a imagem"
              >
                <Crop className="h-3.5 w-3.5" />
                {croppingImageNodeId === activeImageRecord.id ? 'Cortando...' : 'Cortar'}
              </button>

              <select
                value={activeImageRecord.imageFit ?? 'contain'}
                onChange={(e) =>
                  updateCanvasNode(activeImageRecord.id, {
                    imageFit: e.target.value as CanvasNodePosition['imageFit'],
                  })
                }
                title="Como a imagem ocupa o quadro"
                className="rounded-lg border border-zinc-800 bg-[#0F1115] px-2 py-1 text-[11px] text-zinc-200 focus:outline-none"
              >
                <option value="contain">Ajuste: Inteira</option>
                <option value="cover">Ajuste: Preencher/Cortar</option>
                <option value="fill">Ajuste: Esticar Livre</option>
              </select>

              <button
                onClick={() =>
                  updateCanvasNode(activeImageRecord.id, {
                    keepAspectRatio: !activeImageRecord.keepAspectRatio,
                  })
                }
                className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] transition ${
                  activeImageRecord.keepAspectRatio
                    ? 'border-indigo-500/60 bg-indigo-500/15 text-indigo-300'
                    : 'border-zinc-800 bg-[#0F1115] text-zinc-400 hover:text-zinc-200'
                }`}
                title="Travar ou liberar proporção ao puxar os cantos"
              >
                <Link2 className="h-3 w-3" />
                {activeImageRecord.keepAspectRatio ? 'Proporção Fixa' : 'Livre'}
              </button>

              <div className="h-4 w-px bg-zinc-800" />

              <button
                onClick={() =>
                  updateCanvasNode(activeImageRecord.id, {
                    rotation: ((activeImageRecord.rotation ?? 0) + 90) % 360,
                  })
                }
                className="rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-800"
                title="Girar 90°"
              >
                <RotateCw className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() =>
                  updateCanvasNode(activeImageRecord.id, { flipX: !activeImageRecord.flipX })
                }
                className={`rounded-lg p-1.5 transition ${
                  activeImageRecord.flipX ? 'bg-indigo-600/25 text-indigo-300' : 'text-zinc-300 hover:bg-zinc-800'
                }`}
                title="Espelhar horizontalmente"
              >
                <FlipHorizontal2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() =>
                  updateCanvasNode(activeImageRecord.id, { flipY: !activeImageRecord.flipY })
                }
                className={`rounded-lg p-1.5 transition ${
                  activeImageRecord.flipY ? 'bg-indigo-600/25 text-indigo-300' : 'text-zinc-300 hover:bg-zinc-800'
                }`}
                title="Espelhar verticalmente"
              >
                <FlipVertical2 className="h-3.5 w-3.5" />
              </button>

              <div className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-[#0F1115] px-2 py-1">
                <span className="text-[10px] text-zinc-500">Opac.</span>
                <input
                  type="range"
                  min={0.2}
                  max={1}
                  step={0.05}
                  value={activeImageRecord.opacity ?? 1}
                  onChange={(e) =>
                    updateCanvasNode(activeImageRecord.id, { opacity: parseFloat(e.target.value) })
                  }
                  className="w-14 accent-indigo-500"
                />
              </div>

              <select
                value={activeImageRecord.borderRadius ?? 'xl'}
                onChange={(e) =>
                  updateCanvasNode(activeImageRecord.id, {
                    borderRadius: e.target.value as CanvasNodePosition['borderRadius'],
                  })
                }
                title="Arredondamento dos cantos"
                className="rounded-lg border border-zinc-800 bg-[#0F1115] px-2 py-1 text-[11px] text-zinc-200 focus:outline-none"
              >
                <option value="none">Cantos: Retos</option>
                <option value="md">Cantos: Suaves</option>
                <option value="xl">Cantos: Redondos</option>
                <option value="full">Círculo/Pílula</option>
              </select>

              <div className="h-4 w-px bg-zinc-800" />

              <div className="flex items-center gap-1">
                {GROUP_PALETTE.map((hex) => (
                  <button
                    key={`ib-${hex}`}
                    onClick={() => updateCanvasNode(activeImageRecord.id, { color: hex, borderStyle: 'solid' })}
                    className={`h-4 w-4 rounded-full border transition hover:scale-125 ${
                      activeImageRecord.color === hex && activeImageRecord.borderStyle !== 'none'
                        ? 'scale-110 border-white'
                        : 'border-zinc-700'
                    }`}
                    style={{ backgroundColor: hex }}
                    title="Cor da moldura"
                  />
                ))}
                <button
                  onClick={() =>
                    updateCanvasNode(activeImageRecord.id, {
                      borderStyle: activeImageRecord.borderStyle === 'none' ? 'solid' : 'none',
                    })
                  }
                  className="ml-0.5 rounded-lg border border-zinc-800 bg-[#0F1115] px-1.5 py-0.5 text-[10px] text-zinc-300 hover:border-indigo-500"
                  title="Mostrar ou ocultar moldura"
                >
                  {activeImageRecord.borderStyle === 'none' ? '+Borda' : 'Sem borda'}
                </button>
              </div>

              <button
                onClick={() => {
                  setCroppingImageNodeId(null);
                  updateCanvasNode(activeImageRecord.id, {
                    imageFit: 'contain',
                    keepAspectRatio: false,
                    rotation: 0,
                    flipX: false,
                    flipY: false,
                    opacity: 1,
                    cropZoom: 1,
                    cropX: 0,
                    cropY: 0,
                    borderRadius: 'xl',
                  });
                }}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                title="Resetar todos os ajustes da imagem"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>

              <button
                onClick={async () => {
                  pushHistorySnapshot();
                  setCroppingImageNodeId(null);
                  await deleteCanvasSelection([activeImageRecord.id], []);
                  addToast({
                    message: 'Imagem removida do canvas',
                    action: { label: 'Desfazer', onClick: () => handleUndo() },
                  });
                }}
                className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/15"
                title="Excluir imagem"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </Panel>
        )}

        {/* NAVEGAÇÃO DE CONTEXTO FLUTUANTE (ÍCONE COMPACTO) */}
        {!zenMode && (
          <Panel position="top-left" className="ml-3 mt-3">
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setIsContextMenuOpen((v) => !v)}
                className={`relative flex h-9 w-9 items-center justify-center rounded-xl border shadow-lg backdrop-blur-xl transition ${
                  isContextMenuOpen || activeBreadcrumb.length > 0
                    ? 'border-indigo-500/50 bg-[#161920]/95 text-indigo-300 hover:bg-indigo-600/20'
                    : 'border-zinc-800/90 bg-[#161920]/90 text-zinc-400 hover:border-zinc-700 hover:text-zinc-100'
                }`}
                title={
                  activeBreadcrumb.length > 0
                    ? `Contexto ativo: ${activeBreadcrumb.map((b) => b.title).join(' / ')} — Clique para navegar`
                    : 'Todo o Conhecimento — Clique para filtrar por Disciplina, Assunto ou Tópico'
                }
                aria-label="Abrir navegação de tópicos e contextos"
              >
                <FolderTree className="h-4 w-4" />
                {activeBreadcrumb.length > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-indigo-500 px-1 text-[9px] font-bold text-white shadow">
                    {activeBreadcrumb.length}
                  </span>
                )}
              </button>

              {isContextMenuOpen && (
                <div className="absolute left-0 top-full z-[130] mt-2 flex max-h-[68vh] w-72 flex-col overflow-hidden rounded-2xl border border-indigo-500/35 bg-[#161920]/98 shadow-2xl backdrop-blur-xl">
                  <div className="border-b border-zinc-800/80 p-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                        Contexto do Mapa
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsContextMenuOpen(false)}
                        className="rounded p-0.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {activeBreadcrumb.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1 text-[11px]">
                        {activeBreadcrumb.map((item, idx) => (
                          <React.Fragment key={item.id}>
                            {idx > 0 && <ChevronRight className="h-3 w-3 text-zinc-600" />}
                            <button
                              type="button"
                              onClick={() => {
                                clearTransientCanvasUi();
                                selectHierarchy(item.id);
                                setIsContextMenuOpen(false);
                              }}
                              className={`rounded px-1 py-0.5 transition hover:bg-indigo-500/15 hover:text-indigo-200 ${
                                idx === activeBreadcrumb.length - 1
                                  ? 'font-semibold text-indigo-300'
                                  : 'text-zinc-400'
                              }`}
                            >
                              {item.title}
                            </button>
                          </React.Fragment>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs font-medium text-indigo-300">
                        Todo o Conhecimento (Panorama)
                      </p>
                    )}
                  </div>

                  <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
                    <button
                      type="button"
                      onClick={() => {
                        clearTransientCanvasUi();
                        selectHierarchy(null);
                        setIsContextMenuOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition ${
                        selectedHierarchyId === null
                          ? 'bg-indigo-600/20 text-indigo-200 ring-1 ring-indigo-500/35'
                          : 'text-zinc-300 hover:bg-zinc-800/70'
                      }`}
                    >
                      <span>Ver Todo o Conhecimento</span>
                      {selectedHierarchyId === null && (
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                      )}
                    </button>

                    {quickHierarchyList.length > 0 && (
                      <div className="my-1.5 h-px bg-zinc-800/80" />
                    )}

                    {quickHierarchyList.map(({ node, depth }) => {
                      const active = selectedHierarchyId === node.id;
                      return (
                        <button
                          key={node.id}
                          type="button"
                          onClick={() => {
                            clearTransientCanvasUi();
                            selectHierarchy(node.id);
                            setIsContextMenuOpen(false);
                          }}
                          style={{ paddingLeft: `${10 + depth * 14}px` }}
                          className={`flex w-full items-center justify-between rounded-lg py-1.5 pr-2.5 text-left text-xs transition ${
                            active
                              ? 'bg-indigo-600/20 font-semibold text-indigo-200 ring-1 ring-indigo-500/35'
                              : 'text-zinc-300 hover:bg-zinc-800/70'
                          }`}
                        >
                          <span className="truncate">
                            {depth > 0 ? '└ ' : ''}
                            {node.title}
                          </span>
                          {active && (
                            <span className="ml-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </Panel>
        )}

        {/* AVISO DE POSICIONAMENTO DE TEXTO LIVRE (ATALHO T) */}
        {isPlacingText && (
          <Panel position="top-center" className="mt-3">
            <div className="flex items-center gap-2 rounded-2xl border border-indigo-500/50 bg-[#161920]/95 px-3.5 py-2 text-xs font-medium text-indigo-200 shadow-2xl backdrop-blur-xl">
              <Type className="h-3.5 w-3.5 text-indigo-400" />
              Clique em qualquer lugar do Canvas para escrever
              <button
                type="button"
                onClick={() => setIsPlacingText(false)}
                className="ml-1 rounded-lg bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300 hover:text-white"
              >
                Esc
              </button>
            </div>
          </Panel>
        )}

        {/* BARRA CONTEXTUAL 4: TEXTO LIVRE SELECIONADO */}
        {showTextToolbar && activeTextRecord && (
          <Panel position="top-center" className="mt-3 !max-w-none">
            <div className="flex w-max max-w-[95vw] flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-indigo-500/40 bg-[#161920]/95 px-3 py-1.5 shadow-2xl backdrop-blur-xl">
              <span className="rounded-lg bg-amber-500/15 px-2 py-1 text-[11px] font-semibold text-amber-300">
                Texto
              </span>

              <div className="flex items-center gap-1">
                {(
                  [
                    {
                      id: 'plain',
                      label: 'Solto',
                      patch: {
                        bgOpacity: 'transparent',
                        borderStyle: 'none',
                        fontSize: 15,
                        padding: 'sm',
                        height: 0,
                      },
                    },
                    {
                      id: 'heading',
                      label: 'Título',
                      patch: {
                        bgOpacity: 'transparent',
                        borderStyle: 'none',
                        fontSize: 26,
                        padding: 'sm',
                        height: 0,
                      },
                    },
                    {
                      id: 'sticky',
                      label: 'Post-it',
                      patch: {
                        bgColor: '#f59e0b',
                        color: '#f59e0b',
                        bgOpacity: 'tinted',
                        borderStyle: 'solid',
                        borderWidth: 'thin',
                        borderRadius: 'xl',
                        fontSize: 14,
                        padding: 'md',
                        height: 170,
                      },
                    },
                    {
                      id: 'callout',
                      label: 'Destaque',
                      patch: {
                        bgColor: '#6366f1',
                        color: '#6366f1',
                        bgOpacity: 'subtle',
                        borderStyle: 'solid',
                        borderWidth: 'medium',
                        borderRadius: 'xl',
                        fontSize: 14,
                        padding: 'md',
                        height: 0,
                      },
                    },
                  ] as Array<{ id: string; label: string; patch: Partial<CanvasNodePosition> }>
                ).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => updateCanvasNode(activeTextRecord.id, preset.patch)}
                    className="rounded-lg border border-zinc-800 bg-[#0F1115] px-2 py-1 text-[11px] font-medium text-zinc-300 transition hover:border-indigo-500/60 hover:text-white"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="h-4 w-px bg-zinc-800" />

              <TypographyPopover
                value={activeTextRecord.typography}
                legacyFontSize={activeTextRecord.fontSize}
                defaults={DEFAULT_TEXT_TYPOGRAPHY}
                onChange={(next) =>
                  updateCanvasNode(activeTextRecord.id, {
                    typography: next,
                    fontSize: next.fontSize,
                  })
                }
                onReset={() =>
                  updateCanvasNode(activeTextRecord.id, {
                    typography: undefined,
                    fontSize: DEFAULT_TEXT_TYPOGRAPHY.fontSize,
                  })
                }
              />

              <CalloutCustomizerPopover
                value={activeTextRecord.callout ?? { text: '', visible: true }}
                theme={theme}
                onChange={(next) => updateCanvasNode(activeTextRecord.id, { callout: next })}
              />

              <div className="flex items-center gap-0.5 rounded-lg border border-zinc-800 bg-[#0F1115] p-0.5">
                {(
                  [
                    { id: 'left', icon: AlignLeft, title: 'Alinhar à esquerda' },
                    { id: 'center', icon: AlignCenter, title: 'Centralizar' },
                    { id: 'right', icon: AlignRight, title: 'Alinhar à direita' },
                    { id: 'justify', icon: AlignJustify, title: 'Justificar' },
                  ] as Array<{
                    id: NonNullable<CanvasNodePosition['textAlign']>;
                    icon: React.ComponentType<{ className?: string }>;
                    title: string;
                  }>
                ).map(({ id, icon: Icon, title }) => (
                  <button
                    key={id}
                    type="button"
                    title={title}
                    onClick={() => updateCanvasNode(activeTextRecord.id, { textAlign: id })}
                    className={`rounded p-1 transition ${
                      (activeTextRecord.textAlign ?? 'left') === id
                        ? 'bg-indigo-600/30 text-indigo-200'
                        : 'text-zinc-400 hover:text-zinc-100'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>

              <div className="h-4 w-px bg-zinc-800" />

              <div className="flex items-center gap-1">
                <span className="text-[10px] font-semibold uppercase text-zinc-500">Cor</span>
                {['', '#f4f4f5', '#18181b', '#818cf8', '#38bdf8', '#34d399', '#fbbf24', '#fb7185'].map(
                  (hex) => (
                    <button
                      key={`tc-${hex || 'auto'}`}
                      type="button"
                      title={hex ? `Cor ${hex}` : 'Cor automática do tema'}
                      onClick={() => updateCanvasNode(activeTextRecord.id, { textColor: hex || undefined })}
                      className={`flex h-4 w-4 items-center justify-center rounded-full border text-[8px] font-bold text-zinc-400 transition hover:scale-125 ${
                        (activeTextRecord.textColor ?? '') === hex
                          ? 'scale-110 border-white'
                          : 'border-zinc-700'
                      }`}
                      style={hex ? { backgroundColor: hex } : undefined}
                    >
                      {!hex && 'A'}
                    </button>
                  )
                )}
              </div>

              <div className="h-4 w-px bg-zinc-800" />

              <div className="flex items-center gap-1">
                <span className="text-[10px] font-semibold uppercase text-zinc-500">Fundo</span>
                {GROUP_PALETTE.map((hex) => (
                  <button
                    key={`tbg-${hex}`}
                    type="button"
                    onClick={() =>
                      updateCanvasNode(activeTextRecord.id, {
                        bgColor: hex,
                        color: hex,
                        bgOpacity:
                          (activeTextRecord.bgOpacity ?? 'transparent') === 'transparent'
                            ? 'tinted'
                            : activeTextRecord.bgOpacity,
                      })
                    }
                    className={`h-4 w-4 rounded border transition hover:scale-125 ${
                      (activeTextRecord.bgColor ?? '') === hex &&
                      (activeTextRecord.bgOpacity ?? 'transparent') !== 'transparent'
                        ? 'scale-110 border-white'
                        : 'border-zinc-700'
                    }`}
                    style={{ backgroundColor: hex }}
                    title="Cor de fundo"
                  />
                ))}
              </div>

              <select
                value={activeTextRecord.bgOpacity ?? 'transparent'}
                onChange={(e) =>
                  updateCanvasNode(activeTextRecord.id, {
                    bgOpacity: e.target.value as CanvasNodePosition['bgOpacity'],
                  })
                }
                className="rounded-lg border border-zinc-800 bg-[#0F1115] px-2 py-1 text-[11px] text-zinc-200 focus:outline-none"
                title="Intensidade do fundo"
              >
                <option value="transparent">Fundo: 0%</option>
                <option value="subtle">Fundo: Suave</option>
                <option value="tinted">Fundo: Post-it</option>
                <option value="solid">Fundo: Sólido</option>
              </select>

              <select
                value={activeTextRecord.borderStyle ?? 'none'}
                onChange={(e) =>
                  updateCanvasNode(activeTextRecord.id, {
                    borderStyle: e.target.value as CanvasNodePosition['borderStyle'],
                  })
                }
                className="rounded-lg border border-zinc-800 bg-[#0F1115] px-2 py-1 text-[11px] text-zinc-200 focus:outline-none"
                title="Estilo da borda"
              >
                <option value="none">Sem borda</option>
                <option value="solid">Borda sólida</option>
                <option value="dashed">Tracejada</option>
                <option value="dotted">Pontilhada</option>
              </select>

              <button
                type="button"
                onClick={() =>
                  updateCanvasNode(activeTextRecord.id, {
                    sketch: !activeTextRecord.sketch,
                    borderStyle:
                      !activeTextRecord.sketch &&
                      (activeTextRecord.borderStyle ?? 'none') === 'none'
                        ? 'solid'
                        : activeTextRecord.borderStyle,
                  })
                }
                className={`rounded-lg border px-2 py-1 text-[11px] font-medium transition ${
                  activeTextRecord.sketch
                    ? 'border-amber-500/60 bg-amber-500/15 text-amber-300'
                    : 'border-zinc-800 bg-[#0F1115] text-zinc-400 hover:text-zinc-100'
                }`}
                title="Ativar borda com efeito desenhado à mão (caderno)"
              >
                À Mão
              </button>

              <div className="h-4 w-px bg-zinc-800" />

              <button
                type="button"
                onClick={async () => {
                  pushHistorySnapshot();
                  const newCardId = await promoteTextNodeToCard(activeTextRecord.id);
                  if (newCardId) {
                    addToast({
                      message: 'Texto promovido para Knowledge Card (setas mantidas!)',
                      variant: 'success',
                    });
                  }
                }}
                className="flex items-center gap-1 rounded-lg bg-indigo-600/20 px-2.5 py-1 text-[11px] font-semibold text-indigo-300 transition hover:bg-indigo-600 hover:text-white"
                title="Converter este texto livre em um Knowledge Card completo (entra em Revisão e Modo Livro)"
              >
                <ArrowUpRightFromSquare className="h-3.5 w-3.5" /> Virar Card
              </button>

              <button
                type="button"
                onClick={async () => {
                  pushHistorySnapshot();
                  await duplicateCanvasText(activeTextRecord.id);
                }}
                className="rounded-lg p-1.5 text-indigo-400 hover:bg-zinc-800"
                title="Duplicar texto"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={async () => {
                  pushHistorySnapshot();
                  await deleteCanvasSelection([activeTextRecord.id], []);
                  addToast({
                    message: 'Texto removido do canvas',
                    action: { label: 'Desfazer', onClick: () => handleUndo() },
                  });
                }}
                className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/15"
                title="Excluir texto (Delete)"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </Panel>
        )}

        {/* BARRA CONTEXTUAL 5: TÓPICO / SUBTÓPICO / BALÃO SELECIONADO */}
        {showTopicToolbar && activeTopicRecord && (
          <Panel position="top-center" className="mt-3 !max-w-none">
            <div className="flex w-max max-w-[95vw] flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-indigo-500/40 bg-[#161920]/95 px-2.5 py-1.5 shadow-2xl backdrop-blur-xl">
              <span className="rounded-lg bg-violet-500/15 px-2 py-1 text-[11px] font-semibold text-violet-300">
                Tópico
              </span>

              <button
                type="button"
                onClick={() => handleQuickSubtopic(activeTopicRecord.id)}
                className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-indigo-500"
                title="Criar subtópico conectado (Tab)"
              >
                <GitBranch className="h-3.5 w-3.5" /> + Subtópico
              </button>

              {activeTopicRecord.topicConfig?.shape === 'diamond' && (
                <button
                  type="button"
                  onClick={async () => {
                    pushHistorySnapshot();
                    await createSubtopic(activeTopicRecord.id, {
                      label: 'Caminho Sim',
                      shape: 'rounded',
                      edgeLabel: 'Sim',
                    });
                    await createSubtopic(activeTopicRecord.id, {
                      label: 'Caminho Não',
                      shape: 'rounded',
                      edgeLabel: 'Não',
                    });
                    addToast({ message: 'Ramos Sim / Não criados', variant: 'success' });
                  }}
                  className="rounded-lg bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold text-emerald-300 transition hover:bg-emerald-600 hover:text-white"
                  title="Gerar dois ramos de decisão (Sim / Não)"
                >
                  + Sim / Não
                </button>
              )}

              <div className="h-4 w-px bg-zinc-800" />

              <select
                value={activeTopicRecord.topicConfig?.shape ?? 'rounded'}
                onChange={(e) => {
                  const nextShape = e.target.value as TopicShape;
                  const patch: Partial<CanvasNodePosition> = {
                    topicConfig: {
                      ...(activeTopicRecord.topicConfig ?? { shape: nextShape }),
                      shape: nextShape,
                      ...(nextShape === 'cloud' ? { doubleBorder: true } : {}),
                    },
                  };
                  if (nextShape === 'square' || nextShape === 'circle') {
                    const side = Math.max(120, Math.min(240, activeTopicRecord.width || 150));
                    patch.width = side;
                    patch.height = side;
                  } else if (nextShape === 'diamond') {
                    patch.width = Math.max(160, activeTopicRecord.width || 184);
                    patch.height = Math.max(120, activeTopicRecord.height || 132);
                  } else if (nextShape === 'cloud') {
                    patch.width = Math.max(240, activeTopicRecord.width || 268);
                    patch.height = Math.max(140, activeTopicRecord.height || 156);
                  } else if (nextShape === 'banner') {
                    patch.width = Math.max(230, activeTopicRecord.width || 256);
                    patch.height = Math.max(76, activeTopicRecord.height || 80);
                  } else if (nextShape === 'speech') {
                    patch.width = Math.max(210, activeTopicRecord.width || 230);
                    patch.height = Math.max(108, activeTopicRecord.height || 116);
                  } else if (nextShape === 'sticky-tape') {
                    patch.width = Math.max(200, activeTopicRecord.width || 224);
                    patch.height = Math.max(140, activeTopicRecord.height || 156);
                  }
                  updateCanvasNode(activeTopicRecord.id, patch);
                }}
                title="Formato geométrico do tópico"
                className="rounded-lg border border-zinc-800 bg-[#0F1115] px-2 py-1 text-[11px] font-medium text-zinc-200 focus:border-indigo-500 focus:outline-none"
              >
                <option value="rounded">Arredondado</option>
                <option value="rect">Retângulo</option>
                <option value="capsule">Cápsula</option>
                <option value="cloud">Nuvem</option>
                <option value="banner">Faixa / Banner</option>
                <option value="speech">Balão de Fala</option>
                <option value="sticky-tape">Post-it c/ Fita</option>
                <option value="square">Quadrado</option>
                <option value="circle">Círculo</option>
                <option value="ellipse">Elipse</option>
                <option value="diamond">Losango (Decisão)</option>
                <option value="hexagon">Hexágono</option>
              </select>

              <TypographyPopover
                value={activeTopicRecord.typography}
                legacyFontSize={activeTopicRecord.fontSize}
                defaults={DEFAULT_TOPIC_TYPOGRAPHY}
                onChange={(next) =>
                  updateCanvasNode(activeTopicRecord.id, {
                    typography: next,
                    fontSize: next.fontSize,
                  })
                }
                onReset={() =>
                  updateCanvasNode(activeTopicRecord.id, {
                    typography: undefined,
                    fontSize: DEFAULT_TOPIC_TYPOGRAPHY.fontSize,
                  })
                }
              />

              <div className="flex items-center gap-0.5 rounded-lg border border-zinc-800 bg-[#0F1115] p-0.5">
                {(
                  [
                    { id: 'left', icon: AlignLeft },
                    { id: 'center', icon: AlignCenter },
                    { id: 'right', icon: AlignRight },
                  ] as const
                ).map(({ id, icon: Icon }) => (
                  <button
                    key={`ta-${id}`}
                    type="button"
                    onClick={() => updateCanvasNode(activeTopicRecord.id, { textAlign: id })}
                    className={`rounded p-1 ${
                      (activeTopicRecord.textAlign ?? 'center') === id
                        ? 'bg-indigo-600/30 text-indigo-200'
                        : 'text-zinc-400 hover:text-zinc-100'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>

              <div className="h-4 w-px bg-zinc-800" />

              <div className="flex items-center gap-1">
                {GROUP_PALETTE.map((hex) => (
                  <button
                    key={`topc-${hex}`}
                    type="button"
                    onClick={() =>
                      updateCanvasNode(activeTopicRecord.id, {
                        color: hex,
                        bgColor: hex,
                        topicConfig: {
                          ...(activeTopicRecord.topicConfig ?? { shape: 'rounded' }),
                          defaultEdgeStyle: {
                            ...(activeTopicRecord.topicConfig?.defaultEdgeStyle ?? {}),
                            color: hex,
                          },
                        },
                      })
                    }
                    className={`h-4 w-4 rounded-full border transition hover:scale-125 ${
                      (activeTopicRecord.bgColor ?? activeTopicRecord.color) === hex
                        ? 'scale-110 border-white'
                        : 'border-zinc-700'
                    }`}
                    style={{ backgroundColor: hex }}
                    title="Cor do tópico"
                  />
                ))}
              </div>

              <select
                value={activeTopicRecord.bgOpacity ?? 'tinted'}
                onChange={(e) =>
                  updateCanvasNode(activeTopicRecord.id, {
                    bgOpacity: e.target.value as CanvasNodePosition['bgOpacity'],
                  })
                }
                className="rounded-lg border border-zinc-800 bg-[#0F1115] px-1.5 py-1 text-[11px] text-zinc-200 focus:outline-none"
                title="Preenchimento de fundo"
              >
                <option value="transparent">Fundo: 0%</option>
                <option value="subtle">Fundo: Suave</option>
                <option value="tinted">Fundo: Médio</option>
                <option value="solid">Fundo: Sólido</option>
              </select>

              <select
                value={activeTopicRecord.borderStyle ?? 'solid'}
                onChange={(e) =>
                  updateCanvasNode(activeTopicRecord.id, {
                    borderStyle: e.target.value as CanvasNodePosition['borderStyle'],
                  })
                }
                className="rounded-lg border border-zinc-800 bg-[#0F1115] px-1.5 py-1 text-[11px] text-zinc-200 focus:outline-none"
                title="Estilo da borda"
              >
                <option value="solid">Borda: Sólida</option>
                <option value="dashed">Tracejada</option>
                <option value="dotted">Pontilhada</option>
                <option value="none">Sem borda</option>
              </select>

              <button
                type="button"
                onClick={() =>
                  updateCanvasNode(activeTopicRecord.id, { sketch: !activeTopicRecord.sketch })
                }
                className={`rounded-lg border px-2 py-1 text-[11px] font-medium transition ${
                  activeTopicRecord.sketch
                    ? 'border-amber-500/60 bg-amber-500/15 text-amber-300'
                    : 'border-zinc-800 bg-[#0F1115] text-zinc-400 hover:text-zinc-100'
                }`}
                title="Efeito de borda desenhada à mão (caderno)"
              >
                À Mão
              </button>

              <button
                type="button"
                onClick={() =>
                  updateCanvasNode(activeTopicRecord.id, {
                    topicConfig: {
                      ...(activeTopicRecord.topicConfig ?? { shape: 'rounded' }),
                      doubleBorder: !activeTopicRecord.topicConfig?.doubleBorder,
                    },
                  })
                }
                className={`rounded-lg border px-2 py-1 text-[11px] font-medium transition ${
                  activeTopicRecord.topicConfig?.doubleBorder
                    ? 'border-indigo-500/60 bg-indigo-500/15 text-indigo-200'
                    : 'border-zinc-800 bg-[#0F1115] text-zinc-400 hover:text-zinc-100'
                }`}
                title="Contorno duplo tracejado interno"
              >
                Dupla
              </button>

              <select
                value={activeTopicRecord.topicConfig?.shadow ?? 'md'}
                onChange={(e) =>
                  updateCanvasNode(activeTopicRecord.id, {
                    topicConfig: {
                      ...(activeTopicRecord.topicConfig ?? { shape: 'rounded' }),
                      shadow: e.target.value as NonNullable<
                        CanvasNodePosition['topicConfig']
                      >['shadow'],
                    },
                  })
                }
                className="rounded-lg border border-zinc-800 bg-[#0F1115] px-1.5 py-1 text-[11px] text-zinc-200 focus:outline-none"
                title="Sombra do tópico"
              >
                <option value="none">Sem sombra</option>
                <option value="sm">Sombra leve</option>
                <option value="md">Sombra média</option>
                <option value="glow">Brilho</option>
              </select>

              <select
                value={activeTopicRecord.topicConfig?.defaultEdgeStyle?.edgeType ?? 'default'}
                onChange={(e) =>
                  updateCanvasNode(activeTopicRecord.id, {
                    topicConfig: {
                      ...(activeTopicRecord.topicConfig ?? { shape: 'rounded' }),
                      defaultEdgeStyle: {
                        ...(activeTopicRecord.topicConfig?.defaultEdgeStyle ?? {}),
                        edgeType: e.target.value as CanvasEdgePathType,
                      },
                    },
                  })
                }
                className="rounded-lg border border-zinc-800 bg-[#0F1115] px-1.5 py-1 text-[11px] text-zinc-200 focus:outline-none"
                title="Estilo padrão das conexões criadas a partir deste tópico"
              >
                <option value="default">Setas: Curva</option>
                <option value="smoothstep">Setas: Ortogonal</option>
                <option value="straight">Setas: Reta</option>
                <option value="organic">Setas: Orgânica</option>
              </select>

              <div className="flex items-center gap-0.5">
                {['🎯', '💡', '⚖️', '📌', '🔀'].map((ic) => (
                  <button
                    key={`ti-${ic}`}
                    type="button"
                    onClick={() =>
                      updateCanvasNode(activeTopicRecord.id, {
                        topicConfig: {
                          ...(activeTopicRecord.topicConfig ?? { shape: 'rounded' }),
                          icon: activeTopicRecord.topicConfig?.icon === ic ? undefined : ic,
                        },
                      })
                    }
                    className={`rounded px-1 py-0.5 text-xs ${
                      activeTopicRecord.topicConfig?.icon === ic
                        ? 'bg-indigo-600/30'
                        : 'hover:bg-zinc-800'
                    }`}
                  >
                    {ic}
                  </button>
                ))}
              </div>

              <div className="h-4 w-px bg-zinc-800" />

              <button
                type="button"
                onClick={async () => {
                  pushHistorySnapshot();
                  await duplicateCanvasTopic(activeTopicRecord.id);
                }}
                className="rounded-lg p-1.5 text-indigo-400 hover:bg-zinc-800"
                title="Duplicar tópico"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={async () => {
                  pushHistorySnapshot();
                  await deleteCanvasSelection([activeTopicRecord.id], []);
                  addToast({
                    message: 'Tópico removido do canvas',
                    action: { label: 'Desfazer', onClick: () => handleUndo() },
                  });
                }}
                className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/15"
                title="Excluir tópico (Delete)"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </Panel>
        )}

        {/* BARRA CONTEXTUAL 6: CONEXÃO / SETA SELECIONADA */}
        {showEdgeToolbar && activeEdgeRecord && (
          <Panel position="top-center" className="mt-3 !max-w-none">
            <div className="flex w-max max-w-[95vw] flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-indigo-500/40 bg-[#161920]/95 px-3 py-1.5 shadow-2xl backdrop-blur-xl">
              <span className="rounded-lg bg-sky-500/15 px-2 py-1 text-[11px] font-semibold text-sky-300">
                Conexão
              </span>

              <div className="flex items-center gap-0.5 rounded-lg border border-zinc-800 bg-[#0F1115] p-0.5">
                {(
                  [
                    { id: 'smoothstep', label: 'Ortogonal' },
                    { id: 'default', label: 'Curva' },
                    { id: 'straight', label: 'Reta' },
                    { id: 'organic', label: 'Orgânica' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updateCanvasEdge(activeEdgeRecord.id, { edgeType: opt.id })}
                    className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition ${
                      (activeEdgeRecord.edgeType ?? 'smoothstep') === opt.id
                        ? 'bg-indigo-600 text-white'
                        : 'text-zinc-400 hover:text-zinc-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <select
                value={
                  activeEdgeRecord.lineStyle ??
                  (activeEdgeRecord.style === 'dashed' ? 'dashed' : 'solid')
                }
                onChange={(e) => {
                  const nextLine = e.target.value as EdgeLineStyle;
                  updateCanvasEdge(activeEdgeRecord.id, {
                    lineStyle: nextLine,
                    style:
                      activeEdgeRecord.style === 'animated'
                        ? 'animated'
                        : nextLine === 'dashed'
                        ? 'dashed'
                        : 'solid',
                  });
                }}
                className="rounded-lg border border-zinc-800 bg-[#0F1115] px-2 py-1 text-[11px] text-zinc-200 focus:outline-none"
                title="Tipo de traço"
              >
                <option value="solid">Contínua</option>
                <option value="dashed">Tracejada</option>
                <option value="dotted">Pontilhada</option>
              </select>

              <button
                type="button"
                onClick={() =>
                  updateCanvasEdge(activeEdgeRecord.id, {
                    style: activeEdgeRecord.style === 'animated' ? 'solid' : 'animated',
                  })
                }
                className={`rounded-lg border px-2 py-1 text-[11px] font-medium transition ${
                  activeEdgeRecord.style === 'animated'
                    ? 'border-indigo-500 bg-indigo-500/20 text-indigo-200'
                    : 'border-zinc-800 bg-[#0F1115] text-zinc-400 hover:text-zinc-100'
                }`}
                title="Ativar ou desativar fluxo animado"
              >
                Animada
              </button>

              <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-[#0F1115] px-2 py-1">
                <span className="text-[10px] text-zinc-500">Esp.</span>
                <input
                  type="range"
                  min={1}
                  max={6}
                  step={0.5}
                  value={activeEdgeRecord.strokeWidth ?? 2}
                  onChange={(e) =>
                    updateCanvasEdge(activeEdgeRecord.id, {
                      strokeWidth: parseFloat(e.target.value),
                    })
                  }
                  className="w-14 accent-indigo-500"
                />
              </div>

              <select
                value={activeEdgeRecord.arrowStart ?? 'none'}
                onChange={(e) =>
                  updateCanvasEdge(activeEdgeRecord.id, {
                    arrowStart: e.target.value as EdgeArrowType,
                  })
                }
                className="rounded-lg border border-zinc-800 bg-[#0F1115] px-1.5 py-1 text-[11px] text-zinc-200 focus:outline-none"
                title="Ponta inicial da conexão"
              >
                <option value="none">Início: Sem</option>
                <option value="arrow">Início: Seta</option>
                <option value="arrowclosed">Início: Cheia</option>
                <option value="hand">Início: À Mão</option>
                <option value="dot">Início: Ponto</option>
              </select>

              <select
                value={activeEdgeRecord.arrowEnd ?? 'arrowclosed'}
                onChange={(e) =>
                  updateCanvasEdge(activeEdgeRecord.id, {
                    arrowEnd: e.target.value as EdgeArrowType,
                  })
                }
                className="rounded-lg border border-zinc-800 bg-[#0F1115] px-1.5 py-1 text-[11px] text-zinc-200 focus:outline-none"
                title="Ponta final da conexão"
              >
                <option value="arrowclosed">Fim: Cheia</option>
                <option value="arrow">Fim: Seta</option>
                <option value="hand">Fim: À Mão</option>
                <option value="dot">Fim: Ponto</option>
                <option value="none">Fim: Sem</option>
              </select>

              <div className="flex items-center gap-1">
                {EDGE_COLORS.map((hex) => (
                  <button
                    key={`ec-${hex}`}
                    type="button"
                    onClick={() => updateCanvasEdge(activeEdgeRecord.id, { color: hex })}
                    className={`h-4 w-4 rounded-full border transition hover:scale-125 ${
                      (activeEdgeRecord.color ?? '#6366f1') === hex
                        ? 'scale-110 border-white'
                        : 'border-zinc-700'
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>

              {activeEdgeRecord.label?.trim() ? (
                <button
                  type="button"
                  onClick={() => setSelectedEdgeLabelId(activeEdgeRecord.id)}
                  className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-[#0F1115] px-2 py-1 text-[11px] font-medium text-zinc-200 hover:border-indigo-500/60 hover:text-indigo-200"
                  title="Personalizar aparência, rotação e tamanho do rótulo"
                >
                  <Tag className="h-3 w-3 text-indigo-400" /> Rótulo
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEdgeLabelId(activeEdgeRecord.id);
                    setEditingEdgeLabelId(activeEdgeRecord.id);
                  }}
                  className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-[#0F1115] px-2 py-1 text-[11px] font-medium text-zinc-200 hover:border-indigo-500/60 hover:text-indigo-200"
                  title="Inserir rótulo nesta conexão"
                >
                  <Tag className="h-3 w-3 text-indigo-400" /> + Rótulo
                </button>
              )}

              <button
                type="button"
                onClick={() => handleResetEdgeToAuto(activeEdgeRecord.id)}
                className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition ${
                  activeEdgeRecord.routingMode === 'manual' ||
                  (activeEdgeRecord.waypoints?.length ?? 0) > 0
                    ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40 hover:bg-amber-500 hover:text-zinc-950'
                    : 'border border-zinc-800 bg-[#0F1115] text-zinc-300 hover:border-indigo-500/60 hover:text-white'
                }`}
                title="Voltar ao melhor caminho automático recalculando entrada, saída e trajeto"
              >
                <Wand2 className="h-3 w-3" /> Automático
              </button>

              <button
                type="button"
                onClick={async () => {
                  pushHistorySnapshot();
                  await deleteCanvasEdge(activeEdgeRecord.id);
                  addToast({
                    message: 'Conexão removida',
                    action: { label: 'Desfazer', onClick: () => handleUndo() },
                  });
                }}
                className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/15"
                title="Excluir conexão (Delete)"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </Panel>
        )}

        {/* BARRA CONTEXTUAL 7: RÓTULO DA CONEXÃO SELECIONADO */}
        {showEdgeLabelToolbar && activeEdgeLabelRecord && (
          <Panel position="top-center" className="mt-3 !max-w-none">
            {(() => {
              const ls: EdgeLabelStyle = activeEdgeLabelRecord.labelStyle ?? {};
              const updateLabelStyle = (patch: Partial<EdgeLabelStyle>) => {
                updateCanvasEdge(activeEdgeLabelRecord.id, {
                  labelStyle: { ...ls, ...patch },
                });
              };
              const currentFont = ls.fontSize ?? 11;
              const currentRot = ls.rotation ?? 0;

              return (
                <div className="flex w-max max-w-[95vw] flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-indigo-500/40 bg-[#161920]/95 px-2.5 py-1.5 shadow-2xl backdrop-blur-xl">
                  <button
                    type="button"
                    onClick={() => setSelectedEdgeLabelId(null)}
                    className="flex items-center gap-1 rounded-lg bg-zinc-800/80 px-2 py-1 text-[11px] font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white"
                    title="Voltar para opções da conexão"
                  >
                    <ArrowLeft className="h-3 w-3" /> Seta
                  </button>

                  <span className="rounded-lg bg-indigo-500/15 px-2 py-1 text-[11px] font-semibold text-indigo-300">
                    Rótulo
                  </span>

                  <button
                    type="button"
                    onClick={() => setEditingEdgeLabelId(activeEdgeLabelRecord.id)}
                    className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-[#0F1115] px-2 py-1 text-[11px] font-medium text-zinc-200 hover:border-indigo-500/60 hover:text-white"
                    title="Editar texto do rótulo (ou duplo clique no rótulo)"
                  >
                    <Pencil className="h-3 w-3 text-indigo-400" /> Texto
                  </button>

                  <select
                    value={ls.preset ?? 'auto'}
                    onChange={(e) =>
                      updateLabelStyle({
                        preset: e.target.value as EdgeLabelStyle['preset'],
                        ...(e.target.value !== 'custom'
                          ? { bgColor: undefined, borderColor: undefined }
                          : {}),
                      })
                    }
                    className="rounded-lg border border-zinc-800 bg-[#0F1115] px-2 py-1 text-[11px] text-zinc-200 focus:outline-none"
                    title="Estilo visual do rótulo"
                  >
                    <option value="auto">Padrão da Seta</option>
                    <option value="neutral">Neutro (Fundo)</option>
                    <option value="tinted">Destaque Suave</option>
                    <option value="solid">Sólido (Cor da Seta)</option>
                    <option value="transparent">Sem Caixa</option>
                    <option value="custom">Personalizado</option>
                  </select>

                  <div className="flex items-center gap-1">
                    {EDGE_COLORS.map((hex) => (
                      <button
                        key={`elc-${hex}`}
                        type="button"
                        onClick={() =>
                          updateLabelStyle({
                            preset: ls.preset === 'solid' ? 'solid' : 'custom',
                            bgColor: hex,
                            borderColor: hex,
                            textColor: ls.preset === 'solid' ? '#ffffff' : ls.textColor,
                          })
                        }
                        className={`h-4 w-4 rounded-full border transition hover:scale-125 ${
                          (ls.bgColor ?? activeEdgeLabelRecord.color) === hex
                            ? 'scale-110 border-white'
                            : 'border-zinc-700'
                        }`}
                        style={{ backgroundColor: hex }}
                        title="Cor do rótulo"
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-0.5">
                    {['', '#ffffff', '#18181b', '#fde68a', '#bae6fd'].map((hex) => (
                      <button
                        key={`elt-${hex || 'auto'}`}
                        type="button"
                        onClick={() => updateLabelStyle({ textColor: hex || undefined })}
                        className={`flex h-4 w-4 items-center justify-center rounded-full border text-[8px] font-bold text-zinc-400 transition hover:scale-110 ${
                          (ls.textColor ?? '') === hex ? 'scale-110 border-white' : 'border-zinc-700'
                        }`}
                        style={hex ? { backgroundColor: hex } : undefined}
                        title={hex ? `Cor do texto ${hex}` : 'Cor automática'}
                      >
                        {!hex && 'A'}
                      </button>
                    ))}
                  </div>

                  <div className="h-4 w-px bg-zinc-800" />

                  <TypographyPopover
                    hideSpacingControls
                    value={{
                      fontSize: currentFont,
                      fontFamily: ls.fontFamily ?? 'default',
                      textEffect: ls.textEffect ?? 'none',
                      effectColor: ls.effectColor ?? '#0f172a',
                    }}
                    defaults={{
                      fontSize: 11,
                      lineHeight: 1.3,
                      paragraphSpacing: 4,
                      fontFamily: 'default',
                      textEffect: 'none',
                      effectColor: '#0f172a',
                    }}
                    onChange={(next) =>
                      updateLabelStyle({
                        fontSize: next.fontSize,
                        fontFamily: next.fontFamily,
                        textEffect: next.textEffect,
                        effectColor: next.effectColor,
                      })
                    }
                    onReset={() =>
                      updateLabelStyle({
                        fontSize: undefined,
                        fontFamily: undefined,
                        textEffect: undefined,
                        effectColor: undefined,
                      })
                    }
                  />

                  <button
                    type="button"
                    onClick={() =>
                      updateLabelStyle({
                        fontWeight: ls.fontWeight === 'bold' ? 'medium' : 'bold',
                      })
                    }
                    className={`rounded-lg border p-1.5 transition ${
                      ls.fontWeight === 'bold'
                        ? 'border-indigo-500 bg-indigo-600/25 text-indigo-200'
                        : 'border-zinc-800 bg-[#0F1115] text-zinc-400 hover:text-white'
                    }`}
                    title="Negrito"
                  >
                    <Bold className="h-3 w-3" />
                  </button>

                  <div className="flex items-center gap-0.5 rounded-lg border border-zinc-800 bg-[#0F1115] p-0.5">
                    {(
                      [
                        { id: 'left', icon: AlignLeft },
                        { id: 'center', icon: AlignCenter },
                        { id: 'right', icon: AlignRight },
                      ] as const
                    ).map(({ id, icon: Icon }) => (
                      <button
                        key={`ela-${id}`}
                        type="button"
                        onClick={() => updateLabelStyle({ textAlign: id })}
                        className={`rounded p-1 ${
                          (ls.textAlign ?? 'center') === id
                            ? 'bg-indigo-600/30 text-indigo-200'
                            : 'text-zinc-400 hover:text-zinc-100'
                        }`}
                      >
                        <Icon className="h-3 w-3" />
                      </button>
                    ))}
                  </div>

                  <div className="h-4 w-px bg-zinc-800" />

                  <button
                    type="button"
                    onClick={() =>
                      updateLabelStyle({
                        autoRotate: !ls.autoRotate,
                      })
                    }
                    className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition ${
                      ls.autoRotate
                        ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                        : 'border-zinc-800 bg-[#0F1115] text-zinc-300 hover:border-indigo-500/60'
                    }`}
                    title="Alinhar automaticamente o ângulo do rótulo ao trecho da conexão"
                  >
                    <RotateCw className="h-3 w-3" /> Seguir seta
                  </button>

                  <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-[#0F1115] px-1.5 py-0.5">
                    <button
                      type="button"
                      onClick={() =>
                        updateLabelStyle({
                          autoRotate: false,
                          rotation: ((currentRot - 45 + 540) % 360) - 180,
                        })
                      }
                      className="rounded px-1 text-[10px] text-zinc-400 hover:bg-zinc-800 hover:text-white"
                      title="Girar -45°"
                    >
                      -45°
                    </button>
                    <span className="w-8 text-center font-mono text-[10.5px] text-zinc-200">
                      {ls.autoRotate ? 'Auto' : `${currentRot}°`}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateLabelStyle({
                          autoRotate: false,
                          rotation: ((currentRot + 45 + 540) % 360) - 180,
                        })
                      }
                      className="rounded px-1 text-[10px] text-zinc-400 hover:bg-zinc-800 hover:text-white"
                      title="Girar +45°"
                    >
                      +45°
                    </button>
                  </div>

                  {(ls.width || ls.height || ls.rotation || ls.autoRotate) && (
                    <button
                      type="button"
                      onClick={() =>
                        updateCanvasEdge(activeEdgeLabelRecord.id, {
                          labelPosition: 0.5,
                          labelStyle: {
                            ...ls,
                            width: undefined,
                            height: undefined,
                            rotation: 0,
                            autoRotate: false,
                          },
                        })
                      }
                      className="rounded-lg border border-zinc-800 bg-[#0F1115] px-2 py-1 text-[11px] text-zinc-300 hover:border-indigo-500/60 hover:text-white"
                      title="Restaurar tamanho automático, 0° e centro da seta"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEdgeLabelId(null);
                      updateCanvasEdge(activeEdgeLabelRecord.id, {
                        label: undefined,
                        labelPosition: undefined,
                        labelStyle: undefined,
                        labelOffset: undefined,
                      });
                    }}
                    className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/15"
                    title="Remover apenas o rótulo (mantém a seta)"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })()}
          </Panel>
        )}

        {/* DOCK INFERIOR DE CRIAÇÃO RÁPIDA */}
        {!zenMode && (
          <Panel position="bottom-center" className="mb-4">
            <div className="flex items-center gap-1.5 rounded-2xl border border-zinc-800/90 bg-[#161920]/90 p-1.5 shadow-2xl backdrop-blur-xl">
              <button
                onClick={() => handleCreateQuickCard('blank')}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500"
              >
                <Plus className="h-3.5 w-3.5" /> Novo Card
              </button>
              <button
                onClick={() => handleCreateQuickCard('law', 'Artigo de Lei')}
                className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800"
              >
                <Scale className="h-3.5 w-3.5 text-amber-400" /> Lei Seca
              </button>
              <button
                onClick={() => handleCreateQuickCard('jurisprudence', 'Tese STF/STJ')}
                className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800"
              >
                <BookOpenCheck className="h-3.5 w-3.5 text-emerald-400" /> Jurisprudência
              </button>
              <div className="mx-0.5 h-4 w-px bg-zinc-800" />
              <button
                onClick={() => handleCreateQuickTopic('rounded')}
                className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800"
                title="Adicionar Tópico / Nó de Mapa Mental ou Fluxograma"
              >
                <Shapes className="h-3.5 w-3.5 text-violet-400" /> Tópico
              </button>
              <button
                onClick={() => handleCreateQuickText('plain')}
                className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs transition ${
                  isPlacingText
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'text-zinc-300 hover:bg-zinc-800'
                }`}
                title="Adicionar texto livre no Canvas (ou aperte T e clique onde quiser)"
              >
                <Type className="h-3.5 w-3.5 text-amber-400" /> Texto
              </button>
              <button
                onClick={() => imageInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800"
                title="Inserir imagem livre no Canvas (ou arraste / Ctrl+V)"
              >
                <ImagePlus className="h-3.5 w-3.5 text-sky-400" /> Imagem
              </button>
              <button
                onClick={() => setIsStickerPanelOpen((v) => !v)}
                className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs transition ${
                  isStickerPanelOpen
                    ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40'
                    : 'text-zinc-300 hover:bg-zinc-800'
                }`}
                title="Adesivos, fitas washi, selos e biblioteca universal de ícones"
              >
                <Sticker className="h-3.5 w-3.5 text-amber-400" /> Elementos
              </button>
              <button
                onClick={handleCreateQuickGroup}
                className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800"
              >
                <FolderPlus className="h-3.5 w-3.5 text-indigo-400" /> Grupo
              </button>
            </div>
          </Panel>
        )}
      </ReactFlow>

      <StickerLibraryPanel
        isOpen={isStickerPanelOpen}
        onClose={() => setIsStickerPanelOpen(false)}
        onInsertSvg={insertSvgElementToCanvas}
      />

      <DrawingLayer
        isActive={isDrawingMode}
        viewport={liveViewport}
        screenToFlowPosition={screenToFlowPosition}
        onBeforeMutate={pushHistorySnapshot}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onClose={() => setIsDrawingMode(false)}
      />
    </div>
  );
}

export function KnowledgeCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}