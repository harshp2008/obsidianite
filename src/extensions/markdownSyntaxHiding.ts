// src/extensions/markdownSyntaxHiding.ts
import { ViewPlugin, Decoration } from '@codemirror/view';
import type { DecorationSet, ViewUpdate } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import type { SyntaxNode } from '@lezer/common';
import { Range } from '@codemirror/state';

// Import highlightTags for direct comparison if needed, or rely on node.type.name
import { highlightTags } from './markdownHighlightExtension'; // NEW IMPORT

export const markdownSyntaxHiding = ViewPlugin.fromClass(class {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = this.buildDecorations(view);
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged || update.selectionSet) {
      this.decorations = this.buildDecorations(update.view);
    }
  }

  buildDecorations(view: EditorView) {
    const widgets: Range<Decoration>[] = [];

    const hiddenMark = Decoration.mark({
      attributes: {
        style: 'display: none;',
      },
    });

    const replaceMark = Decoration.replace({}); // Used for inline code


    const revealSyntaxForNode = (nodeFrom: number, nodeTo: number) => {
      const selection = view.state.selection.main;
      return (selection.from >= nodeFrom && selection.from <= nodeTo) ||
             (selection.to >= nodeFrom && selection.to <= nodeTo);
    };

    for (let { from, to } of view.visibleRanges) {
      syntaxTree(view.state).iterate({
        from, to,
        enter: (nodeRef) => {
          const node = nodeRef.node;
          const name = node.type.name;

          if (
            name === 'CodeBlock' ||
            name === 'URL' ||
            name === 'ImageDescription'
          ) {
            return false;
          }

          switch (name) {
            case 'ATXHeading1':
            case 'ATXHeading2':
            case 'ATXHeading3':
            case 'ATXHeading4':
            case 'ATXHeading5':
            case 'ATXHeading6': {
              node.getChildren('HeaderMark').forEach((markNode: SyntaxNode) => {
                  const charAfterMarkPos = markNode.to;
                  let hideTo = markNode.to;

                  if (view.state.doc.sliceString(charAfterMarkPos, charAfterMarkPos + 1) === ' ') {
                      hideTo++;
                  }

                  if (!revealSyntaxForNode(node.from, node.to)) {
                      widgets.push(hiddenMark.range(markNode.from, hideTo));
                  }
              });
              break;
            }
            case 'Blockquote': {
              node.getChildren('QuoteMark').forEach((markNode: SyntaxNode) => {
                if (!revealSyntaxForNode(node.from, node.to)) {
                  widgets.push(hiddenMark.range(markNode.from, markNode.to));
                }
              });
              break;
            }
            case 'Emphasis': {
              node.getChildren('EmphasisMark').forEach((markNode: SyntaxNode) => {
                  if (!revealSyntaxForNode(node.from, node.to)) {
                      widgets.push(hiddenMark.range(markNode.from, markNode.to));
                  }
              });
              break;
            }
            case 'StrongEmphasis': {
                node.getChildren('EmphasisMark').forEach((markNode: SyntaxNode) => {
                    if (!revealSyntaxForNode(node.from, node.to)) {
                        widgets.push(hiddenMark.range(markNode.from, markNode.to));
                    }
                });
                break;
            }
            case 'Strikethrough': {
                node.getChildren('StrikethroughMark').forEach((markNode: SyntaxNode) => {
                    if (!revealSyntaxForNode(node.from, node.to)) {
                        widgets.push(hiddenMark.range(markNode.from, markNode.to));
                    }
                });
                break;
            }
            case 'Mark': { // NEW CASE FOR HIGHLIGHT
                // Assuming 'Mark' node and 'MarkMark' children from custom extension
                node.getChildren('MarkMark').forEach((markNode: SyntaxNode) => {
                    if (!revealSyntaxForNode(node.from, node.to)) {
                        widgets.push(hiddenMark.range(markNode.from, markNode.to));
                    }
                });
                break;
            }
            case 'InlineCode': {
                node.getChildren('CodeMark').forEach((markNode: SyntaxNode) => {
                    if (!revealSyntaxForNode(node.from, node.to)) {
                        widgets.push(replaceMark.range(markNode.from, markNode.to));
                    }
                });
                break;
            }
            case 'Link':
            case 'Image': {
                node.getChildren('LinkMark').forEach((markNode: SyntaxNode) => {
                    if (!revealSyntaxForNode(node.from, node.to)) {
                        widgets.push(hiddenMark.range(markNode.from, markNode.to));
                    }
                });
                break;
            }
            case 'ListItem': {
                node.getChildren('ListMark').forEach((markNode: SyntaxNode) => {
                    const markText = view.state.doc.sliceString(markNode.from, markNode.to);

                    if (markText.match(/^\d+\./)) {
                        return;
                    }

                    if (!revealSyntaxForNode(node.from, node.to)) {
                        widgets.push(hiddenMark.range(markNode.from, markNode.to));
                    }
                });
                break;
            }

            case 'Highlight': { // Changed from 'Mark' to 'Highlight'
              node.getChildren('HighlightMark').forEach((markNode: SyntaxNode) => { // Changed from 'MarkMark' to 'HighlightMark'
                  if (!revealSyntaxForNode(node.from, node.to)) {
                      widgets.push(hiddenMark.range(markNode.from, markNode.to));
                  }
              });
              break;
            }


          }
        },
      });
    }
    return Decoration.set(widgets, true);
  }
}, {
  decorations: v => v.decorations
});