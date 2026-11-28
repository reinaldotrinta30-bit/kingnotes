'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ArrowRightLeft,
  ChevronRight,
  FolderPlus,
  Image as ImageIcon,
  Layers,
  MoreVertical,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { HierarchyLevel, HierarchyNode } from '@/domains/knowledge/types';
import { useKnowledgeStore } from '@/domains/knowledge/store/useKnowledgeStore';
import { useUiStore } from '@/domains/ui/store/useUiStore';
import {
  getDescendantHierarchyIds,
  getHierarchyBreadcrumb,
  getHierarchyDepth,
  getHierarchyLevelLabel,
  getNextHierarchyLevel,
  getRootDiscipline,
  isHierarchyNodeArchived,
} from '@/domains/knowledge/utils/hierarchyContext';
import { HierarchyAvatar, getDeterministicHierarchyColor } from './HierarchyAvatar';
import { HierarchyAppearanceModal } from './HierarchyAppearanceModal';
import { HierarchyTransferModal } from './HierarchyTransferModal';

type FilterTab = 'all' | 'due' | 'pinned' | 'favorite';

interface NodeStats {
  childCount: number;
  cardCount: number;
  dueCount: number;
  lastUpdatedAt: number;
}

interface ContextMenuState {
  nodeId: string;
  x: number;
  y: number;
}

function formatShortTimestamp(ts: number): string {
  if (!ts) return '';
  const date = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
      new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) /
      86400000
  );

  if (diffDays <= 0) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) {
    return date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  }
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function pluralizeChildLabel(level: HierarchyLevel, depth: number, count: number): string {
  const singular = getHierarchyLevelLabel(getNextHierarchyLevel(level), depth + 1).toLowerCase();
  if (count === 1) return `1 ${singular}`;
  return `${count} ${singular}s`;
}

