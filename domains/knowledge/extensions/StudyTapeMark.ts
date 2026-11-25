import { Mark, mergeAttributes } from '@tiptap/core';

/**
 * Fita de Ocultação (Study Tape — estilo Freenotes / StarNotes).
 * Cobre trechos selecionados com uma fita colorida clicável para recuperação ativa.
 */
export const StudyTapeMark = Mark.create({
  name: 'studyTape',

  parseHTML() {
    return [{ tag: 'span[data-study-tape]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-study-tape': 'true',
        class: 'kc-study-tape',
        title: 'Fita de ocultação (clique para revelar)',
      }),
      0,
    ];
  },
});