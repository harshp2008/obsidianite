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
  // Add a property to indicate if the URL is empty/invalid
  private isEmptyUrl: boolean;
  
  constructor(readonly text: string, readonly url: string) {
    super();
    // Determine if the URL is empty or just contains whitespace
    this.isEmptyUrl = !url || url.trim() === '()';
  }

  eq(other: WidgetType): boolean {
    return other instanceof LinkTextWidget &&
           this.text === other.text &&
           this.url === other.url;
  }

  toDOM() {
    const anchor = document.createElement('a');
    anchor.textContent = this.text;
    anchor.className = 'cm-link-display';

    if (!this.isEmptyUrl) {
      // Only set href and target if the URL is not empty
      anchor.href = this.url;
      anchor.target = '_blank';
      anchor.title = this.url; // Show full URL on hover
    } else {
      // Add a class for empty/invalid URLs for specific styling
      anchor.classList.add('cm-link-empty-url');
      anchor.href = 'javascript:void(0);'; // Prevent actual navigation
      anchor.title = 'Link has no URL'; // Tooltip for empty links
    }

    // Optional: Truncate long URLs in the tooltip if you were to show it within the text
    // For a simple link text, the title attribute handles the full URL
    
    return anchor;
  }

  updateDOM(_dom: HTMLElement): boolean {
    return false;
  }

  get estimatedHeight(): number {
    return -1;
  }

  get lineBreaks(): number {
    return 0;
  }

  ignoreEvent(event: Event): boolean {
    // Allow mousedown to go through to the anchor tag itself for clicking
    if (event.type === 'mousedown') return false;
    // For other events (like keydown for navigation), ignore to prevent interference
    return true;
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
              let urlText = '';
              let linkDisplayText = '';

              node.cursor().iterate((childCursor) => {
                if (childCursor.name === 'LinkText') {
                  // +1 and -1 to strip the brackets []
                  linkDisplayText = doc.sliceString(childCursor.from + 1, childCursor.to - 1);
                } else if (childCursor.name === 'URL') {
                  // The URL node typically includes the parentheses, so we strip them
                  urlText = doc.sliceString(childCursor.from + 1, childCursor.to - 1);
                }
                return true;
              });

              // If linkDisplayText is empty, and urlText is also empty or just "()", consider it an incomplete link.
              // We should not render a widget for just '[]()' unless specifically desired.
              // For now, let's only create a widget if we have at least linkDisplayText.
              if (linkDisplayText) { // Ensure there's at least some display text
                builder.add(nodeFrom, nodeTo, Decoration.replace({
                  widget: new LinkTextWidget(linkDisplayText, urlText),
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