'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Command } from 'cmdk';
import {
  Search,
  Pin,
  Star,
  Flame,
  Crosshair,
  Terminal,
  Plus,
  Scale,
  BookOpenCheck,
  Layers,
  BookOpen,
  BrainCircuit,
  Eye,
  Maximize2,
  PanelLeft,
  Sun,
  Moon,
  SlidersHorizontal,
  Database,
  LayoutGrid,
} from 'lucide-react';
import { useKnowledgeStore } from '@/domains/knowledge/store/useKnowledgeStore';
import { useUiStore } from '@/domains/ui/store/useUiStore';
import { getKnowledgeRepository } from '@/infrastructure/persistence/repositoryFactory';
import { KnowledgeCardMeta } from '@/domains/knowledge/types';

interface QuickCommand {
  id: string;
  label: string;
  hint?: string;
  keywords: string;
  icon: React.ComponentType<{ className?: string }>;
  run: () => void | Promise<void>;
}

/** Extrai filtros inteligentes como tag:cebraspe, is:critical, is:pinned, is:fav */
function parseSmartQuery(raw: string) {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  let tag: string | undefined;
  let onlyCritical = false;
  let onlyPinned = false;
  let onlyFavorites = false;
  const freeTerms: string[] = [];

  for (const tok of tokens) {
    const lower = tok.toLowerCase();
    if (lower.startsWith('tag:') && lower.length > 4) {
      tag = lower.slice(4);
    } else if (lower === 'is:critical' || lower === 'is:critico') {
      onlyCritical = true;
    } else if (lower === 'is:pinned' || lower === 'is:pin') {
      onlyPinned = true;
    } else if (lower === 'is:fav' || lower === 'is:favorite' || lower === 'is:favorito') {
      onlyFavorites = true;
    } else {
      freeTerms.push(tok);
    }
  }

  return {
    freeQuery: freeTerms.join(' '),
    tag,
    onlyCritical,
    onlyPinned,
    onlyFavorites,
  };
}

