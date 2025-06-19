// src/extensions/markdownSyntaxHiding.ts
import { EditorView, Decoration, type DecorationSet } from '@codemirror/view';
import { StateField, type Transaction, EditorState, Range } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';

const zeroWidthReplaceDecoration = Decoration.replace({
  content: '​' // Zero-width space character (U+200B)
});

/**
 * Creates decorations for hiding Markdown syntax.
 * Syntax will be shown if the cursor is within the containing markdown structure.
 */
function createSyntaxHidingDecorations(state: EditorState): DecorationSet {
  const decorations: Array<Range<Decoration>> = [];
  const tree = syntaxTree(state);
  const primarySelection = state.selection.main;
  const cursorFrom = primarySelection.from;
  const cursorTo = primarySelection.to;

  tree.iterate({
    from: 0,
    to: state.doc.length,
    enter: (nodeRef) => {
      const { type, from, to } = nodeRef.node;

      // Check if the current node is a "parent" markdown structure that contains marks
      // Based on your Lezer tree, these are nodes like:
      // ATXHeading, StrongEmphasis, Emphasis, BulletList, Link, FencedCode
      let parentNodeForHiding = null;
      switch (type.name) {
        case 'ATXHeading1':
        case 'ATXHeading2':
        case 'ATXHeading3':
        case 'ATXHeading4':
        case 'ATXHeading5':
        case 'ATXHeading6':
        case 'StrongEmphasis':
        case 'Emphasis':
        case 'ListItem': // For list items, the ListItem itself is the parent
        case 'Link':     // For links, the Link node is the parent
        case 'FencedCode': // For fenced code blocks
          parentNodeForHiding = nodeRef.node;
          break;
        default:
          break;
      }

      if (parentNodeForHiding) {
        const parentFrom = parentNodeForHiding.from;
        const parentTo = parentNodeForHiding.to;

        // If cursor is within the parent node's full range, we should NOT hide its marks
        if (cursorFrom >= parentFrom && cursorFrom <= parentTo) {
          return false; // Don't hide children of this node, and don't recurse into them for hiding
        }
      }

      // If we reach here, it means the cursor is NOT in a relevant parent node,
      // so we can proceed with hiding the specific marks.
      switch (type.name) {
        case 'HeaderMark':       // e.g., '##', '###'
        case 'EmphasisMark':     // e.g., '**', '*', '__', '_'
        case 'BlockquoteMark':   // e.g., '>'
        case 'FencedCodeMark':   // e.g., '```'
        case 'ListMark':         // e.g., '-', '*'
        case 'LinkMark':         // e.g., '[', ']', '(', ')'
          // Apply a replace decoration for *each character* within the mark's range.
          for (let i = from; i < to; i++) {
            decorations.push(zeroWidthReplaceDecoration.range(i, i + 1));
          }
          break;
        
        // CodeInfo ('javascript' in ```javascript) should generally not be hidden as it's part of content.
        // URL node content ('https://www.google.com') should also not be hidden, it's displayed by the Link transformation.
      }
    }
  });

  return Decoration.set(decorations);
}

/**
 * State field to manage syntax hiding decorations.
 */
export const markdownSyntaxHiding = StateField.define<DecorationSet>({
  create(state) {
    return createSyntaxHidingDecorations(state);
  },
  update(decorations: DecorationSet, transaction: Transaction) { 
    // Re-evaluate decorations if document content changes or selection changes.
    if (transaction.docChanged || transaction.selection) {
      return createSyntaxHidingDecorations(transaction.state); 
    }
    return decorations;
  },
  provide(field) {
    return EditorView.decorations.from(field);
  }
});