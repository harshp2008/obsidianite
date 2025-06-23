// C:\Users\harsh\Desktop\obsidianite\src\components\EditorCore\editor_core_imports.ts

export { useEffect, useRef } from 'react';
export { EditorView, keymap } from '@codemirror/view';
export { EditorState } from '@codemirror/state';
export type { Extension } from '@codemirror/state';

import { EditorView } from '@codemirror/view';

export { markdown, markdownLanguage } from '@codemirror/lang-markdown';
export { GFM } from '@lezer/markdown'; // Keep GFM for strikethrough, etc.

export { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
export { tags} from '@lezer/highlight';

import { tags} from '@lezer/highlight';
import { HighlightStyle } from '@codemirror/language';

export { javascript } from '@codemirror/lang-javascript';

export { history, historyKeymap } from '@codemirror/commands';
export { defaultKeymap } from '@codemirror/commands';
export { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
export { lintKeymap } from '@codemirror/lint';

export {
  dropCursor,
  drawSelection,
  highlightActiveLine,
  rectangularSelection,
  crosshairCursor,
  highlightActiveLineGutter,
} from '@codemirror/view';

export { oneDark } from '@codemirror/theme-one-dark';

// Custom extensions and utilities

export { markdownLinkTransformation } from '../../extensions/markdownLinkTransformation';
export { logLezerTree } from '../../utils/lezerInspector';
export { markdownSyntaxHiding } from '../../extensions/markdownSyntaxHiding/snytaxHidingPlugin';
export { listBulletExtension } from '../../extensions/markdownListBulletExtension';

// export the new highlight extension
export { markdownHighlightExtension, highlightTags } from '../../extensions/markdownHighlightExtension';

import { highlightTags } from '../../extensions/markdownHighlightExtension';

//export '../../App.css';
export { horizontalRuleExtension } from '../../extensions/horizontalRuleExtension';

// Update customTags to include 'mark' mapped to highlightTags.highlight
export const customTags = {
  mark: highlightTags.highlight // Mapped to the content tag of our highlight extension
};

export const customHighlightStyle = HighlightStyle.define([
  { tag: tags.heading1, class: 'cm-header cm-header-1' },
  { tag: tags.heading2, class: 'cm-header cm-header-2' },
  { tag: tags.heading3, class: 'cm-header cm-header-3' },
  { tag: tags.heading4, class: 'cm-header cm-header-4' },
  { tag: tags.heading5, class: 'cm-header cm-header-5' },
  { tag: tags.heading6, class: 'cm-header cm-header-6' },

  { tag: tags.strong, class: 'cm-strong' },
  { tag: tags.emphasis, class: 'cm-emphasis' },

  { tag: tags.link, class: 'cm-link' },
  { tag: tags.url, class: 'cm-url' },

  { tag: tags.monospace, class: 'cm-inline-code',
    lineHeight: 'normal',
  },

  { tag: tags.strikethrough, class: 'cm-strikethrough' },
  { tag: customTags.mark, class: 'cm-highlight' }, // This will now apply to 'Mark' nodes created by our extension
  { tag: tags.quote, class: 'cm-blockquote' }
]);

// Define your custom theme extension for selection here
// We are choosing an opaque selection color to ensure it stands out
// over existing colored backgrounds like highlights.
export const mySelectionTheme = EditorView.theme({
  // Target selection background when editor is focused
  "&.cm-focused .cm-selectionBackground": {
    backgroundColor: "#BBDEFB", // A light, opaque blue, or even a light gray like #E0E0E0 for more neutrality
  },
  // Target selection background when editor is not focused
  ".cm-selectionBackground": {
    backgroundColor: "#BBDEFB", // Keep consistent with focused state for now
  },

  // Make all selected text dark for maximum contrast against the light selection background
  "&.cm-focused .cm-selectionBackground span": {
    color: "#000", // Black text on light selection background
  },
  // Specific overrides for highlight and inline code text colors when selected
  "&.cm-focused .cm-selectionBackground .cm-highlight": {
    color: "#000", // Ensure highlight text is black when selected
  },
  "&.cm-focused .cm-selectionBackground .cm-inline-code": {
    color: "#000", // Ensure inline code text is black when selected
  },
  // To ensure cursor remains visible over selection
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "#000", // Make cursor black when editor is focused and over selection
  }
});

