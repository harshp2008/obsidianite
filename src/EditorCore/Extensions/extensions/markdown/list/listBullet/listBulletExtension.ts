import { EditorView, Decoration, WidgetType, type DecorationSet } from '@codemirror/view';
import { StateField, type EditorState, Range } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';

// Define a custom WidgetType for the bullet point visual
class ListBulletWidget extends WidgetType {
  bulletType: string;
  
  constructor(bulletType: string) {
    super();
    this.bulletType = bulletType;
  }
  
  eq(other: ListBulletWidget) {
    return this.bulletType === other.bulletType;
  }
  
  toDOM() {
    const bullet = document.createElement('span');
    bullet.className = 'cm-custom-list-bullet';
    
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

// Function to create decorations for bullets
function createListBulletDecorations(state: EditorState): DecorationSet {
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
        
        // Only process unordered list markers
        if (isUnorderedListMarker(markerText)) {
          // Check if cursor is on this line
          const isCursorOnLine = primarySelection.from <= line.to && primarySelection.to >= line.from;
          
          if (!isCursorOnLine) {
            // Hide original marker
            decorations.push(
              Decoration.mark({
                class: "cm-syntax-hide"
              }).range(from, to)
            );
            
            // Add bullet widget
            decorations.push(
              Decoration.widget({
                widget: new ListBulletWidget(markerText),
                side: 0
              }).range(from)
            );
          }
        }
      }
    }
  });
  
  return Decoration.set(decorations, true);
}

// State Field for the List Bullet extension
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