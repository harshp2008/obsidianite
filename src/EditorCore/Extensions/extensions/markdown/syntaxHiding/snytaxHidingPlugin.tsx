// src/extensions/markdownSyntaxHiding/syntaxHidingPlugin.tsx

import { Extension, RangeSet } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { RangeSetBuilder } from '@codemirror/state'; // Corrected import
import { SyntaxNode } from '@lezer/common';

import { HIDEABLE_MARK_NAMES, CONTENT_NODE_NAMES_FOR_MARKER_REVEAL } from './markers';

// Helper function: Checks if two ranges intersect
function intersects(range1From: number, range1To: number, range2From: number, range2To: number): boolean {
  return range1From < range2To && range1To > range2From;
}

// Helper function: Checks if cursor is adjacent to a marker (for empty selections/cursors)
function isCursorAdjacent(cursorPos: number, markerFrom: number, markerTo: number): boolean {
  return cursorPos === markerFrom || cursorPos === markerTo;
}


// --- Decorations for hiding/showing ---
const hideDecoration = Decoration.mark({
  class: 'cm-syntax-hide',
  attributes: { 'aria-hidden': 'true' }
});

const showOnSelectDecoration = Decoration.mark({
  class: 'cm-syntax-show',
  attributes: { 'aria-hidden': 'false' }
});

// A special 'replace' decoration for markers (like HeaderMark) that need to hide trailing space
const replaceDecoration = Decoration.replace({
    inclusive: true,
    block: false,
});


