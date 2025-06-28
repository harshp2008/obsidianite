// src\EditorCore\Extensions\extensions\markdown\list\listBullet\listBulletExtension.ts
// Consider renaming this file to listMarkersExtension.ts later for clarity,
// as it will handle both bullet and ordered list markers.

import { EditorView, Decoration, WidgetType, type DecorationSet } from '@codemirror/view';
import { StateField, type EditorState, Range } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';

// Define a custom WidgetType for the bullet point visual
// This widget is specifically for UNORDERED list bullets
class BulletPointWidget extends WidgetType {
  bulletType: string;
  
  constructor(bulletType: string) {
    super();
    this.bulletType = bulletType;
  }
  
  eq(other: BulletPointWidget) {
    return this.bulletType === other.bulletType;
  }
  
  toDOM() {
    const bullet = document.createElement('span');
    bullet.className = 'cm-custom-list-bullet'; // Your existing custom class for bullets
    
    // Set bullet character depending on type
    switch (this.bulletType) {
      case '-':
        bullet.textContent = '•'; // Bullet point
        break;
      case '+':
        bullet.textContent = '◦'; // Hollow bullet
        break;
      case '*':
        bullet.textContent = '▪'; // Small square
        break;
      default:
        bullet.textContent = '•';
    }
    
    return bullet;
  }
}

// Function to check if a string is an unordered list marker
function isUnorderedListMarker(text: string): boolean {
  return text === '-' || text === '+' || text === '*';
}

// Function to check if a string is an ordered list marker (e.g., "1.", "2.", "10.")
function isOrderedListMarker(text: string): boolean {
    return /^\d+\.$/.test(text); // Regex to match digits followed by a period
}

// Function to create decorations for list markers (both ordered and unordered)
function createListMarkerDecorations(state: EditorState): DecorationSet {
  const decorations: Array<Range<Decoration>> = [];
  const tree = syntaxTree(state);
  const { main: primarySelection } = state.selection;
  
  tree.iterate({
    enter: (nodeRef) => {
      // Find nodes that could be list markers
      if (nodeRef.type.name === 'ListMark') {
        const from = nodeRef.from;
        const to = nodeRef.to;
        const line = state.doc.lineAt(from);
        
        // Extract the marker text
        const markerText = state.doc.sliceString(from, to).trim();
        
        // Check if cursor is on this line (meaning, the original mark should be visible)
        const isCursorOnLine = primarySelection.from <= line.to && primarySelection.to >= line.from;
        
        if (isUnorderedListMarker(markerText)) {
          if (!isCursorOnLine) {
            // When cursor is NOT on the line, we replace the original UNORDERED marker with the widget.
            decorations.push(
              Decoration.replace({
                widget: new BulletPointWidget(markerText),
                inclusive: true // Replace the entire range
              }).range(from, to) // Apply to the range of the ListMark
            );
          }
        } else if (isOrderedListMarker(markerText)) {
            // For ordered list markers, we generally want to keep the number visible.
            // Instead of hiding/replacing, we can apply a custom class for styling.
            // This class will be added to the span containing the number (e.g., <span class="ͼ13 cm-ordered-list-marker">1.</span>)
            if (!isCursorOnLine) {
                decorations.push(
                    Decoration.mark({ class: "cm-ordered-list-marker" }).range(from, to)
                );
            }
            // If the cursor IS on the line, no decoration is applied,
            // allowing the original text (and its default syntax highlighting like ͼ13) to show.
        }
      }
    }
  });
  
  return Decoration.set(decorations, true);
}

// State Field for the List Marker extension
export const listBulletExtension = StateField.define<DecorationSet>({
  create(state) {
    return createListMarkerDecorations(state);
  },
  update(decorations, transaction) {
    // Rebuild decorations if:
    // 1. The document content has changed.
    // 2. The selection (cursor position) has changed.
    const selectionChanged = transaction.selection &&
                             !transaction.selection.main.eq(transaction.startState.selection.main);

    if (transaction.docChanged || selectionChanged) {
      return createListMarkerDecorations(transaction.state);
    }
    return decorations.map(transaction.changes); // Use .map for efficiency if no full rebuild
  },
  provide: (field) => EditorView.decorations.from(field),
});