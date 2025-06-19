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

// Helper to check if cursor is within a specific range
function cursorIsWithin(currentSelection: EditorState['selection']['main'], start: number, end: number): boolean {
  return currentSelection.from >= start && currentSelection.to <= end;
}

// Widget to render the link text (and optionally make it clickable)
class LinkTextWidget extends WidgetType {
  constructor(readonly text: string, readonly url: string) { super(); }

  eq(other: WidgetType): boolean {
    return other instanceof LinkTextWidget &&
           this.text === other.text &&
           this.url === other.url;
  }

  toDOM() {
    const anchor = document.createElement('a');
    anchor.href = this.url;
    anchor.textContent = this.text;
    anchor.className = 'cm-link-display';
    anchor.target = '_blank';
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
    if (event.type === 'mousedown') return true;
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
            if (!cursorIsWithin(currentSelection, nodeFrom, nodeTo)) {
              let urlNode: SyntaxNode | null = null;
              let firstBracketFrom: number | null = null;
              let firstBracketTo: number | null = null;
              let secondBracketFrom: number | null = null;

              // Iterate through children to find LinkMarks and the URL
              let cursor = node.firstChild;
              while (cursor) {
                if (cursor.type.name === 'LinkMark') {
                  if (firstBracketFrom === null) {
                    firstBracketFrom = cursor.from; // This is the '['
                    firstBracketTo = cursor.to;
                  } else if (secondBracketFrom === null && cursor.from > (firstBracketFrom || 0)) {
                    secondBracketFrom = cursor.from; // This is the ']'
                  }
                } else if (cursor.type.name === 'URL') {
                  urlNode = cursor;
                }
                cursor = cursor.nextSibling;
              }

              // Now, derive the link text range
              let linkTextFrom: number | null = null;
              let linkTextTo: number | null = null;

              if (firstBracketTo !== null && secondBracketFrom !== null) {
                linkTextFrom = firstBracketTo;
                linkTextTo = secondBracketFrom;
              }

              if (linkTextFrom !== null && linkTextTo !== null && urlNode) {
                const linkText = doc.sliceString(linkTextFrom, linkTextTo);
                const url = doc.sliceString(urlNode.from, urlNode.to);

                builder.add(nodeFrom, nodeTo, Decoration.replace({
                  widget: new LinkTextWidget(linkText, url),
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