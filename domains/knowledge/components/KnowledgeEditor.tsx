'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useKnowledgeStore } from '../store/useKnowledgeStore';
import { KnowledgeCardEditorPane } from './KnowledgeCardEditorPane';

export function KnowledgeEditorDrawer() {
  const { activeFullCard, secondaryFullCard, openCard, openSecondaryCard } = useKnowledgeStore();
  const [isExpanded, setIsExpanded] = useState(false);

  const isSplitActive = Boolean(activeFullCard && secondaryFullCard);

  return (
    <AnimatePresence>
      {activeFullCard && (
        <motion.aside
          initial={{ x: 560, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 560, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          className={`fixed inset-y-0 right-0 z-40 flex border-l border-zinc-800/90 bg-[#13161C]/98 shadow-2xl backdrop-blur-xl transition-[width,max-width] duration-200 ${
            isSplitActive
              ? 'w-[96vw] max-w-[1260px]'
              : isExpanded
              ? 'w-full max-w-[960px]'
              : 'w-full max-w-[640px]'
          }`}
        >
          <div
            className={`grid h-full w-full ${
              isSplitActive ? 'grid-cols-1 divide-y divide-zinc-800 lg:grid-cols-2 lg:divide-x lg:divide-y-0' : 'grid-cols-1'
            }`}
          >
            <KnowledgeCardEditorPane
              key={`primary-${activeFullCard.meta.id}`}
              fullCard={activeFullCard}
              slot="primary"
              isSplitActive={isSplitActive}
              isExpanded={isExpanded}
              onToggleExpand={() => setIsExpanded((v) => !v)}
              onClose={() => openCard(null)}
            />

            {secondaryFullCard && (
              <KnowledgeCardEditorPane
                key={`secondary-${secondaryFullCard.meta.id}`}
                fullCard={secondaryFullCard}
                slot="secondary"
                isSplitActive={isSplitActive}
                onClose={() => openSecondaryCard(null)}
              />
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}