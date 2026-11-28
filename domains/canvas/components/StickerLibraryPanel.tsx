'use client';

import React, { useEffect, useState } from 'react';
import {
  Search,
  X,
  Sparkles,
  Globe,
  Clock,
  Loader2,
  WifiOff,
  Sticker,
} from 'lucide-react';
import {
  ICONIFY_COLLECTION_PREFIXES,
  ICONIFY_QUICK_CHIPS,
  IconifyCollectionFilter,
  STARNOTE_STICKERS,
  STICKER_PALETTE,
  StarNoteCategory,
  StarNoteStickerItem,
  translateStudyQueryToIconify,
} from '../utils/starNoteStickers';

type LibraryTab = 'starnote' | 'universal' | 'recent';

interface RecentStickerItem {
  id: string;
  label: string;
  svg: string;
  width: number;
  height: number;
}

const RECENT_STORAGE_KEY = 'kc_recent_stickers_v1';

function sanitizeStandaloneSvg(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('<svg')) return null;
  let safe = trimmed.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  if (!/xmlns=/.test(safe)) {
    safe = safe.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  return safe;
}

function loadRecentStickers(): RecentStickerItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentStickerItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecentSticker(item: RecentStickerItem): RecentStickerItem[] {
  const current = loadRecentStickers().filter((r) => r.id !== item.id);
  const next = [item, ...current].slice(0, 18);
  try {
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignora limite de storage
  }
  return next;
}

interface StickerLibraryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertSvg: (params: {
    svg: string;
    width: number;
    height: number;
    caption: string;
  }) => Promise<void>;
}

