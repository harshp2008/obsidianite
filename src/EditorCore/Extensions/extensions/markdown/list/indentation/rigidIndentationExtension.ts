// src\EditorCore\Extensions\extensions\markdown\list\indentation\rigidIndentationExtension.ts

import { EditorState, StateField, Range } from '@codemirror/state';
import { EditorView, Decoration, DecorationSet } from '@codemirror/view'; // Removed ViewPlugin, ViewUpdate as they are unused
import { syntaxTree } from '@codemirror/language';
import { indentationConfig, setIndentSizeEffect } from './listIndentationExtension';


/**
 * Function to build the set of ranges that should be treated as atomic for indentation.
 * These are *not* visual decorations, but logical ranges for cursor movement.
 */
function buildAtomicIndentRanges(state: EditorState): DecorationSet {
  const ranges: Array<Range<Decoration>> = []; // We will collect Range objects here
  const tree = syntaxTree(state);
  const indentSize = state.field(indentationConfig).indentSize;

  // Create a single, non-visual Decoration instance to be used as the value for all atomic ranges.
  // Decoration.mark({}) creates a Decoration instance that can have .range() called on it,
  // and by default, it doesn't apply any visual styles unless a 'class' or other spec is given.
  const atomicPlaceholderDecoration = Decoration.mark({});

  tree.iterate({
    from: 0,
    to: state.doc.length,
    enter: (nodeRef) => {
      const { node } = nodeRef;

      if (node.type.name === 'ListItem') {
        const line = state.doc.lineAt(node.from);
        const listMarkNode = node.getChild('ListMark');

        if (!listMarkNode) {
          return;
        }

        const leadingSpacesBeforeMark = listMarkNode.from - line.from;

        if (leadingSpacesBeforeMark > 0) {
          for (let i = 0; i < leadingSpacesBeforeMark; i += indentSize) {
            const from = line.from + i;
            const to = Math.min(line.from + i + indentSize, listMarkNode.from);

            if (from < to) {
              // Now, we correctly call .range(from, to) on an actual Decoration instance.
              ranges.push(atomicPlaceholderDecoration.range(from, to));
            }
          }
        }
      }
    }
  });

  // Return a DecorationSet from the collected ranges
  return Decoration.set(ranges, true); // `true` to ensure ranges are sorted
}

// This field will hold the DecorationSet of atomic ranges.
export const atomicIndentRanges = StateField.define<DecorationSet>({
  create(state) {
    return buildAtomicIndentRanges(state);
  },
  update(value, transaction) {
    // Only rebuild if doc changes or indent size changes
    if (transaction.docChanged || transaction.effects.some(e => e.is(setIndentSizeEffect))) {
      return buildAtomicIndentRanges(transaction.state);
    }
    // Efficiently map existing ranges to new document positions
    return value.map(transaction.changes);
  },
  // Provide a function that extracts the DecorationSet from this StateField
  // This aligns with how EditorView.atomicRanges.of expects its argument.
  provide: (field) => EditorView.atomicRanges.of(view => {
    // Access the current value of this StateField within the view's state
    return view.state.field(field);
  }),
});


// Export the rigid indentation extension
export const rigidIndentationExtension = [
  atomicIndentRanges,
];  