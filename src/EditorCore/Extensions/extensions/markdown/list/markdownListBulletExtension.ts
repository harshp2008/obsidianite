// src/extensions/listBulletExtension.ts
import { EditorView, Decoration, WidgetType, type DecorationSet } from '@codemirror/view';
import { StateField, type EditorState, Range, SelectionRange } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { SyntaxNode } from '@lezer/common'; // Ensure this is imported

// Helper to check if a selection range is directly adjacent to or inside a given range
function isCursorAdjacentOrInside(selectionRange: SelectionRange, from: number, to: number): boolean {
  // Check if cursor is directly to the left (from - 1) or right (to + 1)
  const isAdjacent = (selectionRange.from === from || selectionRange.from === to ||
                      selectionRange.to === from || selectionRange.to === to);

  // Check if cursor/selection is anywhere within the range
  const isInside = selectionRange.from < to && selectionRange.to > from;

  return isAdjacent || isInside;
}

// Define a custom WidgetType for our bullet (for inactive unordered lists)
class CustomBulletWidget extends WidgetType {
  constructor(private bulletChar: string = '•') {
    super();
  }

  eq(other: CustomBulletWidget) { return other.bulletChar === this.bulletChar; }

  toDOM() {
    const span = document.createElement('span');
    span.textContent = this.bulletChar;
    span.className = 'cm-custom-list-bullet'; // Class for styling
    span.setAttribute('aria-hidden', 'true');
    return span;
  }

  ignoreEvent() { return true; } // Prevents widget from capturing editor events
}

function createListBulletDecorations(state: EditorState): DecorationSet {
  const decorations: Array<Range<Decoration>> = [];
  const tree = syntaxTree(state);
  const { main: primarySelection } = state.selection;

  tree.iterate({
    from: 0,
    to: state.doc.length,
    enter: (nodeRef) => {
      const { node } = nodeRef;

      // We are only interested in the actual 'ListMark' nodes
      if (node.type.name === 'ListMark') {
        const listMarkFrom = node.from;
        const listMarkTo = node.to;

        // Find the parent list type (BulletList or OrderedList)
        let parentListNode: SyntaxNode | null = null;
        let currentParent = node.parent;
        // Traverse up: ListMark -> ListItem -> (BulletList/OrderedList)
        if (currentParent && currentParent.type.name === 'ListItem') {
            parentListNode = currentParent.parent;
        }

        // If not part of a valid list structure, skip
        if (!parentListNode) {
            return;
        }

        // --- Ordered Lists: Always show the original number ---
        if (parentListNode.type.name === 'OrderedList') {
            // For ordered lists, add a class for styling
            decorations.push(Decoration.mark({ class: 'cm-ordered-list-mark' }).range(listMarkFrom, listMarkTo));
            return;
        }

        // --- Unordered Lists: Conditional replacement/showing ---
        if (parentListNode.type.name === 'BulletList') {
            // Check if cursor is directly adjacent to or inside the ListMark range
            const cursorIsAdjacentToMark = isCursorAdjacentOrInside(primarySelection, listMarkFrom, listMarkTo);

            if (cursorIsAdjacentToMark) {
                // When cursor is adjacent, do NOT apply any decorations from this extension.
                // This allows the original markdown character ('-', '+', '*') to be visible.
                // It will rely on CodeMirror's default rendering for `ListMark`.
                // You might still want to add a class here if you need specific styling when active.
                // For instance: decorations.push(Decoration.mark({ class: 'cm-list-mark-active' }).range(listMarkFrom, listMarkTo));
            } else {
                // When cursor is NOT adjacent, replace the original mark and insert the custom bullet.
                // 1. Replace the actual markdown list mark characters with zero-width spaces.
                // This preserves the space/width but hides the original text.
                for (let i = listMarkFrom; i < listMarkTo; i++) {
                    decorations.push(Decoration.replace({ content: '​' }).range(i, i + 1));
                }

                // 2. Insert the custom bullet widget at the start of the original mark's position.
                // 'side: 0' means it is placed at the given position, pushing subsequent content.
                decorations.push(
                    Decoration.widget({
                        widget: new CustomBulletWidget('•'),
                        side: 0 // Place widget at the start of the hidden mark's range
                    }).range(listMarkFrom)
                );
            }
        }
      }
    }
  });
  return Decoration.set(decorations, true);
}

export const listBulletExtension = StateField.define<DecorationSet>({
  create(state) {
    return createListBulletDecorations(state);
  },
  update(decorations, transaction) {
    // Recompute decorations if document content or selection changes
    if (transaction.docChanged || transaction.selection) {
      return createListBulletDecorations(transaction.state);
    }
    return decorations;
  },
  provide: (field) => EditorView.decorations.from(field),
});