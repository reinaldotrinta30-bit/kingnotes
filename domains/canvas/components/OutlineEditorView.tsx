'use client';

import React, { useState } from 'react';
import { FileText, Sparkles, ArrowLeft, Info } from 'lucide-react';

interface OutlineEditorViewProps {
  initialText: string;
  onCancel: () => void;
  onApply: (text: string) => Promise<void>;
}

export function OutlineEditorView({ initialText, onCancel, onApply }: OutlineEditorViewProps) {
  const [text, setText] = useState(initialText);
  const [isApplying, setIsApplying] = useState(false);

  // Permite usar Tab e Shift+Tab para criar níveis hierárquicos rapidamente
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const el = e.currentTarget;
    const start = el.selectionStart;
    const end = el.selectionEnd;

    if (e.shiftKey) {
      const lineStart = text.lastIndexOf('\n', start - 1) + 1;
      if (text.slice(lineStart, lineStart + 2) === '  ') {
        const next = text.slice(0, lineStart) + text.slice(lineStart + 2);
        setText(next);
        setTimeout(() => {
          el.selectionStart = Math.max(lineStart, start - 2);
          el.selectionEnd = Math.max(lineStart, end - 2);
        }, 0);
      }
    } else {
      const next = text.slice(0, start) + '  ' + text.slice(end);
      setText(next);
      setTimeout(() => {
        el.selectionStart = start + 2;
        el.selectionEnd = start + 2;
      }, 0);
    }
  };

  const handleConfirm = async () => {
    setIsApplying(true);
    try {
      await onApply(text);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col items-center overflow-y-auto bg-[#0F1115] px-6 py-8">
      <div className="flex w-full max-w-3xl flex-1 flex-col rounded-2xl border border-zinc-800/90 bg-[#161920] p-6 shadow-2xl">
        {/* Cabeçalho */}
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-zinc-800/80 pb-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-zinc-100">
              <FileText className="h-5 w-5 text-indigo-400" />
              Modo Estrutura em Texto → Canvas Visual
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              Use <code className="rounded bg-zinc-800 px-1 py-0.5 text-indigo-300">- Título</code> para
              criar cards e <code className="rounded bg-zinc-800 px-1 py-0.5 text-indigo-300">Tab</code> (ou
              2 espaços) para conectar subtópicos. Linhas sem hífen viram texto interno do card acima.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao Canvas
          </button>
        </div>

        {/* Aviso de segurança (Segundo Cérebro Permanente) */}
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-indigo-500/20 bg-indigo-500/[0.06] px-3.5 py-2 text-[11.5px] text-indigo-200/90">
          <Info className="h-4 w-4 shrink-0 text-indigo-400" />
          Cards existentes com o mesmo título têm seu conteúdo rico, PDFs e flashcards 100% preservados.
        </div>

        {/* Editor Monoespaçado */}
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`- Seguridade Social (Art. 194 CF)\n  - Saúde\n    Direito de todos e dever do Estado.\n  - Previdência Social\n    Caráter contributivo e filiação obrigatória.\n  - Assistência Social`}
          className="min-h-[340px] flex-1 resize-none rounded-xl border border-zinc-800 bg-[#0F1115] p-4 font-mono text-[13px] leading-7 text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500/70 focus:outline-none"
        />

        {/* Rodapé */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-[11px] text-zinc-500">
            Dica: pressione <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300">Tab</kbd> para
            indentar e <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300">Shift+Tab</kbd> para
            voltar um nível.
          </span>
          <button
            type="button"
            disabled={isApplying}
            onClick={handleConfirm}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {isApplying ? 'Gerando no Canvas...' : 'Atualizar no Canvas Visual'}
          </button>
        </div>
      </div>
    </div>
  );
}