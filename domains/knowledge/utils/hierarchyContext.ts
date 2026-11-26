import { HierarchyNode, HierarchyScope } from '../types';

export interface ResolvedHierarchyChain {
  disciplineId: string;
  subjectId: string;
  subsubjectId: string | null;
  topicId: string | null;
}

/**
 * Sobe a árvore hierárquica a partir de qualquer nó selecionado
 * e preenche os 4 níveis (disciplina, assunto, subassunto e tópico).
 */
export function resolveHierarchyChain(
  hierarchy: HierarchyNode[],
  selectedId: string | null
): ResolvedHierarchyChain {
  const byId = new Map(hierarchy.map((h) => [h.id, h]));

  let disciplineId: string | null = null;
  let subjectId: string | null = null;
  let subsubjectId: string | null = null;
  let topicId: string | null = null;

  if (selectedId) {
    let cursor = byId.get(selectedId) ?? null;
    let guard = 0;
    while (cursor && guard < 10) {
      if (cursor.level === 'discipline') disciplineId = cursor.id;
      if (cursor.level === 'subject') subjectId = cursor.id;
      if (cursor.level === 'subsubject') subsubjectId = cursor.id;
      if (cursor.level === 'topic') topicId = cursor.id;
      cursor = cursor.parentId ? byId.get(cursor.parentId) ?? null : null;
      guard += 1;
    }
  }

  // Fallback seguro apenas quando nenhum contexto está selecionado ("Todo o Conhecimento")
  if (!selectedId) {
    disciplineId = hierarchy.find((h) => h.level === 'discipline')?.id ?? 'unassigned';
    subjectId =
      hierarchy.find((h) => h.level === 'subject' && h.parentId === disciplineId)?.id ??
      hierarchy.find((h) => h.level === 'subject')?.id ??
      'unassigned';
  }

  return {
    disciplineId: disciplineId ?? 'unassigned',
    subjectId: subjectId ?? 'unassigned',
    subsubjectId,
    topicId,
  };
}

/**
 * Resolve o escopo opcional para elementos visuais do Canvas (textos livres, imagens, grupos, tópicos e traços).
 * Em "Todo o Conhecimento" (selectedId === null), nasce sem restrição de disciplina.
 */
export function resolveOptionalHierarchyScope(
  hierarchy: HierarchyNode[],
  selectedId: string | null
): HierarchyScope {
  if (!selectedId) {
    return {
      disciplineId: null,
      subjectId: null,
      subsubjectId: null,
      topicId: null,
    };
  }
  const chain = resolveHierarchyChain(hierarchy, selectedId);
  return {
    disciplineId: chain.disciplineId === 'unassigned' ? null : chain.disciplineId,
    subjectId: chain.subjectId === 'unassigned' ? null : chain.subjectId,
    subsubjectId: chain.subsubjectId,
    topicId: chain.topicId,
  };
}

/**
 * Retorna todos os IDs descendentes (incluindo o próprio rootId) de forma segura contra ciclos.
 */
export function getDescendantHierarchyIds(
  hierarchy: HierarchyNode[],
  rootId: string
): Set<string> {
  const result = new Set<string>([rootId]);
  let added = true;
  let guard = 0;

  while (added && guard < 16) {
    added = false;
    for (const node of hierarchy) {
      if (node.parentId && result.has(node.parentId) && !result.has(node.id)) {
        result.add(node.id);
        added = true;
      }
    }
    guard += 1;
  }

  return result;
}

/**
 * Verifica se um card ou elemento do Canvas pertence ao contexto hierárquico selecionado.
 * Quando selectedHierarchyId === null ("Todo o Conhecimento"), tudo permanece visível.
 */
export function matchesHierarchyContext(
  scope: HierarchyScope | null | undefined,
  selectedHierarchyId: string | null,
  hierarchy: HierarchyNode[]
): boolean {
  if (!selectedHierarchyId) return true;
  if (!scope) return false;

  const allowed = getDescendantHierarchyIds(hierarchy, selectedHierarchyId);
  const ids = [scope.disciplineId, scope.subjectId, scope.subsubjectId, scope.topicId];
  return ids.some((id) => Boolean(id && allowed.has(id)));
}

/**
 * Monta o caminho legível do contexto ativo (ex.: ["Direito Previdenciário", "Seguridade Social"]).
 */
export function getHierarchyBreadcrumb(
  hierarchy: HierarchyNode[],
  selectedId: string | null
): HierarchyNode[] {
  if (!selectedId) return [];
  const byId = new Map(hierarchy.map((h) => [h.id, h]));
  const chain: HierarchyNode[] = [];
  let cursor = byId.get(selectedId) ?? null;
  let guard = 0;

  while (cursor && guard < 10) {
    chain.unshift(cursor);
    cursor = cursor.parentId ? byId.get(cursor.parentId) ?? null : null;
    guard += 1;
  }

  return chain;
}