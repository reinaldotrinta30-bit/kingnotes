'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Database,
  Download,
  Upload,
  X,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  ShieldCheck,
} from 'lucide-react';
import {
  exportFullBackup,
  getLocalStorageStats,
  LocalStorageStats,
  restoreFullBackup,
  triggerBackupDownload,
} from '@/infrastructure/persistence/dexie/backupService';
import { useKnowledgeStore } from '@/domains/knowledge/store/useKnowledgeStore';
import { useUiStore } from '@/domains/ui/store/useUiStore';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BackupModal({ isOpen, onClose }: BackupModalProps) {
  const bootstrap = useKnowledgeStore((s) => s.bootstrap);
  const { openConfirm, addToast, hydrateUi, setPdfReaderOpen } = useUiStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stats, setStats] = useState<LocalStorageStats | null>(null);
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadStats = () => {
    getLocalStorageStats().then(setStats);
  };

  useEffect(() => {
    if (isOpen) {
      setFeedback(null);
      loadStats();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleExport = async () => {
    setBusy('export');
    setFeedback(null);
    try {
      const backup = await exportFullBackup();
      triggerBackupDownload(backup);
      loadStats();
      const summary = `Backup v4 salvo (${backup.stats.cards} cards, ${backup.stats.strokes} traços, ${backup.stats.blobs} mídias).`;
      setFeedback({ type: 'ok', text: summary });
      addToast({ message: 'Backup completo exportado com sucesso', variant: 'success' });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Erro ao exportar backup.',
      });
    } finally {
      setBusy(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    openConfirm({
      title: 'Restaurar backup completo?',
      description: `Os dados atuais deste navegador serão substituídos pelo arquivo "${file.name}" (incluindo cards, desenhos, PDFs, fontes, revisões e preferências).`,
      confirmLabel: 'Restaurar agora',
      variant: 'danger',
      onConfirm: async () => {
        setBusy('import');
        setFeedback(null);
        try {
          const text = await file.text();
          const restored = await restoreFullBackup(text);
          setPdfReaderOpen(false);
          hydrateUi();
          await bootstrap();
          loadStats();
          setFeedback({
            type: 'ok',
            text: `Restaurado com sucesso: ${restored.cards} cards, ${restored.strokes} traços, ${restored.studySessions} sessões e ${restored.blobs} mídias.`,
          });
          addToast({ message: 'Backup restaurado com sucesso!', variant: 'success' });
        } catch (err) {
          setFeedback({
            type: 'err',
            text: err instanceof Error ? err.message : 'Falha ao ler arquivo de backup.',
          });
        } finally {
          setBusy(null);
        }
      },
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 KB';
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-[#161920] p-6 shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-zinc-100">
              Armazenamento Local & Backup v4
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 text-xs leading-relaxed text-zinc-400">
          O backup inclui todos os cards, grupos, desenhos à caneta, revisões SM-2, sessões do
          Heatmap, PDFs, imagens, áudios, fontes importadas e suas preferências.
        </p>

        {/* Último backup */}
        {stats && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-zinc-800/90 bg-[#0F1115] px-3.5 py-2 text-[11px]">
            <span className="flex items-center gap-1.5 text-zinc-400">
              <ShieldCheck
                className={`h-3.5 w-3.5 ${stats.lastBackupAt ? 'text-emerald-400' : 'text-amber-400'}`}
              />
              Último backup exportado
            </span>
            <span className="font-medium text-zinc-200">
              {stats.lastBackupAt
                ? new Date(stats.lastBackupAt).toLocaleString('pt-BR')
                : 'Ainda não realizado'}
            </span>
          </div>
        )}

        {/* Estatísticas da Base */}
        {stats && (
          <div className="mb-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-zinc-800 bg-[#0F1115] p-3">
              <p className="text-base font-bold text-zinc-100">{stats.cards}</p>
              <p className="text-[11px] text-zinc-400">Cards</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-[#0F1115] p-3">
              <p className="text-base font-bold text-zinc-100">{stats.strokes}</p>
              <p className="text-[11px] text-zinc-400">Traços/Desenhos</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-[#0F1115] p-3">
              <p className="text-base font-bold text-zinc-100">{stats.notebooks}</p>
              <p className="text-[11px] text-zinc-400">Cadernos</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-[#0F1115] p-3">
              <p className="text-base font-bold text-zinc-100">{stats.reviews}</p>
              <p className="text-[11px] text-zinc-400">Revisões SM-2</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-[#0F1115] p-3">
              <p className="text-base font-bold text-zinc-100">{stats.studySessions}</p>
              <p className="text-[11px] text-zinc-400">Sessões Foco</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-[#0F1115] p-3">
              <p className="text-base font-bold text-zinc-100">{stats.attachments}</p>
              <p className="text-[11px] text-zinc-400">Mídias/Fontes</p>
            </div>
          </div>
        )}

        {stats && (
          <div className="mb-5 flex items-center justify-between rounded-xl border border-zinc-800 bg-[#0F1115] px-3.5 py-2.5 text-xs text-zinc-400">
            <span className="flex items-center gap-2">
              <HardDrive className="h-3.5 w-3.5 text-indigo-400" />
              Peso total de mídias locais (PDFs, imagens, áudios, fontes)
            </span>
            <span className="font-mono text-[11px] font-semibold text-zinc-200">
              {formatSize(stats.totalBlobBytes)}
            </span>
          </div>
        )}

        {/* Ações */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={handleExport}
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {busy === 'export' ? 'Exportando...' : 'Exportar Backup (.json)'}
          </button>

          <button
            type="button"
            disabled={busy !== null}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-50"
          >
            <Upload className="h-4 w-4 text-emerald-400" />
            {busy === 'import' ? 'Restaurando...' : 'Restaurar Backup'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {feedback && (
          <div
            className={`mt-4 flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs ${
              feedback.type === 'ok'
                ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border border-rose-500/30 bg-rose-500/10 text-rose-300'
            }`}
          >
            {feedback.type === 'ok' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}
      </div>
    </div>
  );
}