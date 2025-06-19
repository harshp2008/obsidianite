// src/extensions/markdownSyntaxHiding.ts
import { EditorView, Decoration, type DecorationSet } from '@codemirror/view';
import { StateField, type Transaction, EditorState, Range } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import type { SyntaxNode } from '@lezer/common';

const zeroWidthReplaceDecoration = Decoration.replace({
  content: '​' // Zero-width space character (U+200B)
});

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

      let revealSyntax = false;
      let currentParent: SyntaxNode | null = nodeRef.node; 
      
      while (currentParent) {
        if (
          currentParent.type.name === 'ATXHeading1' ||
          currentParent.type.name === 'ATXHeading2' ||
          currentParent.type.name === 'ATXHeading3' ||
          currentParent.type.name === 'ATXHeading4' ||
          currentParent.type.name === 'ATXHeading5' ||
          currentParent.type.name === 'ATXHeading6' ||
          currentParent.type.name === 'StrongEmphasis' || // This parent will reveal **
          currentParent.type.name === 'Emphasis' ||     // This parent will reveal *
          currentParent.type.name === 'FencedCode'      // This parent will reveal ```
          // ListItem (both ordered and unordered) will NOT trigger revealSyntax from here.
          // Ordered list numbers should always be visible.
          // Unordered list marks are handled by listBulletExtension's widget logic.
        ) {
          if (cursorFrom >= currentParent.from && cursorFrom <= currentParent.to) {
            revealSyntax = true;
            break;
          }
        }
        currentParent = currentParent.parent;
      }

      if (revealSyntax) {
          return false; // Stop processing children if this parent's syntax should be revealed
      }

      switch (type.name) {
        case 'HeaderMark':
          for (let i = from; i < to; i++) {
            decorations.push(zeroWidthReplaceDecoration.range(i, i + 1));
          }
          if (to < state.doc.length && state.doc.sliceString(to, to + 1) === ' ') {
            decorations.push(zeroWidthReplaceDecoration.range(to, to + 1));
          }
          break;

        case 'EmphasisMark':     // RE-ADDED: This handles hiding ** and * when inactive
        case 'BlockquoteMark':   // RE-ADDED: This handles hiding > when inactive
        case 'FencedCodeMark':   // RE-ADDED: This handles hiding ``` when inactive
          for (let i = from; i < to; i++) {
            decorations.push(zeroWidthReplaceDecoration.range(i, i + 1));
          }
          break;
        // ListMark is intentionally NOT here, as per our revised strategy.
      }
    }
  });

  return Decoration.set(decorations);
}

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