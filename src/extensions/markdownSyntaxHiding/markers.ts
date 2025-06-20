// src/extensions/markdownSyntaxHiding/markers.ts

// Define which types of nodes represent markdown delimiters we want to hide by default.
// These names come from your markdown grammar (Lezer parser).
export const HIDEABLE_MARK_NAMES = new Set([
    "EmphasisMark",       // * _
    "StrongEmphasisMark", // ** __
    "ATXHeadingMark",     // # (for headers)
    "BlockquoteMark",     // >
    "CodeMark",           // ` `` ``` (for inline code or code blocks)
    "LinkMark",           // [ ] ( ) (for link brackets/parentheses)
    "URL",                // The actual URL part of a link (often hidden until active)
    "SetextHeadingMark",  // === --- (for setext headers)
    "StrikethroughMark",  // ~~
    "HighlightMark",      // == (for highlight, from your custom extension)
  "HorizontalRule"      // --- *** ___

  ]);