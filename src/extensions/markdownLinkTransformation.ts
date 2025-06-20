// src/extensions/markdownLinkTransformation.ts

import {
  EditorView,
  ViewPlugin,
  ViewUpdate,
  Decoration,
  WidgetType,
} from '@codemirror/view';
import type { DecorationSet } from '@codemirror/view';

import { syntaxTree } from '@codemirror/language';
import { RangeSetBuilder, EditorState } from '@codemirror/state';
import type { SyntaxNode } from '@lezer/common';

// Helper to check if selection intersects with a specific range
function selectionIntersects(
  currentSelection: EditorState['selection']['main'],
  start: number,
  end: number
): boolean {
  // Check if any part of the selection overlaps with the given range (start, end)
  return currentSelection.from < end && currentSelection.to > start;
}

// Widget to render the link text (and optionally make it clickable)
class LinkTextWidget extends WidgetType {
  private isEmptyUrl: boolean;
  private domElement: HTMLElement | null = null; // Store the created DOM element
  // The 'readonly' keyword in the constructor params below automatically
  // declares and initializes these as properties of the class.
  // private linkFrom: number; // No longer needed as separate declaration
  // private linkTo: number;   // No longer needed as separate declaration
  // private view: EditorView; // No longer needed as separate declaration

  constructor(
    readonly text: string, // Re-added 'readonly'
    readonly url: string,   // Re-added 'readonly'
    readonly linkFrom: number,
    readonly linkTo: number,
    readonly view: EditorView
  ) {
    super();
    // Trim URL content here for robustness, although it should be clean from buildDecorations
    this.isEmptyUrl = url.trim().length === 0;
    // this.linkFrom = linkFrom; // No longer needed, handled by readonly
    // this.linkTo = linkTo;   // No longer needed, handled by readonly
    // this.view = view;       // No longer needed, handled by readonly
  }

  eq(other: WidgetType): boolean {
    return other instanceof LinkTextWidget &&
           this.text === other.text && // Now 'this.text' exists
           this.url === other.url &&   // Now 'this.url' exists
           this.linkFrom === other.linkFrom &&
           this.linkTo === other.linkTo;
  }

  toDOM() {
    const anchor = document.createElement('a');
    anchor.textContent = this.text; // Now 'this.text' exists
    anchor.className = 'cm-link-display';

    if (!this.isEmptyUrl) {
      anchor.href = this.url; // Now 'this.url' exists
      anchor.target = '_blank'; // Open in new tab
      anchor.rel = 'noopener noreferrer'; // Security best practice for target="_blank"
      anchor.title = this.url; // Show full URL on hover // Now 'this.url' exists

      // Add a click event listener to handle both navigation and edit mode
      anchor.addEventListener('click', (e) => {
        e.preventDefault(); // PREVENT default browser navigation

        // 1. Open the link (manually)
        window.open(this.url, '_blank', 'noopener noreferrer'); // Now 'this.url' exists

        // 2. Go into edit mode for the link (by setting CodeMirror selection)
        // We dispatch a transaction to update the selection
        this.view.dispatch({ // 'this.view' exists
          selection: { anchor: this.linkFrom, head: this.linkTo } // 'this.linkFrom', 'this.linkTo' exist
        });
        // Optional: Focus the editor if it loses focus
        this.view.focus(); // 'this.view' exists
      });

    } else {
      // Styling for links with no URL (e.g., `[Link Text]()`)
      anchor.classList.add('cm-link-empty-url');
      anchor.href = 'javascript:void(0);'; // Prevent actual navigation for empty links
      anchor.title = 'Link has no URL'; // Tooltip for empty links
      anchor.style.cursor = 'text'; // Indicate it's not clickable for navigation
    }

    this.domElement = anchor; // Store a reference to the created DOM element
    return anchor;
  }

  // This method tells CodeMirror whether it should "ignore" an event on the widget.
  // Returning `true` means CodeMirror should *ignore* it, allowing our JS event listener to act.
  // Returning `false` means CodeMirror should *not* ignore it, and will process the event itself.
  ignoreEvent(event: Event): boolean {
    // If it's a click or mousedown directly on our anchor element and it's a valid (non-empty) link,
    // we want our custom event listener to handle it, so CodeMirror should ignore its own processing.
    if ((event.type === 'click' || event.type === 'mousedown') &&
        this.domElement && event.target === this.domElement && !this.isEmptyUrl) {
      return true; // CodeMirror should ignore this event
    }

    // For all other events, or for empty links (where we don't have a custom click handler for navigation),
    // let CodeMirror process them (e.g., selection, editing).
    return false;
  }
}

export const markdownLinkTransformation = ViewPlugin.fromClass(class {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = this.buildDecorations(view);
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.selectionSet || update.viewportChanged) {
      this.decorations = this.buildDecorations(update.view);
    }
  }

  private buildDecorations(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const tree = syntaxTree(view.state);
    const doc = view.state.doc;
    const currentSelection = view.state.selection.main;

    for (let { from, to } of view.visibleRanges) {
      tree.iterate({
        from, to,
        enter: (nodeRef) => {
          const node = nodeRef.node;
          const { from: nodeFrom, to: nodeTo, type } = node;

          if (type.name === 'Link') {
            // Apply transformation ONLY if the selection DOES NOT intersect the link's range
            if (!selectionIntersects(currentSelection, nodeFrom, nodeTo)) {
              let urlContent = '';
              let linkDisplayText = '';

              let linkTextStart = -1;
              let linkTextEnd = -1;
              
              node.cursor().iterate((childCursor) => {
                if (childCursor.name === 'LinkMark') {
                    // Check for the opening '[' and closing ']' of the LinkText part
                    if (doc.sliceString(childCursor.from, childCursor.to) === '[') {
                        linkTextStart = childCursor.to; // Start of link text is AFTER '['
                    } else if (doc.sliceString(childCursor.from, childCursor.to) === ']') {
                        linkTextEnd = childCursor.from; // End of link text is BEFORE ']'
                    }
                } else if (childCursor.name === 'URL') {
                    // Get the raw content of the URL node.
                    urlContent = doc.sliceString(childCursor.from, childCursor.to);
                }
                return true;
              });

              // Extract link display text using the identified boundaries
              if (linkTextStart !== -1 && linkTextEnd !== -1 && linkTextEnd >= linkTextStart) {
                  linkDisplayText = doc.sliceString(linkTextStart, linkTextEnd);
              }

              // Clean the URL content: strip surrounding parentheses if present, and trim whitespace
              if (urlContent.startsWith('(') && urlContent.endsWith(')')) {
                  urlContent = urlContent.substring(1, urlContent.length - 1);
              }
              urlContent = urlContent.trim();

              // Condition for rendering the widget:
              // We consider it a valid link to transform if we successfully found the bracket boundaries.
              // The `Link` node type itself from the parser signifies a valid link structure.
              if (linkTextStart !== -1 && linkTextEnd !== -1) {
                builder.add(nodeFrom, nodeTo, Decoration.replace({
                  // Pass the entire link's 'from' and 'to' positions, and the EditorView instance
                  widget: new LinkTextWidget(linkDisplayText, urlContent, nodeFrom, nodeTo, view),
                  inclusive: true,
                  block: false,
                }));
              }
            }
          }
          return true;
        }
      });
    }
    return builder.finish();
  }
}, {
  decorations: v => v.decorations
});