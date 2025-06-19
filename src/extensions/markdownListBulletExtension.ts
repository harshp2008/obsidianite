// src/extensions/listBulletExtension.ts
import { EditorView, Decoration, WidgetType, type DecorationSet } from '@codemirror/view';
import { StateField, type Transaction, EditorState, Range } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';

// Define a custom WidgetType for our bullet
class CustomBulletWidget extends WidgetType {
  constructor(private bulletChar: string) {
    super();
  }

  eq(other: CustomBulletWidget) { return other.bulletChar === this.bulletChar; }

  toDOM() {
    const span = document.createElement('span');
    span.textContent = this.bulletChar;
    span.className = 'cm-custom-list-bullet'; // Apply a custom class for styling
    span.setAttribute('aria-hidden', 'true'); // Hide from screen readers, as it's purely visual
    return span;
  }

  // Ensure the widget doesn't interfere with cursor movements
  ignoreEvent() { return true; } 
}

function createListBulletDecorations(state: EditorState): DecorationSet {
  const decorations: Array<Range<Decoration>> = [];
  const tree = syntaxTree(state);
  const primarySelection = state.selection.main;
  const cursorFrom = primarySelection.from;

  tree.iterate({
    from: 0,
    to: state.doc.length,
    enter: (nodeRef) => {
      const { type, from, to } = nodeRef.node;

      if (type.name === 'ListItem') {
        // Find the ListMark within this ListItem
        const listMarkNode = nodeRef.node.firstChild; 
        
        if (listMarkNode && listMarkNode.type.name === 'ListMark') {
          const listMarkFrom = listMarkNode.from;
          const listMarkTo = listMarkNode.to;
          
          // Determine if cursor is inside the ENTIRE ListItem range
          const cursorIsInsideListItem = cursorFrom >= from && cursorFrom <= to;

          if (!cursorIsInsideListItem) {
            // When the ListItem is INACTIVE, hide the original ListMark character
            // and replace it with our custom bullet widget.
            // Replace the actual ListMark characters with zero-width spaces for navigation,
            // then insert the widget *after* them (or at the same position).
            
            // First, hide the raw ListMark characters with zero-width spaces
            for (let i = listMarkFrom; i < listMarkTo; i++) {
              decorations.push(Decoration.replace({ content: '​' }).range(i, i + 1));
            }

            // Then, insert the custom bullet widget at the beginning of the ListMark range.
            // Using a specific character like '•' or '–' for better visual distinction
            decorations.push(
              Decoration.widget({
                widget: new CustomBulletWidget('•'), // Or use `–` or `●`
                side: -1 // Place it before the character it's attached to (visually to the left)
              }).range(listMarkFrom) // Apply at the start of the ListMark
            );

          } else {
            // When the ListItem is ACTIVE (cursor inside), the raw ListMark character (-) should be visible.
            // No decoration needed here from this extension for the mark, as it's not hidden.
            // If CodeMirror's native cm-list-bullet is still appearing AND we want to hide it
            // when the line is active (because we show the raw `-`), we'd need a CSS rule.
            // For now, let's allow both the raw mark and CM's bullet to be visible when active.
          }
        }
      }
    }
  });
  return Decoration.set(decorations, true); // `true` for sort: true for overlapping decorations
}

export const listBulletExtension = StateField.define<DecorationSet>({
  create(state) {
    return createListBulletDecorations(state);
  },
  update(decorations, transaction) {
    if (transaction.docChanged || transaction.selection) {
      return createListBulletDecorations(transaction.state);
    }
    return decorations;
  },
  provide: (field) => EditorView.decorations.from(field),
});