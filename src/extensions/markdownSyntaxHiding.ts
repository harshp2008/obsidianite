import { Extension, SelectionRange, RangeSet } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, WidgetType, ViewUpdate } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { RangeSetBuilder } from '@codemirror/state';
import { SyntaxNode } from '@lezer/common'; // New: Import SyntaxNode

// A WidgetType to replace hidden delimiters. Using a zero-width space
// helps maintain cursor navigation somewhat, though it can still be tricky.
class HiddenDelimiterWidget extends WidgetType {
  toDOM() {
    const span = document.createElement("span");
    span.textContent = ""; // Makes the span effectively invisible
    span.setAttribute("aria-hidden", "true"); // Helps with accessibility tools
    return span;
  }
  // Important for selection behavior: ignore events on the widget
  ignoreEvent() { return true; }
}

// The decoration to apply when hiding a delimiter
const hiddenDelimiterDecoration = Decoration.replace({
  widget: new HiddenDelimiterWidget(),
  side: 0 // Prevents cursor from being stuck inside the replaced range
});

// Helper function to check if a selection range intersects with a node's range
function intersects(selectionRange: SelectionRange, nodeFrom: number, nodeTo: number): boolean {
  // A range [A, B) intersects with [C, D) if A < D and B > C
  return selectionRange.from < nodeTo && selectionRange.to > nodeFrom;
}

// Helper function to check if cursor is adjacent to a node (useful for hiding logic)
function isCursorAdjacent(head: number, nodeFrom: number, nodeTo: number): boolean {
  return head === nodeFrom || head === nodeTo;
}

// This function builds the set of decorations to apply for syntax hiding.
function buildSyntaxHidingDecorations(view: EditorView): RangeSet<Decoration> {
  const builder = new RangeSetBuilder<Decoration>();
  const tree = syntaxTree(view.state);
  const { state } = view;
  const selection = state.selection; // Get the full selection object, which includes 'main' and 'ranges'

  // Define which types of nodes represent markdown delimiters we want to hide
  const hideableMarkNames = new Set([
    "EmphasisMark",      // * _
    "StrongEmphasisMark", // ** __
    "ATXHeadingMark",    // # (for headers)
    "BlockquoteMark",    // >
    "CodeMark",          // ` `` ``` (for inline code or code blocks)
    "LinkMark",          // [ ] ( ) (for link brackets/parentheses)
    "URL",               // The actual URL part of a link (often hidden until active)
    "SetextHeadingMark", // === --- (for setext headers)
    "StrikethroughMark", // ~~
    "HighlightMark",          // == (for highlight)
  ]);

  // Iterate over the syntax tree to find potential delimiters
  tree.iterate({
    from: 0,
    to: state.doc.length,
    enter: (nodeRef) => {
      if (hideableMarkNames.has(nodeRef.name)) {
        let shouldHide = true; // Assume we should hide by default

        // Condition 1: If any active selection range (non-empty or empty cursor range) intersects with the delimiter node.
        // This handles direct selection of the delimiter itself.
        for (const range of selection.ranges) {
          if (intersects(range, nodeRef.from, nodeRef.to)) {
            shouldHide = false;
            break;
          }
        }
        if (!shouldHide) return; // If already decided to show, skip to next node

        // Condition 2: If the cursor is present (empty selection) AND
        //    the cursor is adjacent to the delimiter OR
        //    the cursor is anywhere within the *parent* markdown element that this delimiter belongs to.
        if (selection.main.empty) {
          if (isCursorAdjacent(selection.main.head, nodeRef.from, nodeRef.to)) {
              shouldHide = false; // Cursor is right next to the *current delimiter*
          } else {
              let current: SyntaxNode | null = nodeRef.node;
              while (current) {
                  // Check if cursor is within or at the boundaries of the *parent styled block*
                  if (
                      (current.name === "StrongEmphasis" ||
                       current.name === "Emphasis" ||
                       current.name === "InlineCode" ||
                       current.name === "URL" ||
                       current.name === "Highlight" ||
                       current.name === "Strikethrough" ||
                       // Add other relevant inline/block parent types here if needed for broader reveal
                       current.name === "ATXHeading" || // Example for headings
                       current.name === "Blockquote" // Example for blockquotes
                      ) &&
                      selection.main.head >= current.from && selection.main.head <= current.to // FIX: Changed > and < to >= and <=
                  ) {
                      shouldHide = false;
                      break;
                  }
                  current = current.parent;
              }
          }
      }
        if (!shouldHide) return; // If we decided to show it, don't add hide decoration

        // If none of the above conditions were met, then the delimiter should be hidden.
        builder.add(nodeRef.from, nodeRef.to, hiddenDelimiterDecoration);
      }
    }
  });

  return builder.finish();
}

// The ViewPlugin that provides the decorations to the editor view.
export const markdownSyntaxHiding: Extension = ViewPlugin.fromClass(class {
  decorations: RangeSet<Decoration>;

  constructor(view: EditorView) {
    // Initialize decorations when the plugin is created
    this.decorations = buildSyntaxHidingDecorations(view);
  }

  update(update: ViewUpdate) {
    // Recompute decorations only when the document content or the selection changes
    if (update.docChanged || update.selectionSet) {
      this.decorations = buildSyntaxHidingDecorations(update.view);
    }
  }
}, {
  // This makes the decorations available to the EditorView
  decorations: v => v.decorations
});