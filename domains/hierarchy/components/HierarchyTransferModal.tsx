'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  FolderInput,
  Search,
  X,
  Check,
  AlertCircle,
} from 'lucide-react';
import { HierarchyNode } from '@/domains/knowledge/types';
import { useKnowledgeStore } from '@/domains/knowledge/store/useKnowledgeStore';
import { useUiStore } from '@/domains/ui/store/useUiStore';
import {
  getDescendantHierarchyIds,
  getHierarchyBreadcrumb,
  getHierarchyDepth,
  getHierarchyLevelLabel,
  getRootDiscipline,
} from '@/domains/knowledge/utils/hierarchyContext';
import { HierarchyAvatar, getDeterministicHierarchyColor } from './HierarchyAvatar';

interface HierarchyTransferModalProps {
  sourceNode: HierarchyNode | null;
  onClose: () => void;
  onTransferred?: (targetId: string) => void;
}

export function HierarchyTransferModal({
  sourceNode,
  onClose,
  onTransferred,
}: HierarchyTransferModalProps) {
  const {
    hierarchy,
    cardsById,
    canvasNodes,
    canvasStrokes,
    transferHierarchyContent,
    undo,
  } = useKnowledgeStore();
  const { addToast } = useUiStore();

  const [mode, setMode] = useState<'move' | 'swap'>('move');
  const [includeDescendants, setIncludeDescendants] = useState(true);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!sourceNode) return;
    setMode('move');
    setIncludeDescendants(true);
    setTargetId(null);
    setSearch('');
  }, [sourceNode?.id]);

  useEffect(() => {
    if (!sourceNode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sourceNode, onClose]);

  const byId = useMemo(() => new Map(hierarchy.map((h) => [h.id, h])), [hierarchy]);

  const sourceDescendants = useMemo(
    () => (sourceNode ? getDescendantHierarchyIds(hierarchy, sourceNode.id) : new Set<string>()),
    [hierarchy, sourceNode]
  );

  const hasSublevels = sourceDescendants.size > 1;

  // Calcula quantos itens serão afetados na origem
  const sourceStats = useMemo(() => {
    if (!sourceNode) return { cards: 0, extras: 0, strokes: 0 };
    const scopeSet = includeDescendants ? sourceDescendants : new Set([sourceNode.id]);

    const leafOf = (scope?: {
      disciplineId?: string | null;
      subjectId?: string | null;
      subsubjectId?: string | null;
      topicId?: string | null;
    }) => {
      if (!scope) return null;
      const list = [scope.topicId, scope.subsubjectId, scope.subjectId, scope.disciplineId];
      for (const id of list) {
        if (id && byId.has(id)) return id;
      }
      return null;
    };

    let cards = 0;
    for (const c of Object.values(cardsById)) {
      const l = leafOf(c);
      if (l && scopeSet.has(l)) cards += 1;
    }

    let extras = 0;
    for (const cn of canvasNodes) {
      if (cn.nodeType === 'knowledgeCard') continue;
      const l = leafOf(cn);
      if (l && scopeSet.has(l)) extras += 1;
    }

    let strokes = 0;
    for (const st of canvasStrokes) {
      const l = leafOf(st);
      if (l && scopeSet.has(l)) strokes += 1;
    }

    return { cards, extras, strokes };
  }, [sourceNode, includeDescendants, sourceDescendants, byId, cardsById, canvasNodes, canvasStrokes]);

  // Lista ordenada em pré-ordem de todos os destinos possíveis (excluindo o próprio nó e seus filhos quando includeDescendants=true no modo move)
  const targetOptions = useMemo(() => {
    if (!sourceNode) return [];
    const ordered: Array<{ node: HierarchyNode; depth: number; path: string }> = [];
    const visit = (parentId: string | null, depth: number) => {
      const children = hierarchy
        .filter((h) => h.parentId === parentId && !h.isArchived)
        .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
      for (const child of children) {
        const isSelf = child.id === sourceNode.id;
        const isBlockedDescendant =
          mode === 'move' && includeDescendants && sourceDescendants.has(child.id);
        if (!isSelf && !isBlockedDescendant) {
          const crumb = getHierarchyBreadcrumb(hierarchy, child.parentId)
            .map((c) => c.title)
            .join(' › ');
          ordered.push({ node: child, depth, path: crumb });
        }
        visit(child.id, depth + 1);
      }
    };
    visit(null, 0);

    const q = search.trim().toLowerCase();
    if (!q) return ordered;
    return ordered.filter(
      (item) =>
        item.node.title.toLowerCase().includes(q) || item.path.toLowerCase().includes(q)
    );
  }, [hierarchy, sourceNode, mode, includeDescendants, sourceDescendants, search]);

  if (!sourceNode) return null;

  const sourceTotal = sourceStats.cards + sourceStats.extras + sourceStats.strokes;
  const sourcePath = getHierarchyBreadcrumb(hierarchy, sourceNode.parentId)
    .map((c) => c.title)
    .join(' › ');

  const getColor = (n: HierarchyNode) => {
    const root = getRootDiscipline(hierarchy, n.id);
    return root?.color || getDeterministicHierarchyColor(root?.id ?? n.id);
  };

  const handleConfirm = async () => {
    if (!targetId) return;
    setBusy(true);
    try {
      const res = await transferHierarchyContent({
        sourceId: sourceNode.id,
        targetId,
        mode,
        includeDescendants,
      });

      const targetName = byId.get(targetId)?.title ?? 'destino';
      const totalMoved = res.movedNodes + res.movedStrokes;

      if (totalMoved === 0 && res.movedCards === 0) {
        addToast({ message: 'Nenhum item encontrado para transferir.', variant: 'default' });
      } else {
        addToast(
          {
            message:
              mode === 'swap'
                ? `Conteúdo trocado entre "${sourceNode.title}" e "${targetName}"`
                : `Conteúdo transferido para "${targetName}"`,
            variant: 'success',
            action: { label: 'Desfazer', onClick: () => undo() },
          },
          4200
        );
        onTransferred?.(targetId);
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[145] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-[#161920] shadow-2xl"
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400">
              <ArrowRightLeft className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Transferir Conteúdo do Mapa</h3>
              <p className="text-[11px] text-zinc-400">
                Mova ou troque o esquema interno entre pastas/tópicos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Origem + Modo */}
        <div className="space-y-3 border-b border-zinc-800/80 bg-[#12151B] px-5 py-3.5">
          <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-[#0F1115] p-2.5">
            <HierarchyAvatar
              node={sourceNode}
              depth={getHierarchyDepth(hierarchy, sourceNode.id)}
              inheritedColor={getColor(sourceNode)}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              {sourcePath && (
                <p className="truncate text-[10px] text-zinc-500">{sourcePath}</p>
              )}
              <p className="truncate text-xs font-semibold text-zinc-100">{sourceNode.title}</p>
              <p className="text-[10.5px] text-indigo-300/85">
                {sourceStats.cards} {sourceStats.cards === 1 ? 'card' : 'cards'} •{' '}
                {sourceStats.extras} {sourceStats.extras === 1 ? 'elemento' : 'elementos'}
                {sourceStats.strokes > 0 ? ` • ${sourceStats.strokes} traços` : ''}
              </p>
            </div>
          </div>

          {/* Alternador Mover vs Trocar de Lugar */}
          <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-zinc-800 bg-[#0F1115] p-1">
            <button
              type="button"
              onClick={() => setMode('move')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-semibold transition ${
                mode === 'move'
                  ? 'bg-indigo-600/25 text-indigo-200 ring-1 ring-indigo-500/40'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <FolderInput className="h-3.5 w-3.5" /> Mover para destino
            </button>
            <button
              type="button"
              onClick={() => setMode('swap')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-semibold transition ${
                mode === 'swap'
                  ? 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ArrowRightLeft className="h-3.5 w-3.5" /> Trocar de lugar
            </button>
          </div>

          {hasSublevels && (
            <label className="flex cursor-pointer items-center gap-2 text-[11px] text-zinc-300">
              <input
                type="checkbox"
                checked={includeDescendants}
                onChange={(e) => {
                  setIncludeDescendants(e.target.checked);
                  setTargetId(null);
                }}
                className="h-3.5 w-3.5 rounded accent-indigo-500"
              />
              <span>Incluir conteúdo dos subníveis internos desta pasta</span>
            </label>
          )}

          {sourceTotal === 0 && mode === 'move' && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              <span>Esta pasta não possui itens no Canvas para mover.</span>
            </div>
          )}
        </div>

        {/* Busca + Lista de Destino */}
        <div className="flex min-h-0 flex-1 flex-col p-4">
          <div className="relative mb-2.5">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar pasta, assunto ou tópico de destino..."
              className="w-full rounded-xl border border-zinc-800 bg-[#0F1115] py-1.5 pl-8 pr-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="kc-no-scrollbar flex-1 space-y-1 overflow-y-auto pr-0.5">
            {targetOptions.length === 0 ? (
              <p className="py-8 text-center text-xs text-zinc-500">
                Nenhum destino disponível encontrado.
              </p>
            ) : (
              targetOptions.map(({ node, depth, path }) => {
                const selected = targetId === node.id;
                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => setTargetId(node.id)}
                    style={{ paddingLeft: `${10 + Math.min(depth, 4) * 14}px` }}
                    className={`flex w-full items-center gap-2.5 rounded-xl border py-2 pr-3 text-left transition ${
                      selected
                        ? 'border-indigo-500/60 bg-indigo-600/20 text-indigo-100'
                        : 'border-transparent bg-[#0F1115]/70 text-zinc-300 hover:border-zinc-800 hover:bg-[#1A1E28]'
                    }`}
                  >
                    <HierarchyAvatar
                      node={node}
                      depth={depth}
                      inheritedColor={getColor(node)}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">{node.title}</p>
                      <p className="truncate text-[10px] text-zinc-500">
                        {getHierarchyLevelLabel(node.level, depth)}
                        {path ? ` • ${path}` : ''}
                      </p>
                    </div>
                    {selected && <Check className="h-4 w-4 shrink-0 text-indigo-400" />}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-end gap-2 border-t border-zinc-800/80 bg-[#12151B] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3 py-1.5 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!targetId || busy || (mode === 'move' && sourceTotal === 0)}
            onClick={handleConfirm}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-40"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            {busy
              ? 'Processando...'
              : mode === 'swap'
              ? 'Trocar Conteúdos'
              : 'Transferir Agora'}
          </button>
        </div>
      </div>
    </div>
  );
}