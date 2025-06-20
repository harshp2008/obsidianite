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
      const { node } = nodeRef;
      const { from: nodeFrom, to: nodeTo, type } = node;

      // Check if this node is a direct syntax marker related to a Link (e.g., LinkMark, Paren)
      // and if its parent is a Link node.
      const isLinkSyntaxMark = (node.parent?.type.name === 'Link' || node.parent?.parent?.type.name === 'Link') &&
                                (type.name === 'LinkMark' || type.name === 'Paren');

      let shouldHideLinkSyntax = false;
      if (isLinkSyntaxMark) {
          let parentLinkNode: SyntaxNode | null = null;
          let currentParent: SyntaxNode | null = node.parent;

          while (currentParent) {
              if (currentParent.type.name === 'Link') {
                  parentLinkNode = currentParent;
                  break;
              }
              currentParent = currentParent.parent;
          }

          if (parentLinkNode) {
              // Check if the parent Link node intersects with the selection.
              // If it DOES NOT intersect, then it should be hidden (as markdownLinkTransformation
              // is expected to replace it).
              let linkSelected = false;
              for (const range of selection.ranges) {
                  if (intersects(range.from, range.to, parentLinkNode.from, parentLinkNode.to)) {
                      linkSelected = true;
                      break;
                  }
              }
              // If the link is NOT selected, then we should apply hiding to its syntax marks.
              shouldHideLinkSyntax = !linkSelected;
          }
      }


      // Special handling for HeaderMark to include trailing space
      if (type.name === 'HeaderMark') {
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
        for (const range of selection.ranges) {
          if (intersects(range.from, range.to, markerFrom, markerTo)) {
            shouldShow = true;
            break;
          }
        }

        if (!shouldShow && isSelectionOnLine(markerFrom)) {
            shouldShow = true;
        }

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
      // General handling for other hideable marks AND newly added link syntax marks
      else if (HIDEABLE_MARK_NAMES.has(type.name) || isLinkSyntaxMark) { // Check if it's generally hideable OR a link syntax mark
        const markerFrom = nodeFrom;
        const markerTo = nodeTo;

        let shouldShow = false;

        // If it's a link syntax mark, its 'shouldShow' is determined by `shouldHideLinkSyntax`
        // which flips the logic: if shouldHideLinkSyntax is true (link not selected), then shouldShow is false.
        if (isLinkSyntaxMark) {
            shouldShow = !shouldHideLinkSyntax; // If shouldHideLinkSyntax is true, then shouldShow is false (hide it)
        } else { // Regular hiding logic for other hideable marks
            for (const range of selection.ranges) {
            if (intersects(range.from, range.to, markerFrom, markerTo)) {
                shouldShow = true;
                break;
            }
            }

            if (!shouldShow && (type.name === 'HorizontalRule' || type.name === 'BlockquoteMark')) {
            if (isSelectionOnLine(markerFrom)) {
                shouldShow = true;
            }
            }

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

            if (!shouldShow && primarySelection.empty) {
            if (isCursorAdjacent(primarySelection.head, markerFrom, markerTo)) {
                shouldShow = true;
            }
            }
        } // End else (regular hiding logic)


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