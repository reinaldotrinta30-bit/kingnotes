import { Mark, mergeAttributes } from '@tiptap/core';

export type StudyUnderlineVariant = 'brush' | 'wavy' | 'double' | 'dashed';

export const StudyUnderlineMark = Mark.create({
  name: 'studyUnderline',

  addAttributes() {
    return {
      color: {
        default: '#ef4444',
        parseHTML: (element) => element.getAttribute('data-ul-color') || '#ef4444',
        renderHTML: (attributes) => ({
          'data-ul-color': attributes.color,
          style: `--kc-ul-color: ${attributes.color};`,
        }),
      },
      variant: {
        default: 'brush',
        parseHTML: (element) =>
          (element.getAttribute('data-study-underline') as StudyUnderlineVariant) || 'brush',
        renderHTML: (attributes) => ({
          'data-study-underline': attributes.variant,
          class: `kc-ul kc-ul-${attributes.variant}`,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-study-underline]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0];
  },
});