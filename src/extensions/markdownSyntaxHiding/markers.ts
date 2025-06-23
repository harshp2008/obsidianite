// src/extensions/markdownSyntaxHiding/markers.ts

export const HIDEABLE_MARK_NAMES = new Set([
  'EmphasisMark',
  'StrongMark',
  'StrikethroughMark',
  'HighlightMark',
  'CodeMark',
  'BlockquoteMark',
  'HorizontalRule',
  'HeaderMark', // <-- **ADD THIS FOR HEADERS**
]);

// These are content nodes where, if the cursor is within them, their associated
// markdown markers should be revealed.
export const CONTENT_NODE_NAMES_FOR_MARKER_REVEAL = new Set([
  'Paragraph',
  'Blockquote',
  'CodeBlock',
  'InlineCode',
  'StrongEmphasis',
  'Emphasis',
  'Strikethrough',
  'Highlight',
  'ATXHeading1',
  'ATXHeading2',
  'ATXHeading3',
  'ATXHeading4',
  'ATXHeading5',
  'ATXHeading6',
]);