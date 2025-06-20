// src/extensions/markdownSyntaxHiding/syntaxHidingPlugin.ts

import { Extension, RangeSet } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { RangeSetBuilder } from '@codemirror/state';
import { SyntaxNode } from '@lezer/common';

import { HIDEABLE_MARK_NAMES } from './markers';
// Assuming 'helpers.ts' is where intersects, isCursorAdjacent, CONTENT_NODE_NAMES_FOR_MARKER_REVEAL are.
// If you deleted helpers.ts, you might need to re-add the definitions or adapt.
// For the purpose of this specific fix, I will use a simplified check for clarity,
// focusing on "on line" activation for HR, but keep the structure for other types.
// import { intersects, isCursorAdjacent, CONTENT_NODE_NAMES_FOR_MARKER_REVEAL } from './helpers';


// --- IMPORTANT: Redefine the decorations here with 'display' properties ---
// If you have a separate `decorations.ts` file, please update that file instead of defining them here.
// For the sake of this fix, defining them inline to be explicit.
const hideDecoration = Decoration.mark({
  class: 'cm-syntax-hide', // This class will use `display: none;`
  attributes: { 'aria-hidden': 'true' }
});

const showOnSelectDecoration = Decoration.mark({
  class: 'cm-syntax-show', // This class will use `display: inline-block;`
  attributes: { 'aria-hidden': 'false' }
});
// --- END Redefine decorations ---


// This function builds the set of decorations to apply for syntax hiding.
function buildSyntaxHidingDecorations(view: EditorView): RangeSet<Decoration> {
  const builder = new RangeSetBuilder<Decoration>();
  const tree = syntaxTree(view.state);
  const { state } = view;
  const selection = state.selection;

  // Helper for checking if selection is on the line of a node
  const isSelectionOnLine = (nodeFrom: number, nodeTo: number): boolean => {
    const line = state.doc.lineAt(nodeFrom);
    return selection.main.from <= line.to && selection.main.to >= line.from;
  };

  tree.iterate({
    from: 0,
    to: state.doc.length,
    enter: (nodeRef) => {
      // Check if this node is a markdown marker that we typically hide
      if (HIDEABLE_MARK_NAMES.has(nodeRef.name)) {
        const markerFrom = nodeRef.from;
        const markerTo = nodeRef.to;

        let shouldShow = false; // Assume we should hide by default

        // Logic for HorizontalRule: Show if cursor/selection is on the same line
        if (nodeRef.name === 'HorizontalRule') {
          shouldShow = isSelectionOnLine(markerFrom, markerTo);
        } else {
          // --- Re-integrating your original complex logic for other markdown types ---
          // Condition 1: Direct Intersection with any selection range
          for (const range of selection.ranges) {
            if (range.from < markerTo && range.to > markerFrom) { // intersects function logic
              shouldShow = true;
              break;
            }
          }

          if (!shouldShow) {
            // Condition 2: Cursor or Selection within the parent styled content
            let parentContentNode: SyntaxNode | null = nodeRef.node.parent;
            // You need to ensure CONTENT_NODE_NAMES_FOR_MARKER_REVEAL is imported/defined if used
            // For example, if you imported from './helpers':
            // while (parentContentNode && !CONTENT_NODE_NAMES_FOR_MARKER_REVEAL.has(parentContentNode.name)) {
            //   parentContentNode = parentContentNode.parent;
            // }
            // If you don't have CONTENT_NODE_NAMES_FOR_MARKER_REVEAL, simplify or define it.
            // For common cases, this might just mean checking if cursor is in the parent text.

            if (parentContentNode) {
              for (const range of selection.ranges) {
                if (range.from <= parentContentNode.to && range.to >= parentContentNode.from) { // intersects logic
                  shouldShow = true;
                  break;
                }
              }
            }
          }

          // Condition 3: If cursor is directly adjacent to the marker (only for empty selection)
          // This requires `isCursorAdjacent` helper. Assuming it's available.
          // if (!shouldShow && selection.main.empty) {
          //   if (isCursorAdjacent(selection.main.head, markerFrom, markerTo)) {
          //     shouldShow = true;
          //   }
          // }
          // --- End original complex logic for other types ---
        }


        // Apply the appropriate decoration based on `shouldShow`
        if (shouldShow) {
          builder.add(markerFrom, markerTo, showOnSelectDecoration);
        } else {
          builder.add(markerFrom, markerTo, hideDecoration);
        }
      }
    }
  });

  return builder.finish();
}

// The ViewPlugin that provides the decorations to the editor view.
export const markdownSyntaxHiding: Extension = ViewPlugin.fromClass(class {
  decorations: RangeSet<Decoration>;

  constructor(view: EditorView) {
    this.decorations = buildSyntaxHidingDecorations(view);
  }

  update(update: ViewUpdate) {
    // Recompute decorations when the document content, selection, or viewport changes
    if (update.docChanged || update.selectionSet || update.viewportChanged) {
      this.decorations = buildSyntaxHidingDecorations(update.view);
    }
  }
}, {
  // This makes the decorations available to the EditorView
  decorations: v => v.decorations
});