export function StickerLibraryPanel({
  isOpen,
  onClose,
  onInsertSvg,
}: StickerLibraryPanelProps) {
  const [tab, setTab] = useState<LibraryTab>('starnote');
  const [starCategory, setStarCategory] = useState<'all' | StarNoteCategory>('all');
  const [selectedColor, setSelectedColor] = useState('#f59e0b');

  // Busca Iconify (Biblioteca Universal Pública)
  const [searchInput, setSearchInput] = useState('');
  const [collectionFilter, setCollectionFilter] = useState<IconifyCollectionFilter>('color');
  const [iconifyResults, setIconifyResults] = useState<string[]>([]);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [insertingKey, setInsertingKey] = useState<string | null>(null);

  const [recentItems, setRecentItems] = useState<RecentStickerItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      setRecentItems(loadRecentStickers());
    }
  }, [isOpen]);

  // Busca automática debounced na API pública do Iconify quando a aba Universal está aberta
  useEffect(() => {
    if (!isOpen || tab !== 'universal') return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsLoadingSearch(true);
      setSearchError(null);
      try {
        const translated = translateStudyQueryToIconify(searchInput || 'book justice brain');
        const prefixes = ICONIFY_COLLECTION_PREFIXES[collectionFilter];
        const params = new URLSearchParams({
          query: translated,
          limit: '48',
        });
        if (prefixes) params.set('prefixes', prefixes);

        const res = await fetch(`https://api.iconify.design/search?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('Falha ao consultar biblioteca');
        const data = (await res.json()) as { icons?: string[] };
        setIconifyResults(Array.isArray(data.icons) ? data.icons : []);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setSearchError(
          'Sem conexão com a biblioteca pública agora. Use os elementos da aba StarNote (100% offline).'
        );
        setIconifyResults([]);
      } finally {
        setIsLoadingSearch(false);
      }
    }, 280);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [isOpen, tab, searchInput, collectionFilter]);

  if (!isOpen) return null;

  const filteredStarStickers = STARNOTE_STICKERS.filter(
    (item) => starCategory === 'all' || item.category === starCategory
  );

  const handleInsertStarNote = async (item: StarNoteStickerItem) => {
    setInsertingKey(item.id);
    try {
      const color = item.supportsColor ? selectedColor : item.defaultColor;
      const svg = item.buildSvg(color);
      await onInsertSvg({
        svg,
        width: item.width,
        height: item.height,
        caption: item.name,
      });
      setRecentItems(
        saveRecentSticker({
          id: `${item.id}-${color}`,
          label: item.name,
          svg,
          width: item.width,
          height: item.height,
        })
      );
    } finally {
      setInsertingKey(null);
    }
  };

  const handleInsertIconify = async (iconId: string) => {
    const [prefix, name] = iconId.split(':');
    if (!prefix || !name) return;

    setInsertingKey(iconId);
    try {
      const isMono = collectionFilter === 'minimal';
      const query = new URLSearchParams({ width: '256', height: '256' });
      if (isMono) query.set('color', selectedColor);

      const res = await fetch(
        `https://api.iconify.design/${encodeURIComponent(prefix)}/${encodeURIComponent(name)}.svg?${query.toString()}`
      );
      if (!res.ok) throw new Error('Erro ao baixar SVG');
      const rawSvg = await res.text();
      const safeSvg = sanitizeStandaloneSvg(rawSvg);
      if (!safeSvg) throw new Error('SVG inválido');

      const label = name.replace(/[-_]+/g, ' ');
      await onInsertSvg({
        svg: safeSvg,
        width: 108,
        height: 108,
        caption: label,
      });
      setRecentItems(
        saveRecentSticker({
          id: `ico-${iconId}-${isMono ? selectedColor : 'color'}`,
          label,
          svg: safeSvg,
          width: 108,
          height: 108,
        })
      );
    } catch {
      setSearchError('Não foi possível baixar este ícone. Verifique sua conexão ou tente outro.');
    } finally {
      setInsertingKey(null);
    }
  };

  const handleInsertRecent = async (item: RecentStickerItem) => {
    setInsertingKey(item.id);
    try {
      await onInsertSvg({
        svg: item.svg,
        width: item.width,
        height: item.height,
        caption: item.label,
      });
    } finally {
      setInsertingKey(null);
    }
  };

  const isMonochromeMode = tab === 'starnote' || collectionFilter === 'minimal';

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      className="fixed bottom-20 left-1/2 z-[115] flex max-h-[68vh] w-[min(92vw,540px)] -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-indigo-500/40 bg-[#161920]/98 shadow-2xl backdrop-blur-xl"
    >
      {/* CABEÇALHO + ABAS */}
      <div className="space-y-2.5 border-b border-zinc-800/80 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sticker className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-semibold text-zinc-100">
              Adesivos & Elementos de Caderno
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            title="Fechar painel (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1 rounded-xl border border-zinc-800 bg-[#0F1115] p-1">
          <button
            type="button"
            onClick={() => setTab('starnote')}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-medium transition ${
              tab === 'starnote'
                ? 'bg-indigo-600/25 text-indigo-200'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-400" /> StarNote (Offline)
          </button>
          <button
            type="button"
            onClick={() => setTab('universal')}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-medium transition ${
              tab === 'universal'
                ? 'bg-indigo-600/25 text-indigo-200'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Globe className="h-3.5 w-3.5 text-sky-400" /> Biblioteca Pública
          </button>
          <button
            type="button"
            onClick={() => setTab('recent')}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-medium transition ${
              tab === 'recent'
                ? 'bg-indigo-600/25 text-indigo-200'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Clock className="h-3.5 w-3.5 text-emerald-400" /> Recentes ({recentItems.length})
          </button>
        </div>

        {/* Paleta de cor rápida (para Washi Tapes, Ornamentos, Selos e Ícones Minimalistas) */}
        {isMonochromeMode && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-zinc-800/80 bg-[#0F1115] px-2.5 py-1.5">
            <span className="text-[10.5px] font-medium text-zinc-400">Cor do elemento</span>
            <div className="flex items-center gap-1.5">
              {STICKER_PALETTE.map((sw) => (
                <button
                  key={sw.hex}
                  type="button"
                  title={sw.label}
                  onClick={() => setSelectedColor(sw.hex)}
                  className={`h-4 w-4 rounded-full border transition hover:scale-125 ${
                    selectedColor === sw.hex ? 'scale-110 border-white' : 'border-zinc-700'
                  }`}
                  style={{ backgroundColor: sw.hex }}
                />
              ))}
              <input
                type="color"
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
                className="h-4 w-4 cursor-pointer rounded border-0 bg-transparent p-0"
                title="Escolher qualquer cor"
              />
            </div>
          </div>
        )}
      </div>

      {/* CONTEÚDO: ABA 1 — PACOTE STARNOTE (100% OFFLINE) */}
      {tab === 'starnote' && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-1.5 border-b border-zinc-800/60 px-3.5 py-2">
            {(
              [
                { id: 'all', label: 'Todos' },
                { id: 'washi', label: 'Fitas Washi' },
                { id: 'badges', label: 'Selos & Estudo' },
                { id: 'decor', label: 'Esquemas & Raios' },
              ] as const
            ).map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setStarCategory(cat.id)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                  starCategory === cat.id
                    ? 'bg-indigo-600/20 text-indigo-200 ring-1 ring-indigo-500/40'
                    : 'text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="grid flex-1 grid-cols-3 gap-2 overflow-y-auto p-3.5 sm:grid-cols-4">
            {filteredStarStickers.map((item) => {
              const previewColor = item.supportsColor ? selectedColor : item.defaultColor;
              const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(
                item.buildSvg(previewColor)
              )}`;
              const isBusy = insertingKey === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={Boolean(insertingKey)}
                  onClick={() => handleInsertStarNote(item)}
                  className="group flex flex-col items-center justify-between gap-2 rounded-xl border border-zinc-800/90 bg-[#0F1115] p-2.5 transition hover:border-indigo-500/60 hover:bg-[#181C24] disabled:opacity-50"
                  title={`Inserir "${item.name}" no Canvas`}
                >
                  <div className="flex h-14 w-full items-center justify-center">
                    {isBusy ? (
                      <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
                    ) : (
                      <img
                        src={dataUri}
                        alt={item.name}
                        className="max-h-12 max-w-full object-contain transition-transform group-hover:scale-110"
                      />
                    )}
                  </div>
                  <span className="w-full truncate text-center text-[10.5px] font-medium text-zinc-300 group-hover:text-white">
                    {item.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* CONTEÚDO: ABA 2 — BIBLIOTECA UNIVERSAL PÚBLICA (ICONIFY) */}
      {tab === 'universal' && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-2 border-b border-zinc-800/60 p-3.5">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Buscar em PT ou EN (ex: balança, livro, cérebro, lupa, mapa)..."
                  className="w-full rounded-xl border border-zinc-800 bg-[#0F1115] py-1.5 pl-8 pr-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <select
                value={collectionFilter}
                onChange={(e) => setCollectionFilter(e.target.value as IconifyCollectionFilter)}
                className="rounded-xl border border-zinc-800 bg-[#0F1115] px-2.5 py-1.5 text-[11px] text-zinc-200 focus:border-indigo-500 focus:outline-none"
                title="Estilo de coleção"
              >
                <option value="color">Coloridos</option>
                <option value="minimal">Traço (Colorível)</option>
                <option value="all">Todas coleções</option>
              </select>
            </div>

            {/* Atalhos rápidos de estudo */}
            <div className="kc-no-scrollbar flex items-center gap-1 overflow-x-auto pb-0.5">
              {ICONIFY_QUICK_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => setSearchInput(chip.label)}
                  className="shrink-0 rounded-lg border border-zinc-800 bg-[#0F1115] px-2 py-0.5 text-[10.5px] font-medium text-zinc-300 transition hover:border-indigo-500/60 hover:text-white"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3.5">
            {isLoadingSearch ? (
              <div className="flex h-44 flex-col items-center justify-center gap-2 text-xs text-zinc-400">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
                <span>Buscando na biblioteca pública Iconify...</span>
              </div>
            ) : searchError ? (
              <div className="flex h-44 flex-col items-center justify-center gap-2 px-6 text-center text-xs text-zinc-400">
                <WifiOff className="h-5 w-5 text-amber-400" />
                <p>{searchError}</p>
              </div>
            ) : iconifyResults.length === 0 ? (
              <div className="flex h-44 flex-col items-center justify-center text-xs text-zinc-500">
                Nenhum elemento encontrado. Tente outro termo ou clique em um atalho acima.
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
                {iconifyResults.map((iconId) => {
                  const [prefix, name] = iconId.split(':');
                  const isMono = collectionFilter === 'minimal';
                  const thumbUrl = `https://api.iconify.design/${encodeURIComponent(prefix)}/${encodeURIComponent(name)}.svg?height=44${
                    isMono ? `&color=${encodeURIComponent(selectedColor)}` : ''
                  }`;
                  const isBusy = insertingKey === iconId;

                  return (
                    <button
                      key={iconId}
                      type="button"
                      disabled={Boolean(insertingKey)}
                      onClick={() => handleInsertIconify(iconId)}
                      title={`Inserir ${name} (${prefix}) — salvo offline no seu mapa`}
                      className="group flex h-16 items-center justify-center rounded-xl border border-zinc-800/90 bg-[#0F1115] p-2 transition hover:border-indigo-500/60 hover:bg-[#181C24] disabled:opacity-50"
                    >
                      {isBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                      ) : (
                        <img
                          src={thumbUrl}
                          alt={name}
                          loading="lazy"
                          className="h-9 w-9 object-contain transition-transform group-hover:scale-110"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONTEÚDO: ABA 3 — RECENTES (CACHE LOCAL OFFLINE) */}
      {tab === 'recent' && (
        <div className="flex-1 overflow-y-auto p-3.5">
          {recentItems.length === 0 ? (
            <div className="flex h-44 flex-col items-center justify-center text-center text-xs text-zinc-500">
              Os adesivos e ícones que você inserir aparecem aqui para reutilização instantânea offline.
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {recentItems.map((item) => {
                const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(item.svg)}`;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={Boolean(insertingKey)}
                    onClick={() => handleInsertRecent(item)}
                    className="group flex flex-col items-center justify-between gap-1.5 rounded-xl border border-zinc-800/90 bg-[#0F1115] p-2 transition hover:border-indigo-500/60 hover:bg-[#181C24]"
                    title={`Reinserir "${item.label}"`}
                  >
                    <div className="flex h-12 w-full items-center justify-center">
                      <img
                        src={dataUri}
                        alt={item.label}
                        className="max-h-10 max-w-full object-contain transition-transform group-hover:scale-110"
                      />
                    </div>
                    <span className="w-full truncate text-center text-[10px] text-zinc-400 group-hover:text-zinc-200">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-zinc-800/80 bg-[#12151B] px-3.5 py-2 text-[10.5px] text-zinc-500">
        <span>Clique para inserir • Depois gire, espelhe ou redimensione direto no Canvas</span>
        <span className="text-emerald-400/90">Salvo offline</span>
      </div>
    </div>
  );
}