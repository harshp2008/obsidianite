// src/extensions/markdownHighlightExtension.ts
import { Tag, tags, styleTags } from '@lezer/highlight';

// We import DelimiterType as a type (interface)
import type { MarkdownConfig, InlineContext, InlineParser, DelimiterType } from '@lezer/markdown';

// Define custom tags for the highlight syntax
export const highlightTags = {
  highlight: Tag.define(),       // Represents the 'mark' content itself (e.g., "highlight")
  highlightMark: Tag.define()    // Represents the '==' delimiters
};

// DelimiterType is an interface, so we define a plain object conforming to its shape.
const highlightDelimiterConfig: DelimiterType & {
  open: { char: number; count: number; };
  close: { char: number; count: number; };
  mixable: boolean;
} = {
  resolve: "Highlight",
  // CORRECTED: 'mark' now takes the string name of the node, not the Tag object
  mark: "HighlightMark", // Use the string name defined in defineNodes
  open: { char: 61 /* = */, count: 2 },
  close: { char: 61 /* = */, count: 2 },
  mixable: true,
};

// Define the InlineParser. Its 'parse' method must now check the starting character.
const highlightInlineParser: InlineParser = {
  name: "Highlight",
  parse(cx: InlineContext, next: number, pos: number): number {
    // Check if the current character (next) and the next one (cx.char(pos + 1)) are '=='
    // Also, ensure it's not '===' to prevent conflicts with other longer sequences.
    if (next !== 61 /* = */ || cx.char(pos + 1) !== 61 /* = */ || cx.char(pos + 2) === 61 /* = */) {
      return -1; // Not a '==' highlight delimiter, so this parser doesn't handle it
    }

    // Add the delimiter using the configuration object and specify its open/close status.
    return cx.addDelimiter(highlightDelimiterConfig, pos, pos + 2, true, true);
  },
  after: "Emphasis" // Place this parser after 'Emphasis' for correct precedence
};

export const markdownHighlightExtension: MarkdownConfig = {
  defineNodes: [
    { name: "Highlight", block: false },
    { name: "HighlightMark", block: false }, // Ensure this node name matches 'mark' above
  ],

  // 'parseInline' now expects an array of 'InlineParser' directly.
  parseInline: [
    highlightInlineParser
  ],

  props: [
    styleTags({
      HighlightMark: tags.processingInstruction,
      "Highlight/...": highlightTags.highlight,
    })
  ]
};