export function CommandSearch() {
  const {
    isSearchOpen,
    setSearchOpen,
    activeWorkspaceId,
    openCard,
    setViewMode,
    createCardOnCanvas,
  } = useKnowledgeStore();

  const {
    theme,
    toggleTheme,
    toggleSidebar,
    toggleZenMode,
    toggleCanvasRecallMode,
    setPreferencesOpen,
    setBackupOpen,
    updatePreferences,
    requestFocusCard,
    addToast,
  } = useUiStore();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<KnowledgeCardMeta[]>([]);

  const isCommandMode = query.trimStart().startsWith('>');
  const commandQuery = isCommandMode ? query.trimStart().slice(1).trim().toLowerCase() : '';

  const commands: QuickCommand[] = useMemo(
    () => [
      {
        id: 'cmd-new-card',
        label: 'Novo Knowledge Card no Canvas',
        hint: 'Criar',
        keywords: 'novo criar card nota',
        icon: Plus,
        run: async () => {
          setViewMode('canvas');
          await createCardOnCanvas({ x: 240, y: 200, template: 'blank' });
        },
      },
      {
        id: 'cmd-new-law',
        label: 'Novo Card — Template Lei Seca',
        hint: 'Template',
        keywords: 'lei seca artigo dispositivo template',
        icon: Scale,
        run: async () => {
          setViewMode('canvas');
          await createCardOnCanvas({ x: 280, y: 220, title: 'Artigo de Lei', template: 'law' });
        },
      },
      {
        id: 'cmd-new-juris',
        label: 'Novo Card — Template Jurisprudência (STF/STJ)',
        hint: 'Template',
        keywords: 'jurisprudencia stf stj sumula tese template',
        icon: BookOpenCheck,
        run: async () => {
          setViewMode('canvas');
          await createCardOnCanvas({
            x: 320,
            y: 240,
            title: 'Tese STF/STJ',
            template: 'jurisprudence',
          });
        },
      },
      {
        id: 'cmd-view-canvas',
        label: 'Ir para Canvas Visual',
        hint: 'Visão',
        keywords: 'canvas visual mapa quadro',
        icon: Layers,
        run: () => setViewMode('canvas'),
      },
      {
        id: 'cmd-view-book',
        label: 'Ir para Modo Livro',
        hint: 'Ctrl+B',
        keywords: 'livro leitura capitulos book',
        icon: BookOpen,
        run: () => setViewMode('book'),
      },
      {
        id: 'cmd-view-review',
        label: 'Ir para Painel de Revisão & Flashcards',
        hint: 'SM-2',
        keywords: 'revisao flashcards heatmap sm2',
        icon: BrainCircuit,
        run: () => setViewMode('review'),
      },
      {
        id: 'cmd-toggle-recall',
        label: 'Alternar Active Recall Visual no Canvas',
        hint: 'Memória',
        keywords: 'recall memoria borrar testar ocultar',
        icon: Eye,
        run: () => {
          setViewMode('canvas');
          toggleCanvasRecallMode();
        },
      },
      {
        id: 'cmd-toggle-zen',
        label: 'Alternar Modo Zen (Tela Limpa)',
        hint: 'Foco',
        keywords: 'zen tela cheia foco distrações',
        icon: Maximize2,
        run: () => toggleZenMode(),
      },
      {
        id: 'cmd-toggle-sidebar',
        label: 'Recolher / Mostrar Barra Lateral',
        hint: 'Ctrl+\\',
        keywords: 'sidebar barra lateral menu arvore',
        icon: PanelLeft,
        run: () => toggleSidebar(),
      },
      {
        id: 'cmd-toggle-theme',
        label: theme === 'dark' ? 'Alternar para Paper Mode (Diurno)' : 'Alternar para Dark Mode (Noturno)',
        hint: 'Tema',
        keywords: 'tema claro escuro paper dark mode',
        icon: theme === 'dark' ? Sun : Moon,
        run: () => toggleTheme(),
      },
      {
        id: 'cmd-density-compact',
        label: 'Densidade do Canvas: Compacto',
        hint: 'Layout',
        keywords: 'densidade compacto mapa grande',
        icon: LayoutGrid,
        run: () => {
          updatePreferences({ cardDensity: 'compact' });
          addToast({ message: 'Cards no modo Compacto' }, 2200);
        },
      },
      {
        id: 'cmd-density-comfortable',
        label: 'Densidade do Canvas: Padrão',
        hint: 'Layout',
        keywords: 'densidade padrao confortavel',
        icon: LayoutGrid,
        run: () => {
          updatePreferences({ cardDensity: 'comfortable' });
          addToast({ message: 'Cards no modo Padrão' }, 2200);
        },
      },
      {
        id: 'cmd-open-prefs',
        label: 'Abrir Preferências de Conforto & Layout',
        hint: 'Config',
        keywords: 'preferencias configuracoes fonte largura grade pontos',
        icon: SlidersHorizontal,
        run: () => setPreferencesOpen(true),
      },
      {
        id: 'cmd-open-backup',
        label: 'Abrir Armazenamento Local & Backup (.json)',
        hint: 'Dados',
        keywords: 'backup exportar importar restaurar dados',
        icon: Database,
        run: () => setBackupOpen(true),
      },
    ],
    [
      theme,
      setViewMode,
      createCardOnCanvas,
      toggleCanvasRecallMode,
      toggleZenMode,
      toggleSidebar,
      toggleTheme,
      updatePreferences,
      setPreferencesOpen,
      setBackupOpen,
      addToast,
    ]
  );

  const visibleCommands = useMemo(() => {
    if (!isCommandMode) return [];
    if (!commandQuery) return commands;
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(commandQuery) ||
        c.keywords.includes(commandQuery)
    );
  }, [isCommandMode, commandQuery, commands]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(!isSearchOpen);
      }
      if (e.key === 'Escape' && isSearchOpen) {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSearchOpen, setSearchOpen]);

  useEffect(() => {
    if (!isSearchOpen || isCommandMode) return;
    let active = true;
    const timer = setTimeout(async () => {
      const repo = getKnowledgeRepository();
      const parsed = parseSmartQuery(query);
      const found = await repo.searchCards({
        query: parsed.freeQuery,
        workspaceId: activeWorkspaceId ?? undefined,
        tag: parsed.tag,
        onlyHighImportance: parsed.onlyCritical,
        onlyPinned: parsed.onlyPinned,
        onlyFavorites: parsed.onlyFavorites,
        limit: 25,
      });
      if (active) setResults(found);
    }, 60);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, isSearchOpen, isCommandMode, activeWorkspaceId]);

  if (!isSearchOpen) return null;

  const handleFlyToCard = (e: React.MouseEvent, cardId: string) => {
    e.stopPropagation();
    setViewMode('canvas');
    requestFocusCard(cardId);
    setSearchOpen(false);
  };

  return (
    <div
      onClick={() => setSearchOpen(false)}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[12vh] backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-800 bg-[#161920] shadow-2xl"
      >
        <Command shouldFilter={false}>
  <div className="flex items-center border-b border-zinc-800 px-4">
    {isCommandMode ? (
      <Terminal className="mr-2.5 h-4 w-4 text-indigo-400" />
    ) : (
      <Search className="mr-2.5 h-4 w-4 text-zinc-500" />
    )}

    <Command.Input
      autoFocus
      value={query}
      onValueChange={setQuery}
      placeholder='Buscar cards (ex: is:critical tag:art-194) ou digite ">" para comandos...'
      className="h-12 w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
    />
  </div>

  {/* Atalhos rápidos de filtro e modo comando */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-800/70 bg-[#0F1115]/60 px-4 py-2 text-[11px]">
            <button
              type="button"
              onClick={() => setQuery(isCommandMode ? '' : '> ')}
              className={`rounded-md px-2 py-0.5 font-medium transition ${
                isCommandMode
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              &gt; Comandos
            </button>
            <button
              type="button"
              onClick={() => setQuery('is:critical ')}
              className="rounded-md bg-zinc-800/80 px-2 py-0.5 text-rose-300 hover:bg-zinc-700"
            >
              is:critical
            </button>
            <button
              type="button"
              onClick={() => setQuery('is:pinned ')}
              className="rounded-md bg-zinc-800/80 px-2 py-0.5 text-indigo-300 hover:bg-zinc-700"
            >
              is:pinned
            </button>
            <button
              type="button"
              onClick={() => setQuery('is:fav ')}
              className="rounded-md bg-zinc-800/80 px-2 py-0.5 text-amber-300 hover:bg-zinc-700"
            >
              is:fav
            </button>
            <button
              type="button"
              onClick={() => setQuery('tag:')}
              className="rounded-md bg-zinc-800/80 px-2 py-0.5 text-emerald-300 hover:bg-zinc-700"
            >
              tag:
            </button>
          </div>

          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            {isCommandMode ? (
              <>
                {visibleCommands.length === 0 && (
                  <div className="py-10 text-center text-xs text-zinc-500">
                    Nenhum comando encontrado para &ldquo;{commandQuery}&rdquo;.
                  </div>
                )}
                {visibleCommands.map((cmd) => {
                  const Icon = cmd.icon;
                  return (
                    <Command.Item
  key={cmd.id}
  value={cmd.id}
  onSelect={async () => {
    setSearchOpen(false);
    setQuery('');
    await cmd.run();
  }}
  className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition aria-selected:bg-indigo-600/20"
>
                      <div className="flex items-center gap-2.5">
                        <Icon className="h-4 w-4 text-indigo-400"/>
                        <span className="text-sm font-medium text-zinc-100">{cmd.label}</span>
                      </div>
                      {cmd.hint && (
                        <kbd className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                          {cmd.hint}
                        </kbd>
                      )}
                    </Command.Item>
                  );
                })}
              </>
            ) : (
              <>
                {results.length === 0 && (
                  <div className="py-10 text-center text-xs text-zinc-500">
                    Nenhum Knowledge Card encontrado para &ldquo;{query}&rdquo;.
                  </div>
                )}
                {results.map((card) => (
                  <Command.Item
  key={card.id}
  value={card.id}
  onSelect={() => {
    openCard(card.id);
    setSearchOpen(false);
  }}
  className="group flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition aria-selected:bg-indigo-600/20"
>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium text-zinc-100">
                        {card.emoji && <span>{card.emoji}</span>}
                        {card.title}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-zinc-400">{card.excerpt}</p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {card.importance === 'critical' && (
                        <Flame className="h-3.5 w-3.5 text-rose-400"/>
                      )}
                      {card.isPinned && <Pin className="h-3.5 w-3.5 text-indigo-400"/>}
                      {card.isFavorite && (
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400"/>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleFlyToCard(e, card.id)}
                        className="flex items-center gap-1 rounded-lg border border-zinc-700/80 bg-zinc-900/90 px-2 py-1 text-[11px] font-medium text-indigo-300 transition hover:border-indigo-500 hover:bg-indigo-600 hover:text-white"
                        title="Voar até este card no Canvas"
                      >
                        <Crosshair className="h-3 w-3"/> Localizar
                      </button>
                    </div>
                  </Command.Item>
                ))}
              </>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}