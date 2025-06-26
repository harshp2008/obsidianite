// src/extensions/horizontalRuleExtension.ts
import { EditorView, Decoration, WidgetType, type DecorationSet } from '@codemirror/view';
import { StateField, type EditorState, Range } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { SyntaxNode } from '@lezer/common'; // Explicitly import SyntaxNode

// Define a custom WidgetType for the horizontal line visual
class HorizontalRuleWidget extends WidgetType {
  // IMPORTANT: Declare the property explicitly before the constructor.
  // This makes it a standard instance property, not just a constructor parameter property.
  isHidden: boolean;

  constructor(isHidden: boolean) { // Receive the value
    super();
    this.isHidden = isHidden; // Assign the value to the instance property
  }

  // CodeMirror uses `eq` to determine if a widget needs to be re-rendered.
  // If this method returns true, the existing DOM element is reused.
  eq(other: HorizontalRuleWidget) {
    return this.isHidden === other.isHidden; // Compare based on the state we control
  }

  toDOM() {
    const hr = document.createElement('div');
    hr.className = 'cm-horizontal-rule-widget'; // Base class for styling
    if (this.isHidden) {
      // Add a class that hides the widget when the markdown text should be visible
      hr.classList.add('cm-horizontal-rule-widget-hidden');
    }
    hr.setAttribute('aria-hidden', this.isHidden.toString()); // Accessibility hint
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
      const { node } = nodeRef; // Use node.from, node.to directly

      // Check if the current node is a HorizontalRule
      if (node.type.name === 'HorizontalRule') {
        const ruleFrom = node.from;
        const ruleTo = node.to;

        // Determine if the cursor/selection is on the line of the horizontal rule.
        // If it is, the widget should be hidden, and markdownSyntaxHiding will show the text.
        const line = state.doc.lineAt(ruleFrom);
        // This condition checks if any part of the selection range is within the line bounds
        const isCursorActiveOnRuleLine = primarySelection.from <= line.to && primarySelection.to >= line.from;

        // Always insert the widget. Its visibility will be controlled by the 'isHidden' property
        // passed to its constructor, which adds/removes a CSS class.
        decorations.push(
          Decoration.widget({
            // Pass true if the cursor is active on the line, meaning the widget should be hidden.
            widget: new HorizontalRuleWidget(isCursorActiveOnRuleLine),
            side: 0, // Place widget at the start of the rule's range
          }).range(ruleFrom)
        );
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
    // This will cause new widget instances to be created if `isHidden` changes,
    // and CodeMirror's `eq` method will handle DOM updates.
    if (transaction.docChanged || transaction.selection) {
      return createHorizontalRuleDecorations(transaction.state);
    }
    return decorations;
  },
  provide: (field) => EditorView.decorations.from(field),
});