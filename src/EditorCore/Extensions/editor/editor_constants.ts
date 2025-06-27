// src/components/EditorCore/editor_constants.ts

import { EditorView, keymap } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language'; // Corrected import
import { tags } from '@lezer/highlight';
import { javascript } from '@codemirror/lang-javascript';
import { history, historyKeymap } from '@codemirror/commands';
import { defaultKeymap } from '@codemirror/commands';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { lintKeymap } from '@codemirror/lint';
import {
  dropCursor,
  drawSelection,
  highlightActiveLine,
  rectangularSelection,
  crosshairCursor,
  highlightActiveLineGutter,
} from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';

// Custom extensions
import { markdownLinkTransformation } from '../extensions/markdown/webLinks/markdownLinkTransformation';
import { markdownSyntaxHiding } from '../extensions/markdown/syntaxHiding/snytaxHidingPlugin';
import { listBulletExtension } from '../extensions/markdown/list/markdownListBulletExtension';
import { markdownHighlightExtension, highlightTags } from '../extensions/markdown/highlight/markdownHighlightExtension';
import { combinedHighlightExtension } from '../extensions/markdown/highlight/combinedHighlightExtension';
import { horizontalRuleExtension } from '../extensions/markdown/horizontalRule/horizontalRuleExtension';

import { markdownBracketCompletion } from './closeBracketsConfig';

// Initial content for the editor
export const initialContent = `## My Markdown Doc

This is some **bold** text and *italic* text.

==highlight==
**==strong highlight==**
*==emphasis highlight==*
***==strong emphasis highlight==***

==*italic*, **bold**, ***italic and bold***==

~~strikethrough~~
\`inline code\`

### A Subheading

\`\`\`javascript
console.log("Hello from a JS code block!");
const x = 10;
\`\`\`

1. Ordered item 1
2. Ordered item 2

- List item 1
- List item 2

> A blockquote

[Link to Google](https://www.google.com)
`;

// Custom tags mapping for syntax highlighting
export const customTags = {
  mark: highlightTags.highlight // Mapped to the content tag of our highlight extension
};

// Custom highlight style for various Markdown elements
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

  { tag: tags.monospace, class: 'cm-inline-code', lineHeight: 'normal' },

  { tag: tags.strikethrough, class: 'cm-strikethrough' },
  { tag: customTags.mark, class: 'cm-highlight' },
  { tag: tags.quote, class: 'cm-blockquote' }
]);

// Custom theme extension for selection
export const mySelectionTheme = EditorView.theme({
  "&.cm-focused .cm-selectionBackground": {
    backgroundColor: "var(--cm-selection-background) !important",
  },
  ".cm-selectionBackground": {
    backgroundColor: "var(--cm-selection-background) !important",
  },
  // Remove specific color overrides since we handle these in CSS with ::selection
  // Using !important in the CSS ensures our selectors will take precedence
  ".cm-selectionMatch": {
    backgroundColor: "rgba(114, 140, 211, 0.5) !important",
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "#fff",
  }
});

// All basic CodeMirror extensions (without line numbers initially)
export const basicExtensions: Extension[] = [
  history(),
  keymap.of(historyKeymap),
  keymap.of(defaultKeymap),
  highlightSelectionMatches(),
  keymap.of(searchKeymap),
  dropCursor(),
  keymap.of(lintKeymap),
  drawSelection(),
  highlightActiveLine(),
  rectangularSelection(),
  crosshairCursor(),
  highlightActiveLineGutter(),

];

// All Markdown and language-specific extensions, plus custom extensions
export const markdownExtensions: Extension[] = [
  markdown({
    base: markdownLanguage,
    extensions: [GFM, markdownHighlightExtension],
  }),
  javascript(), // For JS code blocks
  syntaxHighlighting(customHighlightStyle),
  oneDark, // Base theme
  mySelectionTheme, // Custom selection theme (after base theme to override)
  markdownLinkTransformation,
  markdownSyntaxHiding,
  listBulletExtension,
  horizontalRuleExtension,
  combinedHighlightExtension, // Add our new combined highlight extension

  markdownBracketCompletion // Add auto bracket insertion

];

// Combine all extensions
export const fullExtensions: Extension[] = [
  ...basicExtensions,
  ...markdownExtensions,
];