function buildSyntaxHidingDecorations(view: EditorView): RangeSet<Decoration> {
  const builder = new RangeSetBuilder<Decoration>();
  const tree = syntaxTree(view.state);
  const { state } = view;
  const selection = state.selection;
  const primarySelection = selection.main;

  // Helper for checking if selection is on the line of a given position
  const isSelectionOnLine = (pos: number): boolean => {
    const line = state.doc.lineAt(pos);
    return primarySelection.from <= line.to && primarySelection.to >= line.from;
  };

  tree.iterate({
    from: 0,
    to: state.doc.length,
    enter: (nodeRef) => {
      const { node } = nodeRef;
      const { from: nodeFrom, to: nodeTo, type } = node;

      // Explicitly handle incomplete link markers to ensure they are always visible
      // if the cursor is near, overriding any potential hiding by other decorations.
      // This is for `[` `]` `(` `)` characters when they are *not* part of a full `Link` node.
      if (type.name === 'SquareBracketOpen' || type.name === 'SquareBracketClose' || type.name === 'Paren') {
          let forceShowMarker = false;

          if (primarySelection.empty) {
              if (primarySelection.head >= nodeFrom && primarySelection.head <= nodeTo) {
                  forceShowMarker = true;
              }
          }
          for (const range of selection.ranges) {
              if (intersects(range.from, range.to, nodeFrom, nodeTo)) {
                  forceShowMarker = true;
                  break;
              }
          }

          if (forceShowMarker) {
              builder.add(nodeFrom, nodeTo, showOnSelectDecoration);
              return true;
          }
      }

      // Special handling for HeaderMark to include trailing space
      else if (type.name === 'HeaderMark') {
        const markerFrom = nodeFrom;
        let markerTo = nodeTo;

        let nextSibling = node.nextSibling;
        while (nextSibling && !nextSibling.type.name.startsWith('ATXHeading')) {
            if (nextSibling.type.name === 'Whitespace' || nextSibling.from === markerTo) {
                markerTo = nextSibling.to;
                nextSibling = nextSibling.nextSibling;
            } else {
                break;
            }
        }

        if (nextSibling && nextSibling.type.name.startsWith('ATXHeading')) {
               markerTo = nextSibling.from;
        } else {
            const line = state.doc.lineAt(nodeFrom);
            const lineText = state.doc.sliceString(line.from, line.to);
            const relativeMarkerEnd = nodeTo - line.from;
            const spaceAfterMarker = lineText.substring(relativeMarkerEnd).match(/^\s+/);
            if (spaceAfterMarker) {
                markerTo = nodeTo + spaceAfterMarker[0].length;
            }
        }

        let shouldShow = false;
        // Rule: Show if selected
        for (const range of selection.ranges) {
          if (intersects(range.from, range.to, markerFrom, markerTo)) {
            shouldShow = true;
            break;
          }
        }

        // Rule: Show if selection is on the same line as the header mark (block-level context)
        if (!shouldShow && isSelectionOnLine(markerFrom)) {
            shouldShow = true;
        }

        // Rule: Show if the parent content node (e.g., the entire heading) is selected
        if (!shouldShow) {
            let parentContentNode: SyntaxNode | null = node.parent;
            while (parentContentNode && !CONTENT_NODE_NAMES_FOR_MARKER_REVEAL.has(parentContentNode.type.name)) {
                parentContentNode = parentContentNode.parent;
            }
            if (parentContentNode) {
                // For header marks, any selection within the heading content should reveal the mark.
                for (const range of selection.ranges) {
                    if (intersects(range.from, range.to, parentContentNode.from, parentContentNode.to)) {
                        shouldShow = true;
                        break;
                    }
                }
            }
        }

        // Rule: Show if cursor is adjacent to the header mark
        if (!shouldShow && primarySelection.empty) {
          if (isCursorAdjacent(primarySelection.head, markerFrom, markerTo)) {
            shouldShow = true;
          }
        }

        if (shouldShow) {
          builder.add(nodeFrom, nodeTo, showOnSelectDecoration);
        } else {
          builder.add(markerFrom, markerTo, replaceDecoration);
        }
      }
      // General handling for other hideable marks (e.g., BoldMark, ItalicsMark, InlineCodeMark)
      else if (HIDEABLE_MARK_NAMES.has(type.name)) {
        const markerFrom = nodeFrom;
        const markerTo = nodeTo;

        let shouldShow = false;

        // Rule 1: Show if selected directly
        for (const range of selection.ranges) {
            if (intersects(range.from, range.to, markerFrom, markerTo)) {
                shouldShow = true;
                break;
            }
        }

        // Rule 2: Special case for HorizontalRule or BlockquoteMark: show if selection on line
        // This is correctly scoped to only these block-level markers.
        if (!shouldShow && (type.name === 'HorizontalRule' || type.name === 'BlockquoteMark')) {
            if (isSelectionOnLine(markerFrom)) {
                shouldShow = true;
            }
        }

        // Rule 3: Show if content node (e.g., "bold" in **bold**) is selected or cursor is inside content.
        if (!shouldShow) {
            let parentContentNode: SyntaxNode | null = node.parent;
            // Iterate up the tree until a CONTENT_NODE_NAMES_FOR_MARKER_REVEAL is found or null
            while (parentContentNode && !CONTENT_NODE_NAMES_FOR_MARKER_REVEAL.has(parentContentNode.type.name)) {
                parentContentNode = parentContentNode.parent;
            }

            if (parentContentNode) {
                // Check if the primary cursor is inside/at boundary of the content node (for empty selections)
                if (primarySelection.empty && primarySelection.head >= parentContentNode.from && primarySelection.head <= parentContentNode.to) {
                    shouldShow = true;
                } else {
                    // Check if any part of the selection overlaps with the content node (for non-empty selections)
                    for (const range of selection.ranges) {
                        if (intersects(range.from, range.to, parentContentNode.from, parentContentNode.to)) {
                            shouldShow = true;
                            break;
                        }
                    }
                }
            }
        }

        // Rule 4: Show if cursor is adjacent (empty selection only)
        if (!shouldShow && primarySelection.empty) {
            if (isCursorAdjacent(primarySelection.head, markerFrom, markerTo)) {
                shouldShow = true;
            }
        }

        if (shouldShow) {
          builder.add(markerFrom, markerTo, showOnSelectDecoration);
        } else {
          builder.add(markerFrom, markerTo, hideDecoration);
        }
      }
      return true; // Always continue iteration unless explicitly breaking
    }
  });

  return builder.finish();
}

export const markdownSyntaxHiding: Extension = ViewPlugin.fromClass(class {
  decorations: RangeSet<Decoration>;

  constructor(view: EditorView) {
    this.decorations = buildSyntaxHidingDecorations(view);
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.selectionSet || update.viewportChanged || update.transactions.some(tr => tr.reconfigured)) {
      this.decorations = buildSyntaxHidingDecorations(update.view);
    }
  }
}, {
  decorations: v => v.decorations
});