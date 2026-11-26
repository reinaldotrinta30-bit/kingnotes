import {
  CanvasNodePosition,
  CanvasStroke,
  HierarchyNode,
  HierarchyScope,
  KnowledgeCardMeta,
} from '@/domains/knowledge/types';
import { getHierarchyBreadcrumb } from '@/domains/knowledge/utils/hierarchyContext';

export interface ProjectionOffset {
  dx: number;
  dy: number;
}

export interface PanoramaSectionFrame {
  id: string;
  bucketId: string;
  hierarchyId: string | null;
  title: string;
  subtitle: string;
  itemCount: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PanoramaLayoutResult {
  isPanorama: boolean;
  sections: PanoramaSectionFrame[];
  nodeOffsets: Map<string, ProjectionOffset>;
  strokeOffsets: Map<string, ProjectionOffset>;
}

const GENERAL_BUCKET_ID = '__general__';
const FRAME_PAD_X = 44;
const FRAME_PAD_TOP = 64;
const FRAME_PAD_BOTTOM = 44;
const MIN_FRAME_W = 420;
const MIN_FRAME_H = 300;
const GAP_X = 88;
const GAP_Y = 88;
const MAX_COLS_PER_ROW = 3;

// Registro em memória dos offsets ativos do Panorama para desprojetar coordenadas ao arrastar/redimensionar
const activeNodeOffsets = new Map<string, ProjectionOffset>();
const activeStrokeOffsets = new Map<string, ProjectionOffset>();

export function syncActiveProjectionOffsets(
  nodeOffsets: Map<string, ProjectionOffset>,
  strokeOffsets: Map<string, ProjectionOffset>
): void {
  activeNodeOffsets.clear();
  nodeOffsets.forEach((v, k) => activeNodeOffsets.set(k, v));

  activeStrokeOffsets.clear();
  strokeOffsets.forEach((v, k) => activeStrokeOffsets.set(k, v));
}

export function getNodeProjectionOffset(nodeId: string): ProjectionOffset {
  return activeNodeOffsets.get(nodeId) ?? { dx: 0, dy: 0 };
}

export function getStrokeProjectionOffset(strokeId: string): ProjectionOffset {
  return activeStrokeOffsets.get(strokeId) ?? { dx: 0, dy: 0 };
}

export function unprojectNodePosition(
  nodeId: string,
  displayX: number,
  displayY: number
): { x: number; y: number } {
  const offset = activeNodeOffsets.get(nodeId);
  if (!offset) {
    return { x: Math.round(displayX), y: Math.round(displayY) };
  }
  return {
    x: Math.round(displayX - offset.dx),
    y: Math.round(displayY - offset.dy),
  };
}

/** Gera ordem sequencial (DFS em pré-ordem) respeitando a ordem da árvore hierárquica */
function buildHierarchyOrderMap(hierarchy: HierarchyNode[]): Map<string, number> {
  const orderMap = new Map<string, number>();
  let index = 0;

  const visit = (parentId: string | null) => {
    const children = hierarchy
      .filter((h) => h.parentId === parentId)
      .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);

    for (const child of children) {
      orderMap.set(child.id, index++);
      visit(child.id);
    }
  };

  visit(null);
  return orderMap;
}

/** Determina o contexto mais específico existente para agrupar um item no Panorama */
function resolveBucketId(
  scope: HierarchyScope | null | undefined,
  hierarchyById: Map<string, HierarchyNode>
): string {
  if (!scope) return GENERAL_BUCKET_ID;
  const candidates = [scope.topicId, scope.subsubjectId, scope.subjectId, scope.disciplineId];
  for (const id of candidates) {
    if (id && hierarchyById.has(id)) return id;
  }
  return GENERAL_BUCKET_ID;
}

function getRootDisciplineId(
  bucketId: string,
  hierarchyById: Map<string, HierarchyNode>
): string {
  if (bucketId === GENERAL_BUCKET_ID) return GENERAL_BUCKET_ID;
  let cursor = hierarchyById.get(bucketId) ?? null;
  let rootId = bucketId;
  let guard = 0;

  while (cursor && guard < 10) {
    rootId = cursor.id;
    cursor = cursor.parentId ? hierarchyById.get(cursor.parentId) ?? null : null;
    guard += 1;
  }

  return rootId;
}

