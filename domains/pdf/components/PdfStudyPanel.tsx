'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  FileText,
  Upload,
  X,
  Trash2,
  Send,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
  PanelLeft,
  PanelRight,
  PanelTop,
} from 'lucide-react';
import { getKnowledgeRepository } from '@/infrastructure/persistence/repositoryFactory';
import { useKnowledgeStore } from '@/domains/knowledge/store/useKnowledgeStore';
import { useUiStore } from '@/domains/ui/store/useUiStore';
import { KnowledgeCardMeta } from '@/domains/knowledge/types';

interface LocalPdfDoc {
  id: string;
  name: string;
  blobId: string;
  sizeBytes: number;
  addedAt: number;
}

const PDF_LIB_KEY = 'kc_pdf_library_v1';

const CAPTURE_COLORS: Array<{ id: KnowledgeCardMeta['color']; dot: string; label: string }> = [
  { id: 'sky', dot: '#0ea5e9', label: 'Azul' },
  { id: 'amber', dot: '#f59e0b', label: 'Âmbar' },
  { id: 'emerald', dot: '#10b981', label: 'Verde' },
  { id: 'violet', dot: '#8b5cf6', label: 'Violeta' },
  { id: 'rose', dot: '#f43f5e', label: 'Rosa' },
];

interface PdfStudyPanelProps {
  isResizing: boolean;
  onClose: () => void;
}