export function HierarchyTree() {
  const {
    activeWorkspaceId,
    hierarchy,
    cardsById,
    canvasNodes,
    selectedHierarchyId,
    selectHierarchy,
    createHierarchyItem,
    updateHierarchyItem,
    renameHierarchyItem,
    deleteHierarchyItem,
  } = useKnowledgeStore();

  const {
    openConfirm,
    addToast,
    hasUnsavedEditorChanges,
    clearTransientCanvasUi,
  } = useUiStore();

  // Controle da pilha (drill-down) e da tela de Arquivadas
  const [browseParentId, setBrowseParentId] = useState<string | null>(selectedHierarchyId);
  const [showArchivedView, setShowArchivedView] = useState(false);

  // Busca contextual e filtros em pílula (estilo WhatsApp Web)
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');

  // Criação, renomeação, menu contextual e modal de Capa/Ícone/Cor
  const [isCreating, setIsCreating] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [appearanceNodeId, setAppearanceNodeId] = useState<string | null>(null);
  const [transferSourceId, setTransferSourceId] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sincroniza a pilha quando o contexto muda externamente (ex.: breadcrumb do Canvas, busca ⌘K ou troca de área)
  useEffect(() => {
    setBrowseParentId(selectedHierarchyId);
    setShowArchivedView(false);
    setSearchQuery('');
    setIsCreating(false);
  }, [selectedHierarchyId, activeWorkspaceId]);

  // Fecha menu contextual ao clicar fora ou apertar Esc
  useEffect(() => {
    if (!contextMenu) return;
    const onClose = () => setContextMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('click', onClose);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', onClose);
      window.removeEventListener('keydown', onKey);
    };
  }, [contextMenu]);

  const byId = useMemo(() => new Map(hierarchy.map((h) => [h.id, h])), [hierarchy]);
  const currentParentNode = browseParentId ? byId.get(browseParentId) ?? null : null;
  const currentBreadcrumb = useMemo(
    () => getHierarchyBreadcrumb(hierarchy, browseParentId),
    [hierarchy, browseParentId]
  );

  // Estatísticas consolidadas por nó (filhos ativos, total de itens, revisões vencidas e última atividade)
  const statsById = useMemo(() => {
    const now = Date.now();
    const map: Record<string, NodeStats> = {};
    const allCards = Object.values(cardsById);

    for (const node of hierarchy) {
      const descendants = getDescendantHierarchyIds(hierarchy, node.id);
      const childCount = hierarchy.filter(
        (h) => h.parentId === node.id && !h.isArchived
      ).length;

      let cardCount = 0;
      let dueCount = 0;
      let lastUpdatedAt = node.updatedAt;

      for (const descId of descendants) {
        const d = byId.get(descId);
        if (d && d.updatedAt > lastUpdatedAt) lastUpdatedAt = d.updatedAt;
      }

      for (const card of allCards) {
        const ids = [card.disciplineId, card.subjectId, card.subsubjectId, card.topicId];
        if (ids.some((id) => Boolean(id && descendants.has(id)))) {
          cardCount += 1;
          if (card.nextReviewAt !== null && card.nextReviewAt <= now) {
            dueCount += 1;
          }
          if (card.updatedAt > lastUpdatedAt) lastUpdatedAt = card.updatedAt;
        }
      }

      for (const cn of canvasNodes) {
        if (cn.nodeType === 'knowledgeCard') continue;
        const ids = [cn.disciplineId, cn.subjectId, cn.subsubjectId, cn.topicId];
        if (ids.some((id) => Boolean(id && descendants.has(id)))) {
          cardCount += 1;
          if (cn.updatedAt > lastUpdatedAt) lastUpdatedAt = cn.updatedAt;
        }
      }

      map[node.id] = { childCount, cardCount, dueCount, lastUpdatedAt };
    }

    return map;
  }, [hierarchy, byId, cardsById, canvasNodes]);

  const handleSafeSelectHierarchy = (nextId: string | null) => {
    const applySwitch = () => {
      if (nextId !== selectedHierarchyId) {
        clearTransientCanvasUi();
        selectHierarchy(nextId);
      }
      setBrowseParentId(nextId);
      setShowArchivedView(false);
      setSearchQuery('');
      setIsCreating(false);
    };

    if (nextId !== selectedHierarchyId && hasUnsavedEditorChanges) {
      openConfirm({
        title: 'Descartar alterações não salvas?',
        description:
          'Existem edições pendentes no painel atual. Deseja trocar de contexto e descartá-las?',
        confirmLabel: 'Trocar de contexto',
        variant: 'danger',
        onConfirm: applySwitch,
      });
      return;
    }

    applySwitch();
  };

  // Filhos diretos do nível aberto
  const directChildren = useMemo(() => {
    return hierarchy
      .filter((h) => h.parentId === browseParentId)
      .sort((a, b) => {
        // Fixados sempre no topo, igual WhatsApp Web
        if (Boolean(a.isPinned) !== Boolean(b.isPinned)) return a.isPinned ? -1 : 1;
        return a.order - b.order || a.createdAt - b.createdAt;
      });
  }, [hierarchy, browseParentId]);

  const activeDirectChildren = useMemo(
    () => directChildren.filter((h) => !h.isArchived),
    [directChildren]
  );

  // Itens arquivados: na raiz mostra todos os itens arquivados; dentro de um nível mostra os arquivados daquele ramo
  const archivedItems = useMemo(() => {
    if (!browseParentId) {
      return hierarchy
        .filter((h) => Boolean(h.isArchived))
        .sort((a, b) => b.updatedAt - a.updatedAt);
    }
    const descendants = getDescendantHierarchyIds(hierarchy, browseParentId);
    descendants.delete(browseParentId);
    return hierarchy
      .filter((h) => Boolean(h.isArchived) && descendants.has(h.id))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [hierarchy, browseParentId]);

  const dueFilterCount = useMemo(
    () => activeDirectChildren.filter((n) => (statsById[n.id]?.dueCount ?? 0) > 0).length,
    [activeDirectChildren, statsById]
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();

  // Lista filtrada no nível atual
  const visibleItems = useMemo(() => {
    const source = showArchivedView ? archivedItems : activeDirectChildren;
    return source.filter((item) => {
      if (normalizedQuery && !item.title.toLowerCase().includes(normalizedQuery)) {
        return false;
      }
      if (!showArchivedView) {
        if (filterTab === 'due' && (statsById[item.id]?.dueCount ?? 0) === 0) return false;
        if (filterTab === 'pinned' && !item.isPinned) return false;
        if (filterTab === 'favorite' && !item.isFavorite) return false;
      }
      return true;
    });
  }, [showArchivedView, archivedItems, activeDirectChildren, normalizedQuery, filterTab, statsById]);

  // Busca profunda em subníveis quando o usuário digita na caixa de pesquisa
  const deeperMatches = useMemo(() => {
    if (!normalizedQuery || showArchivedView) return [];
    const directIds = new Set(activeDirectChildren.map((h) => h.id));
    const allowedScope = browseParentId
      ? getDescendantHierarchyIds(hierarchy, browseParentId)
      : null;

    return hierarchy
      .filter((h) => {
        if (h.id === browseParentId || directIds.has(h.id)) return false;
        if (allowedScope && !allowedScope.has(h.id)) return false;
        if (isHierarchyNodeArchived(hierarchy, h.id)) return false;
        return h.title.toLowerCase().includes(normalizedQuery);
      })
      .slice(0, 10);
  }, [normalizedQuery, showArchivedView, activeDirectChildren, browseParentId, hierarchy]);

  const nextCreateLevel: HierarchyLevel = currentParentNode
    ? getNextHierarchyLevel(currentParentNode.level)
    : 'discipline';
  const nextCreateDepth = currentParentNode ? getHierarchyDepth(hierarchy, currentParentNode.id) + 1 : 0;
  const nextCreateLabel = getHierarchyLevelLabel(nextCreateLevel, nextCreateDepth);

  const handleConfirmCreate = async () => {
    const clean = draftTitle.trim();
    if (!clean || !activeWorkspaceId) {
      setIsCreating(false);
      setDraftTitle('');
      return;
    }

    await createHierarchyItem({
      workspaceId: activeWorkspaceId,
      parentId: browseParentId,
      level: nextCreateLevel,
      title: clean,
      order: directChildren.length + 1,
    });

    setDraftTitle('');
    setIsCreating(false);
    addToast({ message: `${nextCreateLabel} "${clean}" criado`, variant: 'success' }, 2000);
  };

  const commitRename = async () => {
    if (renamingId && renameDraft.trim()) {
      await renameHierarchyItem(renamingId, renameDraft.trim());
    }
    setRenamingId(null);
  };

  const openRowMenu = (nodeId: string, clientX: number, clientY: number) => {
    const menuW = 208;
    const menuH = 304;
    const x = Math.max(10, Math.min(window.innerWidth - menuW - 10, clientX));
    const y = Math.max(10, Math.min(window.innerHeight - menuH - 10, clientY));
    setContextMenu({ nodeId, x, y });
  };

  const getInheritedColorFor = (node: HierarchyNode): string => {
    const root = getRootDiscipline(hierarchy, node.id);
    if (root?.color) return root.color;
    return getDeterministicHierarchyColor(root?.id ?? node.id);
  };

  const contextMenuNode = contextMenu ? byId.get(contextMenu.nodeId) ?? null : null;
  const appearanceNode = appearanceNodeId ? byId.get(appearanceNodeId) ?? null : null;
  const transferSourceNode = transferSourceId ? byId.get(transferSourceId) ?? null : null;

  const renderConversationRow = (
    node: HierarchyNode,
    indexInList: number,
    options?: { showPathHint?: boolean }
  ) => {
    const depth = getHierarchyDepth(hierarchy, node.id);
    const inheritedColor = getInheritedColorFor(node);
    const stats = statsById[node.id] ?? {
      childCount: 0,
      cardCount: 0,
      dueCount: 0,
      lastUpdatedAt: node.updatedAt,
    };

    const subtitleParts: string[] = [];
    if (options?.showPathHint) {
      const chain = getHierarchyBreadcrumb(hierarchy, node.parentId);
      if (chain.length > 0) {
        subtitleParts.push(chain.map((c) => c.title).join(' › '));
      }
    } else {
      if (stats.childCount > 0) {
        subtitleParts.push(pluralizeChildLabel(node.level, depth, stats.childCount));
      }
      if (stats.cardCount > 0) {
        subtitleParts.push(`${stats.cardCount} ${stats.cardCount === 1 ? 'item' : 'itens'}`);
      }
      if (subtitleParts.length === 0) {
        subtitleParts.push(`${getHierarchyLevelLabel(node.level, depth)} • vazio`);
      }
    }

    const isSelected = selectedHierarchyId === node.id;

    return (
      <div
        key={node.id}
        role="button"
        tabIndex={0}
        onClick={() => {
          if (renamingId === node.id) return;
          handleSafeSelectHierarchy(node.id);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          openRowMenu(node.id, e.clientX, e.clientY);
        }}
        onKeyDown={(e) => {
          if (renamingId === node.id) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleSafeSelectHierarchy(node.id);
          }
        }}
        className={`group relative flex cursor-pointer select-none items-center gap-3 rounded-xl px-2.5 py-2 transition ${
          isSelected
            ? 'bg-indigo-600/20 ring-1 ring-indigo-500/35'
            : 'hover:bg-[#1A1E28]'
        }`}
      >
        {/* Avatar / Capa circular */}
        <HierarchyAvatar
          node={node}
          depth={depth}
          indexInLevel={indexInList}
          inheritedColor={inheritedColor}
          size="md"
        />

        {/* Conteúdo central (Nome + Subtítulo + Hora + Badges estilo WhatsApp) */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            {renamingId === node.id ? (
              <input
                autoFocus
                value={renameDraft}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setRenameDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setRenamingId(null);
                }}
                className="w-full rounded-md bg-[#0F1115] px-1.5 py-0.5 text-xs font-medium text-zinc-100 ring-1 ring-indigo-500 focus:outline-none"
              />
            ) : (
              <span className="truncate text-[13px] font-semibold tracking-tight text-zinc-100">
                {node.title}
              </span>
            )}

            <span className="shrink-0 text-[10px] text-zinc-500">
              {formatShortTimestamp(stats.lastUpdatedAt)}
            </span>
          </div>

          <div className="mt-0.5 flex items-center justify-between gap-1.5">
            <span className="truncate text-[11px] text-zinc-400">
              {subtitleParts.join(' • ')}
            </span>

            <div className="flex shrink-0 items-center gap-1">
              {node.isFavorite && (
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              )}
              {node.isPinned && <Pin className="h-3 w-3 text-indigo-400" />}

              {/* Badge de revisão vencida (destaque verde/âmbar estilo não-lidas) ou contagem sutil */}
              {stats.dueCount > 0 ? (
                <span
                  title={`${stats.dueCount} ${stats.dueCount === 1 ? 'card para revisar' : 'cards para revisar'}`}
                  className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-zinc-950"
                >
                  {stats.dueCount}
                </span>
              ) : stats.cardCount > 0 ? (
                <span className="rounded-full bg-zinc-800/90 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                  {stats.cardCount}
                </span>
              ) : null}

              {/* Botão rápido de desarquivar quando na tela Arquivadas */}
              {showArchivedView ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateHierarchyItem(node.id, { isArchived: false });
                    addToast({ message: `"${node.title}" desarquivado`, variant: 'success' }, 2000);
                  }}
                  className="rounded-md p-1 text-emerald-400 hover:bg-emerald-500/15"
                  title="Desarquivar"
                >
                  <ArchiveRestore className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    openRowMenu(node.id, rect.right - 16, rect.bottom + 4);
                  }}
                  className="rounded-md p-0.5 text-zinc-500 opacity-0 transition hover:bg-zinc-700/70 hover:text-zinc-100 group-hover:opacity-100"
                  title="Opções"
                  aria-label="Mais opções"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* CABEÇALHO DO NÍVEL ATUAL (QUANDO EM ARQUIVADAS OU DENTRO DE DISCIPLINA / ASSUNTO / TÓPICO) */}
      {showArchivedView ? (
        <div className="flex items-center gap-2 border-b border-zinc-800/80 bg-[#151922] px-3 py-2.5">
          <button
            type="button"
            onClick={() => {
              setShowArchivedView(false);
              setSearchQuery('');
            }}
            className="rounded-lg p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
            title="Voltar"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <Archive className="h-4 w-4 text-emerald-400" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-zinc-100">Arquivadas</p>
            <p className="text-[10px] text-zinc-500">
              {archivedItems.length}{' '}
              {archivedItems.length === 1 ? 'item arquivado' : 'itens arquivados'}
            </p>
          </div>
        </div>
      ) : currentParentNode ? (
        <div className="border-b border-zinc-800/80 bg-[#151922]/90 px-2.5 py-2">
          {/* Linha de retorno + Avatar + Nome + Botões de ação */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSafeSelectHierarchy(currentParentNode.parentId)}
              className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
              title="Voltar um nível"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <HierarchyAvatar
              node={currentParentNode}
              depth={getHierarchyDepth(hierarchy, currentParentNode.id)}
              inheritedColor={getInheritedColorFor(currentParentNode)}
              size="sm"
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-zinc-100">
                {currentParentNode.title}
              </p>
              <p className="text-[10px] text-indigo-300/80">
                {getHierarchyLevelLabel(
                  currentParentNode.level,
                  getHierarchyDepth(hierarchy, currentParentNode.id)
                )}
                {' • '}
                {statsById[currentParentNode.id]?.cardCount ?? 0} itens
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsCreating((v) => !v)}
              className="shrink-0 rounded-lg bg-indigo-600/20 p-1.5 text-indigo-300 transition hover:bg-indigo-600 hover:text-white"
              title={`Novo ${nextCreateLabel}`}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                openRowMenu(currentParentNode.id, rect.right - 16, rect.bottom + 4);
              }}
              className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
              title="Personalizar este nível"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Mini-trilha clicável para pular para qualquer nível pai em 1 clique */}
          {currentBreadcrumb.length > 0 && (
            <div className="kc-no-scrollbar mt-1.5 flex items-center gap-0.5 overflow-x-auto pl-1 text-[10px] text-zinc-500">
              <button
                type="button"
                onClick={() => handleSafeSelectHierarchy(null)}
                className="shrink-0 rounded px-1 py-0.5 hover:bg-zinc-800 hover:text-zinc-200"
              >
                Início
              </button>
              {currentBreadcrumb.map((crumb, idx) => (
                <React.Fragment key={crumb.id}>
                  <ChevronRight className="h-2.5 w-2.5 shrink-0 text-zinc-600" />
                  <button
                    type="button"
                    onClick={() => handleSafeSelectHierarchy(crumb.id)}
                    className={`max-w-[96px] shrink-0 truncate rounded px-1 py-0.5 transition hover:bg-zinc-800 ${
                      idx === currentBreadcrumb.length - 1
                        ? 'font-semibold text-indigo-300'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {crumb.title}
                  </button>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Cabeçalho na Raiz: Todo o Conhecimento + botão Nova Disciplina */
        <div className="flex items-center justify-between gap-1.5 px-3 pb-1 pt-2">
          <button
            type="button"
            onClick={() => handleSafeSelectHierarchy(null)}
            className={`flex flex-1 items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition ${
              selectedHierarchyId === null
                ? 'bg-indigo-600/20 text-indigo-200 ring-1 ring-indigo-500/35'
                : 'text-zinc-300 hover:bg-zinc-800/70'
            }`}
          >
            <Layers className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
            <span>Todo o Conhecimento</span>
          </button>
          <button
            type="button"
            onClick={() => setIsCreating((v) => !v)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-300 transition hover:bg-indigo-600 hover:text-white"
            title="Nova Disciplina"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* CAIXA DE PESQUISA CONTEXTUAL + PÍLULAS DE FILTRO (ESTILO WHATSAPP WEB) */}
      <div className="space-y-2 px-3 pb-2 pt-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              showArchivedView
                ? 'Pesquisar arquivadas...'
                : currentParentNode
                ? `Pesquisar em ${currentParentNode.title}...`
                : 'Pesquisar disciplina ou assunto...'
            }
            className="w-full rounded-full border border-zinc-800/90 bg-[#181C24] py-1.5 pl-8 pr-7 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500/70 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-zinc-500 hover:text-zinc-200"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {!showArchivedView && (
          <div className="kc-no-scrollbar flex items-center gap-1 overflow-x-auto pb-0.5">
            {(
              [
                { id: 'all', label: 'Tudo' },
                {
                  id: 'due',
                  label: dueFilterCount > 0 ? `Revisar ${dueFilterCount}` : 'Revisar',
                },
                { id: 'pinned', label: 'Fixadas' },
                { id: 'favorite', label: 'Favoritas' },
              ] as const
            ).map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setFilterTab(pill.id)}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                  filterTab === pill.id
                    ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
                    : 'bg-[#181C24] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* INPUT INLINE PARA CRIAR NOVO ITEM NO NÍVEL ATUAL */}
      {isCreating && !showArchivedView && (
        <div className="mx-3 mb-2 flex items-center gap-1.5 rounded-xl border border-indigo-500/60 bg-[#0F1115] p-1.5">
          <input
            autoFocus
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirmCreate();
              if (e.key === 'Escape') {
                setIsCreating(false);
                setDraftTitle('');
              }
            }}
            placeholder={`Novo ${nextCreateLabel}...`}
            className="min-w-0 flex-1 bg-transparent px-2 py-1 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleConfirmCreate}
            className="shrink-0 rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-indigo-500"
          >
            Criar
          </button>
        </div>
      )}

      {/* LISTA DE CONVERSAS / DISCIPLINAS / ASSUNTOS / TÓPICOS */}
      <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
        {/* Linha "Arquivadas" no topo da lista (igual WhatsApp Web) */}
        {!showArchivedView && !normalizedQuery && archivedItems.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setShowArchivedView(true);
              setSearchQuery('');
            }}
            className="mb-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-[#1A1E28]"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-400">
                <Archive className="h-4 w-4" />
              </span>
              <span>Arquivadas</span>
            </span>
            <span className="text-[11px] font-semibold text-emerald-400">
              {archivedItems.length}
            </span>
          </button>
        )}

        {visibleItems.length > 0 ? (
          visibleItems.map((node, idx) => renderConversationRow(node, idx))
        ) : !deeperMatches.length ? (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <p className="text-xs font-medium text-zinc-400">
              {showArchivedView
                ? 'Nenhum item arquivado.'
                : normalizedQuery
                ? 'Nenhum resultado encontrado.'
                : filterTab !== 'all'
                ? 'Nenhum item neste filtro.'
                : `Nenhum ${nextCreateLabel.toLowerCase()} aqui ainda.`}
            </p>
            {!showArchivedView && !normalizedQuery && filterTab === 'all' && (
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="mt-3 flex items-center gap-1.5 rounded-xl bg-indigo-600/20 px-3 py-1.5 text-xs font-medium text-indigo-300 transition hover:bg-indigo-600 hover:text-white"
              >
                <FolderPlus className="h-3.5 w-3.5" /> Criar {nextCreateLabel}
              </button>
            )}
          </div>
        ) : null}

        {/* Resultados em subníveis profundos durante a busca */}
        {deeperMatches.length > 0 && (
          <div className="pt-2">
            <div className="mb-1 flex items-center gap-2 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              <span>Em subníveis</span>
              <span className="h-px flex-1 bg-zinc-800/80" />
            </div>
            {deeperMatches.map((node, idx) =>
              renderConversationRow(node, idx, { showPathHint: true })
            )}
          </div>
        )}
      </div>

      {/* MENU CONTEXTUAL FLUTUANTE (CLIQUE EM ⋮ OU BOTÃO DIREITO NA LINHA) */}
      {contextMenu && contextMenuNode && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
          className="fixed z-[135] w-52 overflow-hidden rounded-xl border border-zinc-800 bg-[#161920]/98 p-1.5 text-xs shadow-2xl backdrop-blur-xl"
        >
          <button
            type="button"
            onClick={() => {
              setAppearanceNodeId(contextMenuNode.id);
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-zinc-200 hover:bg-indigo-600/20 hover:text-indigo-200"
          >
            <ImageIcon className="h-3.5 w-3.5 text-indigo-400" /> Capa, ícone e cor
          </button>

          <button
            type="button"
            onClick={() => {
              setContextMenu(null);
              handleSafeSelectHierarchy(contextMenuNode.id);
              setTimeout(() => setIsCreating(true), 20);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-zinc-200 hover:bg-zinc-800"
          >
            <Plus className="h-3.5 w-3.5 text-emerald-400" />
            Adicionar{' '}
            {getHierarchyLevelLabel(
              getNextHierarchyLevel(contextMenuNode.level),
              getHierarchyDepth(hierarchy, contextMenuNode.id) + 1
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setRenamingId(contextMenuNode.id);
              setRenameDraft(contextMenuNode.title);
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-zinc-200 hover:bg-zinc-800"
          >
            <Pencil className="h-3.5 w-3.5 text-zinc-400" /> Renomear
          </button>

          <button
            type="button"
            onClick={() => {
              setTransferSourceId(contextMenuNode.id);
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-zinc-200 hover:bg-indigo-600/20 hover:text-indigo-200"
          >
            <ArrowRightLeft className="h-3.5 w-3.5 text-sky-400" /> Transferir conteúdo...
          </button>

          <div className="my-1 h-px bg-zinc-800/80" />

          <button
            type="button"
            onClick={() => {
              updateHierarchyItem(contextMenuNode.id, { isPinned: !contextMenuNode.isPinned });
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-zinc-200 hover:bg-zinc-800"
          >
            {contextMenuNode.isPinned ? (
              <>
                <PinOff className="h-3.5 w-3.5 text-zinc-400" /> Desafixar
              </>
            ) : (
              <>
                <Pin className="h-3.5 w-3.5 text-indigo-400" /> Fixar no topo
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              updateHierarchyItem(contextMenuNode.id, {
                isFavorite: !contextMenuNode.isFavorite,
              });
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-zinc-200 hover:bg-zinc-800"
          >
            <Star
              className={`h-3.5 w-3.5 ${
                contextMenuNode.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-amber-400'
              }`}
            />
            {contextMenuNode.isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
          </button>

          <button
            type="button"
            onClick={() => {
              const nextArchived = !contextMenuNode.isArchived;
              updateHierarchyItem(contextMenuNode.id, { isArchived: nextArchived });
              if (nextArchived && selectedHierarchyId === contextMenuNode.id) {
                handleSafeSelectHierarchy(contextMenuNode.parentId);
              }
              addToast(
                {
                  message: nextArchived
                    ? `"${contextMenuNode.title}" movido para Arquivadas`
                    : `"${contextMenuNode.title}" desarquivado`,
                },
                2200
              );
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-zinc-200 hover:bg-zinc-800"
          >
            {contextMenuNode.isArchived ? (
              <>
                <ArchiveRestore className="h-3.5 w-3.5 text-emerald-400" /> Desarquivar
              </>
            ) : (
              <>
                <Archive className="h-3.5 w-3.5 text-zinc-400" /> Arquivar
              </>
            )}
          </button>

          <div className="my-1 h-px bg-zinc-800/80" />

          <button
            type="button"
            onClick={() => {
              const target = contextMenuNode;
              const label = getHierarchyLevelLabel(
                target.level,
                getHierarchyDepth(hierarchy, target.id)
              );
              setContextMenu(null);
              openConfirm({
                title: `Remover ${label}?`,
                description: `"${target.title}" e eventuais subníveis serão removidos da lista. Seus Knowledge Cards continuam salvos.`,
                confirmLabel: 'Remover',
                variant: 'danger',
                onConfirm: async () => {
                  await deleteHierarchyItem(target.id);
                  addToast({ message: `${label} removido` });
                },
              });
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-rose-400 hover:bg-rose-500/15"
          >
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </button>
        </div>
      )}

      {/* MODAL DE PERSONALIZAÇÃO DE CAPA / ÍCONE / COR */}
      <HierarchyAppearanceModal
        node={appearanceNode}
        depth={appearanceNode ? getHierarchyDepth(hierarchy, appearanceNode.id) : 0}
        inheritedColor={appearanceNode ? getInheritedColorFor(appearanceNode) : undefined}
        onClose={() => setAppearanceNodeId(null)}
      />

      {/* MODAL DE TRANSFERÊNCIA / TROCA DE CONTEÚDO ENTRE PASTAS E TÓPICOS */}
      <HierarchyTransferModal
        sourceNode={transferSourceNode}
        onClose={() => setTransferSourceId(null)}
        onTransferred={(destId) => handleSafeSelectHierarchy(destId)}
      />
    </div>
  );
}