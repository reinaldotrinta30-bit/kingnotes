import { create } from 'zustand';
import { getKnowledgeRepository } from '@/infrastructure/persistence/repositoryFactory';
import { ensureSeedData } from '@/infrastructure/persistence/dexie/seedData';
import {
  BookProjectConfig,
  CanvasConnection,
  CanvasNodePosition,
  CanvasStroke,
  FullKnowledgeCard,
  HierarchyNode,
  KnowledgeCardContent,
  KnowledgeCardMeta,
  StudyNotebook,
  StudySession,
  Workspace,
  TopicShape,
  EdgeLineStyle,
  EdgeArrowType,
  CanvasEdgePathType,
} from '../types';
import { buildSearchTokens } from '@/domains/search/utils/tokenizer';
import { calculateSm2 } from '@/domains/review/utils/sm2';
import {
  getDescendantHierarchyIds,
  matchesHierarchyContext,
  resolveHierarchyChain,
  resolveOptionalHierarchyScope,
} from '../utils/hierarchyContext';

import { unprojectNodePosition } from '@/domains/canvas/utils/panoramaLayout';
import { DEFAULT_CARD_TYPOGRAPHY, resolveCardCallout } from '../utils/defaults';


export type ActiveViewMode = 'canvas' | 'book' | 'review';

// Contadores monotônicos contra condições de corrida em leituras assíncronas do IndexedDB
let workspaceRequestToken = 0;
let activeCardRequestToken = 0;
let secondaryCardRequestToken = 0;

interface KnowledgeState {
  isReady: boolean;
  viewMode: ActiveViewMode;
  isSearchOpen: boolean;
  workspaces: Workspace[];
  notebooks: StudyNotebook[];
  studySessions: StudySession[];
  activeWorkspaceId: string | null;

  hierarchy: HierarchyNode[];
  selectedHierarchyId: string | null;

  // Mapa indexado por cardId para lookup O(1) mesmo com milhares de cards
  cardsById: Record<string, KnowledgeCardMeta>;
  canvasNodes: CanvasNodePosition[];
  canvasEdges: CanvasConnection[];
  canvasStrokes: CanvasStroke[];

  activeCardId: string | null;
  activeFullCard: FullKnowledgeCard | null;
  secondaryCardId: string | null;
  secondaryFullCard: FullKnowledgeCard | null;

  // Actions
  bootstrap: () => Promise<void>;
  setViewMode: (mode: ActiveViewMode) => void;
  setSearchOpen: (open: boolean) => void;
  selectWorkspace: (workspaceId: string) => Promise<void>;
  selectHierarchy: (id: string | null) => void;
  openCard: (cardId: string | null) => Promise<void>;
  openSecondaryCard: (cardId: string | null) => Promise<void>;
  extractSelectionToCard: (params: {
    sourceCardId: string;
    selectedText: string;
  }) => Promise<{ cardId: string; title: string } | null>;

