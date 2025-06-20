// src/extensions/markdownSyntaxHiding/syntaxHidingPlugin.ts

import { Extension, RangeSet } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { RangeSetBuilder } from '@codemirror/state';
import { SyntaxNode } from '@lezer/common';

import { HIDEABLE_MARK_NAMES } from './markers';
import { intersects, isCursorAdjacent, CONTENT_NODE_NAMES_FOR_MARKER_REVEAL } from './helpers';
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

        // --- Condition 1: Direct Intersection with any selection range ---
        // If any part of the delimiter itself is selected.
        for (const range of selection.ranges) {
          if (intersects(range, nodeRef.from, nodeRef.to)) {
            shouldHide = false;
            break; // Found an intersection, so show this marker
          }
        }
        if (!shouldHide) {
          builder.add(nodeRef.from, nodeRef.to, showOnSelectDecoration);
          return; // Skip to next node as we've decided to show it
        }

        // --- Condition 2: Cursor (empty selection) or Selection (non-empty) within the parent styled content ---
        // This is the crucial part to ensure markers show up when their *content* is interacted with.

        // Find the parent content node that this marker belongs to
        // Example: For `**` (StrongEmphasisMark), its parent might be `StrongEmphasis`
        // For `==` (HighlightMark), its parent might be `Highlight`
        let parentContentNode: SyntaxNode | null = nodeRef.node.parent;
        while (parentContentNode && !CONTENT_NODE_NAMES_FOR_MARKER_REVEAL.has(parentContentNode.name)) {
            parentContentNode = parentContentNode.parent;
        }

        if (parentContentNode) {
            for (const range of selection.ranges) {
                // If the selection (empty or non-empty) is anywhere within the *content* of the parent node
                if (intersects(range, parentContentNode.from, parentContentNode.to)) {
                    shouldHide = false;
                    break;
                }
            }
        }

        // --- Condition 3: If cursor is directly adjacent to the marker (only for empty selection) ---
        // This is a specific case for when you just place the cursor next to the marker.
        if (shouldHide && selection.main.empty) { // Only check if still shouldHide and selection is empty
            if (isCursorAdjacent(selection.main.head, nodeRef.from, nodeRef.to)) {
                shouldHide = false;
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