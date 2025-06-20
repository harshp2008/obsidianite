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

  constructor(
    readonly text: string,
    readonly url: string,
    readonly linkFrom: number,
    readonly linkTo: number,
    readonly view: EditorView
  ) {
    super();
    this.isEmptyUrl = url.trim().length === 0;
  }

  eq(other: WidgetType): boolean {
    return other instanceof LinkTextWidget &&
           this.text === other.text &&
           this.url === other.url &&
           this.linkFrom === other.linkFrom &&
           this.linkTo === other.linkTo;
  }

  toDOM() {
    const anchor = document.createElement('a');
    anchor.textContent = this.text;
    anchor.className = 'cm-link-display';

    if (!this.isEmptyUrl) {
      anchor.href = this.url;
      // We will handle opening in a new tab programmatically via a simulated click,
      // so target="_blank" is not strictly necessary for functionality here,
      // but it's good for semantics and accessibility (e.g., if JS fails).
      anchor.target = '_blank'; // Keep for semantic correctness

      // Add a click event listener to handle both navigation and edit mode
      anchor.addEventListener('click', (e) => {
        e.preventDefault(); // PREVENT default browser navigation

        // 1. Open the link in a new background tab using a simulated Ctrl/Cmd+Click
        const tempAnchor = document.createElement('a');
        tempAnchor.href = this.url;
        tempAnchor.target = '_blank'; // Ensure it's a new tab

        // Simulate Ctrl/Cmd+Click to open in background tab
        // Use `metaKey` for macOS (Cmd), `ctrlKey` for Windows/Linux (Ctrl)
        // Set both to ensure cross-platform compatibility. The browser will
        // typically use the appropriate key based on the OS.
        const event = new MouseEvent('click', {
          view: window,
          bubbles: true,
          cancelable: true,
          ctrlKey: true, // For Windows/Linux
          metaKey: true  // For macOS
        });

        // Append to body temporarily, dispatch event, then remove
        // This is a common pattern to trigger native browser behavior.
        document.body.appendChild(tempAnchor);
        tempAnchor.dispatchEvent(event);
        document.body.removeChild(tempAnchor);

        // 2. Go into edit mode for the link (by setting CodeMirror selection)
        // Dispatch a transaction to update the selection to the original link's range.
        this.view.dispatch({
          selection: { anchor: this.linkFrom, head: this.linkTo }
        });
        // Ensure editor focuses itself after the action, if it didn't already
        this.view.focus();
      });

    } else {
      // Styling and behavior for links with no URL (e.g., `[Link Text]()`)
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
    // We handle the click event ourselves, so CodeMirror should ignore it.
    // We also ignore mousedown to prevent CM from initiating text selection
    // that might interfere with our custom click handler.
    if ((event.type === 'click' || event.type === 'mousedown') &&
        this.domElement && event.target === this.domElement && !this.isEmptyUrl) {
      return true; // CodeMirror should ignore this event on our widget.
    }
    // For other events (like key presses, or events not on the anchor)
    // or for empty links, let CodeMirror process them.
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
                    // Identify the 'LinkMark' nodes for the opening '[' and closing ']'
                    if (doc.sliceString(childCursor.from, childCursor.to) === '[') {
                        linkTextStart = childCursor.to; // Start of link text is AFTER '['
                    } else if (doc.sliceString(childCursor.from, childCursor.to) === ']') {
                        linkTextEnd = childCursor.from; // End of link text is BEFORE ']'
                    }
                } else if (childCursor.name === 'URL') {
                    // Get the raw content of the URL node as identified by the parser.
                    urlContent = doc.sliceString(childCursor.from, childCursor.to);
                }
                return true; // Continue iterating children
              });

              // Extract link display text using the identified boundaries
              if (linkTextStart !== -1 && linkTextEnd !== -1 && linkTextEnd >= linkTextStart) {
                  linkDisplayText = doc.sliceString(linkTextStart, linkTextEnd);
              }

              // Clean the URL content: strip surrounding parentheses if present, and trim whitespace
              if (urlContent.startsWith('(') && urlContent.endsWith(')')) {
                  urlContent = urlContent.substring(1, urlContent.length - 1);
              }
              urlContent = urlContent.trim(); // Trim any leading/trailing whitespace

              // Condition for rendering the widget:
              // We consider it a valid link to transform if we successfully found the bracket boundaries.
              if (linkTextStart !== -1 && linkTextEnd !== -1) {
                builder.add(nodeFrom, nodeTo, Decoration.replace({
                  // Pass the display text, cleaned URL, the original markdown link's full range (nodeFrom, nodeTo),
                  // and the EditorView instance to the widget.
                  widget: new LinkTextWidget(linkDisplayText, urlContent, nodeFrom, nodeTo, view),
                  inclusive: true, // The decoration should include its boundary
                  block: false,    // Not a block decoration
                }));
              }
            }
          }
          return true; // Continue iterating syntax tree nodes
        }
      });
    }
    return builder.finish(); // Finalize the set of decorations
  }
}, {
  // This property tells CodeMirror that the decorations are derived from the view's state.
  // It ensures the plugin's `decorations` property is kept up to date.
  decorations: v => v.decorations
});