export function PdfStudyPanel({ isResizing, onClose }: PdfStudyPanelProps) {
  const { createCardFromPdf, setViewMode } = useKnowledgeStore();
  const {
    theme,
    preferences,
    updatePreferences,
    addToast,
    openConfirm,
    requestFocusCard,
    setInlineEditingCardId,
  } = useUiStore();
  const pdfSide = preferences.pdfSide;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<LocalPdfDoc[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [activeBlobUrl, setActiveBlobUrl] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [showNativeToolbar, setShowNativeToolbar] = useState(false);

  // Painel de Captura Rápida -> Canvas
  const [captureOpen, setCaptureOpen] = useState(true);
  const [captureTitle, setCaptureTitle] = useState('');
  const [capturePage, setCapturePage] = useState('');
  const [captureText, setCaptureText] = useState('');
  const [captureColor, setCaptureColor] = useState<KnowledgeCardMeta['color']>('sky');

  // Carrega biblioteca local salva
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PDF_LIB_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as LocalPdfDoc[];
      setDocs(parsed);
      if (parsed.length > 0) setActiveDocId(parsed[0].id);
    } catch {
      // ignora cache inválido
    }
  }, []);

  const persistDocs = (next: LocalPdfDoc[]) => {
    setDocs(next);
    localStorage.setItem(PDF_LIB_KEY, JSON.stringify(next));
  };

  const activeDoc = docs.find((d) => d.id === activeDocId) ?? null;

  const iframeSrc = activeBlobUrl
    ? `${activeBlobUrl}#toolbar=${showNativeToolbar ? 1 : 0}&navpanes=0&view=FitH`
    : null;

  // Carrega o Blob do PDF ativo no IndexedDB sem vazamento de memória
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    if (!activeDoc) {
      setActiveBlobUrl(null);
      return;
    }

    getKnowledgeRepository()
      .getBlob(activeDoc.blobId)
      .then((blob) => {
        if (cancelled || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setActiveBlobUrl(objectUrl);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [activeDoc?.blobId]);

  const handleImportPdfFile = async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      addToast({ message: 'Selecione um arquivo PDF válido.', variant: 'danger' });
      return;
    }

    const blobId = `pdf-blob-${crypto.randomUUID()}`;
    await getKnowledgeRepository().saveBlob(blobId, file);

    const newDoc: LocalPdfDoc = {
      id: `pdf-${crypto.randomUUID()}`,
      name: file.name,
      blobId,
      sizeBytes: file.size,
      addedAt: Date.now(),
    };

    const nextDocs = [newDoc, ...docs];
    persistDocs(nextDocs);
    setActiveDocId(newDoc.id);
    addToast({ message: `"${file.name}" carregado na biblioteca local`, variant: 'success' });
  };

  const handleRemoveActiveDoc = () => {
    if (!activeDoc) return;
    openConfirm({
      title: 'Remover PDF da biblioteca?',
      description: `"${activeDoc.name}" sairá da sua lista de leitura. Os Knowledge Cards que você já criou a partir dele continuam salvos.`,
      confirmLabel: 'Remover',
      variant: 'danger',
      onConfirm: () => {
        const nextDocs = docs.filter((d) => d.id !== activeDoc.id);
        persistDocs(nextDocs);
        setActiveDocId(nextDocs[0]?.id ?? null);
        addToast({ message: 'PDF removido da lista' });
      },
    });
  };

  const handleSendToCanvas = async () => {
    if (!captureTitle.trim() && !captureText.trim()) {
      addToast({ message: 'Cole um trecho ou escreva um título para enviar ao Canvas.' });
      return;
    }

    const createdId = await createCardFromPdf({
      title: captureTitle,
      bodyText: captureText,
      sourcePdfName: activeDoc?.name ?? 'Documento PDF',
      page: capturePage,
      color: captureColor,
    });

    if (!createdId) return;

    setCaptureTitle('');
    setCaptureText('');
    setViewMode('canvas');
    requestFocusCard(createdId);

    addToast({
      message: 'Trecho enviado como Knowledge Card!',
      variant: 'success',
      action: {
        label: 'Editar agora',
        onClick: () => setInlineEditingCardId(createdId),
      },
    });
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingFile(true);
      }}
      onDragLeave={() => setIsDraggingFile(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingFile(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleImportPdfFile(file);
      }}
      className={`relative flex h-full flex-col border-zinc-800/90 bg-[#12151B] ${
        pdfSide === 'right' ? 'md:border-l' : 'md:border-r'
      } ${isDraggingFile ? 'ring-2 ring-inset ring-indigo-500' : ''}`}
    >
      {/* CABEÇALHO DO LEITOR DE PDF */}
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-rose-400" />

          {docs.length > 0 ? (
            <select
              value={activeDocId ?? ''}
              onChange={(e) => setActiveDocId(e.target.value)}
              className="min-w-0 flex-1 truncate rounded-lg border border-zinc-800 bg-[#181C24] px-2.5 py-1 text-xs font-medium text-zinc-200 focus:border-indigo-500 focus:outline-none"
            >
              {docs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="truncate text-xs font-semibold text-zinc-300">
              Leitor de PDF (Tela Dividida)
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 rounded-lg bg-indigo-600/20 px-2.5 py-1 text-[11px] font-medium text-indigo-300 transition hover:bg-indigo-600 hover:text-white"
            title="Importar novo PDF (apostila, lei seca, slides)"
          >
            <Upload className="h-3.5 w-3.5" /> Importar
          </button>

          <button
            type="button"
            onClick={() =>
              updatePreferences({ pdfSide: pdfSide === 'left' ? 'right' : 'left' })
            }
            className="hidden rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-indigo-300 md:inline-flex"
            title={
              pdfSide === 'left'
                ? 'Mover Leitor de PDF para o lado direito'
                : 'Mover Leitor de PDF para o lado esquerdo'
            }
            aria-label={
              pdfSide === 'left'
                ? 'Mover leitor de PDF para a direita'
                : 'Mover leitor de PDF para a esquerda'
            }
          >
            {pdfSide === 'left' ? (
              <PanelRight className="h-3.5 w-3.5" />
            ) : (
              <PanelLeft className="h-3.5 w-3.5" />
            )}
          </button>

          {activeBlobUrl && (
            <button
              type="button"
              onClick={() => setShowNativeToolbar((v) => !v)}
              className={`rounded-lg p-1.5 transition ${
                showNativeToolbar
                  ? 'bg-indigo-600/20 text-indigo-300'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
              }`}
              title={
                showNativeToolbar
                  ? 'Ocultar barra nativa do navegador (modo limpo sem barra dupla)'
                  : 'Mostrar barra nativa do PDF (imprimir / ferramentas do navegador)'
              }
            >
              <PanelTop className="h-3.5 w-3.5" />
            </button>
          )}

          {activeBlobUrl && (
            <a
              href={activeBlobUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              title="Abrir PDF em nova aba"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}

          {activeDoc && (
            <button
              type="button"
              onClick={handleRemoveActiveDoc}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-500/15 hover:text-rose-400"
              title="Remover este PDF da biblioteca"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            title="Fechar leitor de PDF"
          >
            <X className="h-4 w-4" />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) handleImportPdfFile(file);
            }}
          />
        </div>
      </div>

      {/* VISUALIZADOR DE PDF */}
      <div className="relative min-h-0 flex-1 overflow-hidden bg-[#0F1115]">
        {iframeSrc ? (
          <>
            <iframe
              key={`${activeDoc?.id ?? 'pdf'}-${showNativeToolbar ? 'tb1' : 'tb0'}`}
              src={iframeSrc}
              title={activeDoc?.name ?? 'PDF'}
              style={{ colorScheme: theme === 'paper' ? 'light' : 'dark' }}
              className={`block h-full w-full border-0 ${
                theme === 'paper' ? 'bg-white' : 'bg-[#0F1115]'
              } ${isResizing ? 'pointer-events-none' : ''}`}
            />
            {isResizing && <div className="absolute inset-0 z-10 cursor-col-resize" />}
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-[#161920] text-indigo-400 shadow-lg">
              <FileText className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-100">
              Estude com PDF lado a lado
            </h3>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-zinc-400">
              Arraste uma apostila, edital ou PDF aqui — ou clique em Importar — para ler lado a
              lado enquanto constrói seu mapa mental.
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500"
            >
              <Upload className="h-3.5 w-3.5" /> Importar PDF Local
            </button>
          </div>
        )}
      </div>

      {/* CAPTURA RÁPIDA: TRECHO DO PDF -> KNOWLEDGE CARD NO CANVAS */}
      <div className="shrink-0 border-t border-zinc-800/90 bg-[#161920]">
        <button
          type="button"
          onClick={() => setCaptureOpen((v) => !v)}
          className="flex w-full items-center justify-between px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-indigo-300 transition hover:bg-zinc-800/40"
        >
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Captura Rápida → Canvas
          </span>
          {captureOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>

        {captureOpen && (
          <div className="space-y-2 px-3.5 pb-3.5">
            <div className="flex items-center gap-2">
              <input
                value={captureTitle}
                onChange={(e) => setCaptureTitle(e.target.value)}
                placeholder="Título do card (opcional)..."
                className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-[#0F1115] px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
              />
              <input
                value={capturePage}
                onChange={(e) => setCapturePage(e.target.value)}
                placeholder="Pág."
                className="w-16 rounded-lg border border-zinc-800 bg-[#0F1115] px-2.5 py-1.5 text-center text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <textarea
              rows={2}
              value={captureText}
              onChange={(e) => setCaptureText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleSendToCanvas();
                }
              }}
              placeholder="Cole aqui o trecho copiado do PDF ou escreva seu resumo... (Ctrl+Enter envia)"
              className="w-full resize-none rounded-lg border border-zinc-800 bg-[#0F1115] px-2.5 py-1.5 text-xs leading-relaxed text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
            />

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {CAPTURE_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCaptureColor(c.id)}
                    title={`Cor: ${c.label}`}
                    className={`h-4 w-4 rounded-full border-2 transition hover:scale-110 ${
                      captureColor === c.id ? 'scale-110 border-white' : 'border-transparent opacity-65'
                    }`}
                    style={{ backgroundColor: c.dot }}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={handleSendToCanvas}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500"
              >
                <Send className="h-3.5 w-3.5" /> Enviar p/ Canvas
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}