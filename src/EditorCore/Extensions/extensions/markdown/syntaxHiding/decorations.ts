// src/extensions/markdownSyntaxHiding/decorations.ts

import { Decoration } from '@codemirror/view';

// The decoration to apply when hiding a delimiter by default
export const hideDecoration = Decoration.mark({
  attributes: { "aria-hidden": "true" }, // Good for accessibility
  class: "cm-hide-markdown-marker"
});

// The decoration to apply when showing a delimiter (e.g., when selected)
export const showOnSelectDecoration = Decoration.mark({
  class: "cm-show-markdown-marker-on-select"
});