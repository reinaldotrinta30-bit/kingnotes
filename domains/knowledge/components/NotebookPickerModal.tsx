'use client';

import React, { useState } from 'react';
import { FolderOpen, Plus, X, CheckCircle2, Trash2 } from 'lucide-react';
import { useKnowledgeStore } from '../store/useKnowledgeStore';

interface NotebookPickerModalProps {
  cardId: string | null;
  onClose: () => void;
}

const NOTEBOOK_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#0ea5e9', '#a855f7'];

export function NotebookPickerModal({ cardId, onClose }: NotebookPickerModalProps) {
  const { cardsById, notebooks, createNotebook, deleteNotebook, toggleCardInNotebook } =
    useKnowledgeStore();
  const [newName, setNewName] = useState('');
  const [selectedColor, setSelectedColor] = useState(NOTEBOOK_COLORS[0]);

  if (!cardId) return null;
  const card = cardsById[cardId];
  if (!card) return null;

  const linkedIds = card.notebookIds ?? [];

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const created = await createNotebook(newName.trim(), selectedColor);
    await toggleCardInNotebook(cardId, created.id);
    setNewName('');
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-zinc-800 bg-[#161920] p-5 shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <FolderOpen className="h-4 w-4 text-indigo-400" />
            Meus Cadernos (Polinização Cruzada)
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 text-xs text-zinc-400">
          Vincule <strong className="text-zinc-200">{card.title}</strong> a cadernos extras de
          revisão sem duplicar o card.
        </p>

        {/* Lista de Cadernos */}
        <div className="mb-4 max-h-56 space-y-1.5 overflow-y-auto pr-1">
          {notebooks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 p-5 text-center text-xs text-zinc-500">
              Nenhum caderno criado ainda. Crie seu primeiro abaixo (ex: &ldquo;Revisão de Véspera&rdquo;).
            </div>
          ) : (
            notebooks.map((nb) => {
              const isLinked = linkedIds.includes(nb.id);
              return (
                <div
                  key={nb.id}
                  className={`group flex items-center justify-between rounded-xl border px-3 py-2.5 transition ${
                    isLinked
                      ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-200'
                      : 'border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleCardInNotebook(cardId, nb.id)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: nb.color }}
                    />
                    <span className="truncate text-xs font-medium">{nb.name}</span>
                  </button>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleCardInNotebook(cardId, nb.id)}
                      className={`flex h-5 w-5 items-center justify-center rounded border transition ${
                        isLinked
                          ? 'border-indigo-500 bg-indigo-600 text-white'
                          : 'border-zinc-700 bg-transparent'
                      }`}
                    >
                      {isLinked && <CheckCircle2 className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Remover o caderno "${nb.name}"? Os cards continuam intactos.`)) {
                          deleteNotebook(nb.id);
                        }
                      }}
                      className="rounded p-1 text-zinc-600 opacity-0 transition hover:text-rose-400 group-hover:opacity-100"
                      title="Excluir caderno"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Criar novo caderno inline */}
        <div className="space-y-2.5 rounded-xl border border-zinc-800 bg-[#0F1115] p-3">
          <div className="flex items-center gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
              }}
              placeholder="Novo caderno (ex: Pegadinhas CEBRASPE)..."
              className="flex-1 bg-transparent text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCreate}
              className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
            >
              <Plus className="h-3.5 w-3.5" /> Criar
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            {NOTEBOOK_COLORS.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => setSelectedColor(hex)}
                className={`h-4 w-4 rounded-full border-2 transition ${
                  selectedColor === hex ? 'scale-110 border-white' : 'border-transparent opacity-60'
                }`}
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}