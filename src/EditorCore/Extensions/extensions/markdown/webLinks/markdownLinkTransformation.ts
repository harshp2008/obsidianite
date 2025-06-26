// src/extensions/Web Links/markdownLinkTransformation.ts

import {
  EditorView,
  ViewPlugin,
  ViewUpdate,
  Decoration,
  WidgetType,
  DecorationSet
} from '@codemirror/view';

// EditorState is declared but its value is never read. This is fine if not used elsewhere directly.
import { syntaxTree } from '@codemirror/language';
import { RangeSetBuilder } from '@codemirror/state';
import { SyntaxNode } from '@lezer/common'; // Explicitly import SyntaxNode for type hinting


import { shouldShowRawMarkdown } from './linkVisibilityLogic';

/**
 * Ensures a URL has a protocol prefix (https:// by default)
 * Handles cases like "google.com" or "www.example.org" by adding the protocol
 */
function ensureUrlProtocol(url: string): string {
  url = url.trim();
  
  // If URL is empty, return as is
  if (!url) return url;
  
  // If it already has a protocol, return as is
  if (url.match(/^[a-zA-Z]+:\/\//)) return url;
  
  // If starts with www., add https://
  if (url.startsWith('www.')) {
    return `https://${url}`;
  }
  
  // For cases like "google.com" without www
  return `https://${url}`;
}

class LinkTextWidget extends WidgetType {
  private isEmptyLink: boolean;
  private processedUrl: string;

  constructor(
    readonly text: string,
    readonly url: string,
    readonly linkFrom: number,
    readonly linkTo: number,
    readonly view: EditorView
  ) {
    super();
    this.isEmptyLink = text.trim().length === 0 || url.trim().length === 0;
    this.processedUrl = ensureUrlProtocol(url);
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
    anchor.textContent = this.text || '[]';
    anchor.className = 'cm-link-display';

    // Add empty link class if either text or URL is empty
    if (this.isEmptyLink) {
      anchor.classList.add('cm-empty-link');
    }
    
    // Set URL properties if URL exists
    if (this.url.trim().length > 0) {
      anchor.href = this.processedUrl;
      anchor.target = '_blank';
      anchor.title = this.url.trim();

      anchor.addEventListener('click', (e) => {
        e.preventDefault();

        const tempAnchor = document.createElement('a');
        tempAnchor.href = this.processedUrl;
        tempAnchor.target = '_blank';

        const event = new MouseEvent('click', {
          view: window,
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          metaKey: true
        });

        document.body.appendChild(tempAnchor);
        tempAnchor.dispatchEvent(event);
        document.body.removeChild(tempAnchor);

        this.view.dispatch({
          selection: { anchor: this.linkFrom, head: this.linkTo }
        });
        this.view.focus();
      });
    } else {
      anchor.href = 'javascript:void(0);';
      anchor.style.cursor = 'text';
    }

    return anchor;
  }

  ignoreEvent(event: Event): boolean {
    if ((event.type === 'click' || event.type === 'mousedown') &&
        this.url.trim().length > 0) {
      return true;
    }
    return false;
  }
}


export const markdownLinkTransformation = ViewPlugin.fromClass(class {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = this.buildDecorations(view);
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.selectionSet || update.viewportChanged || update.heightChanged) {
      this.decorations = this.buildDecorations(update.view);
    }
  }

  private buildDecorations(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const tree = syntaxTree(view.state);
    const doc = view.state.doc;

    for (let { from, to } of view.visibleRanges) {
      tree.iterate({
        from, to,
        enter: (nodeRef) => {
          const node = nodeRef.node;
          const { from: nodeFrom, to: nodeTo, type } = node;

          if (type.name === 'Link') {
            const shouldBeRaw = shouldShowRawMarkdown(view, node);

            if (shouldBeRaw) {
              return true;
            }

            // --- Extract Link Display Text and URL ---
            let linkDisplayText = '';
            let urlContent = '';

            let openBracketNode: SyntaxNode | null = null;
            let closeBracketNode: SyntaxNode | null = null;
            let urlNode: SyntaxNode | null = null;

            // Iterate over the direct children of the Link node
            let currentChild: SyntaxNode | null = node.firstChild;
            while (currentChild) {
                if (currentChild.type.name === 'LinkMark') {
                    const markText = doc.sliceString(currentChild.from, currentChild.to);
                    if (markText === '[') {
                        openBracketNode = currentChild;
                    } else if (markText === ']') {
                        closeBracketNode = currentChild;
                    }
                } else if (currentChild.type.name === 'URL') {
                    urlNode = currentChild;
                }
                currentChild = currentChild.nextSibling;
            }

            // Extract link display text between the brackets if they exist and are correctly ordered
            if (openBracketNode && closeBracketNode && openBracketNode.to < closeBracketNode.from) {
                linkDisplayText = doc.sliceString(openBracketNode.to, closeBracketNode.from).trim();
            }

            // Get URL content
            if (urlNode) {
                urlContent = doc.sliceString(urlNode.from, urlNode.to).trim();
            }

            // Fallback for empty links - use URL as display text if link text is empty
            if (linkDisplayText.length === 0 && urlContent.length > 0) {
                linkDisplayText = urlContent;
            }
            // --- End Extraction ---

            builder.add(nodeFrom, nodeTo, Decoration.replace({
                widget: new LinkTextWidget(linkDisplayText, urlContent, nodeFrom, nodeTo, view),
                inclusive: true,
                block: false,
            }));
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