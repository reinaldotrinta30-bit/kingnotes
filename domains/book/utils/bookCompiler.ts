import {
  BookItemEntry,
  BookItemRole,
  BookProjectConfig,
  CanvasConnection,
  CanvasNodePosition,
  FullKnowledgeCard,
  HierarchyNode,
  KnowledgeCardMeta,
} from '@/domains/knowledge/types';
import {
  getHierarchyBreadcrumb,
  matchesHierarchyContext,
} from '@/domains/knowledge/utils/hierarchyContext';

export interface BookCompiledBlock {
  entry: BookItemEntry;
  title: string;
  chapterNumber?: number;
  sectionLabel?: string;
  card?: KnowledgeCardMeta;
  canvasNode?: CanvasNodePosition;
  contextLabel?: string;
}

export interface BookTocEntry {
  anchorId: string;
  role: 'chapter' | 'section';
  numberLabel: string;
  title: string;
}

/**
 * Modelo intermediário desacoplado de qualquer biblioteca de exportação
 * (pronto para Impressão/PDF, Markdown, DOCX ou HTML).
 */
export interface BookDocumentModel {
  title: string;
  subtitle: string;
  headerText: string;
  footerText: string;
  showPageNumbers: boolean;
  margins: 'narrow' | 'normal' | 'wide';
  showPageBreaks: boolean;
  includeCallouts: boolean;
  includeImages: boolean;
  includeFreeTexts: boolean;
  generatedAt: number;
  toc: BookTocEntry[];
  blocks: BookCompiledBlock[];
}

export const DEFAULT_BOOK_CONFIG: Required<
  Omit<BookProjectConfig, 'outlineOrder' | 'updatedAt'>
> = {
  title: 'Caderno de Estudos',
  subtitle: 'Material compilado e estruturado a partir do Knowledge Canvas',
  headerText: '',
  footerText: 'Knowledge Canvas • Material de Estudo',
  showPageNumbers: true,
  margins: 'normal',
  showPageBreaks: true,
  includeCallouts: true,
  includeImages: true,
  includeFreeTexts: true,
};

function buildHierarchyOrder(hierarchy: HierarchyNode[]): Map<string, number> {
  const map = new Map<string, number>();
  let idx = 0;

  const visit = (parentId: string | null) => {
    const children = hierarchy
      .filter((h) => h.parentId === parentId)
      .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
    for (const child of children) {
      map.set(child.id, idx++);
      visit(child.id);
    }
  };

  visit(null);
  return map;
}

function getScopeOrderScore(
  scope: {
    disciplineId?: string | null;
    subjectId?: string | null;
    subsubjectId?: string | null;
    topicId?: string | null;
  },
  hierarchyOrder: Map<string, number>
): number {
  const candidates = [scope.topicId, scope.subsubjectId, scope.subjectId, scope.disciplineId];
  for (const id of candidates) {
    if (id && hierarchyOrder.has(id)) return hierarchyOrder.get(id)!;
  }
  return Number.MAX_SAFE_INTEGER;
}

function getContextBreadcrumbLabel(
  hierarchy: HierarchyNode[],
  scope: {
    disciplineId?: string | null;
    subjectId?: string | null;
    subsubjectId?: string | null;
    topicId?: string | null;
  }
): string {
  const leafId = scope.topicId || scope.subsubjectId || scope.subjectId || scope.disciplineId || null;
  if (!leafId) return '';
  return getHierarchyBreadcrumb(hierarchy, leafId)
    .map((h) => h.title)
    .join(' › ');
}

function extractTextSnippet(node: CanvasNodePosition): string {
  const plain = (node.plainText ?? '').trim();
  if (!plain) return 'Texto Livre';
  const firstLine = plain.split('\n').find((l) => l.trim().length > 0)?.trim() ?? plain;
  return firstLine.length > 56 ? `${firstLine.slice(0, 53)}...` : firstLine;
}

