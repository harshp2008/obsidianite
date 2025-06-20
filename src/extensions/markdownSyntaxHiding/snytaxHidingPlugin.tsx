// src/extensions/markdownSyntaxHiding/syntaxHidingPlugin.ts

import { Extension, RangeSet } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { RangeSetBuilder } from '@codemirror/state';
import { SyntaxNode } from '@lezer/common';

// Corrected Import: HIDEABLE_MARK_NAMES comes from './markers'
import { HIDEABLE_MARK_NAMES } from './markers';
import { intersects, isCursorAdjacent, isCursorInNode, CONTENT_NODE_NAMES_FOR_MARKER_REVEAL } from './helpers';
import { hideDecoration, showOnSelectDecoration } from './decorations';

// This function builds the set of decorations to apply for syntax hiding.
function buildSyntaxHidingDecorations(view: EditorView): RangeSet<Decoration> {
  const builder = new RangeSetBuilder<Decoration>();
  const tree = syntaxTree(view.state);
  const { state } = view;
  const selection = state.selection;

  // Iterate over the syntax tree to find potential delimiters
  tree.iterate({
    from: 0,
    to: state.doc.length,
    enter: (nodeRef) => {
      // Check if this node is a markdown marker that we typically hide
      if (HIDEABLE_MARK_NAMES.has(nodeRef.name)) {
        let shouldHide = true; // Assume we should hide by default

        // Condition 1: If any active selection range (non-empty or empty cursor range) intersects with the delimiter node.
        // This handles direct selection of the delimiter itself.
        for (const range of selection.ranges) {
          if (intersects(range, nodeRef.from, nodeRef.to)) {
            shouldHide = false;
            break; // Found an intersection, so show this marker
          }
        }
        if (!shouldHide) { // If decided to show because it's directly selected
            builder.add(nodeRef.from, nodeRef.to, showOnSelectDecoration);
            return; // Skip to next node as we've decided to show it
        }

        // Condition 2: If the cursor is present (empty selection) AND
        // the cursor is adjacent to the delimiter OR
        // the cursor is anywhere within the *parent* markdown element that this delimiter belongs to.
        if (selection.main.empty) {
          if (isCursorAdjacent(selection.main.head, nodeRef.from, nodeRef.to)) {
              shouldHide = false; // Cursor is right next to the *current delimiter*
          } else {
              let current: SyntaxNode | null = nodeRef.node;
              while (current) {
                  // Check if cursor is within or at the boundaries of the *parent styled block*
                  if (
                      CONTENT_NODE_NAMES_FOR_MARKER_REVEAL.has(current.name) &&
                      isCursorInNode(selection.main.head, current)
                  ) {
                      shouldHide = false;
                      break; // Found parent where cursor is, so show marker
                  }
                  current = current.parent;
              }
          }
        }

        // Based on all conditions, apply the appropriate decoration
        if (shouldHide) {
          builder.add(nodeRef.from, nodeRef.to, hideDecoration);
        } else {
          builder.add(nodeRef.from, nodeRef.to, showOnSelectDecoration);
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
    // Recompute decorations only when the document content, selection, or viewport changes
    if (update.docChanged || update.selectionSet || update.viewportChanged) {
      this.decorations = buildSyntaxHidingDecorations(update.view);
    }
  }
}, {
  // This makes the decorations available to the EditorView
  decorations: v => v.decorations
});