function getNodeBounds(node: CanvasNodePosition): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  const w =
    node.width && node.width > 0
      ? node.width
      : node.nodeType === 'group'
      ? 640
      : node.nodeType === 'text'
      ? 280
      : 350;
  const h =
    node.height && node.height > 0
      ? node.height
      : node.nodeType === 'group'
      ? 360
      : node.nodeType === 'text'
      ? 96
      : 240;

  return {
    minX: node.x,
    minY: node.y,
    maxX: node.x + w,
    maxY: node.y + h,
  };
}

interface BucketRaw {
  bucketId: string;
  hierarchyId: string | null;
  rootDisciplineId: string;
  orderIndex: number;
  title: string;
  subtitle: string;
  nodes: CanvasNodePosition[];
  strokes: CanvasStroke[];
  minX: number;
  minY: number;
  frameW: number;
  frameH: number;
}

/**
 * Organiza os mapas de cada assunto/tópico em sequência limpa quando o usuário
 * visualiza "Todo o Conhecimento" ou um nível pai com múltiplos assuntos.
 */
export function computePanoramaLayout(params: {
  visibleNodes: CanvasNodePosition[];
  visibleStrokes: CanvasStroke[];
  cardsById: Record<string, KnowledgeCardMeta>;
  hierarchy: HierarchyNode[];
  selectedHierarchyId: string | null;
}): PanoramaLayoutResult {
  const { visibleNodes, visibleStrokes, cardsById, hierarchy, selectedHierarchyId } = params;
  const nodeOffsets = new Map<string, ProjectionOffset>();
  const strokeOffsets = new Map<string, ProjectionOffset>();

  if (visibleNodes.length === 0 && visibleStrokes.length === 0) {
    return { isPanorama: false, sections: [], nodeOffsets, strokeOffsets };
  }

  const hierarchyById = new Map(hierarchy.map((h) => [h.id, h]));
  const orderMap = buildHierarchyOrderMap(hierarchy);

  const bucketsMap = new Map<
    string,
    { nodes: CanvasNodePosition[]; strokes: CanvasStroke[] }
  >();

  const ensureBucket = (bucketId: string) => {
    let entry = bucketsMap.get(bucketId);
    if (!entry) {
      entry = { nodes: [], strokes: [] };
      bucketsMap.set(bucketId, entry);
    }
    return entry;
  };

  for (const node of visibleNodes) {
    const scope: HierarchyScope | undefined =
      node.nodeType === 'knowledgeCard' && node.cardId ? cardsById[node.cardId] ?? node : node;
    const bucketId = resolveBucketId(scope, hierarchyById);
    ensureBucket(bucketId).nodes.push(node);
  }

  for (const stroke of visibleStrokes) {
    const bucketId = resolveBucketId(stroke, hierarchyById);
    ensureBucket(bucketId).strokes.push(stroke);
  }

  const bucketIds = Array.from(bucketsMap.keys());

  // Ativa o Panorama apenas em visões compostas (Todo o Conhecimento com assuntos ou nível pai com sub-mapas)
  const isOverviewWithNamedMaps =
    selectedHierarchyId === null &&
    (bucketIds.length >= 2 || (bucketIds.length === 1 && bucketIds[0] !== GENERAL_BUCKET_ID));

  const isParentWithSubMaps =
    selectedHierarchyId !== null &&
    (bucketIds.length >= 2 || (bucketIds.length === 1 && bucketIds[0] !== selectedHierarchyId));

  if (!isOverviewWithNamedMaps && !isParentWithSubMaps) {
    return { isPanorama: false, sections: [], nodeOffsets, strokeOffsets };
  }

  const rawBuckets: BucketRaw[] = bucketIds.map((bucketId) => {
    const { nodes, strokes } = bucketsMap.get(bucketId)!;
    const crumb = bucketId === GENERAL_BUCKET_ID ? [] : getHierarchyBreadcrumb(hierarchy, bucketId);
    const leaf = crumb[crumb.length - 1] ?? null;
    const parentPath = crumb.slice(0, -1).map((c) => c.title).join(' › ');

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const n of nodes) {
      const b = getNodeBounds(n);
      minX = Math.min(minX, b.minX);
      minY = Math.min(minY, b.minY);
      maxX = Math.max(maxX, b.maxX);
      maxY = Math.max(maxY, b.maxY);
    }

    for (const st of strokes) {
      for (const pt of st.points) {
        minX = Math.min(minX, pt.x - st.width);
        minY = Math.min(minY, pt.y - st.width);
        maxX = Math.max(maxX, pt.x + st.width);
        maxY = Math.max(maxY, pt.y + st.width);
      }
    }

    if (!Number.isFinite(minX)) {
      minX = 0;
      minY = 0;
      maxX = 320;
      maxY = 200;
    }

    const contentW = Math.max(1, maxX - minX);
    const contentH = Math.max(1, maxY - minY);

    return {
      bucketId,
      hierarchyId: leaf?.id ?? null,
      rootDisciplineId: getRootDisciplineId(bucketId, hierarchyById),
      orderIndex: orderMap.get(bucketId) ?? Number.MAX_SAFE_INTEGER,
      title: leaf ? leaf.title : 'Notas Gerais',
      subtitle: parentPath,
      nodes,
      strokes,
      minX,
      minY,
      frameW: Math.max(MIN_FRAME_W, Math.round(contentW + FRAME_PAD_X * 2)),
      frameH: Math.max(MIN_FRAME_H, Math.round(contentH + FRAME_PAD_TOP + FRAME_PAD_BOTTOM)),
    };
  });

  rawBuckets.sort((a, b) => a.orderIndex - b.orderIndex);

  // Agrupa em linhas: se "Todo o Conhecimento" tiver disciplinas com múltiplos assuntos, cada disciplina forma uma faixa sequencial
  const rows: BucketRaw[][] = [];
  if (selectedHierarchyId === null) {
    const byDiscipline = new Map<string, BucketRaw[]>();
    for (const b of rawBuckets) {
      const list = byDiscipline.get(b.rootDisciplineId) ?? [];
      list.push(b);
      byDiscipline.set(b.rootDisciplineId, list);
    }

    const anyDisciplineHasMultiple = Array.from(byDiscipline.values()).some((g) => g.length > 1);
    if (anyDisciplineHasMultiple) {
      for (const group of byDiscipline.values()) {
        for (let i = 0; i < group.length; i += MAX_COLS_PER_ROW) {
          rows.push(group.slice(i, i + MAX_COLS_PER_ROW));
        }
      }
    } else {
      for (let i = 0; i < rawBuckets.length; i += MAX_COLS_PER_ROW) {
        rows.push(rawBuckets.slice(i, i + MAX_COLS_PER_ROW));
      }
    }
  } else {
    for (let i = 0; i < rawBuckets.length; i += MAX_COLS_PER_ROW) {
      rows.push(rawBuckets.slice(i, i + MAX_COLS_PER_ROW));
    }
  }

  const sections: PanoramaSectionFrame[] = [];
  let cursorY = 0;

  for (const row of rows) {
    let cursorX = 0;
    let rowMaxH = 0;

    for (const bucket of row) {
      const frameX = cursorX;
      const frameY = cursorY;

      const dx = Math.round(frameX + FRAME_PAD_X - bucket.minX);
      const dy = Math.round(frameY + FRAME_PAD_TOP - bucket.minY);

      for (const n of bucket.nodes) {
        nodeOffsets.set(n.id, { dx, dy });
      }
      for (const st of bucket.strokes) {
        strokeOffsets.set(st.id, { dx, dy });
      }

      sections.push({
        id: `pano-sec-${bucket.bucketId}`,
        bucketId: bucket.bucketId,
        hierarchyId: bucket.hierarchyId,
        title: bucket.title,
        subtitle: bucket.subtitle,
        itemCount: bucket.nodes.length,
        x: frameX,
        y: frameY,
        width: bucket.frameW,
        height: bucket.frameH,
      });

      cursorX += bucket.frameW + GAP_X;
      rowMaxH = Math.max(rowMaxH, bucket.frameH);
    }

    cursorY += rowMaxH + GAP_Y;
  }

  return {
    isPanorama: true,
    sections,
    nodeOffsets,
    strokeOffsets,
  };
}