/**
 * Gera uma sugestão inicial estratégica de sequência para o Livro:
 * 1) Percorre Tópicos raiz -> Capítulos, Subtópicos -> Seções e segue o grafo de conexões (DFS);
 * 2) Organiza os demais itens pela ordem hierárquica (Disciplina > Assunto > Subassunto > Tópico);
 * 3) Usa posição espacial (Y, X) somente como critério secundário de desempate.
 */
export function buildSuggestedBookOrder(params: {
  hierarchy: HierarchyNode[];
  selectedHierarchyId: string | null;
  cardsById: Record<string, KnowledgeCardMeta>;
  canvasNodes: CanvasNodePosition[];
  canvasEdges: CanvasConnection[];
  onlyCritical: boolean;
  selectedNotebookId: string;
}): BookItemEntry[] {
  const {
    hierarchy,
    selectedHierarchyId,
    cardsById,
    canvasNodes,
    canvasEdges,
    onlyCritical,
    selectedNotebookId,
  } = params;

  const hierarchyOrder = buildHierarchyOrder(hierarchy);

  // Filtra nós elegíveis no contexto ativo
  const eligibleNodes = canvasNodes.filter((cn) => {
    if (cn.nodeType === 'group') return false;
    if (cn.nodeType === 'knowledgeCard') {
      if (!cn.cardId) return false;
      const card = cardsById[cn.cardId];
      if (!card) return false;
      if (!matchesHierarchyContext(card, selectedHierarchyId, hierarchy)) return false;
      if (onlyCritical && card.importance === 'normal') return false;
      if (selectedNotebookId && !(card.notebookIds ?? []).includes(selectedNotebookId)) return false;
      return true;
    }
    return matchesHierarchyContext(cn, selectedHierarchyId, hierarchy);
  });

  const nodeById = new Map(eligibleNodes.map((n) => [n.id, n]));
  const eligibleCardIdsOnCanvas = new Set<string>();
  for (const n of eligibleNodes) {
    if (n.nodeType === 'knowledgeCard' && n.cardId) eligibleCardIdsOnCanvas.add(n.cardId);
  }

  // Adjacência direcionada apenas entre nós visíveis
  const outgoing = new Map<string, string[]>();
  const incomingCount = new Map<string, number>();

  for (const n of eligibleNodes) {
    outgoing.set(n.id, []);
    incomingCount.set(n.id, 0);
  }

  for (const edge of canvasEdges) {
    if (!nodeById.has(edge.sourceNodeId) || !nodeById.has(edge.targetNodeId)) continue;
    outgoing.get(edge.sourceNodeId)!.push(edge.targetNodeId);
    incomingCount.set(edge.targetNodeId, (incomingCount.get(edge.targetNodeId) ?? 0) + 1);
  }

  const compareNodes = (a: CanvasNodePosition, b: CanvasNodePosition): number => {
    const scopeA = a.nodeType === 'knowledgeCard' && a.cardId ? cardsById[a.cardId] ?? a : a;
    const scopeB = b.nodeType === 'knowledgeCard' && b.cardId ? cardsById[b.cardId] ?? b : b;
    const hDiff =
      getScopeOrderScore(scopeA, hierarchyOrder) - getScopeOrderScore(scopeB, hierarchyOrder);
    if (hDiff !== 0) return hDiff;

    // Tópicos vêm antes de conteúdos avulsos dentro do mesmo contexto
    const typeRank = (t: CanvasNodePosition['nodeType']) =>
      t === 'topic' ? 0 : t === 'knowledgeCard' ? 1 : t === 'text' ? 2 : 3;
    const tDiff = typeRank(a.nodeType) - typeRank(b.nodeType);
    if (tDiff !== 0) return tDiff;

    // Desempate espacial suave (leitura em faixas horizontais de cima para baixo, esquerda para direita)
    const bandA = Math.round(a.y / 140);
    const bandB = Math.round(b.y / 140);
    if (bandA !== bandB) return bandA - bandB;
    return a.x - b.x;
  };

  // Ordena filhos de cada nó por ordem lógica
  for (const [key, targets] of outgoing.entries()) {
    targets.sort((idA, idB) => compareNodes(nodeById.get(idA)!, nodeById.get(idB)!));
    outgoing.set(key, targets);
  }

  const visited = new Set<string>();
  const result: BookItemEntry[] = [];

  const toEntry = (node: CanvasNodePosition, depth: number): BookItemEntry => {
    if (node.nodeType === 'topic') {
      const isSubtopic = Boolean(node.topicConfig?.parentTopicId) || depth > 0;
      return {
        id: `topic:${node.id}`,
        sourceType: 'topic',
        sourceId: node.id,
        role: isSubtopic ? 'section' : 'chapter',
        included: true,
      };
    }
    if (node.nodeType === 'knowledgeCard' && node.cardId) {
      return {
        id: `card:${node.cardId}`,
        sourceType: 'card',
        sourceId: node.cardId,
        role: 'content',
        included: true,
      };
    }
    if (node.nodeType === 'text') {
      return {
        id: `text:${node.id}`,
        sourceType: 'text',
        sourceId: node.id,
        role: 'content',
        included: true,
      };
    }
    return {
      id: `image:${node.id}`,
      sourceType: 'image',
      sourceId: node.id,
      role: 'content',
      included: true,
    };
  };

  const dfs = (nodeId: string, depth: number) => {
    if (visited.has(nodeId)) return;
    const node = nodeById.get(nodeId);
    if (!node) return;
    visited.add(nodeId);
    result.push(toEntry(node, depth));

    const children = outgoing.get(nodeId) ?? [];
    for (const childId of children) {
      dfs(childId, depth + 1);
    }
  };

  // 1) Inicia pelos Tópicos raiz e nós sem entrada (raízes do mapa mental / fluxograma)
  const roots = eligibleNodes
    .filter((n) => (incomingCount.get(n.id) ?? 0) === 0)
    .sort(compareNodes);
  for (const r of roots) {
    dfs(r.id, 0);
  }

  // 2) Percorre eventuais ciclos ou nós restantes conectados
  const remainingNodes = eligibleNodes.filter((n) => !visited.has(n.id)).sort(compareNodes);
  for (const n of remainingNodes) {
    dfs(n.id, 0);
  }

  // 3) Inclui Knowledge Cards do contexto que existam na biblioteca mesmo sem nó no Canvas
  const offCanvasCards = Object.values(cardsById)
    .filter((c) => !eligibleCardIdsOnCanvas.has(c.id))
    .filter((c) => matchesHierarchyContext(c, selectedHierarchyId, hierarchy))
    .filter((c) => (!onlyCritical || c.importance !== 'normal'))
    .filter((c) => !selectedNotebookId || (c.notebookIds ?? []).includes(selectedNotebookId))
    .sort((a, b) => {
      const hDiff =
        getScopeOrderScore(a, hierarchyOrder) - getScopeOrderScore(b, hierarchyOrder);
      if (hDiff !== 0) return hDiff;
      return a.createdAt - b.createdAt;
    });

  for (const card of offCanvasCards) {
    result.push({
      id: `card:${card.id}`,
      sourceType: 'card',
      sourceId: card.id,
      role: 'content',
      included: true,
    });
  }

  return result;
}

