
export const HIDEABLE_MARK_NAMES = new Set([
  'StrongMark',       // **
  'EmphasisMark',     // *
  'StrikethroughMark',// ~~
  'HighlightMark',    // ==
  'CodeMark',         // `
  'HeaderMark',       // #
  'QuoteMark',        // >
  //'ListMark',         // - or 1. This is now handled in extension/markdownListBulletExtension.ts
  'HorizontalRule',   // ---
  
]);

// These are the *parent* nodes whose selection should reveal their child markers.
// For example, if "bold" is selected in "**bold**", StrongEmphasis is the content node.
export const CONTENT_NODE_NAMES_FOR_MARKER_REVEAL = new Set([
  'StrongEmphasis',
  'Emphasis',
  'Strikethrough',
  'Highlight',
  'InlineCode',
  'ATXHeading', // For HeaderMark (e.g., in '# Heading')
  'Blockquote', // For QuoteMark (e.g., in '> Quote')
  'ListItem', // For ListMark (e.g., in '- List item')
  'URL', // For link URLs within markdownLinkTransformation's context (if not fully replaced)
]);