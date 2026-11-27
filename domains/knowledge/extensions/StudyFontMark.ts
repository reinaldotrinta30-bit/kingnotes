import { Mark, mergeAttributes } from '@tiptap/core';
import { StudyFontId } from '../types';
import { getFontFamilyCss } from '@/domains/canvas/utils/studyFonts';

export const StudyFontMark = Mark.create({
  name: 'studyFont',

  addAttributes() {
    return {
      fontId: {
        default: 'default' as StudyFontId,
        parseHTML: (element) =>
          (element.getAttribute('data-study-font') as StudyFontId) || 'default',
        renderHTML: (attributes) => {
          const id = (attributes.fontId as StudyFontId) || 'default';
          if (id === 'default') return {};
          return {
            'data-study-font': id,
            style: `font-family: ${getFontFamilyCss(id)};`,
          };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-study-font]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0];
  },
});