/**
 * Concilia a ordem manual salva pelo usuário com novos elementos adicionados ao Canvas
 * sem perder personalizações de ordem, papel (capítulo/seção) ou visibilidade.
 */
export function reconcileBookOutline(
  savedOrder: BookItemEntry[] | undefined,
  suggestedOrder: BookItemEntry[]
): BookItemEntry[] {
  if (!savedOrder || savedOrder.length === 0) return suggestedOrder;

  const suggestedById = new Map(suggestedOrder.map((e) => [e.id, e]));
  const merged: BookItemEntry[] = [];
  const seen = new Set<string>();

  for (const saved of savedOrder) {
    if (!suggestedById.has(saved.id) || seen.has(saved.id)) continue;
    merged.push(saved);
    seen.add(saved.id);
  }

  for (const item of suggestedOrder) {
    if (!seen.has(item.id)) {
      merged.push(item);
      seen.add(item.id);
    }
  }

  return merged;
}

/** Compila a estrutura editorial completa pronta para Prévia e Exportadores */
export function compileBookDocument(params: {
  config?: BookProjectConfig;
  workspaceName: string;
  entries: BookItemEntry[];
  hierarchy: HierarchyNode[];
  cardsById: Record<string, KnowledgeCardMeta>;
  canvasNodes: CanvasNodePosition[];
}): BookDocumentModel {
  const { config, workspaceName, entries, hierarchy, cardsById, canvasNodes } = params;

  const includeCallouts = config?.includeCallouts ?? DEFAULT_BOOK_CONFIG.includeCallouts;
  const includeImages = config?.includeImages ?? DEFAULT_BOOK_CONFIG.includeImages;
  const includeFreeTexts = config?.includeFreeTexts ?? DEFAULT_BOOK_CONFIG.includeFreeTexts;

  const nodeById = new Map(canvasNodes.map((n) => [n.id, n]));
  const blocks: BookCompiledBlock[] = [];
  const toc: BookTocEntry[] = [];

  let chapterCounter = 0;
  let sectionCounter = 0;

  for (const entry of entries) {
    if (!entry.included) continue;
    if (entry.sourceType === 'image' && !includeImages) continue;
    if (entry.sourceType === 'text' && !includeFreeTexts) continue;

    let title = '';
    let card: KnowledgeCardMeta | undefined;
    let canvasNode: CanvasNodePosition | undefined;
    let contextLabel = '';

    if (entry.sourceType === 'card') {
      card = cardsById[entry.sourceId];
      if (!card) continue;
      title = card.title || 'Sem título';
      contextLabel = getContextBreadcrumbLabel(hierarchy, card);
    } else {
      canvasNode = nodeById.get(entry.sourceId);
      if (!canvasNode) continue;
      contextLabel = getContextBreadcrumbLabel(hierarchy, canvasNode);
      if (entry.sourceType === 'topic') {
        title = canvasNode.label?.trim() || 'Tópico sem título';
      } else if (entry.sourceType === 'text') {
        title = extractTextSnippet(canvasNode);
      } else {
        title = canvasNode.caption?.trim() || 'Imagem do Mapa';
      }
    }

    let chapterNumber: number | undefined;
    let sectionLabel: string | undefined;

    if (entry.role === 'chapter') {
      chapterCounter += 1;
      sectionCounter = 0;
      chapterNumber = chapterCounter;
      toc.push({
        anchorId: `book-item-${entry.id}`,
        role: 'chapter',
        numberLabel: `Cap. ${chapterCounter}`,
        title,
      });
    } else if (entry.role === 'section') {
      sectionCounter += 1;
      sectionLabel = chapterCounter > 0 ? `${chapterCounter}.${sectionCounter}` : `${sectionCounter}`;
      toc.push({
        anchorId: `book-item-${entry.id}`,
        role: 'section',
        numberLabel: sectionLabel,
        title,
      });
    }

    blocks.push({
      entry,
      title,
      chapterNumber,
      sectionLabel,
      card,
      canvasNode,
      contextLabel,
    });
  }

  return {
    title: config?.title?.trim() || workspaceName || DEFAULT_BOOK_CONFIG.title,
    subtitle: config?.subtitle ?? DEFAULT_BOOK_CONFIG.subtitle,
    headerText: config?.headerText ?? '',
    footerText: config?.footerText ?? DEFAULT_BOOK_CONFIG.footerText,
    showPageNumbers: config?.showPageNumbers ?? DEFAULT_BOOK_CONFIG.showPageNumbers,
    margins: config?.margins ?? DEFAULT_BOOK_CONFIG.margins,
    showPageBreaks: config?.showPageBreaks ?? DEFAULT_BOOK_CONFIG.showPageBreaks,
    includeCallouts,
    includeImages,
    includeFreeTexts,
    generatedAt: Date.now(),
    toc,
    blocks,
  };
}

