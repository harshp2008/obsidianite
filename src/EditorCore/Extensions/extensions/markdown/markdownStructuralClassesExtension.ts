// src/EditorCore/Extensions/extensions/markdown/markdownStructuralClassesExtension.ts

import { EditorView, Decoration, DecorationSet } from '@codemirror/view';
import { StateField, EditorState, Range } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';

/**
 * Creates line decorations (classes on the cm-line div) based on Markdown syntax nodes.
 */
function buildMarkdownLineClasses(state: EditorState): DecorationSet {
  const decorations: Array<Range<Decoration>> = [];
  const tree = syntaxTree(state);

  // Keep track of lines we've already decorated to avoid duplicates
  const decoratedLines = new Set<number>();

  tree.iterate({
    enter: (nodeRef) => {
      const { node } = nodeRef;
      const line = state.doc.lineAt(node.from);

      // We apply the class to the entire line, so we only need to do it once per line.
      // Check if this line has already been processed for a list item class.
      if (!decoratedLines.has(line.number)) {
        if (node.type.name === 'ListItem') {
          // If a ListItem node is found anywhere on the line, apply 'cm-list-item'
          // to the entire line.
          decorations.push(
            Decoration.line({ class: 'cm-list-item' }).range(line.from)
          );
          decoratedLines.add(line.number); // Mark line as decorated
        }
        // Extend this for other block-level Markdown elements
        if (node.type.name === 'Blockquote') {
           decorations.push(
             Decoration.line({ class: 'cm-block-quote' }).range(line.from)
           );
           decoratedLines.add(line.number);
        }
        if (node.type.name.startsWith('ATXHeading')) {
           // Example for headings, you might refine this for specific heading levels
           decorations.push(
             Decoration.line({ class: `cm-heading cm-heading-${node.type.name.replace('ATXHeading', '')}` }).range(line.from)
           );
           decoratedLines.add(line.number);
        }
      }
    }
  });

  return Decoration.set(decorations, true);
}

// State Field for the Markdown structural classes
export const markdownStructuralClassesExtension = StateField.define<DecorationSet>({
  create(state) {
    return buildMarkdownLineClasses(state);
  },
  update(decorations, transaction) {
    if (transaction.docChanged) {
      return buildMarkdownLineClasses(transaction.state);
    }
    // Efficiently map existing decorations if only cursor moves or minor changes
    return decorations.map(transaction.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});