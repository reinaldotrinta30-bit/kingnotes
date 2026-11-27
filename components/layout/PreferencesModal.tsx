'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  SlidersHorizontal,
  X,
  RotateCcw,
  Layers,
  BookOpen,
  Type,
  Upload,
  Trash2,
  FileText,
  PanelLeft,
  PanelRight,
} from 'lucide-react';
import {
  BookFont,
  BookFontSize,
  BookWidth,
  CanvasBackgroundStyle,
  CardDensity,
  PdfReaderSide,
  useUiStore,
} from '@/domains/ui/store/useUiStore';
import {
  CustomFontRecord,
  deleteCustomFontRecord,
  importCustomFontFile,
  listCustomFonts,
} from '@/domains/ui/utils/customFonts';

export function PreferencesModal() {
  const {
    isPreferencesOpen,
    setPreferencesOpen,
    preferences,
    updatePreferences,
    resetPreferences,
    addToast,
  } = useUiStore();

  const fontInputRef = useRef<HTMLInputElement>(null);
  const [customFonts, setCustomFonts] = useState<CustomFontRecord[]>([]);
  const [importingFont, setImportingFont] = useState(false);

  useEffect(() => {
    if (isPreferencesOpen) {
      setCustomFonts(listCustomFonts());
    }
  }, [isPreferencesOpen]);

  if (!isPreferencesOpen) return null;

  const pillClass = (active: boolean) =>
    `flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition ${
      active
        ? 'border-indigo-500 bg-indigo-600/20 text-indigo-200'
        : 'border-zinc-800 bg-[#0F1115] text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
    }`;

  const handleImportFont = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImportingFont(true);
    try {
      const record = await importCustomFontFile(file);
      setCustomFonts(listCustomFonts());
      updatePreferences({ customFontFamily: record.familyName });
      addToast({ message: `Fonte "${record.name}" importada e aplicada!`, variant: 'success' });
    } catch (err) {
      addToast({
        message: err instanceof Error ? err.message : 'Erro ao importar fonte.',
        variant: 'danger',
      });
    } finally {
      setImportingFont(false);
    }
  };

  const handleDeleteFont = (font: CustomFontRecord) => {
    const remaining = deleteCustomFontRecord(font.id);
    setCustomFonts(remaining);
    if (preferences.customFontFamily === font.familyName) {
      updatePreferences({ customFontFamily: null });
    }
    addToast({ message: `Fonte "${font.name}" removida` });
  };

  return (
    <div
      onClick={() => setPreferencesOpen(false)}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-800 bg-[#161920] p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-center justify-between border-b border-zinc-800/80 pb-3.5">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-zinc-100">
              Preferências de Conforto & Layout
            </h3>
          </div>
          <button
            onClick={() => setPreferencesOpen(false)}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-6">
          {/* SEÇÃO 1: CANVAS VISUAL */}
          <div className="space-y-3.5">
            <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              <Layers className="h-3.5 w-3.5 text-indigo-400" /> Canvas Visual
            </h4>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                Densidade dos Knowledge Cards
              </label>
              <div className="flex gap-2">
                {(
                  [
                    { id: 'compact', label: 'Compacto' },
                    { id: 'comfortable', label: 'Padrão' },
                    { id: 'expanded', label: 'Expandido' },
                  ] as Array<{ id: CardDensity; label: string }>
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updatePreferences({ cardDensity: opt.id })}
                    className={pillClass(preferences.cardDensity === opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                Fundo do Canvas
              </label>
              <div className="flex gap-2">
                {(
                  [
                    { id: 'dots', label: 'Pontos' },
                    { id: 'grid', label: 'Grade' },
                    { id: 'lined', label: 'Caderno' },
                    { id: 'none', label: 'Liso' },
                  ] as Array<{ id: CanvasBackgroundStyle; label: string }>
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updatePreferences({ canvasBackground: opt.id })}
                    className={pillClass(preferences.canvasBackground === opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="h-px bg-zinc-800/80" />

          {/* SEÇÃO 1.5: LEITOR DE PDF (TELA DIVIDIDA) */}
          <div className="space-y-3">
            <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              <FileText className="h-3.5 w-3.5 text-rose-400" /> Leitor de PDF (Tela Dividida)
            </h4>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                Posição do Leitor de PDF na Tela
              </label>
              <div className="flex gap-2">
                {(
                  [
                    { id: 'left', label: 'Lado Esquerdo', icon: PanelLeft },
                    { id: 'right', label: 'Lado Direito', icon: PanelRight },
                  ] as Array<{
                    id: PdfReaderSide;
                    label: string;
                    icon: React.ComponentType<{ className?: string }>;
                  }>
                ).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => updatePreferences({ pdfSide: id })}
                    className={`${pillClass(preferences.pdfSide === id)} flex items-center justify-center gap-1.5`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="h-px bg-zinc-800/80" />

          {/* SEÇÃO 2: MODO LIVRO */}
          <div className="space-y-3.5">
            <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              <BookOpen className="h-3.5 w-3.5 text-emerald-400" /> Modo Livro (Leitura Longa)
            </h4>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                Largura da Coluna de Leitura
              </label>
              <div className="flex gap-2">
                {(
                  [
                    { id: 'narrow', label: 'Estreita' },
                    { id: 'medium', label: 'Confortável' },
                    { id: 'wide', label: 'Ampla' },
                  ] as Array<{ id: BookWidth; label: string }>
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updatePreferences({ bookWidth: opt.id })}
                    className={pillClass(preferences.bookWidth === opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                  Tipografia do Texto
                </label>
                <div className="flex gap-2">
                  {(
                    [
                      { id: 'serif', label: 'Serifada' },
                      { id: 'sans', label: 'Sem Serifa' },
                    ] as Array<{ id: BookFont; label: string }>
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updatePreferences({ bookFont: opt.id })}
                      className={pillClass(preferences.bookFont === opt.id)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                  Tamanho da Fonte
                </label>
                <div className="flex gap-2">
                  {(
                    [
                      { id: 'sm', label: 'A-' },
                      { id: 'base', label: 'A' },
                      { id: 'lg', label: 'A+' },
                    ] as Array<{ id: BookFontSize; label: string }>
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updatePreferences({ bookFontSize: opt.id })}
                      className={pillClass(preferences.bookFontSize === opt.id)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-zinc-800/80" />

          {/* SEÇÃO 3: FONTES PERSONALIZADAS (.TTF / .OTF / .WOFF2) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                <Type className="h-3.5 w-3.5 text-amber-400" /> Fontes Personalizadas (.TTF / .OTF)
              </h4>

              <button
                type="button"
                disabled={importingFont}
                onClick={() => fontInputRef.current?.click()}
                className="flex items-center gap-1 rounded-lg bg-indigo-600/20 px-2.5 py-1 text-[11px] font-medium text-indigo-300 transition hover:bg-indigo-600 hover:text-white disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" />
                {importingFont ? 'Importando...' : 'Importar Fonte'}
              </button>
              <input
                ref={fontInputRef}
                type="file"
                accept=".ttf,.otf,.woff2"
                className="hidden"
                onChange={handleImportFont}
              />
            </div>

            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => updatePreferences({ customFontFamily: null })}
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs transition ${
                  preferences.customFontFamily === null
                    ? 'border-indigo-500 bg-indigo-600/15 text-indigo-200'
                    : 'border-zinc-800 bg-[#0F1115] text-zinc-300 hover:border-zinc-700'
                }`}
              >
                <span className="font-medium">Padrão do Knowledge Canvas</span>
                <span className="text-[10px] text-zinc-500">Plus Jakarta / Newsreader</span>
              </button>

              {customFonts.map((font) => {
                const active = preferences.customFontFamily === font.familyName;
                return (
                  <div
                    key={font.id}
                    className={`group flex items-center justify-between rounded-xl border px-3 py-2 text-xs transition ${
                      active
                        ? 'border-indigo-500 bg-indigo-600/15 text-indigo-200'
                        : 'border-zinc-800 bg-[#0F1115] text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => updatePreferences({ customFontFamily: font.familyName })}
                      style={{ fontFamily: `"${font.familyName}", sans-serif` }}
                      className="min-w-0 flex-1 truncate text-left text-sm font-medium"
                    >
                      {font.name} — Abc 123
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteFont(font)}
                      className="ml-2 rounded p-1 text-zinc-500 opacity-0 transition hover:text-rose-400 group-hover:opacity-100"
                      title="Remover fonte"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-zinc-800/80 pt-4">
          <button
            type="button"
            onClick={() => {
              resetPreferences();
              addToast({ message: 'Preferências restauradas para o padrão' }, 2500);
            }}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Restaurar padrão
          </button>

          <button
            type="button"
            onClick={() => setPreferencesOpen(false)}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}