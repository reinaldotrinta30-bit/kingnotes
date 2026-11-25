'use client';

import React, { useEffect, useRef, useState } from 'react';
import { FileText, Mic, Square, Volume2, ExternalLink, Trash2, Eye } from 'lucide-react';
import { LocalAttachment } from '../types';
import { getKnowledgeRepository } from '@/infrastructure/persistence/repositoryFactory';

interface Props {
  attachments: LocalAttachment[];
  onAddAttachment: (attachment: LocalAttachment) => void;
  onRemoveAttachment: (attachmentId: string) => void;
}

function BlobMediaRow({
  attachment,
  onRemove,
  onPreviewPdf,
}: {
  attachment: LocalAttachment;
  onRemove: () => void;
  onPreviewPdf: (url: string, name: string) => void;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    let revoked = false;
    let createdUrl: string | null = null;

    getKnowledgeRepository()
      .getBlob(attachment.blobId)
      .then((blob) => {
        if (!blob || revoked) return;
        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
      });

    return () => {
      revoked = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl); // Evita memory leak em sessões longas
    };
  }, [attachment.blobId]);

  if (attachment.type === 'audio') {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
        <div className="mb-2 flex items-center justify-between text-xs text-zinc-300">
          <span className="flex items-center gap-1.5 font-medium">
            <Volume2 className="h-3.5 w-3.5 text-indigo-400" /> {attachment.name}
          </span>
          <button onClick={onRemove} className="text-zinc-500 hover:text-rose-400">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        {objectUrl && <audio controls src={objectUrl} className="h-8 w-full accent-indigo-500" />}
      </div>
    );
  }

  if (attachment.type === 'pdf') {
    return (
      <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-2.5 text-xs">
        <div className="flex items-center gap-2 truncate">
          <FileText className="h-4 w-4 shrink-0 text-rose-400" />
          <span className="truncate text-zinc-200">{attachment.name}</span>
          <span className="text-[10px] text-zinc-500">({Math.round(attachment.sizeBytes / 1024)} KB)</span>
        </div>
        <div className="flex items-center gap-1.5">
          {objectUrl && (
            <>
              <button
                onClick={() => onPreviewPdf(objectUrl, attachment.name)}
                className="flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-1 text-[11px] text-zinc-200 hover:bg-indigo-600"
              >
                <Eye className="h-3 w-3" /> Ler
              </button>
              <a
                href={objectUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                title="Abrir em nova aba"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </>
          )}
          <button onClick={onRemove} className="rounded-md p-1 text-zinc-500 hover:text-rose-400">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export function AttachmentManager({ attachments, onAddAttachment, onRemoveAttachment }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<{ url: string; name: string } | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const toggleVoiceNote = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const blobId = `blob-${crypto.randomUUID()}`;
      await getKnowledgeRepository().saveBlob(blobId, blob);

      onAddAttachment({
        id: `att-${crypto.randomUUID()}`,
        type: 'audio',
        name: `Nota de Voz — ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
        mimeType: 'audio/webm',
        blobId,
        sizeBytes: blob.size,
      });
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
  };

  return (
    <div className="mt-6 border-t border-zinc-800/80 pt-5">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          PDFs & Áudios de Revisão
        </h4>
        <button
          type="button"
          onClick={toggleVoiceNote}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
            isRecording
              ? 'animate-pulse bg-rose-600 text-white'
              : 'border border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-indigo-500/50'
          }`}
        >
          {isRecording ? <Square className="h-3 w-3" /> : <Mic className="h-3 w-3 text-indigo-400" />}
          {isRecording ? 'Parar Gravação' : 'Gravar Áudio'}
        </button>
      </div>

      <div className="space-y-2">
        {attachments.map((att) => (
          <BlobMediaRow
            key={att.id}
            attachment={att}
            onRemove={() => onRemoveAttachment(att.id)}
            onPreviewPdf={(url, name) => setPdfPreview({ url, name })}
          />
        ))}
      </div>

      {/* Modal de Leitura Rápida de PDF */}
      {pdfPreview && (
        <div
          onClick={() => setPdfPreview(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-[#13161C]"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5 text-xs text-zinc-200">
              <span className="font-medium">{pdfPreview.name}</span>
              <button
                onClick={() => setPdfPreview(null)}
                className="rounded-md bg-zinc-800 px-2.5 py-1 hover:bg-zinc-700"
              >
                Fechar
              </button>
            </div>
            <iframe src={pdfPreview.url} className="flex-1 bg-white" title={pdfPreview.name} />
          </div>
        </div>
      )}
    </div>
  );
}