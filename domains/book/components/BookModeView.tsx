'use client';

import React, { useMemo, useState } from 'react';
import { BookOpen, Flame, Highlighter, FolderOpen } from 'lucide-react';
import { useKnowledgeStore } from '@/domains/knowledge/store/useKnowledgeStore';
import { useUiStore } from '@/domains/ui/store/useUiStore';
import { HierarchyNode, KnowledgeCardMeta } from '@/domains/knowledge/types';
import { BookCardReader } from './BookCardReader';
import { NotebookPickerModal } from '@/domains/knowledge/components/NotebookPickerModal';

interface TopicGroup {
  node: HierarchyNode;
  cards: KnowledgeCardMeta[];
}

interface SubsubjectGroup {
  node: HierarchyNode;
  directCards: KnowledgeCardMeta[];
  topics: TopicGroup[];
}

interface SubjectGroup {
  node: HierarchyNode;
  directCards: KnowledgeCardMeta[];
  subsubjects: SubsubjectGroup[];
}

interface ChapterGroup {
  discipline: HierarchyNode;
  directCards: KnowledgeCardMeta[];
  subjects: SubjectGroup[];
  totalCards: number;
}

export function BookModeView() {
  const { hierarchy, cardsById, notebooks, openCard } = useKnowledgeStore();
  const { preferences } = useUiStore();

  const bookWidthClass =
    preferences.bookWidth === 'narrow'
      ? 'max-w-3xl'
      : preferences.bookWidth === 'wide'
      ? 'max-w-none'
      : 'max-w-5xl';
  const [onlyCritical, setOnlyCritical] = useState(false);
  const [selectedNotebookId, setSelectedNotebookId] = useState<string>('');
  const [penModeEnabled, setPenModeEnabled] = useState(false);
  const [notebookModalCardId, setNotebookModalCardId] = useState<string | null>(null);

  const filteredCards = useMemo(() => {
    return Object.values(cardsById).filter((c) => {
      if (onlyCritical && c.importance === 'normal') return false;
      if (selectedNotebookId && !(c.notebookIds ?? []).includes(selectedNotebookId)) return false;
      return true;
    });
  }, [cardsById, onlyCritical, selectedNotebookId]);

  const { chapters, orphanCards } = useMemo(() => {
    const disciplines = hierarchy.filter((h) => h.level === 'discipline');
    const usedIds = new Set<string>();

    const compiled: ChapterGroup[] = disciplines.map((disc) => {
      const subjectNodes = hierarchy.filter((h) => h.level === 'subject' && h.parentId === disc.id);

      const subjects: SubjectGroup[] = subjectNodes.map((subj) => {
        const subNodes = hierarchy.filter(
          (h) => h.level === 'subsubject' && h.parentId === subj.id
        );

        const subsubjects: SubsubjectGroup[] = subNodes.map((sub) => {
          const topicNodes = hierarchy.filter((h) => h.level === 'topic' && h.parentId === sub.id);

          const topics: TopicGroup[] = topicNodes.map((top) => {
            const topCards = filteredCards.filter((c) => c.topicId === top.id);
            topCards.forEach((c) => usedIds.add(c.id));
            return { node: top, cards: topCards };
          });

          const subDirect = filteredCards.filter(
            (c) => c.subsubjectId === sub.id && !usedIds.has(c.id)
          );
          subDirect.forEach((c) => usedIds.add(c.id));

          return { node: sub, directCards: subDirect, topics };
        });

        const subjDirect = filteredCards.filter(
          (c) => c.subjectId === subj.id && !usedIds.has(c.id)
        );
        subjDirect.forEach((c) => usedIds.add(c.id));

        return { node: subj, directCards: subjDirect, subsubjects };
      });

      const discDirect = filteredCards.filter(
        (c) => c.disciplineId === disc.id && !usedIds.has(c.id)
      );
      discDirect.forEach((c) => usedIds.add(c.id));

      const totalCards =
        discDirect.length +
        subjects.reduce(
          (acc, s) =>
            acc +
            s.directCards.length +
            s.subsubjects.reduce(
              (acc2, ss) =>
                acc2 +
                ss.directCards.length +
                ss.topics.reduce((acc3, t) => acc3 + t.cards.length, 0),
              0
            ),
          0
        );

      return { discipline: disc, directCards: discDirect, subjects, totalCards };
    });

    const orphans = filteredCards.filter((c) => !usedIds.has(c.id));
    return { chapters: compiled, orphanCards: orphans };
  }, [hierarchy, filteredCards]);

  return (
    <div className="flex h-full bg-[#111318] text-zinc-200">
      {/* SUMÁRIO NAVEGÁVEL (4 NÍVEIS) */}
      <aside className="hidden w-76 shrink-0 flex-col border-r border-zinc-800/80 bg-[#12151B] lg:flex">
        <div className="space-y-3 border-b border-zinc-800/80 p-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-300">
              <BookOpen className="h-3.5 w-3.5 text-indigo-400" /> Sumário Interativo
            </span>
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
              {filteredCards.length} cards
            </span>
          </div>

          {/* Controles de Leitura */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPenModeEnabled((v) => !v)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition ${
                penModeEnabled
                  ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40'
                  : 'border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
              }`}
              title="Ativar marca-texto direto na leitura"
            >
              <Highlighter className="h-3.5 w-3.5" /> Modo Canetas
            </button>
            <button
              type="button"
              onClick={() => setOnlyCritical((v) => !v)}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition ${
                onlyCritical
                  ? 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40'
                  : 'border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Flame className="h-3.5 w-3.5" /> Críticos
            </button>
          </div>

          {/* Filtro por Caderno Personalizado */}
          {notebooks.length > 0 && (
            <div className="flex items-center gap-1.5">
              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              <select
                value={selectedNotebookId}
                onChange={(e) => setSelectedNotebookId(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-[11px] text-zinc-200 focus:border-indigo-500 focus:outline-none"
              >
                <option value="">Todos os Cadernos</option>
                {notebooks.map((nb) => (
                  <option key={nb.id} value={nb.id}>
                    {nb.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Árvore de Capítulos */}
        <nav className="flex-1 space-y-4 overflow-y-auto p-4">
          {chapters.map((ch, idx) => (
            <div key={ch.discipline.id}>
              <a
                href={`#chap-${ch.discipline.id}`}
                className="flex items-center justify-between text-xs font-semibold text-zinc-100 hover:text-indigo-400"
              >
                <span className="truncate">
                  Cap. {idx + 1} — {ch.discipline.title}
                </span>
                <span className="ml-2 text-[10px] text-zinc-500">{ch.totalCards}</span>
              </a>

              <div className="mt-1.5 space-y-1.5 border-l border-zinc-800 pl-3">
                {ch.subjects.map((sec) => (
                  <div key={sec.node.id}>
                    <a
                      href={`#sec-${sec.node.id}`}
                      className="block truncate text-xs text-zinc-300 hover:text-indigo-300"
                    >
                      {sec.node.title}
                    </a>
                    {sec.subsubjects.map((ss) => (
                      <div key={ss.node.id} className="ml-2.5 mt-1 border-l border-zinc-800/70 pl-2">
                        <a
                          href={`#sub-${ss.node.id}`}
                          className="block truncate text-[11px] text-zinc-400 hover:text-zinc-200"
                        >
                          {ss.node.title}
                        </a>
                        {ss.topics.map((top) => (
                          <a
                            key={top.node.id}
                            href={`#top-${top.node.id}`}
                            className="ml-2 mt-0.5 block truncate text-[10.5px] text-zinc-500 hover:text-zinc-300"
                          >
                            • {top.node.title}
                          </a>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {orphanCards.length > 0 && (
            <a
              href="#chap-orphans"
              className="block text-xs font-medium text-zinc-400 hover:text-indigo-300"
            >
              Notas Avulsas ({orphanCards.length})
            </a>
          )}
        </nav>
      </aside>

      {/* LEITURA EDITORIAL CONTÍNUA */}
      <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-10">
        <div className={`${bookWidthClass} space-y-14 transition-all duration-200`}>
          {filteredCards.length === 0 && (
            <div className="rounded-2xl border border-dashed border-zinc-800 p-12 text-center text-sm text-zinc-500">
              Nenhum Knowledge Card corresponde aos filtros atuais.
            </div>
          )}

          {chapters
            .filter((ch) => ch.totalCards > 0)
            .map((ch, idx) => (
              <section key={ch.discipline.id} id={`chap-${ch.discipline.id}`}>
                <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
                  Capítulo {idx + 1}
                </p>
                <h1 className="mt-1 border-b border-zinc-800 pb-4 font-serif text-3xl font-bold text-zinc-100">
                  {ch.discipline.title}
                </h1>

                {ch.directCards.length > 0 && (
                  <div className="mt-6 space-y-6">
                    {ch.directCards.map((card) => (
                      <BookCardReader
                        key={card.id}
                        card={card}
                        penModeEnabled={penModeEnabled}
                        onOpenEditor={openCard}
                        onOpenNotebooks={setNotebookModalCardId}
                      />
                    ))}
                  </div>
                )}

                <div className="mt-8 space-y-12">
                  {ch.subjects.map((sec) => (
                    <div key={sec.node.id} id={`sec-${sec.node.id}`}>
                      <h2 className="mb-5 text-xl font-semibold tracking-tight text-zinc-100">
                        {sec.node.title}
                      </h2>

                      {sec.directCards.length > 0 && (
                        <div className="mb-6 space-y-6">
                          {sec.directCards.map((card) => (
                            <BookCardReader
                              key={card.id}
                              card={card}
                              penModeEnabled={penModeEnabled}
                              onOpenEditor={openCard}
                              onOpenNotebooks={setNotebookModalCardId}
                            />
                          ))}
                        </div>
                      )}

                      {sec.subsubjects.map((ss) => (
                        <div key={ss.node.id} id={`sub-${ss.node.id}`} className="mt-8">
                          <h3 className="mb-4 border-l-2 border-indigo-500/60 pl-3 text-base font-semibold text-zinc-200">
                            {ss.node.title}
                          </h3>

                          {ss.directCards.length > 0 && (
                            <div className="mb-6 space-y-6">
                              {ss.directCards.map((card) => (
                                <BookCardReader
                                  key={card.id}
                                  card={card}
                                  penModeEnabled={penModeEnabled}
                                  onOpenEditor={openCard}
                                  onOpenNotebooks={setNotebookModalCardId}
                                />
                              ))}
                            </div>
                          )}

                          {ss.topics.map((top) => (
                            <div key={top.node.id} id={`top-${top.node.id}`} className="mt-6">
                              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-indigo-300/90">
                                {top.node.title}
                              </h4>
                              <div className="space-y-6">
                                {top.cards.map((card) => (
                                  <BookCardReader
                                    key={card.id}
                                    card={card}
                                    penModeEnabled={penModeEnabled}
                                    onOpenEditor={openCard}
                                    onOpenNotebooks={setNotebookModalCardId}
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            ))}

          {orphanCards.length > 0 && (
            <section id="chap-orphans">
              <h1 className="border-b border-zinc-800 pb-4 font-serif text-2xl font-bold text-zinc-200">
                Notas Avulsas
              </h1>
              <div className="mt-6 space-y-6">
                {orphanCards.map((card) => (
                  <BookCardReader
                    key={card.id}
                    card={card}
                    penModeEnabled={penModeEnabled}
                    onOpenEditor={openCard}
                    onOpenNotebooks={setNotebookModalCardId}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <NotebookPickerModal
        cardId={notebookModalCardId}
        onClose={() => setNotebookModalCardId(null)}
      />
    </div>
  );
}