/**
 * Adaptador de exportação desacoplado: transforma o BookDocumentModel em Markdown editável (.md).
 * Futuros exportadores (DOCX, EPUB, PDF server-side) consomem exatamente o mesmo modelo.
 */
export function exportBookModelToMarkdown(
  doc: BookDocumentModel,
  fullCardsById: Record<string, FullKnowledgeCard>
): string {
  const lines: string[] = [];

  lines.push(`# ${doc.title}`);
  if (doc.subtitle.trim()) lines.push(`> ${doc.subtitle.trim()}`);
  lines.push('');

  if (doc.toc.length > 0) {
    lines.push('## Sumário');
    for (const item of doc.toc) {
      const indent = item.role === 'section' ? '  ' : '';
      lines.push(`${indent}- **${item.numberLabel}** — ${item.title}`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  for (const block of doc.blocks) {
    const { entry, title, chapterNumber, sectionLabel, card, canvasNode } = block;

    if (entry.role === 'chapter') {
      lines.push(`## Capítulo ${chapterNumber}: ${title}`);
      lines.push('');
      if (entry.sourceType === 'topic') continue;
    } else if (entry.role === 'section') {
      lines.push(`### ${sectionLabel} ${title}`);
      lines.push('');
      if (entry.sourceType === 'topic') continue;
    } else if (entry.sourceType === 'topic') {
      lines.push(`#### ${title}`);
      lines.push('');
      continue;
    }

    if (entry.sourceType === 'card' && card) {
      if (entry.role === 'content') {
        lines.push(`### ${card.emoji ? `${card.emoji} ` : ''}${card.title}`);
        lines.push('');
      }
      const full = fullCardsById[card.id];
      const body = full?.content.plainText?.trim() || card.excerpt.trim();
      if (body) {
        lines.push(body);
        lines.push('');
      }
      const calloutText = (card.callout?.text ?? card.notes ?? '').trim();
      if (doc.includeCallouts && calloutText && card.callout?.visible !== false) {
        lines.push(`> **Destaque / Pegadinha:** ${calloutText}`);
        lines.push('');
      }
    } else if (entry.sourceType === 'text' && canvasNode) {
      const body = (canvasNode.plainText ?? '').trim();
      if (body) {
        lines.push(body);
        lines.push('');
      }
      const calloutText = (canvasNode.callout?.text ?? '').trim();
      if (doc.includeCallouts && calloutText && canvasNode.callout?.visible !== false) {
        lines.push(`> **Observação:** ${calloutText}`);
        lines.push('');
      }
    } else if (entry.sourceType === 'image' && canvasNode) {
      lines.push(`*[Imagem do Canvas: ${canvasNode.caption?.trim() || 'Ilustração'}]*`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

export function getBookEntryLabel(
  entry: BookItemEntry,
  cardsById: Record<string, KnowledgeCardMeta>,
  canvasNodesById: Map<string, CanvasNodePosition>
): string {
  if (entry.sourceType === 'card') {
    return cardsById[entry.sourceId]?.title || 'Card sem título';
  }
  const node = canvasNodesById.get(entry.sourceId);
  if (!node) return 'Item';
  if (entry.sourceType === 'topic') return node.label?.trim() || 'Tópico';
  if (entry.sourceType === 'text') return extractTextSnippet(node);
  return node.caption?.trim() || 'Imagem';
}

export function cycleBookRole(role: BookItemRole): BookItemRole {
  if (role === 'chapter') return 'section';
  if (role === 'section') return 'content';
  return 'chapter';
}