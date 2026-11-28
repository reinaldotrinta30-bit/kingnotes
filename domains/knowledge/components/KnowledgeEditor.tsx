'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useKnowledgeStore } from '../store/useKnowledgeStore';
import { useUiStore } from '@/domains/ui/store/useUiStore';
import { KnowledgeCardEditorPane } from './KnowledgeCardEditorPane';

export function KnowledgeEditorDrawer() {
  const { activeFullCard, secondaryFullCard, openCard, openSecondaryCard } = useKnowledgeStore();
  const {
    editorPresentation,
    toggleEditorPresentation,
    hasUnsavedEditorChanges,
    setHasUnsavedEditorChanges,
    openConfirm,
  } = useUiStore();

  const isSplitActive = Boolean(activeFullCard && secondaryFullCard);
  const isExpandedModal = editorPresentation === 'expanded';

  const requestCloseAll = () => {
    if (hasUnsavedEditorChanges) {
      openConfirm({
        title: 'Existem alterações não salvas',
        description:
          'Deseja fechar o editor e descartar as alterações ainda não salvas, ou cancelar para salvar antes?',
        confirmLabel: 'Descartar e fechar',
        variant: 'danger',
        onConfirm: () => {
          setHasUnsavedEditorChanges(false);
          openCard(null);
        },
      });
      return;
    }
    openCard(null);
  };

  // Fecha com Esc respeitando a guarda de alterações não salvas
  useEffect(() => {
    if (!activeFullCard) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Evita fechar se algum input de busca/menu interno já tratou o Escape
      if (e.defaultPrevented) return;
      e.preventDefault();
      requestCloseAll();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeFullCard, hasUnsavedEditorChanges]);

  // Garante limpeza do dirty flag quando nenhum card estiver aberto
  useEffect(() => {
    if (!activeFullCard) {
      setHasUnsavedEditorChanges(false);
    }
  }, [activeFullCard, setHasUnsavedEditorChanges]);

  return (
    <AnimatePresence>
      {activeFullCard && (
        <>
          {/* Backdrop escuro sutil apenas no modo Tela Ampliada */}
          {isExpandedModal && (
            <motion.div
              key="editor-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={requestCloseAll}
              className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm"
            />
          )}

          <motion.section
            key={isExpandedModal ? 'editor-expanded' : 'editor-side'}
            role="dialog"
            aria-modal={isExpandedModal}
            aria-label={`Editor avançado: ${activeFullCard.meta.title}`}
            initial={
              isExpandedModal
                ? { opacity: 0, scale: 0.97, y: 12 }
                : { x: 560, opacity: 0 }
            }
            animate={isExpandedModal ? { opacity: 1, scale: 1, y: 0 } : { x: 0, opacity: 1 }}
            exit={
              isExpandedModal
                ? { opacity: 0, scale: 0.97, y: 10 }
                : { x: 560, opacity: 0 }
            }
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className={
              isExpandedModal
                ? 'fixed inset-2 z-50 mx-auto flex max-w-[1440px] overflow-hidden rounded-2xl border border-zinc-800/90 bg-[#13161C]/98 shadow-2xl sm:inset-4 md:inset-6'
                : `fixed inset-y-0 right-0 z-40 flex border-l border-zinc-800/90 bg-[#13161C]/98 shadow-2xl backdrop-blur-xl transition-[width,max-width] duration-200 ${
                    isSplitActive ? 'w-[96vw] max-w-[1260px]' : 'w-full max-w-[760px]'
                  }`
            }
          >
            <div
              className={`grid h-full min-h-0 w-full ${
                isSplitActive
                  ? 'grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] divide-y divide-zinc-800 lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)] lg:divide-x lg:divide-y-0'
                  : 'grid-cols-1 grid-rows-[minmax(0,1fr)]'
              }`}
            >
              <KnowledgeCardEditorPane
                key={`primary-${activeFullCard.meta.id}`}
                fullCard={activeFullCard}
                slot="primary"
                isSplitActive={isSplitActive}
                isExpanded={isExpandedModal}
                onToggleExpand={toggleEditorPresentation}
                onClose={requestCloseAll}
              />

              {secondaryFullCard && (
                <KnowledgeCardEditorPane
                  key={`secondary-${secondaryFullCard.meta.id}`}
                  fullCard={secondaryFullCard}
                  slot="secondary"
                  isSplitActive={isSplitActive}
                  isExpanded={isExpandedModal}
                  onClose={() => openSecondaryCard(null)}
                />
              )}
            </div>
          </motion.section>
        </>
      )}
    </AnimatePresence>
  );
}