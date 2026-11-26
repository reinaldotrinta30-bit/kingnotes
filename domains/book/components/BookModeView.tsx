'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Flame,
  Highlighter,
  FolderOpen,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  Shapes,
  Layers,
  Printer,
  FileDown,
  Settings2,
  ListOrdered,
  RefreshCw,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
} from 'lucide-react';
import { useKnowledgeStore } from '@/domains/knowledge/store/useKnowledgeStore';
import { useUiStore } from '@/domains/ui/store/useUiStore';
import {
  BookItemEntry,
  BookItemRole,
  BookProjectConfig,
  FullKnowledgeCard,
} from '@/domains/knowledge/types';
import { getHierarchyBreadcrumb } from '@/domains/knowledge/utils/hierarchyContext';
import { getKnowledgeRepository } from '@/infrastructure/persistence/repositoryFactory';
import {
  BookCompiledBlock,
  DEFAULT_BOOK_CONFIG,
  buildSuggestedBookOrder,
  compileBookDocument,
  cycleBookRole,
  exportBookModelToMarkdown,
  getBookEntryLabel,
  reconcileBookOutline,
} from '../utils/bookCompiler';
import { BookCardReader } from './BookCardReader';
import { BookFreeTextBlock } from './BookFreeTextBlock';
import { BookImageBlock } from './BookImageBlock';
import { NotebookPickerModal } from '@/domains/knowledge/components/NotebookPickerModal';

type StudioTab = 'outline' | 'editorial';

const ROLE_BADGE: Record<BookItemRole, { short: string; label: string; cls: string }> = {
  chapter: {
    short: 'Cap.',
    label: 'Capítulo (clique para mudar para Seção)',
    cls: 'border-indigo-500/50 bg-indigo-500/20 text-indigo-200',
  },
  section: {
    short: 'Seç.',
    label: 'Seção (clique para mudar para Conteúdo)',
    cls: 'border-sky-500/50 bg-sky-500/15 text-sky-300',
  },
  content: {
    short: 'Item',
    label: 'Conteúdo (clique para promover a Capítulo)',
    cls: 'border-zinc-700 bg-zinc-900 text-zinc-400',
  },
};

const MARGIN_PADDING_CLASS: Record<'narrow' | 'normal' | 'wide', string> = {
  narrow: 'px-6 py-7 md:px-10 md:py-9',
  normal: 'px-8 py-10 md:px-14 md:py-12',
  wide: 'px-10 py-12 md:px-20 md:py-16',
};

/** Agrupa blocos compilados em folhas lógicas quando "Quebras de Página" está ativo */
function groupBlocksIntoPages(blocks: BookCompiledBlock[]): BookCompiledBlock[][] {
  if (blocks.length === 0) return [];
  const pages: BookCompiledBlock[][] = [];
  let current: BookCompiledBlock[] = [];
  let weight = 0;

  const blockWeight = (b: BookCompiledBlock) => {
    if (b.entry.role === 'chapter') return 2;
    if (b.entry.role === 'section') return 1.5;
    if (b.entry.sourceType === 'image') return 3.2;
    if (b.entry.sourceType === 'card') {
      const len = b.card?.excerpt?.length ?? 80;
      return len > 180 ? 3.5 : 2.5;
    }
    return 1.8;
  };

  for (const block of blocks) {
    // Novo capítulo sempre inicia em nova folha (se a atual já tem conteúdo)
    if (block.entry.role === 'chapter' && current.length > 0) {
      pages.push(current);
      current = [];
      weight = 0;
    }

    const w = blockWeight(block);
    if (current.length > 0 && weight + w > 8.5) {
      pages.push(current);
      current = [];
      weight = 0;
    }

    current.push(block);
    weight += w;
  }

  if (current.length > 0) pages.push(current);
  return pages;
}

