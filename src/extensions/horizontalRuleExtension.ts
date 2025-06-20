// src/extensions/horizontalRuleExtension.ts
import { EditorView, Decoration, WidgetType, type DecorationSet } from '@codemirror/view';
import { StateField, type EditorState, Range, SelectionRange } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { SyntaxNode } from '@lezer/common';

// Define a custom WidgetType for the horizontal line visual
class HorizontalRuleWidget extends WidgetType {
  toDOM() {
    const hr = document.createElement('div');
    hr.className = 'cm-horizontal-rule-widget'; // Class for styling
    // Optionally, you can add a visible <hr> tag inside the div for semantic HTML
    // hr.appendChild(document.createElement('hr'));
    return hr;
  }

  ignoreEvent() { return true; } // Prevents widget from capturing editor events
}

// Function to create decorations for horizontal rules
function createHorizontalRuleDecorations(state: EditorState): DecorationSet {
  const decorations: Array<Range<Decoration>> = [];
  const tree = syntaxTree(state);
  const { main: primarySelection } = state.selection;

  tree.iterate({
    from: 0,
    to: state.doc.length,
    enter: (nodeRef) => {
      const { node, from, to } = nodeRef;

      // Check if the current node is a HorizontalRule
      if (node.type.name === 'HorizontalRule') {
        const ruleFrom = node.from;
        const ruleTo = node.to;

        // Determine if the cursor/selection is on the line of the horizontal rule
        // or directly adjacent to its markers.
        // We'll rely on markdownSyntaxHiding for the actual hiding/showing
        // based on cursor proximity, so here we just need to know if the HR is active.
        let isCursorActiveOnRuleLine = false;
        const line = state.doc.lineAt(ruleFrom);

        if (primarySelection.from >= line.from && primarySelection.to <= line.to) {
            isCursorActiveOnRuleLine = true;
        }

        if (!isCursorActiveOnRuleLine) {
          // If the cursor is NOT on the line, insert the visual HR widget.
          // This widget will appear where markdownSyntaxHiding would have hidden the markers.
          decorations.push(
            Decoration.widget({
              widget: new HorizontalRuleWidget(),
              side: 0, // Place widget at the start of the rule's range
            }).range(ruleFrom)
          );
        }
        // If the cursor IS on the line, we do nothing here,
        // letting markdownSyntaxHiding reveal the actual '---' characters.
      }
    }
  });
  return Decoration.set(decorations, true);
}

// State Field for the Horizontal Rule extension
export const horizontalRuleExtension = StateField.define<DecorationSet>({
  create(state) {
    return createHorizontalRuleDecorations(state);
  },
  update(decorations, transaction) {
    // Recompute decorations if document content or selection changes
    if (transaction.docChanged || transaction.selection) {
      return createHorizontalRuleDecorations(transaction.state);
    }
    return decorations;
  },
  provide: (field) => EditorView.decorations.from(field),
}); 