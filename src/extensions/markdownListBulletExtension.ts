// src/extensions/listBulletExtension.ts
import { EditorView, Decoration, WidgetType, type DecorationSet } from '@codemirror/view';
import { StateField, type  EditorState, Range } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';


// Define a custom WidgetType for our bullet (only for unordered lists)
class CustomBulletWidget extends WidgetType {
  constructor(private bulletChar: string = '•') { // Default to bullet point
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
        const parentList = nodeRef.node.parent; // Get the parent (BulletList or OrderedList)

        if (parentList && parentList.type.name === 'BulletList') {
          // This is an UNORDERED list item
          const listMarkNode = nodeRef.node.firstChild; 
          
          if (listMarkNode && listMarkNode.type.name === 'ListMark') {
            const listMarkFrom = listMarkNode.from;
            const listMarkTo = listMarkNode.to;
            
            // Check if cursor is inside the ENTIRE ListItem range
            const cursorIsInsideListItem = cursorFrom >= from && cursorFrom <= to;

            if (!cursorIsInsideListItem) {
              // When the ListItem is INACTIVE, hide the original ListMark character
              // and replace it with our custom bullet widget.
              
              // First, hide the raw ListMark characters with zero-width spaces
              for (let i = listMarkFrom; i < listMarkTo; i++) {
                decorations.push(Decoration.replace({ content: '​' }).range(i, i + 1));
              }

              // Then, insert the custom bullet widget
              decorations.push(
                Decoration.widget({
                  widget: new CustomBulletWidget('•'), // Use a standard bullet character
                  side: -1 
                }).range(listMarkFrom)
              );
            }
            // If active, no decoration from this extension. markdownSyntaxHiding will not touch it.
            // So the raw '-' or '*' will show.
          }
        }
        // For OrderedList items, this extension does nothing.
        // markdownSyntaxHiding will handle showing/hiding their `ListMark` based on activity.
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
    if (transaction.docChanged || transaction.selection) {
      return createListBulletDecorations(transaction.state);
    }
    return decorations;
  },
  provide: (field) => EditorView.decorations.from(field),
});