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
} from 'lucide-react';
import { useKnowledgeStore } from '@/domains/knowledge/store/useKnowledgeStore';
import { CanvasSpotlightMode, useUiStore } from '@/domains/ui/store/useUiStore';
import {
  CanvasConnection,
  CanvasNodePosition,
  CanvasStroke,
  KnowledgeCardMeta,
} from '@/domains/knowledge/types';
import { getKnowledgeRepository } from '@/infrastructure/persistence/repositoryFactory';
import { KnowledgeCardNode } from './KnowledgeCardNode';
import { GroupNode } from './GroupNode';
import { CanvasImageNode } from './CanvasImageNode';
import { EditableEdge } from './EditableEdge';
import { OutlineEditorView } from './OutlineEditorView';
import { DrawingLayer } from './DrawingLayer';
import { computeMultiAxisLayout, LayoutDirection } from '../utils/autoLayout';
import { prepareCanvasImage } from '../utils/imageBlob';

const nodeTypes = {
  knowledgeCard: KnowledgeCardNode,
  canvasGroup: GroupNode,
  canvasImage: CanvasImageNode,
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

function CanvasInner() {
  const { screenToFlowPosition, fitView, getNodes, getEdges, zoomIn, zoomOut, getViewport, setViewport } =
    useReactFlow();

  const containerRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const {
    theme,
    preferences,
    addToast,
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
  } = useUiStore();
  const {
    activeWorkspaceId,
    cardsById,
    canvasNodes,
    canvasEdges,
    selectedHierarchyId,
    activeCardId,
    openCard,
    createCardOnCanvas,
    createCanvasGroup,
    createCanvasImage,
    updateCanvasNode,
    persistNodePositions,
    addCanvasEdge,
    updateCanvasEdgesBulk,
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
  const [liveViewport, setLiveViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [openHeaderMenu, setOpenHeaderMenu] = useState<null | 'layout' | 'edge' | 'spotlight'>(null);

  const [globalEdgeType, setGlobalEdgeType] = useState<'smoothstep' | 'default'>('smoothstep');
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

  const groupDragRef = useRef<{
    groupId: string;
    startX: number;
    startY: number;
    children: Array<{ id: string; startX: number; startY: number }>;
  } | null>(null);

  // Calcula o centro exato da visão atual do usuário, evitando empilhar sobre outro card
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

  // Insere uma imagem solta no Canvas (por botão, arrastar ou Ctrl+V)
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

  // Sincroniza Zustand -> React Flow
  useEffect(() => {
    setNodes((prevNodes) => {
      const prevMap = new Map(prevNodes.map((n) => [n.id, n]));
      const next: Node[] = [];

      for (const cn of canvasNodes) {
        const prev = prevMap.get(cn.id);

        if (cn.nodeType === 'group') {
          next.push({
            id: cn.id,
            type: 'canvasGroup',
            position: { x: cn.x, y: cn.y },
            zIndex: -1,
            selected: prev?.selected ?? false,
            style: { width: cn.width || 640, height: cn.height || 360 },
            data: { node: cn },
          });
          continue;
        }

        if (cn.nodeType === 'image') {
          next.push({
            id: cn.id,
            type: 'canvasImage',
            position: { x: cn.x, y: cn.y },
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

        if (
          selectedHierarchyId &&
          card.disciplineId !== selectedHierarchyId &&
          card.subjectId !== selectedHierarchyId &&
          card.subsubjectId !== selectedHierarchyId &&
          card.topicId !== selectedHierarchyId
        ) {
          continue;
        }

        const isEditingThis = inlineEditingCardId === card.id;
        next.push({
          id: cn.id,
          type: 'knowledgeCard',
          position: { x: cn.x, y: cn.y },
          zIndex: isEditingThis ? 100 : undefined,
          selected: prev?.selected ?? false,
          hidden: prev?.hidden ?? false,
          style: {
            width: cn.width || 350,
            height: cn.height || 240,
          },
          data: {
            card,
            isCollapsed: (prev?.data as { isCollapsed?: boolean } | undefined)?.isCollapsed ?? false,
            onOpen: openCard,
            onSaveViewport: saveViewport,
          },
        });
      }
      return next;
    });
  }, [canvasNodes, cardsById, selectedHierarchyId, inlineEditingCardId, openCard, saveViewport, setNodes]);

  useEffect(() => {
    setEdges((prevEdges) => {
      const prevMap = new Map(prevEdges.map((e) => [e.id, e]));
      return canvasEdges.map((e) => ({
        id: e.id,
        source: e.sourceNodeId,
        target: e.targetNodeId,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        type: 'editable',
        data: {
          pathStyle: e.edgeType ?? 'smoothstep',
          edgeStyle: e.style,
          color: e.color ?? '#6366f1',
        },
        label: e.label,
        animated: e.style === 'animated',
        selected: prevMap.get(e.id)?.selected ?? false,
        hidden: prevMap.get(e.id)?.hidden ?? false,
        style: {
          stroke: e.color ?? '#6366f1',
          strokeWidth: 1.75,
          strokeDasharray: e.style === 'dashed' ? '5 5' : undefined,
        },
      }));
    });
  }, [canvasEdges, setEdges]);

  // Restaura última câmera do Workspace
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
    setTimeout(() => fitView({ padding: 0.25, duration: 350 }), 60);
  }, [activeWorkspaceId, nodes.length, setViewport, fitView]);

  // "Voar até o Card"
  useEffect(() => {
    if (!focusRequest) return;
    const targetCanvasNode = canvasNodes.find((n) => n.cardId === focusRequest.cardId);
    if (targetCanvasNode) {
      setTimeout(() => {
        fitView({
          nodes: [{ id: targetCanvasNode.id }],
          duration: 650,
          maxZoom: 1.1,
          padding: 0.45,
        });
        triggerCardHighlight(focusRequest.cardId);
      }, 60);
    }
    clearFocusRequest();
  }, [focusRequest, canvasNodes, fitView, triggerCardHighlight, clearFocusRequest]);

  useEffect(() => {
    if (!openHeaderMenu) return;
    const close = () => setOpenHeaderMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openHeaderMenu]);

  // Ctrl+V de prints direto no Canvas (fora da edição de texto)
  useEffect(() => {
    const handlePasteOnCanvas = (e: ClipboardEvent) => {
      if (isOutlineMode || activeCardId !== null || inlineEditingCardId !== null || isLocked) return;
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
  }, [isOutlineMode, activeCardId, inlineEditingCardId, isLocked, insertImageFileToCanvas]);

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

  const selectedGroupableNodes = useMemo(
    () => nodes.filter((n) => n.selected && (n.type === 'knowledgeCard' || n.type === 'canvasImage')),
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
  const activeGroupRecord =
    selectedGroupNodes.length === 1 && selectedCardNodes.length === 0 && selectedImageNodes.length === 0
      ? canvasNodes.find((n) => n.id === selectedGroupNodes[0].id) ?? null
      : null;

  const activeImageRecord =
    selectedImageNodes.length === 1 && selectedCardNodes.length === 0 && selectedGroupNodes.length === 0
      ? canvasNodes.find((n) => n.id === selectedImageNodes[0].id) ?? null
      : null;

  const canShowContextualBar =
    !isLocked && !isOutlineMode && !inlineEditingCardId && !isDrawingMode && interactionMode !== 'focus';

  const showCardSelectionToolbar = canShowContextualBar && selectedCardNodes.length > 0;
  const showGroupToolbar = canShowContextualBar && Boolean(activeGroupRecord);
  const showImageToolbar = canShowContextualBar && Boolean(activeImageRecord);

  // Agrupar seleção atual (envolve automaticamente 2+ cards/imagens em um Grupo)
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

  // Atalhos de teclado
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (isOutlineMode || activeCardId !== null || inlineEditingCardId !== null || isLocked) return;

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

      const cmdOrCtrl = e.metaKey || e.ctrlKey;

      if (e.key === 'Delete' || e.key === 'Backspace') {
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
    isLocked,
    getNodes,
    getEdges,
    pushHistorySnapshot,
    deleteCanvasSelection,
    duplicateCanvasNodes,
    handleUndo,
    handleRedo,
    addToast,
  ]);

  const getBestHandles = useCallback((sourceNode: Node, targetNode: Node) => {
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
  }, []);

  const onNodeDragStart = useCallback(
    (_: unknown, node: Node) => {
      pushHistorySnapshot();

      if (node.type === 'canvasGroup') {
        const gW = Number(node.measured?.width || node.style?.width || 640);
        const gH = Number(node.measured?.height || node.style?.height || 360);
        const gx1 = node.position.x;
        const gy1 = node.position.y;
        const gx2 = gx1 + gW;
        const gy2 = gy1 + gH;

        const children = getNodes()
          .filter((n) => (n.type === 'knowledgeCard' || n.type === 'canvasImage') && !n.hidden)
          .filter((n) => {
            const nw = Number(n.measured?.width || n.style?.width || 350);
            const nh = Number(n.measured?.height || n.style?.height || 240);
            const cx = n.position.x + nw / 2;
            const cy = n.position.y + nh / 2;
            return cx >= gx1 && cx <= gx2 && cy >= gy1 && cy <= gy2;
          })
          .map((n) => ({ id: n.id, startX: n.position.x, startY: n.position.y }));

        groupDragRef.current = {
          groupId: node.id,
          startX: node.position.x,
          startY: node.position.y,
          children,
        };
      } else {
        groupDragRef.current = null;
      }
    },
    [getNodes, pushHistorySnapshot]
  );

  const onNodeDrag = useCallback(
    (_: unknown, draggedNode: Node) => {
      if (groupDragRef.current && groupDragRef.current.groupId === draggedNode.id) {
        const dx = draggedNode.position.x - groupDragRef.current.startX;
        const dy = draggedNode.position.y - groupDragRef.current.startY;
        const childMap = new Map(groupDragRef.current.children.map((c) => [c.id, c]));

        setNodes((nds) =>
          nds.map((n) => {
            const c = childMap.get(n.id);
            if (!c) return n;
            return { ...n, position: { x: c.startX + dx, y: c.startY + dy } };
          })
        );
      }

      const currentNodes = getNodes();
      setEdges((eds) =>
        eds.map((edge) => {
          const sourceNode = currentNodes.find((n) => n.id === edge.source);
          const targetNode = currentNodes.find((n) => n.id === edge.target);
          if (!sourceNode || !targetNode) return edge;
          const best = getBestHandles(sourceNode, targetNode);
          if (edge.sourceHandle !== best.s || edge.targetHandle !== best.t) {
            return { ...edge, sourceHandle: best.s, targetHandle: best.t };
          }
          return edge;
        })
      );
    },
    [getNodes, getBestHandles, setNodes, setEdges]
  );

  const onNodeDragStop = useCallback(
    (_: unknown, node: Node) => {
      const updates: Array<{ id: string; x: number; y: number }> = [
        { id: node.id, x: Math.round(node.position.x), y: Math.round(node.position.y) },
      ];

      if (groupDragRef.current && groupDragRef.current.groupId === node.id) {
        const dx = node.position.x - groupDragRef.current.startX;
        const dy = node.position.y - groupDragRef.current.startY;
        for (const child of groupDragRef.current.children) {
          updates.push({
            id: child.id,
            x: Math.round(child.startX + dx),
            y: Math.round(child.startY + dy),
          });
        }
        groupDragRef.current = null;
      }

      persistNodePositions(updates);
    },
    [persistNodePositions]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        pushHistorySnapshot();
        addCanvasEdge(connection.source, connection.target, undefined, {
          sourceHandle: connection.sourceHandle ?? undefined,
          targetHandle: connection.targetHandle ?? undefined,
          edgeType: globalEdgeType,
          style: globalAnimated ? 'animated' : 'solid',
          color: globalColor,
        });
      }
    },
    [addCanvasEdge, globalEdgeType, globalAnimated, globalColor, pushHistorySnapshot]
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
            updatedAt: Date.now(),
          }
        : ce;
    });
    await updateCanvasEdgesBulk(updatedStoreEdges);
    setTimeout(() => fitView({ padding: 0.2, duration: 500 }), 50);
  };

  const handleUpdateAllEdges = async (patch: {
    edgeType?: 'smoothstep' | 'default';
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

  // Cria Card sempre no centro exato da sua visão atual
  const handleCreateQuickCard = async (
    template: 'blank' | 'law' | 'jurisprudence',
    title?: string
  ) => {
    pushHistorySnapshot();
    const pos = getSmartViewportPos(350, 240);
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
        <button type="button" onClick={() => fitView({ padding: 0.2, duration: 500 })} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100" title="Enquadrar Tudo"><Maximize className="h-3.5 w-3.5" /></button>
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
              <div className="flex gap-1.5">
                <button onClick={() => handleUpdateAllEdges({ edgeType: 'smoothstep' })} className={`flex-1 rounded-lg py-1.5 text-xs font-medium ${globalEdgeType === 'smoothstep' ? 'bg-indigo-600 text-white' : 'bg-zinc-800/80 text-zinc-300'}`}>Retas</button>
                <button onClick={() => handleUpdateAllEdges({ edgeType: 'default' })} className={`flex-1 rounded-lg py-1.5 text-xs font-medium ${globalEdgeType === 'default' ? 'bg-indigo-600 text-white' : 'bg-zinc-800/80 text-zinc-300'}`}>Curvas</button>
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
      }`}
      style={{ backgroundColor: canvasBgHex }}
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
              fitView({ nodes: selected, duration: 600, padding: 0.15 });
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
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onPaneContextMenu={handlePaneContextMenu}
        onInit={(instance) => {
          setLiveViewport(instance.getViewport());
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
          if (croppingImageNodeId) {
            setCroppingImageNodeId(null);
            return;
          }
          if (inlineEditingCardId) {
            setInlineEditingCardId(null);
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
        {preferences.canvasBackground !== 'none' && (
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

        <MiniMap
          pannable
          zoomable
          bgColor={theme === 'paper' ? '#FFFFFF' : '#161920'}
          nodeBorderRadius={6}
          nodeColor={(n) =>
            n.type === 'canvasGroup'
              ? 'rgba(99, 102, 241, 0.14)'
              : n.type === 'canvasImage'
              ? 'rgba(16, 185, 129, 0.55)'
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
            <div className="kc-no-scrollbar flex w-max max-w-[94vw] flex-nowrap items-center gap-2 overflow-x-auto whitespace-nowrap rounded-2xl border border-indigo-500/40 bg-[#161920]/95 px-2.5 py-1.5 shadow-2xl backdrop-blur-xl">
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

              {/* Cor da Borda / Título */}
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

              {/* Cor do Fundo Interno */}
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

              {/* Opacidade do Fundo */}
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

              {/* Estilo da Borda */}
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

              {/* Espessura da Borda */}
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

              {/* Modo de Corte / Enquadramento interativo */}
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

              {/* Ajuste de preenchimento (Inteira / Cortar / Esticar Livre) */}
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

              {/* Travar / Liberar proporção ao redimensionar */}
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

              {/* Girar e Espelhar */}
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

              {/* Opacidade */}
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

              {/* Cantos arredondados */}
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

              {/* Moldura / Cores */}
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

              {/* Resetar ajustes */}
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
                onClick={() => imageInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800"
                title="Inserir imagem livre no Canvas (ou arraste / Ctrl+V)"
              >
                <ImagePlus className="h-3.5 w-3.5 text-sky-400" /> Imagem
              </button>
              <button
                onClick={handleCreateQuickGroup}
                className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800"
              >
                <FolderPlus className="h-3.5 w-3.5 text-violet-400" /> Novo Grupo
              </button>
            </div>
          </Panel>
        )}
      </ReactFlow>

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