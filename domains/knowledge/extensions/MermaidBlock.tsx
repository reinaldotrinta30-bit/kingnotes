'use client';

import React, { useEffect, useId, useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { GitFork } from 'lucide-react';

const DEFAULT_DIAGRAM = `graph LR
  A[Fato Gerador] --> B{Obrigação Tributária}
  B --> C[Lançamento]
  C --> D[Crédito Tributário]`;

function MermaidNodeView({ node, updateAttributes, selected }: NodeViewProps) {
  const code: string = node.attrs.code ?? DEFAULT_DIAGRAM;
  const [editing, setEditing] = useState(false);
  const [svg, setSvg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const uniqueId = useId().replace(/:/g, '');

  useEffect(() => {
    let cancelled = false;
    async function renderDiagram() {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          themeVariables: {
            primaryColor: '#1e2230',
            primaryTextColor: '#e4e4e7',
            primaryBorderColor: '#6366f1',
            lineColor: '#818cf8',
            background: '#13161C',
          },
        });
        const { svg: rendered } = await mermaid.render(`mmd-${uniqueId}`, code);
        if (!cancelled) {
          setSvg(rendered);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Sintaxe Mermaid inválida');
        }
      }
    }
    renderDiagram();
    return () => {
      cancelled = true;
    };
  }, [code, uniqueId]);

  return (
    <NodeViewWrapper
      className={`my-3 rounded-xl border p-3 transition ${
        selected ? 'border-indigo-500/70 bg-zinc-900/90' : 'border-zinc-800 bg-zinc-900/50'
      }`}
    >
      <div className="mb-2 flex items-center justify-between text-[11px] text-zinc-400">
        <span className="flex items-center gap-1.5 font-medium text-emerald-300">
          <GitFork className="h-3.5 w-3.5" /> Diagrama (Mermaid)
        </span>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="rounded-md bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-200 hover:bg-zinc-700"
        >
          {editing ? 'Visualizar' : 'Editar Código'}
        </button>
      </div>

      {editing && (
        <textarea
          rows={5}
          value={code}
          onChange={(e) => updateAttributes({ code: e.target.value })}
          className="mb-3 w-full rounded-lg bg-zinc-950 p-2.5 font-mono text-xs text-zinc-200 focus:outline-none"
        />
      )}

      {error ? (
        <p className="rounded-lg bg-rose-950/40 p-2 text-[11px] text-rose-300">{error}</p>
      ) : (
        <div
          onDoubleClick={() => setEditing(true)}
          className="flex justify-center overflow-x-auto py-2 [&>svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
    </NodeViewWrapper>
  );
}

export const MermaidBlock = Node.create({
  name: 'mermaidBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      code: { default: DEFAULT_DIAGRAM },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="mermaid-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'mermaid-block' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidNodeView);
  },
});