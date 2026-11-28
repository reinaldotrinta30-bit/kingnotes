'use client';

import React, { useEffect, useState } from 'react';
import {
  Briefcase,
  Check,
  Pencil,
  Plus,
  Trash2,
  X,
  ArrowUpRight,
} from 'lucide-react';
import { Workspace } from '@/domains/knowledge/types';
import { useKnowledgeStore } from '@/domains/knowledge/store/useKnowledgeStore';
import { useUiStore } from '@/domains/ui/store/useUiStore';

const WORKSPACE_ICONS = [
  '⚖️',
  '📚',
  '🏛️',
  '🎯',
  '🧠',
  '💼',
  '🩺',
  '💻',
  '🛡️',
  '📊',
  '🎓',
  '⚡',
];

const WORKSPACE_COLORS = [
  '#6366f1',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#f43f5e',
  '#a855f7',
  '#14b8a6',
  '#f97316',
];

interface WorkspaceManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WorkspaceManagerModal({ isOpen, onClose }: WorkspaceManagerModalProps) {
  const {
    workspaces,
    activeWorkspaceId,
    selectWorkspace,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
  } = useKnowledgeStore();

  const { openConfirm, addToast, hasUnsavedEditorChanges, clearTransientCanvasUi } = useUiStore();

  const [formMode, setFormMode] = useState<'none' | 'create' | 'edit'>('none');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [iconDraft, setIconDraft] = useState('📚');
  const [colorDraft, setColorDraft] = useState('#6366f1');
  const [descDraft, setDescDraft] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setFormMode('none');
      setEditingId(null);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const openCreateForm = () => {
    setFormMode('create');
    setEditingId(null);
    setNameDraft('');
    setIconDraft('🎯');
    setColorDraft('#6366f1');
    setDescDraft('');
  };

  const openEditForm = (ws: Workspace) => {
    setFormMode('edit');
    setEditingId(ws.id);
    setNameDraft(ws.name);
    setIconDraft(ws.icon || '📚');
    setColorDraft(ws.color || '#6366f1');
    setDescDraft(ws.description ?? '');
  };

  const handleSaveForm = async () => {
    const clean = nameDraft.trim();
    if (!clean) return;

    if (formMode === 'create') {
      await createWorkspace(clean, iconDraft, colorDraft, descDraft);
      addToast({ message: `Carreira/Módulo "${clean}" criado`, variant: 'success' });
    } else if (formMode === 'edit' && editingId) {
      await updateWorkspace(editingId, {
        name: clean,
        icon: iconDraft,
        color: colorDraft,
        description: descDraft,
      });
      addToast({ message: `"${clean}" atualizado`, variant: 'success' });
    }

    setFormMode('none');
    setEditingId(null);
  };

  const handleSafeSwitch = (wsId: string) => {
    if (wsId === activeWorkspaceId) {
      onClose();
      return;
    }
    const runSwitch = async () => {
      clearTransientCanvasUi();
      await selectWorkspace(wsId);
      onClose();
    };
    if (hasUnsavedEditorChanges) {
      openConfirm({
        title: 'Descartar alterações não salvas?',
        description:
          'Há edições pendentes no card atual. Deseja trocar de carreira/módulo e descartá-las?',
        confirmLabel: 'Trocar',
        variant: 'danger',
        onConfirm: runSwitch,
      });
      return;
    }
    runSwitch();
  };