export function BookModeView() {
  const {
    workspaces,
    activeWorkspaceId,
    hierarchy,
    selectedHierarchyId,
    cardsById,
    canvasNodes,
    canvasEdges,
    notebooks,
    openCard,
    updateWorkspaceBookConfig,
  } = useKnowledgeStore();
  const { theme, preferences, addToast, openConfirm } = useUiStore();

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId) ?? null,
    [workspaces, activeWorkspaceId]
  );

  const savedConfig = activeWorkspace?.bookConfig;

  const [studioTab, setStudioTab] = useState<StudioTab>('outline');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [onlyCritical, setOnlyCritical] = useState(false);
  const [selectedNotebookId, setSelectedNotebookId] = useState<string>('');
  const [penModeEnabled, setPenModeEnabled] = useState(false);
  const [notebookModalCardId, setNotebookModalCardId] = useState<string | null>(null);
  const [exportingMd, setExportingMd] = useState(false);

  // Estado local fluido para inputs editoriais com salvamento debounced
  const [titleDraft, setTitleDraft] = useState(
    savedConfig?.title ?? activeWorkspace?.name ?? DEFAULT_BOOK_CONFIG.title
  );
  const [subtitleDraft, setSubtitleDraft] = useState(
    savedConfig?.subtitle ?? DEFAULT_BOOK_CONFIG.subtitle
  );
  const [headerDraft, setHeaderDraft] = useState(savedConfig?.headerText ?? '');
  const [footerDraft, setFooterDraft] = useState(
    savedConfig?.footerText ?? DEFAULT_BOOK_CONFIG.footerText
  );

  // Drag-and-drop nativo na lista do organizador
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const metaSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTitleDraft(savedConfig?.title ?? activeWorkspace?.name ?? DEFAULT_BOOK_CONFIG.title);
    setSubtitleDraft(savedConfig?.subtitle ?? DEFAULT_BOOK_CONFIG.subtitle);
    setHeaderDraft(savedConfig?.headerText ?? '');
    setFooterDraft(savedConfig?.footerText ?? DEFAULT_BOOK_CONFIG.footerText);
  }, [activeWorkspaceId, savedConfig?.updatedAt]);

  useEffect(() => {
    return () => {
      if (metaSaveTimerRef.current) clearTimeout(metaSaveTimerRef.current);
    };
  }, []);

  const scheduleMetaPatch = (patch: Partial<BookProjectConfig>) => {
    if (metaSaveTimerRef.current) clearTimeout(metaSaveTimerRef.current);
    metaSaveTimerRef.current = setTimeout(() => {
      updateWorkspaceBookConfig(patch);
    }, 320);
  };

  const contextBreadcrumb = useMemo(
    () => getHierarchyBreadcrumb(hierarchy, selectedHierarchyId),
    [hierarchy, selectedHierarchyId]
  );

  const canvasNodesById = useMemo(
    () => new Map(canvasNodes.map((n) => [n.id, n])),
    [canvasNodes]
  );

  // 1) Sugestão inteligente baseada em Hierarquia + Tópicos + Grafo de Conexões
  const suggestedEntries = useMemo(
    () =>
      buildSuggestedBookOrder({
        hierarchy,
        selectedHierarchyId,
        cardsById,
        canvasNodes,
        canvasEdges,
        onlyCritical,
        selectedNotebookId,
      }),
    [
      hierarchy,
      selectedHierarchyId,
      cardsById,
      canvasNodes,
      canvasEdges,
      onlyCritical,
      selectedNotebookId,
    ]
  );

  // 2) Conciliação com a ordem manual salva pelo usuário (separada das coordenadas X/Y)
  const orderedEntries = useMemo(
    () => reconcileBookOutline(savedConfig?.outlineOrder, suggestedEntries),
    [savedConfig?.outlineOrder, suggestedEntries]
  );

  // 3) Compilação para o modelo abstrato desacoplado (BookDocumentModel)
  const effectiveConfig: BookProjectConfig = useMemo(
    () => ({
      ...DEFAULT_BOOK_CONFIG,
      ...savedConfig,
      title: titleDraft,
      subtitle: subtitleDraft,
      headerText: headerDraft,
      footerText: footerDraft,
    }),
    [savedConfig, titleDraft, subtitleDraft, headerDraft, footerDraft]
  );

  const bookDocument = useMemo(
    () =>
      compileBookDocument({
        config: effectiveConfig,
        workspaceName: activeWorkspace?.name ?? 'Knowledge Canvas',
        entries: orderedEntries,
        hierarchy,
        cardsById,
        canvasNodes,
      }),
    [effectiveConfig, activeWorkspace?.name, orderedEntries, hierarchy, cardsById, canvasNodes]
  );

  const pagedBlocks = useMemo(
    () => (bookDocument.showPageBreaks ? groupBlocksIntoPages(bookDocument.blocks) : []),
    [bookDocument.showPageBreaks, bookDocument.blocks]
  );

  const persistOrder = (nextEntries: BookItemEntry[]) => {
    updateWorkspaceBookConfig({ outlineOrder: nextEntries });
  };

  const handleToggleInclude = (entryId: string) => {
    persistOrder(
      orderedEntries.map((e) => (e.id === entryId ? { ...e, included: !e.included } : e))
    );
  };

  const handleCycleRole = (entryId: string) => {
    persistOrder(
      orderedEntries.map((e) => (e.id === entryId ? { ...e, role: cycleBookRole(e.role) } : e))
    );
  };

  const handleMoveEntry = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= orderedEntries.length) return;
    const next = [...orderedEntries];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    persistOrder(next);
  };

  const handleDropReorder = (targetId: string) => {
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }
    const fromIdx = orderedEntries.findIndex((e) => e.id === draggingId);
    const toIdx = orderedEntries.findIndex((e) => e.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const next = [...orderedEntries];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    persistOrder(next);
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleRebuildSuggestedOrder = () => {
    const apply = () => {
      persistOrder(suggestedEntries);
      addToast({
        message: 'Sequência sugerida gerada a partir da hierarquia, tópicos e conexões do Canvas',
        variant: 'success',
      });
    };

    if (savedConfig?.outlineOrder && savedConfig.outlineOrder.length > 0) {
      openConfirm({
        title: 'Recalcular sequência sugerida?',
        description:
          'A ordem manual personalizada do livro será substituída pela sequência inteligente baseada em tópicos, conexões e hierarquia. Nada no seu Canvas será alterado.',
        confirmLabel: 'Recalcular sequência',
        onConfirm: apply,
      });
      return;
    }
    apply();
  };

  const handleExportMarkdown = async () => {
    setExportingMd(true);
    try {
      const repo = getKnowledgeRepository();
      const cardBlocks = bookDocument.blocks.filter(
        (b) => b.entry.sourceType === 'card' && b.card
      );
      const loaded = await Promise.all(
        cardBlocks.map((b) => repo.getFullCard(b.card!.id))
      );
      const fullMap: Record<string, FullKnowledgeCard> = {};
      for (const fc of loaded) {
        if (fc) fullMap[fc.meta.id] = fc;
      }

      const md = exportBookModelToMarkdown(bookDocument, fullMap);
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeName = bookDocument.title
        .toLowerCase()
        .replace(/[^a-z0-9à-ÿ]+/gi, '-')
        .replace(/(^-|-$)/g, '');
      a.href = url;
      a.download = `${safeName || 'livro-estudos'}.md`;
      a.click();
      URL.revokeObjectURL(url);
      addToast({ message: 'Livro exportado em Markdown (.md)', variant: 'success' });
    } finally {
      setExportingMd(false);
    }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const bookWidthClass =
    bookDocument.showPageBreaks
      ? 'max-w-[820px]'
      : preferences.bookWidth === 'narrow'
      ? 'max-w-3xl'
      : preferences.bookWidth === 'wide'
      ? 'max-w-6xl'
      : 'max-w-4xl';

  const isPrintSheetMode = bookDocument.showPageBreaks;
  const sheetMarginClass = MARGIN_PADDING_CLASS[bookDocument.margins];

  const renderCompiledBlock = (block: BookCompiledBlock) => {
    const { entry, title, chapterNumber, sectionLabel, card, canvasNode, contextLabel } = block;
    const isLightSheet = isPrintSheetMode || theme === 'paper';

    return (
      <section key={entry.id} id={`book-item-${entry.id}`} className="space-y-4">
        {/* Cabeçalho de Capítulo / Seção conforme papel escolhido pelo usuário */}
        {entry.role === 'chapter' && (
          <header
            className={`border-b pb-3 ${
              isLightSheet ? 'border-stone-300' : 'border-zinc-800'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-500">
                Capítulo {chapterNumber}
              </span>
              {contextLabel && (
                <span className="text-[10.5px] text-zinc-500">{contextLabel}</span>
              )}
            </div>
            <h1
              className={`mt-1 font-serif text-3xl font-bold tracking-tight ${
                isLightSheet ? 'text-zinc-900' : 'text-zinc-100'
              }`}
            >
              {canvasNode?.topicConfig?.icon ? `${canvasNode.topicConfig.icon} ` : ''}
              {title}
            </h1>
          </header>
        )}

        {entry.role === 'section' && (
          <header className="pt-2">
            <h2
              className={`flex items-baseline gap-2 border-l-[3px] border-indigo-500 pl-3 text-xl font-semibold tracking-tight ${
                isLightSheet ? 'text-zinc-800' : 'text-zinc-100'
              }`}
            >
              <span className="font-mono text-sm font-bold text-indigo-500">{sectionLabel}</span>
              <span>
                {canvasNode?.topicConfig?.icon ? `${canvasNode.topicConfig.icon} ` : ''}
                {title}
              </span>
            </h2>
          </header>
        )}

        {entry.role === 'content' && entry.sourceType === 'topic' && (
          <h3
            className={`pt-1 text-base font-semibold tracking-tight ${
              isLightSheet ? 'text-zinc-800' : 'text-zinc-200'
            }`}
          >
            {canvasNode?.topicConfig?.icon ? `${canvasNode.topicConfig.icon} ` : '• '}
            {title}
          </h3>
        )}

        {/* Corpo do elemento */}
        {entry.sourceType === 'card' && card && (
          <BookCardReader
            card={card}
            penModeEnabled={penModeEnabled}
            showCallouts={bookDocument.includeCallouts}
            hideTitle={entry.role !== 'content'}
            isPrintSheet={isPrintSheetMode}
            onOpenEditor={openCard}
            onOpenNotebooks={setNotebookModalCardId}
          />
        )}

        {entry.sourceType === 'text' && canvasNode && (
          <BookFreeTextBlock
            node={canvasNode}
            showCallouts={bookDocument.includeCallouts}
            theme={theme}
            isPrintSheet={isPrintSheetMode}
          />
        )}

        {entry.sourceType === 'image' && canvasNode && (
          <BookImageBlock node={canvasNode} isPrintSheet={isPrintSheetMode} />
        )}
      </section>
    );
  };

  const entryIcon = (type: BookItemEntry['sourceType']) => {
    switch (type) {
      case 'topic':
        return <Shapes className="h-3.5 w-3.5 shrink-0 text-violet-400" />;
      case 'card':
        return <Layers className="h-3.5 w-3.5 shrink-0 text-indigo-400" />;
      case 'text':
        return <FileText className="h-3.5 w-3.5 shrink-0 text-amber-400" />;
      case 'image':
        return <ImageIcon className="h-3.5 w-3.5 shrink-0 text-emerald-400" />;
    }
  };

  return (
    <div className="flex h-full bg-[#111318] text-zinc-200">
      {/* PAINEL EDITORIAL ESQUERDO (ORGANIZADOR DE SEQUÊNCIA + LAYOUT DE LIVRO) */}
      {sidebarOpen && (
        <aside className="kc-no-print flex w-80 shrink-0 flex-col border-r border-zinc-800/80 bg-[#12151B]">
          {/* Cabeçalho + Abas do Estúdio */}
          <div className="space-y-3 border-b border-zinc-800/80 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-200">
                <BookOpen className="h-3.5 w-3.5 text-indigo-400" /> Estúdio do Livro
              </span>
              <div className="flex items-center gap-1">
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                  {bookDocument.blocks.length}/{orderedEntries.length}
                </span>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                  title="Recolher organizador"
                >
                  <PanelLeftClose className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1 rounded-xl border border-zinc-800 bg-[#0F1115] p-1">
              <button
                type="button"
                onClick={() => setStudioTab('outline')}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-medium transition ${
                  studioTab === 'outline'
                    ? 'bg-indigo-600/25 text-indigo-200'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <ListOrdered className="h-3.5 w-3.5" /> Sequência
              </button>
              <button
                type="button"
                onClick={() => setStudioTab('editorial')}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-medium transition ${
                  studioTab === 'editorial'
                    ? 'bg-indigo-600/25 text-indigo-200'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Settings2 className="h-3.5 w-3.5" /> Página & Capa
              </button>
            </div>
          </div>

          {/* ABA 1: SEQUÊNCIA REORGANIZÁVEL + FILTROS DE CONTEÚDO */}
          {studioTab === 'outline' && (
            <div className="flex min-h-0 flex-1 flex-col">
              {/* Filtros rápidos e elementos incluídos */}
              <div className="space-y-2.5 border-b border-zinc-800/70 p-3.5">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPenModeEnabled((v) => !v)}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition ${
                      penModeEnabled
                        ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40'
                        : 'border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    <Highlighter className="h-3.5 w-3.5" /> Canetas
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

                {notebooks.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <FolderOpen className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    <select
                      value={selectedNotebookId}
                      onChange={(e) => setSelectedNotebookId(e.target.value)}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-200 focus:border-indigo-500 focus:outline-none"
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

                {/* Tipos de elementos incluídos */}
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {(
                    [
                      {
                        key: 'includeFreeTexts',
                        label: 'Textos livres',
                        active: bookDocument.includeFreeTexts,
                      },
                      {
                        key: 'includeImages',
                        label: 'Imagens',
                        active: bookDocument.includeImages,
                      },
                      {
                        key: 'includeCallouts',
                        label: 'Pegadinhas',
                        active: bookDocument.includeCallouts,
                      },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => updateWorkspaceBookConfig({ [item.key]: !item.active })}
                      className={`rounded-md border px-2 py-0.5 text-[10.5px] font-medium transition ${
                        item.active
                          ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-200'
                          : 'border-zinc-800 bg-zinc-900 text-zinc-500 line-through'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Arraste para reordenar
                  </span>
                  <button
                    type="button"
                    onClick={handleRebuildSuggestedOrder}
                    className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium text-indigo-300 hover:bg-indigo-500/15"
                    title="Recalcular ordem inteligente usando tópicos, hierarquia e conexões do Canvas"
                  >
                    <RefreshCw className="h-3 w-3" /> Sugerir do Canvas
                  </button>
                </div>
              </div>

              {/* Lista Arrastável de Itens do Livro */}
              <div className="flex-1 space-y-1 overflow-y-auto p-2.5">
                {orderedEntries.length === 0 ? (
                  <p className="p-4 text-center text-xs text-zinc-500">
                    Nenhum item no contexto atual. Crie tópicos, cards ou textos livres no Canvas.
                  </p>
                ) : (
                  orderedEntries.map((entry, idx) => {
                    const label = getBookEntryLabel(entry, cardsById, canvasNodesById);
                    const badge = ROLE_BADGE[entry.role];
                    const isOver = dragOverId === entry.id && draggingId !== entry.id;

                    return (
                      <div
                        key={entry.id}
                        draggable
                        onDragStart={() => setDraggingId(entry.id)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (dragOverId !== entry.id) setDragOverId(entry.id);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          handleDropReorder(entry.id);
                        }}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setDragOverId(null);
                        }}
                        className={`group flex items-center gap-1.5 rounded-xl border px-2 py-1.5 text-xs transition ${
                          isOver
                            ? 'border-indigo-400 bg-indigo-500/15'
                            : entry.included
                            ? 'border-zinc-800/80 bg-[#161920] hover:border-zinc-700'
                            : 'border-zinc-900 bg-[#0F1115]/60 opacity-45'
                        }`}
                      >
                        <span
                          className="cursor-grab text-zinc-600 hover:text-zinc-300 active:cursor-grabbing"
                          title="Arraste para mover"
                        >
                          <GripVertical className="h-3.5 w-3.5" />
                        </span>

                        <button
                          type="button"
                          onClick={() => handleToggleInclude(entry.id)}
                          className="shrink-0 text-zinc-400 hover:text-indigo-300"
                          title={entry.included ? 'Ocultar do livro' : 'Incluir no livro'}
                        >
                          {entry.included ? (
                            <Eye className="h-3.5 w-3.5" />
                          ) : (
                            <EyeOff className="h-3.5 w-3.5 text-zinc-600" />
                          )}
                        </button>

                        {entryIcon(entry.sourceType)}

                        <a
                          href={`#book-item-${entry.id}`}
                          className={`min-w-0 flex-1 truncate text-left ${
                            entry.role === 'chapter'
                              ? 'font-semibold text-zinc-100'
                              : entry.role === 'section'
                              ? 'font-medium text-zinc-200'
                              : 'text-zinc-400'
                          } hover:text-indigo-300`}
                          title={label}
                        >
                          {label}
                        </a>

                        {/* Papel editorial: Capítulo / Seção / Conteúdo */}
                        <button
                          type="button"
                          onClick={() => handleCycleRole(entry.id)}
                          title={badge.label}
                          className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[9.5px] font-semibold transition hover:brightness-125 ${badge.cls}`}
                        >
                          {badge.short}
                        </button>

                        {/* Controles de teclado/precisão Subir/Descer */}
                        <div className="flex shrink-0 flex-col opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveEntry(idx, -1)}
                            className="text-zinc-500 hover:text-zinc-100 disabled:opacity-20"
                            title="Mover para cima"
                            aria-label="Mover item para cima"
                          >
                            <ArrowUp className="h-2.5 w-2.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === orderedEntries.length - 1}
                            onClick={() => handleMoveEntry(idx, 1)}
                            className="text-zinc-500 hover:text-zinc-100 disabled:opacity-20"
                            title="Mover para baixo"
                            aria-label="Mover item para baixo"
                          >
                            <ArrowDown className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ABA 2: CONFIGURAÇÕES EDITORIAIS (CAPA, CABEÇALHO, RODAPÉ, MARGENS E QUEBRAS) */}
          {studioTab === 'editorial' && (
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <div className="space-y-2.5">
                <span className="block text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">
                  Identificação do Livro
                </span>

                <div>
                  <label className="mb-1 block text-[11px] text-zinc-400">Título</label>
                  <input
                    value={titleDraft}
                    onChange={(e) => {
                      setTitleDraft(e.target.value);
                      scheduleMetaPatch({ title: e.target.value });
                    }}
                    placeholder="Título do material..."
                    className="w-full rounded-xl border border-zinc-800 bg-[#0F1115] px-3 py-2 text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] text-zinc-400">Subtítulo</label>
                  <input
                    value={subtitleDraft}
                    onChange={(e) => {
                      setSubtitleDraft(e.target.value);
                      scheduleMetaPatch({ subtitle: e.target.value });
                    }}
                    placeholder="Ex: Resumo esquematizado para revisão final"
                    className="w-full rounded-xl border border-zinc-800 bg-[#0F1115] px-3 py-2 text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="h-px bg-zinc-800/80" />

              <div className="space-y-2.5">
                <span className="block text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">
                  Cabeçalho & Rodapé
                </span>

                <div>
                  <label className="mb-1 block text-[11px] text-zinc-400">Cabeçalho da página</label>
                  <input
                    value={headerDraft}
                    onChange={(e) => {
                      setHeaderDraft(e.target.value);
                      scheduleMetaPatch({ headerText: e.target.value });
                    }}
                    placeholder="Ex: Direito Previdenciário • Apostila"
                    className="w-full rounded-xl border border-zinc-800 bg-[#0F1115] px-3 py-2 text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] text-zinc-400">Rodapé da página</label>
                  <input
                    value={footerDraft}
                    onChange={(e) => {
                      setFooterDraft(e.target.value);
                      scheduleMetaPatch({ footerText: e.target.value });
                    }}
                    placeholder="Ex: Material de uso pessoal"
                    className="w-full rounded-xl border border-zinc-800 bg-[#0F1115] px-3 py-2 text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-zinc-800 bg-[#0F1115] px-3 py-2 text-xs text-zinc-300">
                  <span>Numerar páginas</span>
                  <input
                    type="checkbox"
                    checked={bookDocument.showPageNumbers}
                    onChange={(e) =>
                      updateWorkspaceBookConfig({ showPageNumbers: e.target.checked })
                    }
                    className="accent-indigo-500"
                  />
                </label>
              </div>

              <div className="h-px bg-zinc-800/80" />

              <div className="space-y-2.5">
                <span className="block text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">
                  Diagramação & Paginação
                </span>

                <div>
                  <label className="mb-1.5 block text-[11px] text-zinc-400">Margens da página</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'narrow', label: 'Estreita' },
                        { id: 'normal', label: 'Normal' },
                        { id: 'wide', label: 'Ampla' },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => updateWorkspaceBookConfig({ margins: m.id })}
                        className={`rounded-lg border py-1.5 text-[11px] font-medium transition ${
                          bookDocument.margins === m.id
                            ? 'border-indigo-500 bg-indigo-600/20 text-indigo-200'
                            : 'border-zinc-800 bg-[#0F1115] text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-zinc-800 bg-[#0F1115] px-3 py-2 text-xs text-zinc-300">
                  <span>Visualizar quebras de página</span>
                  <input
                    type="checkbox"
                    checked={bookDocument.showPageBreaks}
                    onChange={(e) =>
                      updateWorkspaceBookConfig({ showPageBreaks: e.target.checked })
                    }
                    className="accent-indigo-500"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Ações de Saída / Exportação (desacopladas do Canvas) */}
          <div className="space-y-1.5 border-t border-zinc-800/80 p-3">
            <button
              type="button"
              onClick={handlePrintPdf}
              disabled={bookDocument.blocks.length === 0}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-40"
            >
              <Printer className="h-3.5 w-3.5" /> Imprimir / Salvar em PDF
            </button>
            <button
              type="button"
              onClick={handleExportMarkdown}
              disabled={exportingMd || bookDocument.blocks.length === 0}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-zinc-800 bg-[#0F1115] py-2 text-xs font-medium text-zinc-300 transition hover:border-indigo-500/60 hover:text-white disabled:opacity-40"
            >
              <FileDown className="h-3.5 w-3.5 text-emerald-400" />
              {exportingMd ? 'Gerando Markdown...' : 'Exportar Documento (.md)'}
            </button>
          </div>
        </aside>
      )}

      {/* PRÉVIA FIEL DO LIVRO */}
      <main className="kc-book-print-root flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Barra superior da prévia */}
        <div className="kc-no-print flex shrink-0 items-center justify-between gap-2 border-b border-zinc-800/80 bg-[#12151B]/80 px-4 py-2 backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-2">
            {!sidebarOpen && (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-[#0F1115] px-2.5 py-1 text-xs font-medium text-zinc-300 hover:border-indigo-500/60 hover:text-white"
              >
                <PanelLeftOpen className="h-3.5 w-3.5 text-indigo-400" /> Organizador
              </button>
            )}
            <span className="truncate text-xs text-zinc-400">
              {contextBreadcrumb.length > 0
                ? `Escopo: ${contextBreadcrumb.map((b) => b.title).join(' › ')}`
                : 'Escopo: Todo o Conhecimento'}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                updateWorkspaceBookConfig({ showPageBreaks: !bookDocument.showPageBreaks })
              }
              className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
                bookDocument.showPageBreaks
                  ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-200'
                  : 'border-zinc-800 bg-[#0F1115] text-zinc-400 hover:text-zinc-200'
              }`}
              title="Alternar entre prévia paginada (folhas A4) e leitura contínua"
            >
              {bookDocument.showPageBreaks ? 'Prévia Paginada' : 'Leitura Contínua'}
            </button>
            <button
              type="button"
              onClick={handlePrintPdf}
              disabled={bookDocument.blocks.length === 0}
              className="flex items-center gap-1 rounded-lg bg-indigo-600/90 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
              title="Imprimir ou gerar PDF pelo navegador"
            >
              <Printer className="h-3.5 w-3.5" /> PDF
            </button>
          </div>
        </div>

        {/* Área scrollável da Prévia */}
        <div
          className={`kc-book-scroll flex-1 overflow-y-auto px-4 py-8 md:px-8 ${
            isPrintSheetMode ? 'bg-[#0C0E13]' : ''
          }`}
        >
          <div className={`mx-auto ${bookWidthClass} space-y-8 transition-all duration-200`}>
            {bookDocument.blocks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-800 p-12 text-center">
                <Sparkles className="mx-auto mb-2 h-6 w-6 text-indigo-400 opacity-70" />
                <p className="text-sm font-medium text-zinc-300">
                  Nenhum conteúdo selecionado para o Livro
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Ative os itens na aba <strong>Sequência</strong> à esquerda ou ajuste os filtros.
                </p>
              </div>
            ) : isPrintSheetMode ? (
              /* MODO PRÉVIA PAGINADA FIEL (COM CAPA, SUMÁRIO, CABEÇALHO, RODAPÉ E QUEBRAS DE PÁGINA) */
              <>
                {/* Folha 1: Capa + Sumário */}
                <div
                  className={`kc-book-sheet flex min-h-[540px] flex-col justify-between rounded-2xl border border-stone-300 bg-[#FDFCF9] text-zinc-900 shadow-2xl ${sheetMarginClass}`}
                >
                  <div>
                    {bookDocument.headerText && (
                      <div className="mb-8 border-b border-stone-200 pb-2 text-[10.5px] font-medium uppercase tracking-widest text-stone-400">
                        {bookDocument.headerText}
                      </div>
                    )}

                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-indigo-600">
                      Material de Estudo Estruturado
                    </p>
                    <h1 className="mt-2 font-serif text-4xl font-bold tracking-tight text-zinc-900">
                      {bookDocument.title}
                    </h1>
                    {bookDocument.subtitle && (
                      <p className="mt-3 max-w-2xl text-base leading-relaxed text-zinc-600">
                        {bookDocument.subtitle}
                      </p>
                    )}

                    {bookDocument.toc.length > 0 && (
                      <div className="mt-10 border-t border-stone-200 pt-6">
                        <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-stone-500">
                          Sumário
                        </h2>
                        <ul className="space-y-2">
                          {bookDocument.toc.map((item) => (
                            <li
                              key={item.anchorId}
                              className={item.role === 'section' ? 'pl-5' : ''}
                            >
                              <a
                                href={`#${item.anchorId}`}
                                className="flex items-baseline gap-2 text-sm text-zinc-800 hover:text-indigo-600"
                              >
                                <span className="font-mono text-xs font-semibold text-indigo-600">
                                  {item.numberLabel}
                                </span>
                                <span
                                  className={
                                    item.role === 'chapter' ? 'font-semibold' : 'font-normal'
                                  }
                                >
                                  {item.title}
                                </span>
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <footer className="mt-10 flex items-center justify-between border-t border-stone-200 pt-3 text-[11px] text-stone-500">
                    <span>{bookDocument.footerText}</span>
                    {bookDocument.showPageNumbers && <span className="font-mono">Pág. 1</span>}
                  </footer>
                </div>

                {/* Folhas de Conteúdo */}
                {pagedBlocks.map((pageItems, pageIdx) => (
                  <React.Fragment key={`page-${pageIdx}`}>
                    <div className="kc-no-print flex items-center gap-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                      <span className="h-px flex-1 border-t border-dashed border-zinc-800" />
                      Quebra de página • Folha {pageIdx + 2}
                      <span className="h-px flex-1 border-t border-dashed border-zinc-800" />
                    </div>

                    <div
                      className={`kc-book-sheet kc-book-page-break flex min-h-[780px] flex-col justify-between rounded-2xl border border-stone-300 bg-[#FDFCF9] text-zinc-900 shadow-2xl ${sheetMarginClass}`}
                    >
                      <div>
                        {bookDocument.headerText && (
                          <div className="mb-6 flex items-center justify-between border-b border-stone-200 pb-2 text-[10.5px] font-medium uppercase tracking-widest text-stone-400">
                            <span>{bookDocument.headerText}</span>
                            <span>{bookDocument.title}</span>
                          </div>
                        )}

                        <div className="space-y-7">
                          {pageItems.map((block) => renderCompiledBlock(block))}
                        </div>
                      </div>

                      <footer className="mt-10 flex items-center justify-between border-t border-stone-200 pt-3 text-[11px] text-stone-500">
                        <span>{bookDocument.footerText}</span>
                        {bookDocument.showPageNumbers && (
                          <span className="font-mono">Pág. {pageIdx + 2}</span>
                        )}
                      </footer>
                    </div>
                  </React.Fragment>
                ))}
              </>
            ) : (
              /* MODO LEITURA CONTÍNUA (TEMAS DARK / PAPER) */
              <div className={`space-y-10 ${sheetMarginClass}`}>
                <header className="border-b border-zinc-800/80 pb-6">
                  {bookDocument.headerText && (
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-indigo-400">
                      {bookDocument.headerText}
                    </p>
                  )}
                  <h1 className="font-serif text-4xl font-bold tracking-tight text-zinc-100">
                    {bookDocument.title}
                  </h1>
                  {bookDocument.subtitle && (
                    <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                      {bookDocument.subtitle}
                    </p>
                  )}
                </header>

                <div className="space-y-8">
                  {bookDocument.blocks.map((block) => renderCompiledBlock(block))}
                </div>

                {bookDocument.footerText && (
                  <footer className="border-t border-zinc-800/80 pt-4 text-xs text-zinc-500">
                    {bookDocument.footerText}
                  </footer>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      <NotebookPickerModal
        cardId={notebookModalCardId}
        onClose={() => setNotebookModalCardId(null)}
      />
    </div>
  );
}