'use client';

import React, { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, Plus, FolderTree, Hash, Trash2 } from 'lucide-react';
import { HierarchyLevel, HierarchyNode } from '@/domains/knowledge/types';
import { useKnowledgeStore } from '@/domains/knowledge/store/useKnowledgeStore';
import { useUiStore } from '@/domains/ui/store/useUiStore';

const NEXT_LEVEL: Record<HierarchyLevel, HierarchyLevel | null> = {
  discipline: 'subject',
  subject: 'subsubject',
  subsubject: 'topic',
  topic: null,
};

const LEVEL_LABEL: Record<HierarchyLevel, string> = {
  discipline: 'Disciplina',
  subject: 'Assunto',
  subsubject: 'Subassunto',
  topic: 'Tópico',
};

export function HierarchyTree() {
  const {
    activeWorkspaceId,
    hierarchy,
    cardsById,
    selectedHierarchyId,
    selectHierarchy,
    createHierarchyItem,
    renameHierarchyItem,
    deleteHierarchyItem,
  } = useKnowledgeStore();

  const { openConfirm, addToast } = useUiStore();

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [creatingUnder, setCreatingUnder] = useState<{
    parentId: string | null;
    level: HierarchyLevel;
  } | null>(null);
  const [draftTitle, setDraftTitle] = useState('');

  // Renomear inline com duplo clique
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const cardCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const card of Object.values(cardsById)) {
      for (const id of [card.disciplineId, card.subjectId, card.subsubjectId, card.topicId]) {
        if (id) counts[id] = (counts[id] ?? 0) + 1;
      }
    }
    return counts;
  }, [cardsById]);

  const handleConfirmCreate = async () => {
    if (!creatingUnder || !draftTitle.trim() || !activeWorkspaceId) {
      setCreatingUnder(null);
      return;
    }
    await createHierarchyItem({
      workspaceId: activeWorkspaceId,
      parentId: creatingUnder.parentId,
      level: creatingUnder.level,
      title: draftTitle.trim(),
      order: hierarchy.length + 1,
    });
    if (creatingUnder.parentId) {
      setExpanded((e) => ({ ...e, [creatingUnder.parentId!]: true }));
    }
    setDraftTitle('');
    setCreatingUnder(null);
  };

  const commitRename = async () => {
    if (renamingId && renameDraft.trim()) {
      await renameHierarchyItem(renamingId, renameDraft.trim());
    }
    setRenamingId(null);
  };

  const renderBranch = (parentId: string | null, depth = 0) => {
    const items = hierarchy.filter((h) => h.parentId === parentId);
    return items.map((node: HierarchyNode) => {
      const children = hierarchy.filter((h) => h.parentId === node.id);
      const isOpen = expanded[node.id] ?? depth === 0;
      const nextLevel = NEXT_LEVEL[node.level];
      const count = cardCounts[node.id] ?? 0;

      return (
        <div key={node.id} style={{ paddingLeft: depth > 0 ? 12 : 0 }}>
          <div
            className={`group flex items-center justify-between rounded-lg px-2 py-1.5 text-xs transition ${
              selectedHierarchyId === node.id
                ? 'bg-indigo-600/20 text-indigo-300'
                : 'text-zinc-300 hover:bg-zinc-800/60'
            }`}
          >
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              {nextLevel ? (
                <button
                  onClick={() => setExpanded((e) => ({ ...e, [node.id]: !isOpen }))}
                  className="text-zinc-500 hover:text-zinc-200"
                >
                  {isOpen ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </button>
              ) : (
                <Hash className="h-3 w-3 shrink-0 text-zinc-600" />
              )}

              {renamingId === node.id ? (
                <input
                  autoFocus
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  className="w-full rounded bg-zinc-900 px-1.5 py-0.5 text-xs text-zinc-100 ring-1 ring-indigo-500 focus:outline-none"
                />
              ) : (
                <button
                  onClick={() => selectHierarchy(node.id)}
                  onDoubleClick={() => {
                    setRenamingId(node.id);
                    setRenameDraft(node.title);
                  }}
                  className="truncate text-left font-medium"
                  title={`${LEVEL_LABEL[node.level]}: ${node.title} (duplo clique para renomear)`}
                >
                  {node.title}
                </button>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {count > 0 && (
                <span className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[10px] text-zinc-400">
                  {count}
                </span>
              )}
              {nextLevel && (
                <button
                  onClick={() => {
                    setCreatingUnder({ parentId: node.id, level: nextLevel });
                    setExpanded((e) => ({ ...e, [node.id]: true }));
                  }}
                  className="rounded p-0.5 text-zinc-500 opacity-0 transition hover:bg-zinc-700 hover:text-zinc-100 group-hover:opacity-100"
                  title={`Adicionar ${LEVEL_LABEL[nextLevel]}`}
                >
                  <Plus className="h-3 w-3" />
                </button>
              )}
              <button
                onClick={() =>
                  openConfirm({
                    title: `Remover ${LEVEL_LABEL[node.level]}?`,
                    description: `"${node.title}" será removido da árvore hierárquica. Seus Knowledge Cards continuam salvos.`,
                    confirmLabel: 'Remover',
                    variant: 'danger',
                    onConfirm: async () => {
                      await deleteHierarchyItem(node.id);
                      addToast({ message: `${LEVEL_LABEL[node.level]} removido`, variant: 'default' });
                    },
                  })
                }
                className="rounded p-0.5 text-zinc-500 opacity-0 transition hover:text-rose-400 group-hover:opacity-100"
                title="Remover"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>

          {creatingUnder?.parentId === node.id && (
            <div className="my-1 ml-5">
              <input
                autoFocus
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onBlur={handleConfirmCreate}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmCreate();
                  if (e.key === 'Escape') setCreatingUnder(null);
                }}
                placeholder={`Novo ${LEVEL_LABEL[creatingUnder.level]}...`}
                className="w-full rounded-md border border-indigo-500/60 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 focus:outline-none"
              />
            </div>
          )}

          {isOpen && children.length > 0 && (
            <div className="border-l border-zinc-800/70">{renderBranch(node.id, depth + 1)}</div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2">
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={() => selectHierarchy(null)}
          className={`flex items-center gap-2 rounded-lg px-2 py-1 text-xs font-medium transition ${
            selectedHierarchyId === null
              ? 'bg-indigo-600/20 text-indigo-300'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <FolderTree className="h-3.5 w-3.5" /> Todo o Conhecimento
        </button>
        <button
          onClick={() => setCreatingUnder({ parentId: null, level: 'discipline' })}
          className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-indigo-300"
          title="Nova Disciplina"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {creatingUnder?.parentId === null && (
        <input
          autoFocus
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          onBlur={handleConfirmCreate}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleConfirmCreate();
            if (e.key === 'Escape') setCreatingUnder(null);
          }}
          placeholder="Nova Disciplina (ex: Direito Tributário)..."
          className="mb-2 w-full rounded-md border border-indigo-500/60 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none"
        />
      )}

      <div className="space-y-0.5">{renderBranch(null, 0)}</div>
    </div>
  );
}