  const handleDeleteWorkspace = (ws: Workspace) => {
    if (workspaces.length <= 1) {
      addToast({
        message: 'É necessário manter ao menos uma Carreira/Módulo ativo. Você pode renomeá-lo.',
        variant: 'default',
      });
      return;
    }

    openConfirm({
      title: `Excluir "${ws.name}"?`,
      description:
        'Esta carreira/módulo será removido da lista. Recomendamos exportar um Backup antes se desejar guardar uma cópia.',
      confirmLabel: 'Excluir módulo',
      variant: 'danger',
      onConfirm: async () => {
        const ok = await deleteWorkspace(ws.id);
        if (ok) {
          if (editingId === ws.id) {
            setFormMode('none');
            setEditingId(null);
          }
          addToast({ message: `"${ws.name}" removido`, variant: 'default' });
        }
      },
    });
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[84vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-[#161920] shadow-2xl"
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400">
              <Briefcase className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Carreiras & Módulos</h3>
              <p className="text-[11px] text-zinc-400">
                Crie, edite, personalize ou remova suas áreas de estudo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {formMode === 'none' && (
              <button
                type="button"
                onClick={openCreateForm}
                className="flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500"
              >
                <Plus className="h-3.5 w-3.5" /> Novo Módulo
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Formulário de Criação / Edição */}
        {formMode !== 'none' && (
          <div className="space-y-3 border-b border-zinc-800/80 bg-[#12151B] px-5 py-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300">
                {formMode === 'create' ? 'Nova Carreira / Módulo' : 'Editar Carreira / Módulo'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setFormMode('none');
                  setEditingId(null);
                }}
                className="text-[11px] text-zinc-400 hover:text-zinc-200"
              >
                Cancelar
              </button>
            </div>

            <div className="space-y-2">
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveForm();
                }}
                placeholder="Nome (ex: INSS, Receita Federal, MBA Gestão...)"
                className="w-full rounded-xl border border-zinc-800 bg-[#0F1115] px-3 py-2 text-xs font-medium text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
              />
              <input
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                placeholder="Descrição opcional (ex: Edital 2026, revisões e mapas)..."
                className="w-full rounded-xl border border-zinc-800 bg-[#0F1115] px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Ícone */}
            <div className="space-y-1.5">
              <span className="block text-[10.5px] font-medium text-zinc-400">Ícone</span>
              <div className="flex flex-wrap gap-1.5">
                {WORKSPACE_ICONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setIconDraft(ic)}
                    className={`flex h-8 w-8 items-center justify-center rounded-xl border text-sm transition ${
                      iconDraft === ic
                        ? 'border-indigo-500 bg-indigo-600/20'
                        : 'border-zinc-800 bg-[#0F1115] hover:border-zinc-700'
                    }`}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            {/* Cor */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-1.5">
                <span className="mr-1 text-[10.5px] font-medium text-zinc-400">Cor</span>
                {WORKSPACE_COLORS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setColorDraft(hex)}
                    className={`h-5 w-5 rounded-full border-2 transition hover:scale-110 ${
                      colorDraft === hex ? 'scale-110 border-white' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>

              <button
                type="button"
                disabled={!nameDraft.trim()}
                onClick={handleSaveForm}
                className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-40"
              >
                <Check className="h-3.5 w-3.5" />
                {formMode === 'create' ? 'Criar' : 'Salvar'}
              </button>
            </div>
          </div>
        )}

        {/* Lista de Carreiras / Módulos */}
        <div className="kc-no-scrollbar flex-1 space-y-2 overflow-y-auto p-4">
          {workspaces.map((ws) => {
            const isActive = ws.id === activeWorkspaceId;
            return (
              <div
                key={ws.id}
                className={`group flex items-center justify-between gap-3 rounded-2xl border p-3 transition ${
                  isActive
                    ? 'border-indigo-500/50 bg-indigo-500/10'
                    : 'border-zinc-800/90 bg-[#0F1115] hover:border-zinc-700'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleSafeSwitch(ws.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <div
                    style={{ borderColor: ws.color || '#6366f1' }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-[#161920] text-lg"
                  >
                    {ws.icon || '📚'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-semibold text-zinc-100">
                        {ws.name}
                      </span>
                      {isActive && (
                        <span className="shrink-0 rounded-full bg-indigo-500/20 px-2 py-0.5 text-[9.5px] font-semibold text-indigo-300">
                          Atual
                        </span>
                      )}
                    </div>
                    {ws.description ? (
                      <p className="mt-0.5 truncate text-[11px] text-zinc-400">{ws.description}</p>
                    ) : (
                      <p className="mt-0.5 text-[10.5px] text-zinc-500">
                        Clique para abrir esta área
                      </p>
                    )}
                  </div>
                </button>

                <div className="flex shrink-0 items-center gap-1">
                  {!isActive && (
                    <button
                      type="button"
                      onClick={() => handleSafeSwitch(ws.id)}
                      className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-indigo-300"
                      title="Abrir este módulo"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openEditForm(ws)}
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                    title="Editar nome, ícone e cor"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteWorkspace(ws)}
                    disabled={workspaces.length <= 1}
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-500/15 hover:text-rose-400 disabled:opacity-30"
                    title={
                      workspaces.length <= 1
                        ? 'Mantenha ao menos 1 módulo (você pode renomeá-lo)'
                        : 'Excluir módulo'
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}