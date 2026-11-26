'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Layers,
  BookOpen,
  BrainCircuit,
  Search,
  Plus,
  Sun,
  Moon,
  Database,
  PanelLeftClose,
  PanelLeftOpen,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
  FileText,
} from 'lucide-react';
import { useKnowledgeStore } from '@/domains/knowledge/store/useKnowledgeStore';
import { useUiStore } from '@/domains/ui/store/useUiStore';
import { KnowledgeCanvas } from '@/domains/canvas/components/KnowledgeCanvas';
import { BookModeView } from '@/domains/book/components/BookModeView';
import { ReviewPanel } from '@/domains/review/components/ReviewPanel';
import { KnowledgeEditorDrawer } from '@/domains/knowledge/components/KnowledgeEditor';
import { CommandSearch } from '@/domains/search/components/CommandSearch';
import { HierarchyTree } from '@/domains/hierarchy/components/HierarchyTree';
import { FocusTimerWidget } from '@/domains/review/components/FocusTimerWidget';
import { PdfStudyPanel } from '@/domains/pdf/components/PdfStudyPanel';
import { BackupModal } from './BackupModal';
import { PreferencesModal } from './PreferencesModal';
import { UiOverlays } from './UiOverlays';

export function AppShell() {
  const {
    isReady,
    bootstrap,
    viewMode,
    setViewMode,
    setSearchOpen,
    workspaces,
    activeWorkspaceId,
    selectWorkspace,
    createWorkspace,
    cardsById,
  } = useKnowledgeStore();

  const {
    theme,
    hydrateUi,
    toggleTheme,
    isBackupOpen,
    setBackupOpen,
    setPreferencesOpen,
    isPdfReaderOpen,
    togglePdfReader,
    setPdfReaderOpen,
    sidebarCollapsed,
    toggleSidebar,
    zenMode,
    toggleZenMode,
    setZenMode,
    addToast,
    openConfirm,
    hasUnsavedEditorChanges,
    clearTransientCanvasUi,
  } = useUiStore();

  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [workspaceDraft, setWorkspaceDraft] = useState('');

  // Controle suave da largura do Leitor de PDF (Tela Dividida)
  const mainAreaRef = useRef<HTMLDivElement>(null);
  const [pdfWidthPct, setPdfWidthPct] = useState(42);
  const [isResizingPdf, setIsResizingPdf] = useState(false);

  useEffect(() => {
    hydrateUi();
    bootstrap();
  }, [hydrateUi, bootstrap]);

  useEffect(() => {
    const onShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setViewMode(viewMode === 'book' ? 'canvas' : 'book');
      } else if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        toggleSidebar();
      } else if (e.key === 'Escape' && zenMode) {
        setZenMode(false);
      }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, [viewMode, setViewMode, toggleSidebar, zenMode, setZenMode]);

  // Arraste da divisória da Tela Dividida PDF <-> Canvas
  const handleDividerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsResizingPdf(true);
  };

  const handleDividerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizingPdf || !mainAreaRef.current) return;
    const rect = mainAreaRef.current.getBoundingClientRect();
    const rawPct = ((e.clientX - rect.left) / rect.width) * 100;
    const clamped = Math.max(26, Math.min(68, rawPct));
    setPdfWidthPct(Math.round(clamped * 10) / 10);
  };

  const handleDividerPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizingPdf) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsResizingPdf(false);
  };

  const handleCreateWorkspace = async () => {
    const name = workspaceDraft.trim();
    if (!name) {
      setCreatingWorkspace(false);
      return;
    }
    await createWorkspace(name);
    setWorkspaceDraft('');
    setCreatingWorkspace(false);
    addToast({ message: `Área "${name}" criada`, variant: 'success' });
  };

  if (!isReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0F1115] text-sm text-zinc-400">
        Carregando Knowledge Canvas...
      </div>
    );
  }

  const totalCards = Object.keys(cardsById).length;
  const showSidebar = !sidebarCollapsed && !zenMode;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0F1115] text-zinc-100">
      {/* Sidebar Hierárquica estilo Arc */}
      {showSidebar && (
        <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-800/80 bg-[#12151B]">
          <div className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-3.5">
            <span className="text-sm font-semibold tracking-tight text-zinc-100">
              Knowledge Canvas
            </span>
            <span className="rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300">
              LOCAL
            </span>
          </div>

          <div className="p-3">
            <div className="flex items-center gap-1.5">
              <select
                value={activeWorkspaceId ?? ''}
                onChange={(e) => {
                  const nextWorkspaceId = e.target.value;
                  if (nextWorkspaceId === activeWorkspaceId) return;
                  const runSwitch = () => {
                    clearTransientCanvasUi();
                    selectWorkspace(nextWorkspaceId);
                  };
                  if (hasUnsavedEditorChanges) {
                    openConfirm({
                      title: 'Descartar alterações não salvas?',
                      description:
                        'Há edições pendentes no card atual. Deseja trocar de área de trabalho e descartá-las?',
                      confirmLabel: 'Trocar área',
                      variant: 'danger',
                      onConfirm: runSwitch,
                    });
                    return;
                  }
                  runSwitch();
                }}
                className="w-full rounded-xl border border-zinc-800 bg-[#181C24] px-3 py-2 text-xs font-medium text-zinc-200 focus:border-indigo-500 focus:outline-none"
              >
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.icon} {ws.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setCreatingWorkspace((v) => !v)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-[#181C24] text-zinc-300 transition hover:border-indigo-500 hover:text-indigo-300"
                title="Nova área de trabalho"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {creatingWorkspace && (
              <div className="mt-2 flex items-center gap-1.5 rounded-xl border border-indigo-500/50 bg-[#0F1115] p-1.5">
                <input
                  autoFocus
                  value={workspaceDraft}
                  onChange={(e) => setWorkspaceDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateWorkspace();
                    if (e.key === 'Escape') setCreatingWorkspace(false);
                  }}
                  placeholder="Nome da área..."
                  className="w-full bg-transparent px-2 py-1 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
                />
                <button
                  onClick={handleCreateWorkspace}
                  className="rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-500"
                >
                  Criar
                </button>
              </div>
            )}

            <button
              onClick={() => setSearchOpen(true)}
              className="mt-2.5 flex w-full items-center justify-between rounded-xl border border-zinc-800/90 bg-[#181C24]/70 px-3 py-2 text-xs text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200"
            >
              <span className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5" /> Busca e Comandos
              </span>
              <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">⌘K</kbd>
            </button>
          </div>

          <HierarchyTree />

          <div className="flex items-center justify-end gap-2.5 border-t border-zinc-800/80 px-3 py-2.5">
            <span className="text-[11px] text-zinc-500">
              {totalCards} {totalCards === 1 ? 'card' : 'cards'}
            </span>
            <span className="h-3 w-px bg-zinc-800" />
            <button
              onClick={() => setBackupOpen(true)}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
              title="Exportar ou restaurar backup local"
            >
              <Database className="h-3.5 w-3.5 text-indigo-400" /> Backup
            </button>
          </div>
        </aside>
      )}

      {/* Área Principal */}
      <div className="relative flex flex-1 flex-col overflow-hidden">
        {!zenMode ? (
          <header className="relative z-30 flex h-12 shrink-0 items-center justify-between gap-2 border-b border-zinc-800/80 bg-[#12151B]/90 px-3 backdrop-blur-md">
            {/* ESQUERDA: Sidebar + Abas (só ícones, expandem no hover) + Ferramentas do Canvas */}
            <div className="flex min-w-0 items-center gap-2">
              <button
                onClick={toggleSidebar}
                className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
                title={
                  sidebarCollapsed
                    ? 'Mostrar barra lateral (Ctrl+\\)'
                    : 'Recolher barra lateral (Ctrl+\\)'
                }
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </button>

              {/* Seletor de Visão: somente ícones, expande o rótulo suavemente no hover */}
              <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-zinc-800 bg-[#0F1115] p-0.5">
                {[
                  { id: 'canvas', label: 'Canvas Visual', icon: Layers },
                  { id: 'book', label: 'Modo Livro', icon: BookOpen },
                  { id: 'review', label: 'Revisão', icon: BrainCircuit },
                ].map(({ id, label, icon: Icon }) => {
                  const active = viewMode === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setViewMode(id as typeof viewMode)}
                      title={label}
                      className={`group flex items-center rounded-lg px-2 py-1.5 text-xs font-medium transition-all duration-200 ${
                        active
                          ? 'bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-500/40'
                          : 'text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-100'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 ease-out group-hover:ml-1.5 group-hover:max-w-[110px] group-hover:opacity-100">
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* SLOT UNIFICADO: O KnowledgeCanvas injeta sua barra de ferramentas aqui */}
              <div id="kc-header-tools-slot" className="flex items-center" />
            </div>

            {/* DIREITA: PDF Tela Dividida + Foco + Preferências + Zen + Tema */}
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={togglePdfReader}
                title="Abrir / Fechar Leitor de PDF lado a lado"
                className={`group flex items-center rounded-xl border px-2 py-1.5 text-xs font-medium transition-all duration-200 ${
                  isPdfReaderOpen
                    ? 'border-rose-500/45 bg-rose-500/15 text-rose-300'
                    : 'border-zinc-800 bg-[#181C24] text-zinc-300 hover:border-indigo-500/60 hover:text-zinc-100'
                }`}
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                <span
                  className={`overflow-hidden whitespace-nowrap transition-all duration-200 ease-out ${
                    isPdfReaderOpen
                      ? 'ml-1.5 max-w-[60px] opacity-100'
                      : 'max-w-0 opacity-0 group-hover:ml-1.5 group-hover:max-w-[60px] group-hover:opacity-100'
                  }`}
                >
                  PDF
                </span>
              </button>

              <FocusTimerWidget />

              <button
                onClick={() => setPreferencesOpen(true)}
                className="rounded-xl border border-zinc-800 bg-[#181C24] p-1.5 text-zinc-300 transition hover:border-indigo-500/60 hover:text-zinc-100"
                title="Preferências de Conforto & Layout"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-400" />
              </button>

              <button
                onClick={toggleZenMode}
                className="group flex items-center rounded-xl border border-zinc-800 bg-[#181C24] px-2 py-1.5 text-xs font-medium text-zinc-300 transition-all duration-200 hover:border-indigo-500/60 hover:text-zinc-100"
                title="Modo Zen (Tela limpa sem distrações)"
              >
                <Maximize2 className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
                <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 ease-out group-hover:ml-1.5 group-hover:max-w-[40px] group-hover:opacity-100">
                  Zen
                </span>
              </button>

              <button
                onClick={toggleTheme}
                className="group flex items-center rounded-xl border border-zinc-800 bg-[#181C24] px-2 py-1.5 text-xs font-medium text-zinc-300 transition-all duration-200 hover:border-indigo-500/60 hover:text-zinc-100"
                title={
                  theme === 'dark'
                    ? 'Alternar para Paper Mode (Diurno)'
                    : 'Alternar para Dark Mode (Noturno)'
                }
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                    <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 ease-out group-hover:ml-1.5 group-hover:max-w-[50px] group-hover:opacity-100">
                      Paper
                    </span>
                  </>
                ) : (
                  <>
                    <Moon className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                    <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 ease-out group-hover:ml-1.5 group-hover:max-w-[55px] group-hover:opacity-100">
                      Escuro
                    </span>
                  </>
                )}
              </button>
            </div>
          </header>
        ) : (
          <button
            onClick={() => setZenMode(false)}
            className={`fixed left-4 z-50 flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-[#161920]/90 px-3 py-1.5 text-xs font-medium text-zinc-300 shadow-xl backdrop-blur-md transition hover:border-indigo-500 hover:text-white ${
              isPdfReaderOpen ? 'top-14' : 'top-3'
            }`}
            title="Sair do Modo Zen (Esc)"
          >
            <Minimize2 className="h-3.5 w-3.5 text-indigo-400" /> Sair do Zen (Esc)
          </button>
        )}

        {/* ÁREA DE CONTEÚDO: Suporte nativo a Tela Dividida com PDF + Divisória Arrastável */}
        <div
          ref={mainAreaRef}
          className={`relative flex flex-1 overflow-hidden ${isResizingPdf ? 'select-none' : ''}`}
        >
          {isPdfReaderOpen && (
            <>
              <div style={{ width: `${pdfWidthPct}%` }} className="h-full shrink-0 overflow-hidden">
                <PdfStudyPanel
                  isResizing={isResizingPdf}
                  onClose={() => setPdfReaderOpen(false)}
                />
              </div>

              {/* Divisória arrastável entre PDF e Canvas */}
              <div
                onPointerDown={handleDividerPointerDown}
                onPointerMove={handleDividerPointerMove}
                onPointerUp={handleDividerPointerUp}
                onPointerCancel={handleDividerPointerUp}
                title="Arraste para redimensionar a tela dividida"
                className={`group relative z-20 flex w-1.5 shrink-0 cursor-col-resize items-center justify-center transition-colors ${
                  isResizingPdf ? 'bg-indigo-500' : 'bg-zinc-800/80 hover:bg-indigo-500/70'
                }`}
              >
                <div className="h-8 w-0.5 rounded-full bg-zinc-500/60 group-hover:bg-white" />
              </div>
            </>
          )}

          <div className="relative min-w-0 flex-1 overflow-hidden">
            {viewMode === 'canvas' && <KnowledgeCanvas />}
            {viewMode === 'book' && <BookModeView />}
            {viewMode === 'review' && <ReviewPanel />}
          </div>
        </div>
      </div>

      <KnowledgeEditorDrawer />
      <CommandSearch />
      <BackupModal isOpen={isBackupOpen} onClose={() => setBackupOpen(false)} />
      <PreferencesModal />
      <UiOverlays />
    </div>
  );
}