import {
  CanvasConnection,
  CanvasNodePosition,
  CanvasStroke,
  HierarchyNode,
  HierarchyScope,
  KnowledgeCardMeta,
} from '@/domains/knowledge/types';
import {
  getDescendantHierarchyIds,
  getHierarchyDepth,
  getHierarchyLevelLabel,
  getNextHierarchyLevel,
  getRootDiscipline,
} from '@/domains/knowledge/utils/hierarchyContext';

export interface ExplorerMiniMapData {
  nodes: CanvasNodePosition[];
  edges: CanvasConnection[];
  strokes: CanvasStroke[];
  cardsById: Record<string, KnowledgeCardMeta>;
}

export interface ExplorerFolderItem {
  id: string;
  node: HierarchyNode | null; // null = pasta especial "Notas Gerais" (itens sem disciplina)
  title: string;
  accentColor: string;
  childCount: number;
  childLabel: string;
  childPreviews: Array<{ id: string; title: string }>;
  itemCount: number;
  dueCount: number;
  isGeneralFallback?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExplorerSlidePage {
  id: string;
  hierarchyId: string | null; // null quando for a lâmina de itens diretos do nível pai
  title: string;
  levelLabel: string;
  subChildCount: number;
  itemCount: number;
  dueCount: number;
  isDirectMap?: boolean;
  preview: ExplorerMiniMapData;
}

export interface ExplorerSlideCardItem {
  id: string;
  node: HierarchyNode | null; // null = cartão de "Itens Diretos" do nível pai
  title: string;
  depth: number;
  indexInLevel: number;
  levelLabel: string;
  accentColor: string;
  subChildCount: number;
  itemCount: number;
  dueCount: number;
  isDirectParentSlice?: boolean;
  slides: ExplorerSlidePage[];
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasExplorerLayoutResult {
  mode: 'folders' | 'slides' | 'map';
  folders: ExplorerFolderItem[];
  slides: ExplorerSlideCardItem[];
  hasDirectItemsAtCurrentLevel: boolean;
}

const ACCENT_PALETTE = [
  '#6366f1',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#f43f5e',
  '#a855f7',
  '#14b8a6',
  '#f97316',
];

function deterministicColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return ACCENT_PALETTE[hash % ACCENT_PALETTE.length];
}

function resolveAccentForNode(hierarchy: HierarchyNode[], node: HierarchyNode): string {
  if (node.color) return node.color;
  const root = getRootDiscipline(hierarchy, node.id);
  if (root?.color) return root.color;
  return deterministicColor(root?.id ?? node.id);
}

function sortHierarchySiblings(list: HierarchyNode[]): HierarchyNode[] {
  return [...list].sort((a, b) => {
    if (Boolean(a.isPinned) !== Boolean(b.isPinned)) return a.isPinned ? -1 : 1;
    return a.order - b.order || a.createdAt - b.createdAt;
  });
}

function getNodeScope(
  node: CanvasNodePosition,
  cardsById: Record<string, KnowledgeCardMeta>
): HierarchyScope {
  if (node.nodeType === 'knowledgeCard' && node.cardId && cardsById[node.cardId]) {
    return cardsById[node.cardId];
  }
  return node;
}

function scopeMatchesIdSet(scope: HierarchyScope, idSet: Set<string>): boolean {
  const ids = [scope.disciplineId, scope.subjectId, scope.subsubjectId, scope.topicId];
  return ids.some((id) => Boolean(id && idSet.has(id)));
}

function collectBranchData(
  branchRootId: string,
  hierarchy: HierarchyNode[],
  cardsById: Record<string, KnowledgeCardMeta>,
  canvasNodes: CanvasNodePosition[],
  canvasEdges: CanvasConnection[],
  canvasStrokes: CanvasStroke[]
): { preview: ExplorerMiniMapData; itemCount: number; dueCount: number } {
  const allowed = getDescendantHierarchyIds(hierarchy, branchRootId);
  const now = Date.now();

  const nodes = canvasNodes.filter((cn) => {
    if (cn.nodeType === 'knowledgeCard' && (!cn.cardId || !cardsById[cn.cardId])) return false;
    return scopeMatchesIdSet(getNodeScope(cn, cardsById), allowed);
  });

  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = canvasEdges.filter(
    (e) => nodeIds.has(e.sourceNodeId) && nodeIds.has(e.targetNodeId)
  );
  const strokes = canvasStrokes.filter((st) => scopeMatchesIdSet(st, allowed));

  let dueCount = 0;
  for (const card of Object.values(cardsById)) {
    if (scopeMatchesIdSet(card, allowed) && card.nextReviewAt !== null && card.nextReviewAt <= now) {
      dueCount += 1;
    }
  }

  return {
    preview: { nodes, edges, strokes, cardsById },
    itemCount: nodes.length,
    dueCount,
  };
}

function collectDirectItemsNotInChildren(
  parentId: string | null,
  childIds: HierarchyNode[],
  hierarchy: HierarchyNode[],
  cardsById: Record<string, KnowledgeCardMeta>,
  canvasNodes: CanvasNodePosition[],
  canvasEdges: CanvasConnection[],
  canvasStrokes: CanvasStroke[]
): { preview: ExplorerMiniMapData; itemCount: number; dueCount: number } {
  const excludedDescendants = new Set<string>();
  for (const child of childIds) {
    getDescendantHierarchyIds(hierarchy, child.id).forEach((id) => excludedDescendants.add(id));
  }

  const parentSet = parentId ? new Set<string>([parentId]) : null;
  const now = Date.now();

  const belongsDirect = (scope: HierarchyScope): boolean => {
    if (scopeMatchesIdSet(scope, excludedDescendants)) return false;
    if (!parentSet) {
      // Raiz: itens verdadeiramente avulsos (sem disciplina ativa)
      return !scope.disciplineId || scope.disciplineId === 'unassigned';
    }
    return scopeMatchesIdSet(scope, parentSet);
  };

  const nodes = canvasNodes.filter((cn) => {
    if (cn.nodeType === 'knowledgeCard' && (!cn.cardId || !cardsById[cn.cardId])) return false;
    return belongsDirect(getNodeScope(cn, cardsById));
  });

  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = canvasEdges.filter(
    (e) => nodeIds.has(e.sourceNodeId) && nodeIds.has(e.targetNodeId)
  );
  const strokes = canvasStrokes.filter((st) => belongsDirect(st));

  let dueCount = 0;
  for (const card of Object.values(cardsById)) {
    if (belongsDirect(card) && card.nextReviewAt !== null && card.nextReviewAt <= now) {
      dueCount += 1;
    }
  }

  return {
    preview: { nodes, edges, strokes, cardsById },
    itemCount: nodes.length,
    dueCount,
  };
}

const FOLDER_W = 308;
const FOLDER_H = 196;
const FOLDER_GAP_X = 36;
const FOLDER_GAP_Y = 36;
const FOLDER_COLS = 3;

const SLIDE_W = 412;
const SLIDE_H = 318;
const SLIDE_GAP_X = 44;
const SLIDE_GAP_Y = 44;
const SLIDE_COLS = 3;

/**
 * Decide e calcula o modo espacial do Canvas:
 * 1) Raiz ("Todo o Conhecimento") com disciplinas ativas -> Pastas de Disciplinas
 * 2) Qualquer Disciplina / Assunto / Subassunto que possua filhos ativos -> Mini-Slides navegáveis
 * 3) Nível folha ("assunto fim") ou workspace sem disciplinas -> Mapa completo editável
 */
export function computeCanvasExplorerLayout(params: {
  hierarchy: HierarchyNode[];
  selectedHierarchyId: string | null;
  cardsById: Record<string, KnowledgeCardMeta>;
  canvasNodes: CanvasNodePosition[];
  canvasEdges: CanvasConnection[];
  canvasStrokes: CanvasStroke[];
}): CanvasExplorerLayoutResult {
  const { hierarchy, selectedHierarchyId, cardsById, canvasNodes, canvasEdges, canvasStrokes } =
    params;

  // MODO 1: RAIZ ("Todo o Conhecimento") -> PASTAS DE DISCIPLINAS
  if (selectedHierarchyId === null) {
    const activeDisciplines = sortHierarchySiblings(
      hierarchy.filter((h) => h.parentId === null && !h.isArchived)
    );

    if (activeDisciplines.length === 0) {
      return { mode: 'map', folders: [], slides: [], hasDirectItemsAtCurrentLevel: false };
    }

    const directGeneral = collectDirectItemsNotInChildren(
      null,
      activeDisciplines,
      hierarchy,
      cardsById,
      canvasNodes,
      canvasEdges,
      canvasStrokes
    );

    const folders: ExplorerFolderItem[] = activeDisciplines.map((disc, idx) => {
      const col = idx % FOLDER_COLS;
      const row = Math.floor(idx / FOLDER_COLS);
      const subjects = sortHierarchySiblings(
        hierarchy.filter((h) => h.parentId === disc.id && !h.isArchived)
      );
      const branch = collectBranchData(
        disc.id,
        hierarchy,
        cardsById,
        canvasNodes,
        canvasEdges,
        canvasStrokes
      );

      return {
        id: `exp-folder-${disc.id}`,
        node: disc,
        title: disc.title,
        accentColor: resolveAccentForNode(hierarchy, disc),
        childCount: subjects.length,
        childLabel: subjects.length === 1 ? 'assunto' : 'assuntos',
        childPreviews: subjects.slice(0, 3).map((s) => ({ id: s.id, title: s.title })),
        itemCount: branch.itemCount,
        dueCount: branch.dueCount,
        x: col * (FOLDER_W + FOLDER_GAP_X),
        y: row * (FOLDER_H + FOLDER_GAP_Y),
        width: FOLDER_W,
        height: FOLDER_H,
      };
    });

    if (directGeneral.itemCount > 0) {
      const idx = folders.length;
      const col = idx % FOLDER_COLS;
      const row = Math.floor(idx / FOLDER_COLS);
      folders.push({
        id: 'exp-folder-general',
        node: null,
        title: 'Notas Gerais',
        accentColor: '#71717a',
        childCount: 0,
        childLabel: 'itens avulsos',
        childPreviews: [],
        itemCount: directGeneral.itemCount,
        dueCount: directGeneral.dueCount,
        isGeneralFallback: true,
        x: col * (FOLDER_W + FOLDER_GAP_X),
        y: row * (FOLDER_H + FOLDER_GAP_Y),
        width: FOLDER_W,
        height: FOLDER_H,
      });
    }

    return {
      mode: 'folders',
      folders,
      slides: [],
      hasDirectItemsAtCurrentLevel: directGeneral.itemCount > 0,
    };
  }

  // MODO 2: DENTRO DE UM NÍVEL PAI COM FILHOS ATIVOS -> QUADROS COM MINI-SLIDES NAVEGÁVEIS
  const currentParent = hierarchy.find((h) => h.id === selectedHierarchyId) ?? null;
  const activeChildren = sortHierarchySiblings(
    hierarchy.filter((h) => h.parentId === selectedHierarchyId && !h.isArchived)
  );

  if (!currentParent || activeChildren.length === 0) {
    return { mode: 'map', folders: [], slides: [], hasDirectItemsAtCurrentLevel: false };
  }

  const directParentData = collectDirectItemsNotInChildren(
    selectedHierarchyId,
    activeChildren,
    hierarchy,
    cardsById,
    canvasNodes,
    canvasEdges,
    canvasStrokes
  );

  const slideCards: ExplorerSlideCardItem[] = activeChildren.map((child, idx) => {
    const col = idx % SLIDE_COLS;
    const row = Math.floor(idx / SLIDE_COLS);
    const childDepth = getHierarchyDepth(hierarchy, child.id);
    const childAccent = resolveAccentForNode(hierarchy, child);
    const childBranch = collectBranchData(
      child.id,
      hierarchy,
      cardsById,
      canvasNodes,
      canvasEdges,
      canvasStrokes
    );

    const subChildren = sortHierarchySiblings(
      hierarchy.filter((h) => h.parentId === child.id && !h.isArchived)
    );

    const slides: ExplorerSlidePage[] = [];

    if (subChildren.length === 0) {
      // Assunto/Subassunto folha: mostra o próprio mapa em miniatura
      slides.push({
        id: `slide-${child.id}`,
        hierarchyId: child.id,
        title: child.title,
        levelLabel: getHierarchyLevelLabel(child.level, childDepth),
        subChildCount: 0,
        itemCount: childBranch.itemCount,
        dueCount: childBranch.dueCount,
        preview: childBranch.preview,
      });
    } else {
      // Possui subníveis: cria slides passáveis para cada subassunto/tópico interno
      const directChildOnly = collectDirectItemsNotInChildren(
        child.id,
        subChildren,
        hierarchy,
        cardsById,
        canvasNodes,
        canvasEdges,
        canvasStrokes
      );

      if (directChildOnly.itemCount > 0) {
        slides.push({
          id: `slide-direct-${child.id}`,
          hierarchyId: child.id,
          title: `Visão Geral • ${child.title}`,
          levelLabel: getHierarchyLevelLabel(child.level, childDepth),
          subChildCount: subChildren.length,
          itemCount: directChildOnly.itemCount,
          dueCount: directChildOnly.dueCount,
          preview: directChildOnly.preview,
        });
      }

      for (const sub of subChildren) {
        const subDepth = getHierarchyDepth(hierarchy, sub.id);
        const subBranch = collectBranchData(
          sub.id,
          hierarchy,
          cardsById,
          canvasNodes,
          canvasEdges,
          canvasStrokes
        );
        const grandChildrenCount = hierarchy.filter(
          (h) => h.parentId === sub.id && !h.isArchived
        ).length;

        slides.push({
          id: `slide-${sub.id}`,
          hierarchyId: sub.id,
          title: sub.title,
          levelLabel: getHierarchyLevelLabel(sub.level, subDepth),
          subChildCount: grandChildrenCount,
          itemCount: subBranch.itemCount,
          dueCount: subBranch.dueCount,
          preview: subBranch.preview,
        });
      }
    }

    return {
      id: `exp-slide-${child.id}`,
      node: child,
      title: child.title,
      depth: childDepth,
      indexInLevel: idx,
      levelLabel: getHierarchyLevelLabel(child.level, childDepth),
      accentColor: childAccent,
      subChildCount: subChildren.length,
      itemCount: childBranch.itemCount,
      dueCount: childBranch.dueCount,
      slides,
      x: col * (SLIDE_W + SLIDE_GAP_X),
      y: row * (SLIDE_H + SLIDE_GAP_Y),
      width: SLIDE_W,
      height: SLIDE_H,
    };
  });

  // Se o próprio nível pai possuir cards/textos soltos fora dos filhos, mostra um slide dedicado para não perder nada
  if (directParentData.itemCount > 0) {
    const idx = slideCards.length;
    const col = idx % SLIDE_COLS;
    const row = Math.floor(idx / SLIDE_COLS);
    const parentDepth = getHierarchyDepth(hierarchy, currentParent.id);
    const parentAccent = resolveAccentForNode(hierarchy, currentParent);

    slideCards.push({
      id: `exp-slide-direct-${currentParent.id}`,
      node: null,
      title: `Mapa Direto • ${currentParent.title}`,
      depth: parentDepth,
      indexInLevel: idx,
      levelLabel: `Itens soltos em ${getHierarchyLevelLabel(currentParent.level, parentDepth)}`,
      accentColor: parentAccent,
      subChildCount: 0,
      itemCount: directParentData.itemCount,
      dueCount: directParentData.dueCount,
      isDirectParentSlice: true,
      slides: [
        {
          id: `slide-parent-direct-${currentParent.id}`,
          hierarchyId: null,
          title: `Itens diretos de ${currentParent.title}`,
          levelLabel: getHierarchyLevelLabel(
            getNextHierarchyLevel(currentParent.level),
            parentDepth + 1
          ),
          subChildCount: 0,
          itemCount: directParentData.itemCount,
          dueCount: directParentData.dueCount,
          isDirectMap: true,
          preview: directParentData.preview,
        },
      ],
      x: col * (SLIDE_W + SLIDE_GAP_X),
      y: row * (SLIDE_H + SLIDE_GAP_Y),
      width: SLIDE_W,
      height: SLIDE_H,
    });
  }

  return {
    mode: 'slides',
    folders: [],
    slides: slideCards,
    hasDirectItemsAtCurrentLevel: directParentData.itemCount > 0,
  };
}