  createCardOnCanvas: (params: {
    x: number;
    y: number;
    title?: string;
    template?: 'blank' | 'law' | 'jurisprudence';
  }) => Promise<string>;
  createCardFromPdf: (params: {
    title: string;
    bodyText: string;
    sourcePdfName: string;
    page?: string;
    color?: KnowledgeCardMeta['color'];
  }) => Promise<string | null>;
  updateCardMeta: (cardId: string, patch: Partial<KnowledgeCardMeta>) => Promise<void>;
  saveCardContent: (
    cardId: string,
    content: KnowledgeCardContent,
    plainTextExcerpt: string
  ) => Promise<void>;
  deleteCard: (cardId: string) => Promise<void>;
  updateCardsMetaBulk: (cardIds: string[], patch: Partial<KnowledgeCardMeta>) => Promise<void>;
  deleteCanvasSelection: (nodeIds: string[], edgeIds: string[]) => Promise<void>;
  duplicateCanvasNodes: (nodeIds: string[]) => Promise<string[]>;
  importOutlineToCanvas: (outlineText: string) => Promise<void>;
  restoreCanvasSnapshot: (
    nodes: CanvasNodePosition[],
    edges: CanvasConnection[],
    strokes?: CanvasStroke[]
  ) => Promise<void>;
  createNotebook: (name: string, color?: string) => Promise<StudyNotebook>;
  deleteNotebook: (notebookId: string) => Promise<void>;
  toggleCardInNotebook: (cardId: string, notebookId: string) => Promise<void>;
  recordCardReview: (
    cardId: string,
    confidence: 'hard' | 'good' | 'easy',
    durationMs?: number
  ) => Promise<void>;
  saveStudySession: (durationSeconds: number, mode: StudySession['mode']) => Promise<void>;
  addCanvasStroke: (
    stroke: Omit<
      CanvasStroke,
      'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'syncStatus' | 'version'
    >
  ) => Promise<CanvasStroke | null>;
  deleteCanvasStroke: (strokeId: string) => Promise<void>;
  restoreCanvasStroke: (stroke: CanvasStroke) => Promise<void>;
  clearCanvasStrokes: () => Promise<void>;
  createWorkspace: (name: string, icon?: string) => Promise<void>;
  updateWorkspaceBookConfig: (patch: Partial<BookProjectConfig>) => Promise<void>;
  deleteHierarchyItem: (id: string) => Promise<void>;
  createCanvasGroup: (
    x: number,
    y: number,
    label?: string,
    width?: number,
    height?: number
  ) => Promise<string>;
  renameCanvasGroup: (groupId: string, label: string) => Promise<void>;
  createCanvasImage: (params: {
    x: number;
    y: number;
    blobId: string;
    width: number;
    height: number;
    caption?: string;
    borderStyle?: CanvasNodePosition['borderStyle'];
    keepAspectRatio?: boolean;
  }) => Promise<string | null>;
  updateCanvasNode: (nodeId: string, patch: Partial<CanvasNodePosition>) => Promise<void>;
  createCanvasText: (params: {
    x: number;
    y: number;
    preset?: 'plain' | 'heading' | 'sticky' | 'callout';
    initialText?: string;
  }) => Promise<string | null>;
  duplicateCanvasText: (nodeId: string) => Promise<string | null>;
  createCanvasTopic: (params: {
    x: number;
    y: number;
    label?: string;
    shape?: TopicShape;
    color?: string;
    parentTopicId?: string | null;
  }) => Promise<string | null>;
  createSubtopic: (
    parentNodeId: string,
    options?: { label?: string; shape?: TopicShape; edgeLabel?: string }
  ) => Promise<{ nodeId: string; edgeId: string } | null>;
  duplicateCanvasTopic: (nodeId: string) => Promise<string | null>;
  promoteTextNodeToCard: (nodeId: string) => Promise<string | null>;
  convertCardToTextNode: (cardNodeId: string) => Promise<{
    textNodeId: string;
    undoBundle: {
      fullCard: FullKnowledgeCard;
      canvasNode: CanvasNodePosition;
      edges: CanvasConnection[];
    };
  } | null>;
  undoConvertCardToText: (
    textNodeId: string,
    undoBundle: {
      fullCard: FullKnowledgeCard;
      canvasNode: CanvasNodePosition;
      edges: CanvasConnection[];
    }
  ) => Promise<void>;
  updateCanvasEdge: (edgeId: string, patch: Partial<CanvasConnection>) => Promise<void>;
  deleteCanvasEdge: (edgeId: string) => Promise<void>;
  renameHierarchyItem: (id: string, title: string) => Promise<void>;
  updateHierarchyItem: (
    id: string,
    patch: Partial<
      Pick<
        HierarchyNode,
        'title' | 'color' | 'icon' | 'coverBlobId' | 'isArchived' | 'isPinned' | 'isFavorite' | 'order'
      >
    >
  ) => Promise<void>;
  restoreCardBundle: (
    full: FullKnowledgeCard,
    nodes: CanvasNodePosition[],
    edges: CanvasConnection[]
  ) => Promise<void>;
  persistNodePositions: (
    updates: Array<{
      id: string;
      x: number;
      y: number;
      width?: number;
      height?: number;
      sizingMode?: 'auto' | 'custom';
    }>
  ) => Promise<void>;
  addCanvasEdge: (
    sourceNodeId: string,
    targetNodeId: string,
    label?: string,
    options?: {
      sourceHandle?: string;
      targetHandle?: string;
      edgeType?: CanvasEdgePathType;
      style?: 'solid' | 'dashed' | 'animated';
      lineStyle?: EdgeLineStyle;
      strokeWidth?: number;
      arrowStart?: EdgeArrowType;
      arrowEnd?: EdgeArrowType;
      color?: string;
    }
  ) => Promise<void>;
  updateCanvasEdgesBulk: (edges: CanvasConnection[]) => Promise<void>;
  createHierarchyItem: (
    node: Omit<
      HierarchyNode,
      'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'syncStatus' | 'version'
    >
  ) => Promise<HierarchyNode>;
}

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  isReady: false,
  viewMode: 'canvas',
  isSearchOpen: false,
  workspaces: [],
  notebooks: [],
  studySessions: [],
  activeWorkspaceId: null,
  hierarchy: [],
  selectedHierarchyId: null,
  cardsById: {},
  canvasNodes: [],
  canvasEdges: [],
  canvasStrokes: [],
  activeCardId: null,
  activeFullCard: null,
  secondaryCardId: null,
  secondaryFullCard: null,

  bootstrap: async () => {
    const firstWorkspaceId = await ensureSeedData();
    const repo = getKnowledgeRepository();
    const [workspaces, notebooks, studySessions] = await Promise.all([
      repo.listWorkspaces(),
      repo.listNotebooks(),
      repo.listStudySessions(500),
    ]);
    set({ workspaces, notebooks, studySessions });
    await get().selectWorkspace(firstWorkspaceId);
    set({ isReady: true });
  },

  setViewMode: (viewMode) => set({ viewMode }),
  setSearchOpen: (isSearchOpen) => set({ isSearchOpen }),

  selectWorkspace: async (workspaceId) => {
    const token = ++workspaceRequestToken;
    activeCardRequestToken += 1;
    secondaryCardRequestToken += 1;

    // Limpa contexto anterior imediatamente para evitar exibição de dados obsoletos durante a leitura
    set({
      activeWorkspaceId: workspaceId,
      selectedHierarchyId: null,
      activeCardId: null,
      activeFullCard: null,
      secondaryCardId: null,
      secondaryFullCard: null,
    });

    const repo = getKnowledgeRepository();
    const [hierarchy, cards, canvasNodes, canvasEdges, canvasStrokes] = await Promise.all([
      repo.listHierarchy(workspaceId),
      repo.listCardMetasByWorkspace(workspaceId),
      repo.listCanvasNodes(workspaceId),
      repo.listCanvasConnections(workspaceId),
      repo.listCanvasStrokes(workspaceId),
    ]);

    // Descarta resposta se o usuário já trocou para outro workspace nesse meio tempo
    if (token !== workspaceRequestToken) return;

    const cardsById: Record<string, KnowledgeCardMeta> = {};
    for (const c of cards) cardsById[c.id] = c;

    set({
      activeWorkspaceId: workspaceId,
      selectedHierarchyId: null,
      hierarchy,
      cardsById,
      canvasNodes,
      canvasEdges,
      canvasStrokes,
      activeCardId: null,
      activeFullCard: null,
      secondaryCardId: null,
      secondaryFullCard: null,
    });
  },

  selectHierarchy: (selectedHierarchyId) => {
    const state = get();
    // Se algum card aberto no editor não pertence ao novo contexto, fecha para evitar salvar no contexto errado
    const keepActive =
      !selectedHierarchyId ||
      !state.activeCardId ||
      matchesHierarchyContext(
        state.cardsById[state.activeCardId],
        selectedHierarchyId,
        state.hierarchy
      );

    const keepSecondary =
      !selectedHierarchyId ||
      !state.secondaryCardId ||
      matchesHierarchyContext(
        state.cardsById[state.secondaryCardId],
        selectedHierarchyId,
        state.hierarchy
      );

    if (!keepActive) activeCardRequestToken += 1;
    if (!keepSecondary) secondaryCardRequestToken += 1;

    set({
      selectedHierarchyId,
      activeCardId: keepActive ? state.activeCardId : null,
      activeFullCard: keepActive ? state.activeFullCard : null,
      secondaryCardId: keepSecondary ? state.secondaryCardId : null,
      secondaryFullCard: keepSecondary ? state.secondaryFullCard : null,
    });
  },

  openCard: async (cardId) => {
    const token = ++activeCardRequestToken;
    if (!cardId) {
      secondaryCardRequestToken += 1;
      set({
        activeCardId: null,
        activeFullCard: null,
        secondaryCardId: null,
        secondaryFullCard: null,
      });
      return;
    }

    const expectedWorkspaceId = get().activeWorkspaceId;
    const repo = getKnowledgeRepository();
    const full = await repo.getFullCard(cardId);

    if (token !== activeCardRequestToken) return;
    if (full && expectedWorkspaceId && full.meta.workspaceId !== expectedWorkspaceId) return;

    set((s) => ({
      activeCardId: cardId,
      activeFullCard: full,
      secondaryCardId: s.secondaryCardId === cardId ? null : s.secondaryCardId,
      secondaryFullCard: s.secondaryCardId === cardId ? null : s.secondaryFullCard,
    }));
  },

  openSecondaryCard: async (cardId) => {
    const token = ++secondaryCardRequestToken;
    if (!cardId) {
      set({ secondaryCardId: null, secondaryFullCard: null });
      return;
    }
    if (get().activeCardId === cardId) return;

    const expectedWorkspaceId = get().activeWorkspaceId;
    const repo = getKnowledgeRepository();
    const full = await repo.getFullCard(cardId);

    if (token !== secondaryCardRequestToken) return;
    if (full && expectedWorkspaceId && full.meta.workspaceId !== expectedWorkspaceId) return;

    set({ secondaryCardId: cardId, secondaryFullCard: full });
  },

  extractSelectionToCard: async ({ sourceCardId, selectedText }) => {
    const cleanText = selectedText.trim();
    if (!cleanText) return null;

    const state = get();
    const repo = getKnowledgeRepository();
    const workspaceId = state.activeWorkspaceId;
    const sourceCard = state.cardsById[sourceCardId];
    if (!workspaceId || !sourceCard) return null;

    const lines = cleanText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const firstLine = lines[0] ?? cleanText;
    const title = firstLine.length > 64 ? `${firstLine.slice(0, 61)}...` : firstLine;

    const now = Date.now();
    const newCardId = `card-${crypto.randomUUID()}`;
    const newNodeId = `node-${crypto.randomUUID()}`;

    const sourceNode = state.canvasNodes.find((n) => n.cardId === sourceCardId);
    const posX = sourceNode ? Math.round(sourceNode.x + (sourceNode.width || 320) + 90) : 320;
    const posY = sourceNode ? Math.round(sourceNode.y + 30) : 220;

    const meta: KnowledgeCardMeta = {
      id: newCardId,
      workspaceId,
      disciplineId: sourceCard.disciplineId,
      subjectId: sourceCard.subjectId,
      subsubjectId: sourceCard.subsubjectId ?? null,
      topicId: sourceCard.topicId ?? null,
      title,
      excerpt: cleanText.slice(0, 220),
      notes: '',
      tags: [...sourceCard.tags],
      color: sourceCard.color,
      isFavorite: false,
      isPinned: false,
      importance: 'normal',
      reviewCount: 0,
      lastReviewedAt: null,
      nextReviewAt: null,
      outgoingLinkIds: [],
      searchTokens: buildSearchTokens([title, cleanText, ...sourceCard.tags]),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'local_only',
      version: 1,
    };

    const content: KnowledgeCardContent = {
      cardId: newCardId,
      tiptapJson: {
        type: 'doc',
        content: lines.map((line) => ({
          type: 'paragraph',
          content: [{ type: 'text', text: line }],
        })),
      },
      plainText: cleanText,
      flashcards: [],
      attachments: [],
      updatedAt: now,
    };

    const canvasNode: CanvasNodePosition = {
      id: newNodeId,
      workspaceId,
      cardId: newCardId,
      nodeType: 'knowledgeCard',
      disciplineId: meta.disciplineId,
      subjectId: meta.subjectId,
      subsubjectId: meta.subsubjectId,
      topicId: meta.topicId,
      x: posX,
      y: posY,
      width: 350,
      height: 240,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'local_only',
      version: 1,
    };

    await repo.saveCard(meta, content);
    await repo.upsertCanvasNodes([canvasNode]);

    let createdEdge: CanvasConnection | null = null;
    if (sourceNode) {
      createdEdge = {
        id: `edge-${crypto.randomUUID()}`,
        workspaceId,
        sourceNodeId: sourceNode.id,
        targetNodeId: newNodeId,
        sourceHandle: 's-right',
        targetHandle: 't-left',
        edgeType: 'smoothstep',
        label: 'desdobramento',
        style: 'solid',
        color: '#6366f1',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: 'local_only',
        version: 1,
      };
      await repo.saveCanvasConnection(createdEdge);
    }

    set((s) => ({
      cardsById: { ...s.cardsById, [newCardId]: meta },
      canvasNodes: [...s.canvasNodes, canvasNode],
      canvasEdges: createdEdge ? [...s.canvasEdges, createdEdge] : s.canvasEdges,
    }));

    return { cardId: newCardId, title };
  },

  createCardOnCanvas: async ({ x, y, title = 'Novo Knowledge Card', template = 'blank' }) => {
    const state = get();
    const repo = getKnowledgeRepository();
    const workspaceId = state.activeWorkspaceId!;
    const now = Date.now();
    const cardId = `card-${crypto.randomUUID()}`;
    const nodeId = `node-${crypto.randomUUID()}`;

    const chain = resolveHierarchyChain(state.hierarchy, state.selectedHierarchyId);

    const templateDocs: Record<string, Record<string, unknown>> = {
      blank: { type: 'doc', content: [{ type: 'paragraph' }] },
      law: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Dispositivo Legal (Lei Seca)' }],
          },
          {
            type: 'blockquote',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Cole aqui o artigo literal...' }],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Pegadinhas de Banca' }],
          },
          {
            type: 'taskList',
            content: [
              {
                type: 'taskItem',
                attrs: { checked: false },
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text: 'Exceções à regra geral' }] },
                ],
              },
            ],
          },
        ],
      },
      jurisprudence: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Tese Fixada (STF / STJ)' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Informativo / Súmula nº ...' }],
          },
        ],
      },
    };

    const meta: KnowledgeCardMeta = {
      id: cardId,
      workspaceId,
      disciplineId: chain.disciplineId,
      subjectId: chain.subjectId,
      subsubjectId: chain.subsubjectId,
      topicId: chain.topicId,
      title,
      excerpt:
        template === 'law'
          ? 'Estrutura de Lei Seca e Pegadinhas de Banca.'
          : 'Clique para editar seu conhecimento...',
      notes: '',
      tags: template !== 'blank' ? [template] : [],
      color: template === 'law' ? 'amber' : template === 'jurisprudence' ? 'emerald' : 'default',
      isFavorite: false,
      isPinned: false,
      importance: 'normal',
      reviewCount: 0,
      lastReviewedAt: null,
      nextReviewAt: null,
      outgoingLinkIds: [],
      searchTokens: buildSearchTokens([title, template]),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'local_only',
      version: 1,
    };

    const content: KnowledgeCardContent = {
      cardId,
      tiptapJson: templateDocs[template],
      plainText: title,
      flashcards: [],
      attachments: [],
      updatedAt: now,
    };

    const canvasNode: CanvasNodePosition = {
      id: nodeId,
      workspaceId,
      cardId,
      nodeType: 'knowledgeCard',
      disciplineId: chain.disciplineId,
      subjectId: chain.subjectId,
      subsubjectId: chain.subsubjectId,
      topicId: chain.topicId,
      sizingMode: 'auto',
      padding: 'md',
      x,
      y,
      width: 340,
      height: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'local_only',
      version: 1,
    };

    await repo.saveCard(meta, content);
    await repo.upsertCanvasNodes([canvasNode]);

    set((s) => ({
      cardsById: { ...s.cardsById, [cardId]: meta },
      canvasNodes: [...s.canvasNodes, canvasNode],
    }));

    return cardId;
  },

  createCardFromPdf: async ({ title, bodyText, sourcePdfName, page, color = 'sky' }) => {
    const state = get();
    const repo = getKnowledgeRepository();
    const workspaceId = state.activeWorkspaceId;
    if (!workspaceId) return null;

    const cleanBody = bodyText.trim();
    const cleanTitle =
      title.trim() ||
      (cleanBody.length > 56 ? `${cleanBody.slice(0, 53)}...` : cleanBody) ||
      `Nota — ${sourcePdfName}`;

    const now = Date.now();
    const cardId = `card-${crypto.randomUUID()}`;
    const nodeId = `node-${crypto.randomUUID()}`;

    const chain = resolveHierarchyChain(state.hierarchy, state.selectedHierarchyId);

    const cardNodes = state.canvasNodes.filter(
      (n) =>
        n.nodeType === 'knowledgeCard' &&
        n.cardId &&
        matchesHierarchyContext(state.cardsById[n.cardId], state.selectedHierarchyId, state.hierarchy)
    );
    const lastNode = cardNodes[cardNodes.length - 1];
    const posX = lastNode ? Math.round(lastNode.x + 60) : 180;
    const posY = lastNode ? Math.round(lastNode.y + 60) : 160;

    const sourceNote = page?.trim()
      ? `Fonte: ${sourcePdfName} (p. ${page.trim()})`
      : `Fonte: ${sourcePdfName}`;

    const paragraphs = cleanBody
      ? cleanBody.split('\n').map((line) => ({
          type: 'paragraph',
          content: line.trim() ? [{ type: 'text', text: line }] : [],
        }))
      : [{ type: 'paragraph' }];

    const meta: KnowledgeCardMeta = {
      id: cardId,
      workspaceId,
      disciplineId: chain.disciplineId,
      subjectId: chain.subjectId,
      subsubjectId: chain.subsubjectId,
      topicId: chain.topicId,
      title: cleanTitle,
      excerpt: cleanBody ? cleanBody.slice(0, 220) : sourceNote,
      notes: sourceNote,
      tags: ['pdf'],
      color,
      isFavorite: false,
      isPinned: false,
      importance: 'normal',
      reviewCount: 0,
      lastReviewedAt: null,
      nextReviewAt: null,
      outgoingLinkIds: [],
      searchTokens: buildSearchTokens([cleanTitle, cleanBody, sourceNote, 'pdf']),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'local_only',
      version: 1,
    };

    const content: KnowledgeCardContent = {
      cardId,
      tiptapJson: { type: 'doc', content: paragraphs },
      plainText: cleanBody || cleanTitle,
      flashcards: [],
      attachments: [],
      updatedAt: now,
    };

    const canvasNode: CanvasNodePosition = {
      id: nodeId,
      workspaceId,
      cardId,
      nodeType: 'knowledgeCard',
      disciplineId: chain.disciplineId,
      subjectId: chain.subjectId,
      subsubjectId: chain.subsubjectId,
      topicId: chain.topicId,
      sizingMode: 'auto',
      padding: 'md',
      x: posX,
      y: posY,
      width: 340,
      height: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'local_only',
      version: 1,
    };

    await repo.saveCard(meta, content);
    await repo.upsertCanvasNodes([canvasNode]);

    set((s) => ({
      cardsById: { ...s.cardsById, [cardId]: meta },
      canvasNodes: [...s.canvasNodes, canvasNode],
    }));

    return cardId;
  },

  updateCardMeta: async (cardId, patch) => {
    const repo = getKnowledgeRepository();
    const current = get().cardsById[cardId];
    if (!current) return;

    // Mantém notes e callout.text sempre sincronizados
    const mergedPatch: Partial<KnowledgeCardMeta> = { ...patch };
    if (patch.callout && patch.callout.text !== undefined && patch.notes === undefined) {
      mergedPatch.notes = patch.callout.text;
    } else if (patch.notes !== undefined && current.callout && patch.callout === undefined) {
      mergedPatch.callout = { ...current.callout, text: patch.notes };
    }

    const updated: KnowledgeCardMeta = {
      ...current,
      ...mergedPatch,
      updatedAt: Date.now(),
      version: current.version + 1,
      syncStatus: 'pending_push',
    };
    updated.searchTokens = buildSearchTokens([
      updated.title,
      updated.excerpt,
      updated.notes,
      ...updated.tags,
    ]);

    set((s) => ({
      cardsById: { ...s.cardsById, [cardId]: updated },
      activeFullCard:
        s.activeFullCard?.meta.id === cardId
          ? { ...s.activeFullCard, meta: updated }
          : s.activeFullCard,
      secondaryFullCard:
        s.secondaryFullCard?.meta.id === cardId
          ? { ...s.secondaryFullCard, meta: updated }
          : s.secondaryFullCard,
    }));

    await repo.saveCard(updated);
  },

  saveCardContent: async (cardId, content, plainTextExcerpt) => {
    const repo = getKnowledgeRepository();
    const current = get().cardsById[cardId];
    if (!current) return;

    const updatedMeta: KnowledgeCardMeta = {
      ...current,
      excerpt: plainTextExcerpt.slice(0, 220) || current.excerpt,
      updatedAt: Date.now(),
      version: current.version + 1,
      searchTokens: buildSearchTokens([
        current.title,
        current.notes,
        content.plainText,
        ...current.tags,
      ]),
    };

    set((s) => ({
      cardsById: { ...s.cardsById, [cardId]: updatedMeta },
      activeFullCard:
        s.activeFullCard?.meta.id === cardId
          ? { meta: updatedMeta, content }
          : s.activeFullCard,
      secondaryFullCard:
        s.secondaryFullCard?.meta.id === cardId
          ? { meta: updatedMeta, content }
          : s.secondaryFullCard,
    }));

    await repo.saveCard(updatedMeta, content);
  },

  deleteCard: async (cardId) => {
    const repo = getKnowledgeRepository();
    await repo.softDeleteCard(cardId);
    set((s) => {
      const nextCards = { ...s.cardsById };
      delete nextCards[cardId];
      const removedNodeIds = new Set(
        s.canvasNodes.filter((n) => n.cardId === cardId).map((n) => n.id)
      );
      return {
        cardsById: nextCards,
        canvasNodes: s.canvasNodes.filter((n) => n.cardId !== cardId),
        canvasEdges: s.canvasEdges.filter(
          (e) => !removedNodeIds.has(e.sourceNodeId) && !removedNodeIds.has(e.targetNodeId)
        ),
        activeCardId: s.activeCardId === cardId ? null : s.activeCardId,
        activeFullCard: s.activeFullCard?.meta.id === cardId ? null : s.activeFullCard,
        secondaryCardId: s.secondaryCardId === cardId ? null : s.secondaryCardId,
        secondaryFullCard: s.secondaryFullCard?.meta.id === cardId ? null : s.secondaryFullCard,
      };
    });
  },

  updateCardsMetaBulk: async (cardIds, patch) => {
    const repo = getKnowledgeRepository();
    const state = get();
    const now = Date.now();
    const updatedMap: Record<string, KnowledgeCardMeta> = { ...state.cardsById };
    const toSave: KnowledgeCardMeta[] = [];

    for (const cardId of cardIds) {
      const current = updatedMap[cardId];
      if (!current) continue;
      const updated: KnowledgeCardMeta = {
        ...current,
        ...patch,
        updatedAt: now,
        version: current.version + 1,
        syncStatus: 'pending_push',
      };
      updated.searchTokens = buildSearchTokens([
        updated.title,
        updated.excerpt,
        updated.notes,
        ...updated.tags,
      ]);
      updatedMap[cardId] = updated;
      toSave.push(updated);
    }

    set((s) => ({
      cardsById: updatedMap,
      activeFullCard:
        s.activeFullCard && updatedMap[s.activeFullCard.meta.id]
          ? { ...s.activeFullCard, meta: updatedMap[s.activeFullCard.meta.id] }
          : s.activeFullCard,
    }));

    await Promise.all(toSave.map((m) => repo.saveCard(m)));
  },

  deleteCanvasSelection: async (nodeIds, edgeIds) => {
    const repo = getKnowledgeRepository();
    const state = get();
    const nodeIdSet = new Set(nodeIds);
    const edgeIdSet = new Set(edgeIds);

    const nodesToRemove = state.canvasNodes.filter((n) => nodeIdSet.has(n.id));
    const cardIdsToRemove = new Set<string>();

    for (const n of nodesToRemove) {
      if (n.nodeType === 'knowledgeCard' && n.cardId) {
        cardIdsToRemove.add(n.cardId);
      }
    }

    const allEdgesToDelete = new Set<string>(edgeIdSet);
    for (const e of state.canvasEdges) {
      if (nodeIdSet.has(e.sourceNodeId) || nodeIdSet.has(e.targetNodeId)) {
        allEdgesToDelete.add(e.id);
      }
    }

    const nextCardsById = { ...state.cardsById };
    for (const cid of cardIdsToRemove) delete nextCardsById[cid];

    set((s) => ({
      cardsById: nextCardsById,
      canvasNodes: s.canvasNodes.filter((n) => !nodeIdSet.has(n.id)),
      canvasEdges: s.canvasEdges.filter((e) => !allEdgesToDelete.has(e.id)),
      activeCardId: s.activeCardId && cardIdsToRemove.has(s.activeCardId) ? null : s.activeCardId,
      activeFullCard:
        s.activeFullCard && cardIdsToRemove.has(s.activeFullCard.meta.id) ? null : s.activeFullCard,
    }));

    await Promise.all([
      ...Array.from(cardIdsToRemove).map((cid) => repo.softDeleteCard(cid)),
      ...nodesToRemove
        .filter((n) => n.nodeType !== 'knowledgeCard')
        .map((n) => repo.deleteCanvasNode(n.id)),
      ...Array.from(allEdgesToDelete).map((eid) => repo.deleteCanvasConnection(eid)),
    ]);
  },

  duplicateCanvasNodes: async (nodeIds) => {
    const repo = getKnowledgeRepository();
    const state = get();
    const workspaceId = state.activeWorkspaceId;
    if (!workspaceId) return [];

    const now = Date.now();
    const newCardsMap: Record<string, KnowledgeCardMeta> = { ...state.cardsById };
    const createdCanvasNodes: CanvasNodePosition[] = [];

    for (const nodeId of nodeIds) {
      const sourceNode = state.canvasNodes.find((n) => n.id === nodeId);
      if (!sourceNode || sourceNode.nodeType !== 'knowledgeCard' || !sourceNode.cardId) continue;

      const full = await repo.getFullCard(sourceNode.cardId);
      if (!full) continue;

      const newCardId = `card-${crypto.randomUUID()}`;
      const newNodeId = `node-${crypto.randomUUID()}`;

      const clonedMeta: KnowledgeCardMeta = {
        ...full.meta,
        id: newCardId,
        title: `${full.meta.title} (Cópia)`,
        reviewCount: 0,
        lastReviewedAt: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: 'local_only',
        version: 1,
      };
      clonedMeta.searchTokens = buildSearchTokens([
        clonedMeta.title,
        clonedMeta.excerpt,
        clonedMeta.notes,
        ...clonedMeta.tags,
      ]);

      const clonedContent: KnowledgeCardContent = {
        ...full.content,
        cardId: newCardId,
        updatedAt: now,
      };

      const clonedCanvasNode: CanvasNodePosition = {
        ...sourceNode,
        id: newNodeId,
        cardId: newCardId,
        x: Math.round(sourceNode.x + 48),
        y: Math.round(sourceNode.y + 48),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: 'local_only',
        version: 1,
      };

      await repo.saveCard(clonedMeta, clonedContent);
      newCardsMap[newCardId] = clonedMeta;
      createdCanvasNodes.push(clonedCanvasNode);
    }

    if (createdCanvasNodes.length > 0) {
      await repo.upsertCanvasNodes(createdCanvasNodes);
      set((s) => ({
        cardsById: newCardsMap,
        canvasNodes: [...s.canvasNodes, ...createdCanvasNodes],
      }));
    }

    return createdCanvasNodes.map((n) => n.id);
  },

  importOutlineToCanvas: async (outlineText) => {
    const repo = getKnowledgeRepository();
    const state = get();
    const workspaceId = state.activeWorkspaceId;
    if (!workspaceId || !outlineText.trim()) return;

    const lines = outlineText.split('\n');
    const parsed: Array<{ level: number; title: string; bodyLines: string[] }> = [];
    let current: { level: number; title: string; bodyLines: string[] } | null = null;

    for (const rawLine of lines) {
      const normalized = rawLine.replace(/\t/g, '  ');
      if (!normalized.trim() && !current) continue;
      const match = normalized.match(/^(\s*)[-*•]\s+(.*)/);
      if (match) {
        const level = Math.floor(match[1].length / 2);
        current = { level, title: match[2].trim(), bodyLines: [] };
        parsed.push(current);
      } else if (current && normalized.trim()) {
        current.bodyLines.push(normalized.trim());
      }
    }

    if (parsed.length === 0) return;

    const now = Date.now();
    const chain = resolveHierarchyChain(state.hierarchy, state.selectedHierarchyId);

    const nextCardsById = { ...state.cardsById };
    const newCanvasNodes: CanvasNodePosition[] = [];
    const newEdges: CanvasConnection[] = [];
    const usedNodeIds = new Set<string>();
    const stack: Array<{ level: number; nodeId: string }> = [];

    for (let i = 0; i < parsed.length; i++) {
      const item = parsed[i];
      if (!item.title) continue;

      const existingNode = state.canvasNodes.find((cn) => {
        if (cn.nodeType !== 'knowledgeCard' || !cn.cardId || usedNodeIds.has(cn.id)) return false;
        const c = nextCardsById[cn.cardId];
        if (!c || !matchesHierarchyContext(c, state.selectedHierarchyId, state.hierarchy)) {
          return false;
        }
        return c.title.trim().toLowerCase() === item.title.toLowerCase();
      });

      let nodeId: string;
      if (existingNode) {
        nodeId = existingNode.id;
        usedNodeIds.add(nodeId);
      } else {
        const cardId = `card-${crypto.randomUUID()}`;
        nodeId = `node-${crypto.randomUUID()}`;
        usedNodeIds.add(nodeId);

        const bodyText = item.bodyLines.join('\n');
        const colors: KnowledgeCardMeta['color'][] = ['violet', 'sky', 'emerald', 'amber'];
        const cardColor = colors[item.level % colors.length];

        const meta: KnowledgeCardMeta = {
          id: cardId,
          workspaceId,
          disciplineId: chain.disciplineId,
          subjectId: chain.subjectId,
          subsubjectId: chain.subsubjectId,
          topicId: chain.topicId,
          title: item.title,
          excerpt: bodyText ? bodyText.slice(0, 220) : 'Criado via Modo Estrutura em Texto.',
          notes: '',
          tags: [],
          color: cardColor,
          isFavorite: false,
          isPinned: false,
          importance: item.level === 0 ? 'high' : 'normal',
          reviewCount: 0,
          lastReviewedAt: null,
          nextReviewAt: null,
          outgoingLinkIds: [],
          searchTokens: buildSearchTokens([item.title, bodyText]),
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          syncStatus: 'local_only',
          version: 1,
        };

        const paragraphs =
          item.bodyLines.length > 0
            ? item.bodyLines.map((line) => ({
                type: 'paragraph',
                content: [{ type: 'text', text: line }],
              }))
            : [{ type: 'paragraph' }];

        const content: KnowledgeCardContent = {
          cardId,
          tiptapJson: { type: 'doc', content: paragraphs },
          plainText: bodyText || item.title,
          flashcards: [],
          attachments: [],
          updatedAt: now,
        };

        const canvasNode: CanvasNodePosition = {
          id: nodeId,
          workspaceId,
          cardId,
          nodeType: 'knowledgeCard',
          disciplineId: chain.disciplineId,
          subjectId: chain.subjectId,
          subsubjectId: chain.subsubjectId,
          topicId: chain.topicId,
          x: 120 + item.level * 420,
          y: 120 + i * 220,
          width: 350,
          height: 210,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          syncStatus: 'local_only',
          version: 1,
        };

        await repo.saveCard(meta, content);
        nextCardsById[cardId] = meta;
        newCanvasNodes.push(canvasNode);
      }

      while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
        stack.pop();
      }
      if (stack.length > 0) {
        const parentNodeId = stack[stack.length - 1].nodeId;
        const alreadyLinked =
          state.canvasEdges.some(
            (e) => e.sourceNodeId === parentNodeId && e.targetNodeId === nodeId
          ) ||
          newEdges.some((e) => e.sourceNodeId === parentNodeId && e.targetNodeId === nodeId);

        if (!alreadyLinked) {
          const edge: CanvasConnection = {
            id: `edge-${crypto.randomUUID()}`,
            workspaceId,
            sourceNodeId: parentNodeId,
            targetNodeId: nodeId,
            sourceHandle: 's-right',
            targetHandle: 't-left',
            edgeType: 'smoothstep',
            style: 'solid',
            color: '#6366f1',
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
            syncStatus: 'local_only',
            version: 1,
          };
          await repo.saveCanvasConnection(edge);
          newEdges.push(edge);
        }
      }

      stack.push({ level: item.level, nodeId });
    }

    if (newCanvasNodes.length > 0) {
      await repo.upsertCanvasNodes(newCanvasNodes);
    }

    set((s) => ({
      cardsById: nextCardsById,
      canvasNodes: [...s.canvasNodes, ...newCanvasNodes],
      canvasEdges: [...s.canvasEdges, ...newEdges],
    }));
  },

  createNotebook: async (name, color = '#6366f1') => {
    const repo = getKnowledgeRepository();
    const now = Date.now();
    const nb: StudyNotebook = {
      id: `nb-${crypto.randomUUID()}`,
      name: name.trim(),
      color,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'local_only',
      version: 1,
    };
    await repo.saveNotebook(nb);
    set((s) => ({ notebooks: [...s.notebooks, nb] }));
    return nb;
  },

  deleteNotebook: async (notebookId) => {
    const repo = getKnowledgeRepository();
    await repo.deleteNotebook(notebookId);
    set((s) => ({ notebooks: s.notebooks.filter((n) => n.id !== notebookId) }));
  },

  toggleCardInNotebook: async (cardId, notebookId) => {
    const current = get().cardsById[cardId];
    if (!current) return;
    const existing = current.notebookIds ?? [];
    const nextIds = existing.includes(notebookId)
      ? existing.filter((id) => id !== notebookId)
      : [...existing, notebookId];
    await get().updateCardMeta(cardId, { notebookIds: nextIds });
  },

  recordCardReview: async (cardId, confidence, durationMs = 15000) => {
    const repo = getKnowledgeRepository();
    const now = Date.now();
    await repo.logReview({
      id: `rev-${crypto.randomUUID()}`,
      cardId,
      reviewedAt: now,
      confidence,
      durationMs,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'local_only',
      version: 1,
    });

    const current = get().cardsById[cardId];
    if (!current) return;
    const sm2 = calculateSm2({
      easeFactor: current.easeFactor,
      intervalDays: current.intervalDays,
      repetitions: current.repetitions,
      confidence,
      now,
    });
    const updated: KnowledgeCardMeta = {
      ...current,
      reviewCount: current.reviewCount + 1,
      lastReviewedAt: now,
      nextReviewAt: sm2.nextReviewAt,
      easeFactor: sm2.easeFactor,
      intervalDays: sm2.intervalDays,
      repetitions: sm2.repetitions,
      updatedAt: now,
    };

    set((s) => ({
      cardsById: { ...s.cardsById, [cardId]: updated },
      activeFullCard:
        s.activeFullCard?.meta.id === cardId
          ? { ...s.activeFullCard, meta: updated }
          : s.activeFullCard,
      secondaryFullCard:
        s.secondaryFullCard?.meta.id === cardId
          ? { ...s.secondaryFullCard, meta: updated }
          : s.secondaryFullCard,
    }));
  },

  saveStudySession: async (durationSeconds, mode) => {
    const repo = getKnowledgeRepository();
    const state = get();
    const now = Date.now();
    const session: StudySession = {
      id: `sess-${crypto.randomUUID()}`,
      workspaceId: state.activeWorkspaceId ?? 'default',
      disciplineId: state.selectedHierarchyId,
      startedAt: now - durationSeconds * 1000,
      endedAt: now,
      durationSeconds,
      mode,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'local_only',
      version: 1,
    };
    await repo.logStudySession(session);
    set((s) => ({ studySessions: [session, ...s.studySessions] }));
  },

  updateCanvasEdge: async (edgeId, patch) => {
    const repo = getKnowledgeRepository();
    const target = get().canvasEdges.find((e) => e.id === edgeId);
    if (!target) return;
    const updated: CanvasConnection = {
      ...target,
      ...patch,
      updatedAt: Date.now(),
      version: target.version + 1,
      syncStatus: 'pending_push',
    };
    set((s) => ({
      canvasEdges: s.canvasEdges.map((e) => (e.id === edgeId ? updated : e)),
    }));
    await repo.saveCanvasConnection(updated);
  },

  deleteCanvasEdge: async (edgeId) => {
    const repo = getKnowledgeRepository();
    set((s) => ({
      canvasEdges: s.canvasEdges.filter((e) => e.id !== edgeId),
    }));
    await repo.deleteCanvasConnection(edgeId);
  },

  renameHierarchyItem: async (id, title) => {
    const clean = title.trim();
    if (!clean) return;
    await get().updateHierarchyItem(id, { title: clean });
  },

  updateHierarchyItem: async (id, patch) => {
    const repo = getKnowledgeRepository();
    const target = get().hierarchy.find((h) => h.id === id);
    if (!target) return;

    const cleanPatch = { ...patch };
    if (cleanPatch.title !== undefined) {
      const trimmed = cleanPatch.title.trim();
      if (!trimmed) delete cleanPatch.title;
      else cleanPatch.title = trimmed;
    }

    const updated: HierarchyNode = {
      ...target,
      ...cleanPatch,
      updatedAt: Date.now(),
      version: target.version + 1,
      syncStatus: 'pending_push',
    };

    set((s) => ({
      hierarchy: s.hierarchy.map((h) => (h.id === id ? updated : h)),
    }));
    await repo.saveHierarchyNode(updated);
  },

  restoreCardBundle: async (full, nodes, edges) => {
    const repo = getKnowledgeRepository();
    const now = Date.now();
    const restoredMeta: KnowledgeCardMeta = { ...full.meta, deletedAt: null, updatedAt: now };
    const restoredNodes = nodes.map((n) => ({ ...n, deletedAt: null, updatedAt: now }));
    const restoredEdges = edges.map((e) => ({ ...e, deletedAt: null, updatedAt: now }));

    await repo.saveCard(restoredMeta, full.content);
    if (restoredNodes.length > 0) await repo.upsertCanvasNodes(restoredNodes);
    await Promise.all(restoredEdges.map((e) => repo.saveCanvasConnection(e)));

    set((s) => ({
      cardsById: { ...s.cardsById, [restoredMeta.id]: restoredMeta },
      canvasNodes: [
        ...s.canvasNodes.filter((n) => !restoredNodes.some((rn) => rn.id === n.id)),
        ...restoredNodes,
      ],
      canvasEdges: [
        ...s.canvasEdges.filter((e) => !restoredEdges.some((re) => re.id === e.id)),
        ...restoredEdges,
      ],
    }));
  },

  addCanvasStroke: async (partial) => {
    const state = get();
    const workspaceId = state.activeWorkspaceId;
    if (!workspaceId) return null;
    const repo = getKnowledgeRepository();
    const scope = resolveOptionalHierarchyScope(state.hierarchy, state.selectedHierarchyId);
    const now = Date.now();
    const stroke: CanvasStroke = {
      ...scope,
      ...partial,
      id: `stk-${crypto.randomUUID()}`,
      workspaceId,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'local_only',
      version: 1,
    };
    set((s) => ({ canvasStrokes: [...s.canvasStrokes, stroke] }));
    await repo.saveCanvasStroke(stroke);
    return stroke;
  },

  deleteCanvasStroke: async (strokeId) => {
    const repo = getKnowledgeRepository();
    set((s) => ({ canvasStrokes: s.canvasStrokes.filter((st) => st.id !== strokeId) }));
    await repo.deleteCanvasStroke(strokeId);
  },

  restoreCanvasStroke: async (stroke) => {
    const repo = getKnowledgeRepository();
    const restored: CanvasStroke = { ...stroke, deletedAt: null, updatedAt: Date.now() };
    set((s) => ({
      canvasStrokes: [...s.canvasStrokes.filter((st) => st.id !== restored.id), restored],
    }));
    await repo.saveCanvasStroke(restored);
  },

  clearCanvasStrokes: async () => {
    const state = get();
    const workspaceId = state.activeWorkspaceId;
    if (!workspaceId) return;
    const repo = getKnowledgeRepository();

    if (!state.selectedHierarchyId) {
      set({ canvasStrokes: [] });
      await repo.clearWorkspaceStrokes(workspaceId);
      return;
    }

    // Limpa apenas os traços pertencentes ao contexto hierárquico ativo
    const toRemove = state.canvasStrokes.filter((st) =>
      matchesHierarchyContext(st, state.selectedHierarchyId, state.hierarchy)
    );
    const removeIds = new Set(toRemove.map((st) => st.id));
    set((s) => ({ canvasStrokes: s.canvasStrokes.filter((st) => !removeIds.has(st.id)) }));
    await Promise.all(toRemove.map((st) => repo.deleteCanvasStroke(st.id)));
  },

  restoreCanvasSnapshot: async (nodes, edges, strokes) => {
    const repo = getKnowledgeRepository();
    const state = get();
    const now = Date.now();

    const restoredNodes = nodes.map((n) => ({ ...n, deletedAt: null, updatedAt: now }));
    const restoredEdges = edges.map((e) => ({ ...e, deletedAt: null, updatedAt: now }));

    const nextNodeIds = new Set(restoredNodes.map((n) => n.id));
    const nextEdgeIds = new Set(restoredEdges.map((e) => e.id));
    const removedNodes = state.canvasNodes.filter((n) => !nextNodeIds.has(n.id));
    const removedEdges = state.canvasEdges.filter((e) => !nextEdgeIds.has(e.id));

    const ops: Promise<unknown>[] = [
      restoredNodes.length > 0 ? repo.upsertCanvasNodes(restoredNodes) : Promise.resolve(),
      ...restoredEdges.map((e) => repo.saveCanvasConnection(e)),
      ...removedNodes.map((n) => repo.deleteCanvasNode(n.id)),
      ...removedEdges.map((e) => repo.deleteCanvasConnection(e.id)),
    ];

    if (strokes !== undefined) {
      const restoredStrokes = strokes.map((st) => ({ ...st, deletedAt: null, updatedAt: now }));
      const nextStrokeIds = new Set(restoredStrokes.map((st) => st.id));
      const removedStrokes = state.canvasStrokes.filter((st) => !nextStrokeIds.has(st.id));

      ops.push(
        ...restoredStrokes.map((st) => repo.saveCanvasStroke(st)),
        ...removedStrokes.map((st) => repo.deleteCanvasStroke(st.id))
      );

      set({
        canvasNodes: restoredNodes,
        canvasEdges: restoredEdges,
        canvasStrokes: restoredStrokes,
      });
    } else {
      set({ canvasNodes: restoredNodes, canvasEdges: restoredEdges });
    }

    await Promise.all(ops);
  },

  persistNodePositions: async (updates) => {
    const repo = getKnowledgeRepository();
    const now = Date.now();
    const map = new Map(updates.map((u) => [u.id, u]));
    const modified: CanvasNodePosition[] = [];

    const nextNodes = get().canvasNodes.map((n) => {
      const upd = map.get(n.id);
      if (!upd) return n;
      const realPos = unprojectNodePosition(upd.id, upd.x, upd.y);
      const updated = { ...n, ...upd, x: realPos.x, y: realPos.y, updatedAt: now };
      modified.push(updated);
      return updated;
    });

    set({ canvasNodes: nextNodes });
    if (modified.length > 0) {
      await repo.upsertCanvasNodes(modified);
    }
  },

  addCanvasEdge: async (sourceNodeId, targetNodeId, label, options) => {
    const repo = getKnowledgeRepository();
    const workspaceId = get().activeWorkspaceId!;
    const now = Date.now();
    const edge: CanvasConnection = {
      id: `edge-${crypto.randomUUID()}`,
      workspaceId,
      sourceNodeId,
      targetNodeId,
      sourceHandle: options?.sourceHandle,
      targetHandle: options?.targetHandle,
      edgeType: options?.edgeType ?? 'smoothstep',
      routingMode: 'auto',
      waypoints: [],
      lineStyle: options?.lineStyle ?? (options?.style === 'dashed' ? 'dashed' : 'solid'),
      strokeWidth: options?.strokeWidth ?? 2,
      arrowStart: options?.arrowStart ?? 'none',
      arrowEnd: options?.arrowEnd ?? 'arrowclosed',
      label,
      style: options?.style ?? 'solid',
      color: options?.color ?? '#6366f1',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'local_only',
      version: 1,
    };

    set((s) => ({ canvasEdges: [...s.canvasEdges, edge] }));
    await repo.saveCanvasConnection(edge);
  },

  updateCanvasEdgesBulk: async (edges) => {
    const repo = getKnowledgeRepository();
    set({ canvasEdges: edges });
    await Promise.all(edges.map((e) => repo.saveCanvasConnection(e)));
  },

  createWorkspace: async (name: string, icon = '📚') => {
    const repo = getKnowledgeRepository();
    const now = Date.now();
    const ws: Workspace = {
      id: `ws-${crypto.randomUUID()}`,
      name,
      icon,
      color: '#6366f1',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'local_only',
      version: 1,
    };
    await repo.saveWorkspace(ws);
    set((s) => ({ workspaces: [...s.workspaces, ws] }));
    await get().selectWorkspace(ws.id);
  },

  updateWorkspaceBookConfig: async (patch) => {
    const state = get();
    const ws = state.workspaces.find((w) => w.id === state.activeWorkspaceId);
    if (!ws) return;
    const repo = getKnowledgeRepository();
    const now = Date.now();
    const updated: Workspace = {
      ...ws,
      bookConfig: {
        ...ws.bookConfig,
        ...patch,
        updatedAt: now,
      },
      updatedAt: now,
      version: ws.version + 1,
      syncStatus: 'pending_push',
    };
    set((s) => ({
      workspaces: s.workspaces.map((w) => (w.id === ws.id ? updated : w)),
    }));
    await repo.saveWorkspace(updated);
  },

  createCanvasGroup: async (
    x: number,
    y: number,
    label = 'Novo Agrupamento',
    width = 640,
    height = 360
  ) => {
    const state = get();
    const repo = getKnowledgeRepository();
    const workspaceId = state.activeWorkspaceId!;
    const scope = resolveOptionalHierarchyScope(state.hierarchy, state.selectedHierarchyId);
    const now = Date.now();
    const group: CanvasNodePosition = {
      id: `grp-${crypto.randomUUID()}`,
      workspaceId,
      nodeType: 'group',
      ...scope,
      label,
      color: '#6366f1',
      bgColor: '#6366f1',
      bgOpacity: 'subtle',
      borderStyle: 'dashed',
      borderWidth: 'medium',
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'local_only',
      version: 1,
    };
    await repo.upsertCanvasNodes([group]);
    set((s) => ({ canvasNodes: [...s.canvasNodes, group] }));
    return group.id;
  },

  createCanvasImage: async ({
    x,
    y,
    blobId,
    width,
    height,
    caption = '',
    borderStyle = 'solid',
    keepAspectRatio = false,
  }) => {
    const state = get();
    const workspaceId = state.activeWorkspaceId;
    if (!workspaceId) return null;
    const repo = getKnowledgeRepository();
    const scope = resolveOptionalHierarchyScope(state.hierarchy, state.selectedHierarchyId);
    const now = Date.now();
    const imgNode: CanvasNodePosition = {
      id: `img-${crypto.randomUUID()}`,
      workspaceId,
      nodeType: 'image',
      ...scope,
      blobId,
      caption,
      borderStyle,
      borderWidth: 'thin',
      color: '#3f3f46',
      imageFit: 'contain',
      keepAspectRatio,
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'local_only',
      version: 1,
    };
    await repo.upsertCanvasNodes([imgNode]);
    set((s) => ({ canvasNodes: [...s.canvasNodes, imgNode] }));
    return imgNode.id;
  },

  updateCanvasNode: async (nodeId, patch) => {
    const repo = getKnowledgeRepository();
    const target = get().canvasNodes.find((n) => n.id === nodeId);
    if (!target) return;
    const updated: CanvasNodePosition = {
      ...target,
      ...patch,
      updatedAt: Date.now(),
      version: target.version + 1,
      syncStatus: 'pending_push',
    };
    set((s) => ({
      canvasNodes: s.canvasNodes.map((n) => (n.id === nodeId ? updated : n)),
    }));
    await repo.upsertCanvasNodes([updated]);
  },

  createCanvasText: async ({ x, y, preset = 'plain', initialText = '' }) => {
    const state = get();
    const workspaceId = state.activeWorkspaceId;
    if (!workspaceId) return null;
    const repo = getKnowledgeRepository();
    const scope = resolveOptionalHierarchyScope(state.hierarchy, state.selectedHierarchyId);
    const now = Date.now();

    const presetStyles: Record<
      'plain' | 'heading' | 'sticky' | 'callout',
      Partial<CanvasNodePosition>
    > = {
      plain: {
        width: 280,
        height: 0,
        bgColor: '#6366f1',
        bgOpacity: 'transparent',
        borderStyle: 'none',
        borderWidth: 'thin',
        borderRadius: 'xl',
        color: '#6366f1',
        fontSize: 15,
        typography: { fontSize: 15, lineHeight: 1.48, paragraphSpacing: 6 },
        textAlign: 'left',
        padding: 'sm',
      },
      heading: {
        width: 380,
        height: 0,
        bgColor: '#6366f1',
        bgOpacity: 'transparent',
        borderStyle: 'none',
        borderWidth: 'thin',
        borderRadius: 'xl',
        color: '#6366f1',
        fontSize: 26,
        typography: { fontSize: 26, lineHeight: 1.25, paragraphSpacing: 4 },
        textAlign: 'left',
        padding: 'sm',
      },
      sticky: {
        width: 260,
        height: 180,
        bgColor: '#f59e0b',
        bgOpacity: 'tinted',
        borderStyle: 'solid',
        borderWidth: 'thin',
        borderRadius: 'xl',
        color: '#f59e0b',
        fontSize: 14,
        typography: { fontSize: 14, lineHeight: 1.48, paragraphSpacing: 6 },
        textAlign: 'left',
        padding: 'md',
      },
      callout: {
        width: 340,
        height: 0,
        bgColor: '#6366f1',
        bgOpacity: 'subtle',
        borderStyle: 'solid',
        borderWidth: 'medium',
        borderRadius: 'xl',
        color: '#6366f1',
        fontSize: 14,
        typography: { fontSize: 14, lineHeight: 1.5, paragraphSpacing: 6 },
        textAlign: 'left',
        padding: 'md',
      },
    };

    const style = presetStyles[preset];
    const textJson: Record<string, unknown> =
      preset === 'heading'
        ? {
            type: 'doc',
            content: [
              {
                type: 'heading',
                attrs: { level: 1 },
                content: initialText ? [{ type: 'text', text: initialText }] : [],
              },
            ],
          }
        : {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: initialText ? [{ type: 'text', text: initialText }] : [],
              },
            ],
          };

    const textNode: CanvasNodePosition = {
      id: `txt-${crypto.randomUUID()}`,
      workspaceId,
      nodeType: 'text',
      ...scope,
      ...style,
      textJson,
      plainText: initialText,
      x: Math.round(x),
      y: Math.round(y),
      width: style.width ?? 280,
      height: style.height ?? 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'local_only',
      version: 1,
    };

    await repo.upsertCanvasNodes([textNode]);
    set((s) => ({ canvasNodes: [...s.canvasNodes, textNode] }));
    return textNode.id;
  },

  duplicateCanvasText: async (nodeId) => {
    const target = get().canvasNodes.find((n) => n.id === nodeId && n.nodeType === 'text');
    if (!target) return null;
    const repo = getKnowledgeRepository();
    const now = Date.now();
    const copy: CanvasNodePosition = {
      ...target,
      id: `txt-${crypto.randomUUID()}`,
      x: Math.round(target.x + 36),
      y: Math.round(target.y + 36),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'local_only',
      version: 1,
    };
    await repo.upsertCanvasNodes([copy]);
    set((s) => ({ canvasNodes: [...s.canvasNodes, copy] }));
    return copy.id;
  },

  createCanvasTopic: async ({
    x,
    y,
    label = 'Novo Tópico',
    shape = 'rounded',
    color = '#6366f1',
    parentTopicId = null,
  }) => {
    const state = get();
    const workspaceId = state.activeWorkspaceId;
    if (!workspaceId) return null;
    const repo = getKnowledgeRepository();
    const scope = resolveOptionalHierarchyScope(state.hierarchy, state.selectedHierarchyId);
    const now = Date.now();

    const defaultDims: Record<TopicShape, { w: number; h: number }> = {
      rect: { w: 200, h: 72 },
      rounded: { w: 210, h: 74 },
      square: { w: 150, h: 150 },
      circle: { w: 150, h: 150 },
      ellipse: { w: 210, h: 108 },
      diamond: { w: 184, h: 132 },
      capsule: { w: 210, h: 64 },
      hexagon: { w: 200, h: 112 },
      cloud: { w: 268, h: 156 },
      banner: { w: 256, h: 80 },
      speech: { w: 230, h: 116 },
      'sticky-tape': { w: 224, h: 156 },
    };

    const dims = defaultDims[shape];
    const topicNode: CanvasNodePosition = {
      id: `top-${crypto.randomUUID()}`,
      workspaceId,
      nodeType: 'topic',
      ...scope,
      label,
      color,
      bgColor: color,
      bgOpacity: 'tinted',
      borderStyle: 'solid',
      borderWidth: 'medium',
      padding: 'sm',
      textAlign: 'center',
      fontSize: 15,
      sketch: shape === 'cloud' || shape === 'sticky-tape',
      typography: { fontSize: 15, lineHeight: 1.3, paragraphSpacing: 4 },
      topicConfig: {
        shape,
        shadow: 'md',
        doubleBorder: shape === 'cloud',
        parentTopicId,
        defaultEdgeStyle: {
          edgeType: 'default',
          color,
          lineStyle: 'solid',
        },
      },
      x: Math.round(x),
      y: Math.round(y),
      width: dims.w,
      height: dims.h,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'local_only',
      version: 1,
    };

    await repo.upsertCanvasNodes([topicNode]);
    set((s) => ({ canvasNodes: [...s.canvasNodes, topicNode] }));
    return topicNode.id;
  },

  createSubtopic: async (parentNodeId, options) => {
    const state = get();
    const workspaceId = state.activeWorkspaceId;
    const parent = state.canvasNodes.find((n) => n.id === parentNodeId);
    if (!workspaceId || !parent) return null;

    const repo = getKnowledgeRepository();
    const now = Date.now();

    // Calcula quantos filhos diretos já existem para distribuir verticalmente sem sobrepor
    const existingChildrenCount = state.canvasEdges.filter(
      (e) => e.sourceNodeId === parentNodeId
    ).length;

    const childShape: TopicShape = options?.shape ?? 'capsule';
    const childColor = parent.color ?? '#6366f1';
    const childW = childShape === 'diamond' ? 184 : childShape === 'circle' || childShape === 'square' ? 140 : 196;
    const childH = childShape === 'diamond' ? 128 : childShape === 'circle' || childShape === 'square' ? 140 : 62;

    const posX = Math.round(parent.x + (parent.width || 210) + 110);
    const posY = Math.round(parent.y + existingChildrenCount * (childH + 28) - (existingChildrenCount > 0 ? 14 : 0));

    const topicNode: CanvasNodePosition = {
      id: `top-${crypto.randomUUID()}`,
      workspaceId,
      nodeType: 'topic',
      disciplineId: parent.disciplineId ?? null,
      subjectId: parent.subjectId ?? null,
      subsubjectId: parent.subsubjectId ?? null,
      topicId: parent.topicId ?? null,
      label: options?.label ?? 'Subtópico',
      color: childColor,
      bgColor: childColor,
      bgOpacity: 'subtle',
      borderStyle: 'solid',
      borderWidth: 'thin',
      padding: 'sm',
      textAlign: 'center',
      fontSize: 14,
      typography: { fontSize: 14, lineHeight: 1.3, paragraphSpacing: 4 },
      topicConfig: {
        shape: childShape,
        shadow: 'sm',
        parentTopicId: parent.id,
        defaultEdgeStyle: parent.topicConfig?.defaultEdgeStyle ?? {
          edgeType: 'default',
          color: childColor,
          lineStyle: 'solid',
        },
      },
      x: posX,
      y: posY,
      width: childW,
      height: childH,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'local_only',
      version: 1,
    };

    const edgePref = parent.topicConfig?.defaultEdgeStyle;
    const edge: CanvasConnection = {
      id: `edge-${crypto.randomUUID()}`,
      workspaceId,
      sourceNodeId: parent.id,
      targetNodeId: topicNode.id,
      sourceHandle: 's-right',
      targetHandle: 't-left',
      edgeType: edgePref?.edgeType ?? 'default',
      routingMode: 'auto',
      waypoints: [],
      lineStyle: edgePref?.lineStyle ?? 'solid',
      strokeWidth: 2,
      arrowStart: 'none',
      arrowEnd: 'arrowclosed',
      label: options?.edgeLabel,
      style: edgePref?.lineStyle === 'dashed' ? 'dashed' : 'solid',
      color: edgePref?.color ?? childColor,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'local_only',
      version: 1,
    };

    await Promise.all([
      repo.upsertCanvasNodes([topicNode]),
      repo.saveCanvasConnection(edge),
    ]);

    set((s) => ({
      canvasNodes: [...s.canvasNodes, topicNode],
      canvasEdges: [...s.canvasEdges, edge],
    }));

    return { nodeId: topicNode.id, edgeId: edge.id };
  },

  duplicateCanvasTopic: async (nodeId) => {
    const target = get().canvasNodes.find((n) => n.id === nodeId && n.nodeType === 'topic');
    if (!target) return null;
    const repo = getKnowledgeRepository();
    const now = Date.now();
    const copy: CanvasNodePosition = {
      ...target,
      id: `top-${crypto.randomUUID()}`,
      x: Math.round(target.x + 40),
      y: Math.round(target.y + 40),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'local_only',
      version: 1,
    };
    await repo.upsertCanvasNodes([copy]);
    set((s) => ({ canvasNodes: [...s.canvasNodes, copy] }));
    return copy.id;
  },

  promoteTextNodeToCard: async (nodeId) => {
    const state = get();
    const textNode = state.canvasNodes.find((n) => n.id === nodeId && n.nodeType === 'text');
    const workspaceId = state.activeWorkspaceId;
    if (!textNode || !workspaceId) return null;

    const repo = getKnowledgeRepository();
    const now = Date.now();
    const rawPlain = (textNode.plainText ?? '').trim();
    const firstLine = rawPlain.split('\n').find((l) => l.trim().length > 0)?.trim() ?? '';
    const title = firstLine ? firstLine.slice(0, 64) : 'Nota Promovida do Canvas';

    const hexToCardColor = (hex?: string): KnowledgeCardMeta['color'] => {
      switch ((hex ?? '').toLowerCase()) {
        case '#f59e0b':
          return 'amber';
        case '#10b981':
          return 'emerald';
        case '#0ea5e9':
          return 'sky';
        case '#f43f5e':
          return 'rose';
        case '#6366f1':
        case '#a855f7':
          return 'violet';
        default:
          return 'default';
      }
    };

    // Preserva o escopo salvo no próprio texto livre ou usa o contexto ativo
    const fallbackChain = resolveHierarchyChain(state.hierarchy, state.selectedHierarchyId);
    const disciplineId = textNode.disciplineId || fallbackChain.disciplineId;
    const subjectId = textNode.subjectId || fallbackChain.subjectId;
    const subsubjectId = textNode.subsubjectId ?? fallbackChain.subsubjectId;
    const topicId = textNode.topicId ?? fallbackChain.topicId;

    const cardId = `card-${crypto.randomUUID()}`;
    const cardNodeId = `node-${crypto.randomUUID()}`;

    const meta: KnowledgeCardMeta = {
      id: cardId,
      workspaceId,
      disciplineId,
      subjectId,
      subsubjectId,
      topicId,
      title,
      excerpt: rawPlain ? rawPlain.slice(0, 220) : 'Clique para editar seu conhecimento...',
      notes: textNode.callout?.text ?? '',
      callout: textNode.callout,
      typography: textNode.typography ?? (textNode.fontSize ? { fontSize: textNode.fontSize } : undefined),
      tags: [],
      color:
        textNode.bgOpacity && textNode.bgOpacity !== 'transparent'
          ? hexToCardColor(textNode.bgColor ?? textNode.color)
          : 'default',
      isFavorite: false,
      isPinned: false,
      importance: 'normal',
      reviewCount: 0,
      lastReviewedAt: null,
      nextReviewAt: null,
      outgoingLinkIds: [],
      searchTokens: buildSearchTokens([title, rawPlain, textNode.callout?.text ?? '']),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'local_only',
      version: 1,
    };

    const content: KnowledgeCardContent = {
      cardId,
      tiptapJson: textNode.textJson ?? {
        type: 'doc',
        content: [{ type: 'paragraph', content: rawPlain ? [{ type: 'text', text: rawPlain }] : [] }],
      },
      plainText: rawPlain || title,
      flashcards: [],
      attachments: [],
      updatedAt: now,
    };

    const cardNode: CanvasNodePosition = {
      id: cardNodeId,
      workspaceId,
      cardId,
      nodeType: 'knowledgeCard',
      disciplineId,
      subjectId,
      subsubjectId,
      topicId,
      sizingMode: textNode.sizingMode ?? 'auto',
      padding: textNode.padding ?? 'md',
      x: textNode.x,
      y: textNode.y,
      width: Math.max(320, textNode.width || 350),
      height: textNode.sizingMode === 'custom' ? Math.max(200, textNode.height || 240) : 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'local_only',
      version: 1,
    };

    const updatedEdges = state.canvasEdges.map((edge) => {
      if (edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId) return edge;
      return {
        ...edge,
        sourceNodeId: edge.sourceNodeId === nodeId ? cardNodeId : edge.sourceNodeId,
        targetNodeId: edge.targetNodeId === nodeId ? cardNodeId : edge.targetNodeId,
        updatedAt: now,
        version: edge.version + 1,
        syncStatus: 'pending_push' as const,
      };
    });

    const changedEdges = updatedEdges.filter((e, i) => e !== state.canvasEdges[i]);

    await Promise.all([
      repo.saveCard(meta, content),
      repo.upsertCanvasNodes([cardNode]),
      repo.deleteCanvasNode(nodeId),
      ...changedEdges.map((e) => repo.saveCanvasConnection(e)),
    ]);

    set((s) => ({
      cardsById: { ...s.cardsById, [cardId]: meta },
      canvasNodes: [...s.canvasNodes.filter((n) => n.id !== nodeId), cardNode],
      canvasEdges: updatedEdges,
    }));

    return cardId;
  },

  convertCardToTextNode: async (cardNodeId) => {
    const state = get();
    const cardNode = state.canvasNodes.find(
      (n) => n.id === cardNodeId && n.nodeType === 'knowledgeCard' && n.cardId
    );
    const workspaceId = state.activeWorkspaceId;
    if (!cardNode || !cardNode.cardId || !workspaceId) return null;

    const repo = getKnowledgeRepository();
    const fullCard = await repo.getFullCard(cardNode.cardId);
    if (!fullCard) return null;

    const now = Date.now();
    const { meta, content } = fullCard;
    const textNodeId = `txt-${crypto.randomUUID()}`;

    const cardColorToHex: Record<KnowledgeCardMeta['color'], string> = {
      default: '#6366f1',
      amber: '#f59e0b',
      emerald: '#10b981',
      sky: '#0ea5e9',
      rose: '#f43f5e',
      violet: '#8b5cf6',
    };

    // Preserva o título do card no topo do documento caso ainda não esteja presente no primeiro bloco
    const existingBlocks = Array.isArray(content.tiptapJson?.content)
      ? (content.tiptapJson.content as Array<Record<string, unknown>>)
      : [];
    const cleanTitle = meta.title.trim();
    const plainTrimmed = (content.plainText ?? '').trim();
    const alreadyStartsWithTitle =
      cleanTitle.length > 0 && plainTrimmed.toLowerCase().startsWith(cleanTitle.toLowerCase());

    const mergedBlocks: Array<Record<string, unknown>> =
      cleanTitle && !alreadyStartsWithTitle
        ? [
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: cleanTitle }],
            },
            ...existingBlocks,
          ]
        : existingBlocks.length > 0
        ? existingBlocks
        : [{ type: 'paragraph', content: cleanTitle ? [{ type: 'text', text: cleanTitle }] : [] }];

    const mergedPlainText =
      cleanTitle && !alreadyStartsWithTitle
        ? [cleanTitle, plainTrimmed].filter(Boolean).join('\n')
        : plainTrimmed || cleanTitle;

    const resolvedCallout = resolveCardCallout(meta);
    const hasCalloutContent = Boolean((resolvedCallout.text ?? '').trim());

    const typo = meta.typography ?? { ...DEFAULT_CARD_TYPOGRAPHY };
    const accentHex = cardColorToHex[meta.color] ?? '#6366f1';

    const textNode: CanvasNodePosition = {
      id: textNodeId,
      workspaceId,
      nodeType: 'text',
      disciplineId: meta.disciplineId === 'unassigned' ? null : meta.disciplineId,
      subjectId: meta.subjectId === 'unassigned' ? null : meta.subjectId,
      subsubjectId: meta.subsubjectId ?? null,
      topicId: meta.topicId ?? null,
      color: accentHex,
      bgColor: accentHex,
      bgOpacity: meta.color === 'default' ? 'subtle' : 'tinted',
      borderStyle: meta.borderStyle ?? 'solid',
      borderWidth: meta.borderWidth ?? 'thin',
      borderRadius: 'xl',
      padding: cardNode.padding ?? 'md',
      sizingMode: cardNode.sizingMode ?? 'auto',
      typography: typo,
      fontSize: typo.fontSize ?? DEFAULT_CARD_TYPOGRAPHY.fontSize,
      callout: hasCalloutContent ? resolvedCallout : undefined,
      textAlign: 'left',
      textJson: { type: 'doc', content: mergedBlocks },
      plainText: mergedPlainText,
      x: cardNode.x,
      y: cardNode.y,
      width: Math.max(220, cardNode.width || 340),
      height: cardNode.sizingMode === 'custom' ? cardNode.height : 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'local_only',
      version: 1,
    };

    // Guarda snapshot das arestas originais para o Desfazer e remapeia todas para o novo Texto Livre
    const affectedEdges = state.canvasEdges.filter(
      (e) => e.sourceNodeId === cardNodeId || e.targetNodeId === cardNodeId
    );
    const originalEdgesSnapshot = affectedEdges.map((e) => ({ ...e }));

    const updatedEdges = state.canvasEdges.map((edge) => {
      if (edge.sourceNodeId !== cardNodeId && edge.targetNodeId !== cardNodeId) return edge;
      return {
        ...edge,
        sourceNodeId: edge.sourceNodeId === cardNodeId ? textNodeId : edge.sourceNodeId,
        targetNodeId: edge.targetNodeId === cardNodeId ? textNodeId : edge.targetNodeId,
        updatedAt: now,
        version: edge.version + 1,
        syncStatus: 'pending_push' as const,
      };
    });

    const changedEdges = updatedEdges.filter((e, i) => e !== state.canvasEdges[i]);

    await Promise.all([
      repo.upsertCanvasNodes([textNode]),
      ...changedEdges.map((e) => repo.saveCanvasConnection(e)),
      repo.softDeleteCard(meta.id),
    ]);

    set((s) => {
      const nextCards = { ...s.cardsById };
      delete nextCards[meta.id];
      return {
        cardsById: nextCards,
        canvasNodes: [...s.canvasNodes.filter((n) => n.id !== cardNodeId), textNode],
        canvasEdges: updatedEdges,
        activeCardId: s.activeCardId === meta.id ? null : s.activeCardId,
        activeFullCard: s.activeFullCard?.meta.id === meta.id ? null : s.activeFullCard,
        secondaryCardId: s.secondaryCardId === meta.id ? null : s.secondaryCardId,
        secondaryFullCard: s.secondaryFullCard?.meta.id === meta.id ? null : s.secondaryFullCard,
      };
    });

    return {
      textNodeId,
      undoBundle: {
        fullCard,
        canvasNode: { ...cardNode },
        edges: originalEdgesSnapshot,
      },
    };
  },

  undoConvertCardToText: async (textNodeId, undoBundle) => {
    const repo = getKnowledgeRepository();
    const now = Date.now();
    const restoredMeta: KnowledgeCardMeta = {
      ...undoBundle.fullCard.meta,
      deletedAt: null,
      updatedAt: now,
    };
    const restoredNode: CanvasNodePosition = {
      ...undoBundle.canvasNode,
      deletedAt: null,
      updatedAt: now,
    };
    const restoredEdges = undoBundle.edges.map((e) => ({
      ...e,
      deletedAt: null,
      updatedAt: now,
    }));

    const restoredEdgeMap = new Map(restoredEdges.map((e) => [e.id, e]));

    await Promise.all([
      repo.saveCard(restoredMeta, undoBundle.fullCard.content),
      repo.upsertCanvasNodes([restoredNode]),
      ...restoredEdges.map((e) => repo.saveCanvasConnection(e)),
      repo.deleteCanvasNode(textNodeId),
    ]);

    set((s) => ({
      cardsById: { ...s.cardsById, [restoredMeta.id]: restoredMeta },
      canvasNodes: [
        ...s.canvasNodes.filter((n) => n.id !== textNodeId && n.id !== restoredNode.id),
        restoredNode,
      ],
      canvasEdges: s.canvasEdges.map((e) => restoredEdgeMap.get(e.id) ?? e),
    }));
  },

  renameCanvasGroup: async (groupId: string, label: string) => {
    const repo = getKnowledgeRepository();
    const target = get().canvasNodes.find((n) => n.id === groupId);
    if (!target) return;
    const updated = { ...target, label, updatedAt: Date.now() };
    set((s) => ({
      canvasNodes: s.canvasNodes.map((n) => (n.id === groupId ? updated : n)),
    }));
    await repo.upsertCanvasNodes([updated]);
  },

  deleteHierarchyItem: async (id: string) => {
    const state = get();
    const repo = getKnowledgeRepository();
    const toDeleteIds = getDescendantHierarchyIds(state.hierarchy, id);

    await Promise.all(Array.from(toDeleteIds).map((hid) => repo.deleteHierarchyNode(hid)));

    set((s) => ({
      hierarchy: s.hierarchy.filter((h) => !toDeleteIds.has(h.id)),
      selectedHierarchyId:
        s.selectedHierarchyId && toDeleteIds.has(s.selectedHierarchyId)
          ? null
          : s.selectedHierarchyId,
    }));
  },

  createHierarchyItem: async (partial) => {
    const repo = getKnowledgeRepository();
    const now = Date.now();
    const node: HierarchyNode = {
      ...partial,
      id: `hier-${crypto.randomUUID()}`,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'local_only',
      version: 1,
    };
    await repo.saveHierarchyNode(node);
    set((s) => ({ hierarchy: [...s.hierarchy, node] }));
    return node;
  },
}));