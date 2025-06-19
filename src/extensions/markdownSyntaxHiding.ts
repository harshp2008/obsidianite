// src/extensions/markdownSyntaxHiding.ts
import { EditorView, Decoration, type DecorationSet } from '@codemirror/view';
import { StateField, type Transaction, EditorState, Range } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import type { SyntaxNode } from '@lezer/common'; // Import SyntaxNode for type safety

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

  tree.iterate({
    from: 0,
    to: state.doc.length,
    enter: (nodeRef) => {
      const { type, from, to } = nodeRef.node;

      // Identify "parent" markdown structures whose *entire* syntax should be revealed
      // if the cursor is anywhere within them.
      let revealSyntax = false;
      
      // Start with the current node, then traverse up to find a relevant parent.
      let currentParent: SyntaxNode | null = nodeRef.node; 
      
      while (currentParent) {
        if (
          currentParent.type.name === 'ATXHeading1' ||
          currentParent.type.name === 'ATXHeading2' ||
          currentParent.type.name === 'ATXHeading3' ||
          currentParent.type.name === 'ATXHeading4' ||
          currentParent.type.name === 'ATXHeading5' ||
          currentParent.type.name === 'ATXHeading6' ||
          currentParent.type.name === 'StrongEmphasis' ||
          currentParent.type.name === 'Emphasis' ||
          currentParent.type.name === 'ListItem' ||
          currentParent.type.name === 'FencedCode'
        ) {
          // If the cursor is anywhere within this parent's full range, reveal its syntax.
          if (cursorFrom >= currentParent.from && cursorFrom <= currentParent.to) {
            revealSyntax = true;
            break; // Found a parent that triggers reveal, no need to go higher
          }
        }
        currentParent = currentParent.parent; // Move up to the parent node
      }

      // If `revealSyntax` is true, we should not hide any marks within this parent.
      if (revealSyntax) {
          return false; // Skip hiding children of this revealed parent node
      }

      // If we reach here, it means the cursor is NOT in a relevant parent node,
      // so we can proceed with hiding the specific marks.
      switch (type.name) {
        case 'HeaderMark':       // e.g., '##', '###'
          // Hide HeaderMark itself
          for (let i = from; i < to; i++) {
            decorations.push(zeroWidthReplaceDecoration.range(i, i + 1));
          }
          // Additionally, hide the space immediately following the HeaderMark if it exists
          // and is within the same line, as per typical Markdown parsing.
          // Check if 'to' is within document bounds and the character is a space.
          if (to < state.doc.length && state.doc.sliceString(to, to + 1) === ' ') {
            decorations.push(zeroWidthReplaceDecoration.range(to, to + 1));
          }
          break;

        case 'EmphasisMark':     // e.g., '**', '*', '__', '_'
        case 'BlockquoteMark':   // e.g., '>'
        case 'FencedCodeMark':   // e.g., '```'
          for (let i = from; i < to; i++) {
            decorations.push(zeroWidthReplaceDecoration.range(i, i + 1));
          }
          break;
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
    if (transaction.docChanged || transaction.selection) {
      return createSyntaxHidingDecorations(transaction.state); 
    }
    return decorations;
  },
  provide(field) {
    return EditorView.decorations.from(field);
  }
});