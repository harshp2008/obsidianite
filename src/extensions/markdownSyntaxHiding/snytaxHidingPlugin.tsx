// src/extensions/markdownSyntaxHiding/syntaxHidingPlugin.ts

import { Extension, RangeSet } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { RangeSetBuilder } from '@codemirror/state';
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
      const { node } = nodeRef; // Destructure node from nodeRef
      const { from: nodeFrom, to: nodeTo, type } = node; // Destructure from, to, type from node

      // Special handling for HeaderMark to include trailing space
      if (type.name === 'HeaderMark') { // Use 'type.name' instead of 'node.type.name' for consistency
        const markerFrom = nodeFrom; // Use the destructured nodeFrom
        let markerTo = nodeTo; // Initialize with nodeTo, then adjust

        // Find the actual content node (e.g., ATXHeading1) that follows HeaderMark
        // and adjust 'markerTo' to extend to its beginning.
        // This effectively hides the HeaderMark and the space before the content.
        let nextSibling = node.nextSibling;
        // Keep looking for the actual heading content (ATXHeadingX)
        while (nextSibling && !nextSibling.type.name.startsWith('ATXHeading')) {
            // If it's just whitespace or another minor token, extend the hiding range
            if (nextSibling.type.name === 'Whitespace' || nextSibling.from === markerTo) {
                markerTo = nextSibling.to;
                nextSibling = nextSibling.nextSibling;
            } else {
                break; // Found something else, stop
            }
        }

        // If a content node was found, or if there was just whitespace, adjust markerTo
        if (nextSibling && nextSibling.type.name.startsWith('ATXHeading')) {
             // The space between ### and content is usually just before ATXHeading
             markerTo = nextSibling.from;
        } else {
            // If no ATXHeading or specific content follows, ensure we cover any immediate whitespace.
            // This case handles a header with just '### ' and no text.
            const line = state.doc.lineAt(nodeFrom);
            const lineText = state.doc.sliceString(line.from, line.to);
            const relativeMarkerEnd = nodeTo - line.from; // Use nodeTo here
            const spaceAfterMarker = lineText.substring(relativeMarkerEnd).match(/^\s+/);
            if (spaceAfterMarker) {
                markerTo = nodeTo + spaceAfterMarker[0].length;
            }
        }


        let shouldShow = false;

        // Logic for showing markers:
        // 1. If the selection directly intersects the extended marker's range
        for (const range of selection.ranges) {
          if (intersects(range.from, range.to, markerFrom, markerTo)) {
            shouldShow = true;
            break;
          }
        }

        // 2. If the cursor is on the same line as the header (better UX)
        if (!shouldShow && isSelectionOnLine(markerFrom)) {
            shouldShow = true;
        }

        // 3. If the cursor is within the actual heading text content
        if (!shouldShow) {
            let parentContentNode: SyntaxNode | null = node.parent;
            while (parentContentNode && !CONTENT_NODE_NAMES_FOR_MARKER_REVEAL.has(parentContentNode.type.name)) {
                parentContentNode = parentContentNode.parent;
            }
            if (parentContentNode) {
                for (const range of selection.ranges) {
                    if (intersects(range.from, range.to, parentContentNode.from, parentContentNode.to)) {
                        shouldShow = true;
                        break;
                    }
                }
            }
        }

        // 4. If the selection is empty (a cursor) and it's directly adjacent to the extended marker
        if (!shouldShow && primarySelection.empty) {
          if (isCursorAdjacent(primarySelection.head, markerFrom, markerTo)) {
            shouldShow = true;
          }
        }

        if (shouldShow) {
          // When showing, only apply to the original HeaderMark range,
          // allowing the actual space to be rendered by CodeMirror.
          builder.add(nodeFrom, nodeTo, showOnSelectDecoration);
        } else {
          // Use replaceDecoration to hide HeaderMark and the *calculated* space after it
          builder.add(markerFrom, markerTo, replaceDecoration);
        }
      }
      // General handling for other hideable marks
      else if (HIDEABLE_MARK_NAMES.has(type.name)) { // Use 'type.name'
        const markerFrom = nodeFrom; // Use destructured nodeFrom
        const markerTo = nodeTo;     // Use destructured nodeTo

        let shouldShow = false;

        for (const range of selection.ranges) {
          if (intersects(range.from, range.to, markerFrom, markerTo)) {
            shouldShow = true;
            break;
          }
        }

        // For HorizontalRule and BlockquoteMark, show if cursor is on their line
        if (!shouldShow && (type.name === 'HorizontalRule' || type.name === 'BlockquoteMark')) {
          if (isSelectionOnLine(markerFrom)) {
            shouldShow = true;
          }
        }

        // If cursor is within a content node that reveals markers
        if (!shouldShow) {
            let currentParent: SyntaxNode | null = node.parent;
            while (currentParent) {
              if (CONTENT_NODE_NAMES_FOR_MARKER_REVEAL.has(currentParent.type.name)) {
                for (const range of selection.ranges) {
                  if (intersects(range.from, range.to, currentParent.from, currentParent.to)) {
                    shouldShow = true;
                    break;
                  }
                }
                if (shouldShow) break;
              }
              currentParent = currentParent.parent;
            }
        }

        // Adjacent cursor
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
      return true; // Continue iteration
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