'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Flame,
  Pin,
  Star,
  History,
  CheckCircle2,
  RotateCcw,
  Brain,
  Play,
  FolderOpen,
  X,
  Sparkles,
  Braces,
} from 'lucide-react';
import { useKnowledgeStore } from '@/domains/knowledge/store/useKnowledgeStore';
import { useUiStore } from '@/domains/ui/store/useUiStore';
import { getKnowledgeRepository } from '@/infrastructure/persistence/repositoryFactory';
import { KnowledgeCardMeta, ReviewLog } from '@/domains/knowledge/types';
import { calculateSm2, formatIntervalLabel } from '../utils/sm2';
import { ClozeText, extractClozeItemsFromText } from './ClozeText';
import { StudyHeatmap } from './StudyHeatmap';

interface StudyQueueItem {
  id: string;
  cardId: string;
  cardTitle: string;
  kind: 'flashcard' | 'cloze';
  front: string;
  back: string;
}

export function ReviewPanel() {
  const { cardsById, notebooks, studySessions, openCard, recordCardReview } = useKnowledgeStore();
  const addToast = useUiStore((s) => s.addToast);

  const [filter, setFilter] = useState<'due' | 'pinned' | 'favorites' | 'critical'>('due');
  const [selectedNotebookId, setSelectedNotebookId] = useState<string>('');
  const [logs, setLogs] = useState<ReviewLog[]>([]);

  // Sessão Interativa de Flashcards + Lacunas {{...}}
  const [sessionQueue, setSessionQueue] = useState<StudyQueueItem[] | null>(null);
  const [sessionIndex, setSessionIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionStats, setSessionStats] = useState({ hard: 0, good: 0, easy: 0 });
  const [isLoadingSession, setIsLoadingSession] = useState(false);

  const refreshLogs = () => {
    getKnowledgeRepository().listReviewLogs(undefined, 400).then(setLogs);
  };

  useEffect(() => {
    refreshLogs();
  }, []);

  const cards = useMemo(() => {
    const all = Object.values(cardsById).filter((c) =>
      selectedNotebookId ? (c.notebookIds ?? []).includes(selectedNotebookId) : true
    );
    const now = Date.now();
    switch (filter) {
      case 'pinned':
        return all.filter((c) => c.isPinned);
      case 'favorites':
        return all.filter((c) => c.isFavorite);
      case 'critical':
        return all.filter((c) => c.importance !== 'normal');
      case 'due':
      default:
        return all.filter((c) => !c.nextReviewAt || c.nextReviewAt <= now + 86400000);
    }
  }, [cardsById, filter, selectedNotebookId]);

  // Exibe no histórico lateral apenas cards existentes (mantém todos os logs no Heatmap)
  const visibleLogs = useMemo(
    () => logs.filter((log) => Boolean(cardsById[log.cardId])).slice(0, 25),
    [logs, cardsById]
  );

  const getSm2Preview = (card: KnowledgeCardMeta) => {
    const base = {
      easeFactor: card.easeFactor,
      intervalDays: card.intervalDays,
      repetitions: card.repetitions,
    };
    return {
      hard: formatIntervalLabel(calculateSm2({ ...base, confidence: 'hard' }).intervalDays),
      good: formatIntervalLabel(calculateSm2({ ...base, confidence: 'good' }).intervalDays),
      easy: formatIntervalLabel(calculateSm2({ ...base, confidence: 'easy' }).intervalDays),
    };
  };

  const handleQuickReview = async (cardId: string, confidence: 'hard' | 'good' | 'easy') => {
    await recordCardReview(cardId, confidence);
    refreshLogs();
  };

  const handleStartFlashcardSession = async () => {
    if (cards.length === 0) return;
    setIsLoadingSession(true);
    try {
      const repo = getKnowledgeRepository();
      const fullCards = await Promise.all(cards.map((c) => repo.getFullCard(c.id)));
      const queue: StudyQueueItem[] = [];

      for (const full of fullCards) {
        if (!full) continue;

        for (const fc of full.content.flashcards) {
          queue.push({
            id: fc.id,
            cardId: full.meta.id,
            cardTitle: full.meta.title,
            kind: 'flashcard',
            front: fc.front,
            back: fc.back,
          });
        }

        const clozeItems = extractClozeItemsFromText(
          `${full.content.plainText}\n${full.meta.notes || ''}`
        );
        clozeItems.forEach((cl, idx) => {
          queue.push({
            id: `cloze-${full.meta.id}-${idx}`,
            cardId: full.meta.id,
            cardTitle: full.meta.title,
            kind: 'cloze',
            front: cl.masked,
            back: cl.revealed,
          });
        });
      }

      if (queue.length === 0) {
        addToast({
          message:
            'Nenhum flashcard ou lacuna {{...}} nos cards filtrados. Crie um no editor do card!',
          variant: 'default',
        });
        return;
      }

      setSessionQueue(queue);
      setSessionIndex(0);
      setIsFlipped(false);
      setSessionStats({ hard: 0, good: 0, easy: 0 });
    } finally {
      setIsLoadingSession(false);
    }
  };

  const handleGradeFlashcard = async (confidence: 'hard' | 'good' | 'easy') => {
    if (!sessionQueue) return;
    const current = sessionQueue[sessionIndex];
    if (!current) return;

    await recordCardReview(current.cardId, confidence);
    setSessionStats((prev) => ({ ...prev, [confidence]: prev[confidence] + 1 }));
    refreshLogs();

    setIsFlipped(false);
    setSessionIndex((i) => i + 1);
  };

  // Atalhos de teclado durante a sessão (Espaço, 1, 2, 3, Esc)
  useEffect(() => {
    if (!sessionQueue) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSessionQueue(null);
        return;
      }
      if (sessionIndex >= sessionQueue.length) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped((v) => !v);
      } else if (isFlipped && e.key === '1') {
        handleGradeFlashcard('hard');
      } else if (isFlipped && e.key === '2') {
        handleGradeFlashcard('good');
      } else if (isFlipped && e.key === '3') {
        handleGradeFlashcard('easy');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sessionQueue, sessionIndex, isFlipped]);

  // TELA FOCADA DE SESSÃO DE REVISÃO ATIVA
  if (sessionQueue) {
    const isFinished = sessionIndex >= sessionQueue.length;
    const current = sessionQueue[sessionIndex];
    const currentMeta = current ? cardsById[current.cardId] : null;
    const sm2Labels = currentMeta
      ? getSm2Preview(currentMeta)
      : { hard: '+1d', good: '+4d', easy: '+8d' };
    const progressPct = Math.round(
      (Math.min(sessionIndex, sessionQueue.length) / sessionQueue.length) * 100
    );

    return (
      <div className="flex h-full flex-col items-center justify-center bg-[#0F1115] p-6">
        <div className="w-full max-w-2xl">
          <div className="mb-4 flex items-center justify-between text-xs text-zinc-400">
            <span className="flex items-center gap-2 font-medium text-indigo-300">
              <Brain className="h-4 w-4" /> Sessão de Revisão Ativa (SM-2)
            </span>
            <div className="flex items-center gap-3">
              <span>
                {Math.min(sessionIndex + 1, sessionQueue.length)} / {sessionQueue.length}
              </span>
              <button
                onClick={() => setSessionQueue(null)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                title="Sair (Esc)"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-indigo-500 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {isFinished ? (
            <div className="rounded-2xl border border-zinc-800 bg-[#161920] p-10 text-center shadow-2xl">
              <Sparkles className="mx-auto mb-3 h-8 w-8 text-indigo-400" />
              <h2 className="text-xl font-bold text-zinc-100">Sessão Concluída!</h2>
              <p className="mt-1 text-xs text-zinc-400">
                Os intervalos SM-2 foram recalculados e seu Mapa de Constância foi atualizado.
              </p>

              <div className="my-6 grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-rose-500/10 p-3">
                  <p className="text-lg font-bold text-rose-300">{sessionStats.hard}</p>
                  <p className="text-[11px] text-rose-200/70">Difícil</p>
                </div>
                <div className="rounded-xl bg-sky-500/10 p-3">
                  <p className="text-lg font-bold text-sky-300">{sessionStats.good}</p>
                  <p className="text-[11px] text-sky-200/70">Bom</p>
                </div>
                <div className="rounded-xl bg-emerald-500/10 p-3">
                  <p className="text-lg font-bold text-emerald-300">{sessionStats.easy}</p>
                  <p className="text-[11px] text-emerald-200/70">Fácil</p>
                </div>
              </div>

              <button
                onClick={() => setSessionQueue(null)}
                className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500"
              >
                Voltar ao Painel de Revisão
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-zinc-800 bg-[#161920] p-8 shadow-2xl">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-400">
                    Card: {current.cardTitle}
                  </span>
                  {current.kind === 'cloze' && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 px-2 py-1 text-[10px] font-semibold text-amber-300">
                      <Braces className="h-3 w-3" /> Lacuna
                    </span>
                  )}
                </div>
                <button
                  onClick={() => openCard(current.cardId)}
                  className="text-[11px] text-indigo-400 hover:underline"
                >
                  Abrir card completo
                </button>
              </div>

              <div
                onClick={() => setIsFlipped((v) => !v)}
                className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-xl border border-zinc-800/80 bg-[#0F1115] p-6 text-center transition hover:border-indigo-500/40"
              >
                <span className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                  {isFlipped
                    ? 'Resposta'
                    : current.kind === 'cloze'
                    ? 'Complete a Lacuna'
                    : 'Pergunta'}
                </span>
                <p className="whitespace-pre-line text-lg font-medium leading-relaxed text-zinc-100">
                  {isFlipped ? current.back : current.front}
                </p>
              </div>

              <div className="mt-6">
                {!isFlipped ? (
                  <button
                    onClick={() => setIsFlipped(true)}
                    className="w-full rounded-xl bg-indigo-600 py-3 text-xs font-semibold text-white transition hover:bg-indigo-500"
                  >
                    Revelar Resposta (Espaço)
                  </button>
                ) : (
                  <div className="grid grid-cols-3 gap-2.5">
                    <button
                      onClick={() => handleGradeFlashcard('hard')}
                      className="rounded-xl bg-rose-500/15 py-3 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/25"
                    >
                      1 • Difícil ({sm2Labels.hard})
                    </button>
                    <button
                      onClick={() => handleGradeFlashcard('good')}
                      className="rounded-xl bg-sky-500/15 py-3 text-xs font-semibold text-sky-300 transition hover:bg-sky-500/25"
                    >
                      2 • Bom ({sm2Labels.good})
                    </button>
                    <button
                      onClick={() => handleGradeFlashcard('easy')}
                      className="rounded-xl bg-emerald-500/15 py-3 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/25"
                    >
                      3 • Fácil ({sm2Labels.easy})
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto px-6 py-6 lg:px-8">
      <div className="w-full max-w-[1440px]">
        {/* HEATMAP DE CONSTÂNCIA (16 SEMANAS) */}
        <StudyHeatmap reviewLogs={logs} studySessions={studySessions} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {/* Filtros + Botão Iniciar Flashcards & Lacunas */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: 'due', label: 'Revisão Rápida', icon: RotateCcw },
                  { id: 'critical', label: 'Alta Importância', icon: Flame },
                  { id: 'pinned', label: 'Pins Permanentes', icon: Pin },
                  { id: 'favorites', label: 'Favoritos', icon: Star },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setFilter(id as typeof filter)}
                    className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium transition ${
                      filter === id
                        ? 'bg-indigo-600 text-white'
                        : 'border border-zinc-800 bg-[#161920] text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </button>
                ))}
              </div>

              <button
                onClick={handleStartFlashcardSession}
                disabled={isLoadingSession || cards.length === 0}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500 disabled:opacity-40"
              >
                <Play className="h-3.5 w-3.5" />
                {isLoadingSession ? 'Carregando...' : 'Estudar Flashcards & Lacunas'}
              </button>
            </div>

            {/* Filtro por Caderno Personalizado */}
            {notebooks.length > 0 && (
              <div className="mb-5 flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-emerald-400" />
                <select
                  value={selectedNotebookId}
                  onChange={(e) => setSelectedNotebookId(e.target.value)}
                  className="rounded-xl border border-zinc-800 bg-[#161920] px-3 py-1.5 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Todos os Cadernos</option>
                  {notebooks.map((nb) => (
                    <option key={nb.id} value={nb.id}>
                      Caderno: {nb.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Lista de Cards na Fila */}
            <div className="space-y-3">
              {cards.length === 0 && (
                <div className="rounded-2xl border border-dashed border-zinc-800 p-10 text-center text-xs text-zinc-500">
                  Nenhum card encontrado para este filtro de revisão.
                </div>
              )}

              {cards.map((card) => {
                const sm2 = getSm2Preview(card);
                return (
                  <div
                    key={card.id}
                    className="rounded-2xl border border-zinc-800 bg-[#161920] p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="flex items-center gap-1.5 text-base font-semibold text-zinc-100">
                          {card.emoji && <span>{card.emoji}</span>}
                          {card.title}
                        </h3>
                        <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                          <ClozeText text={card.excerpt} />
                        </p>
                      </div>
                      <button
                        onClick={() => openCard(card.id)}
                        className="shrink-0 rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
                      >
                        Estudar
                      </button>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800/80 pt-3">
                      <span className="text-[11px] text-zinc-500">
                        Revisado {card.reviewCount}x • Facilidade{' '}
                        {(card.easeFactor ?? 2.5).toFixed(2)}
                        {card.nextReviewAt
                          ? ` • Próxima: ${new Date(card.nextReviewAt).toLocaleDateString('pt-BR')}`
                          : ''}
                      </span>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleQuickReview(card.id, 'hard')}
                          className="rounded-lg bg-rose-500/15 px-2.5 py-1 text-[11px] text-rose-300 hover:bg-rose-500/25"
                        >
                          Difícil ({sm2.hard})
                        </button>
                        <button
                          onClick={() => handleQuickReview(card.id, 'good')}
                          className="rounded-lg bg-sky-500/15 px-2.5 py-1 text-[11px] text-sky-300 hover:bg-sky-500/25"
                        >
                          Bom ({sm2.good})
                        </button>
                        <button
                          onClick={() => handleQuickReview(card.id, 'easy')}
                          className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/25"
                        >
                          Fácil ({sm2.easy})
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Histórico de Revisões */}
          <aside className="rounded-2xl border border-zinc-800 bg-[#161920] p-5">
            <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              <History className="h-4 w-4 text-indigo-400" /> Histórico de Revisões
            </div>
            <div className="space-y-2.5">
              {visibleLogs.length === 0 && (
                <p className="text-xs text-zinc-500">Nenhuma revisão registrada ainda.</p>
              )}
              {visibleLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between rounded-xl bg-zinc-900/70 px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    <span className="truncate text-zinc-200">
                      {cardsById[log.cardId]?.title}
                    </span>
                  </div>
                  <span className="ml-2 shrink-0 text-[10px] text-zinc-500">
                    {new Date(log.reviewedAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}