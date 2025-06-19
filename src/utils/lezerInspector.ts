import { EditorView } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
// Fix 4: Removed TreeCursor import as it's no longer directly used here
import type { SyntaxNode } from '@lezer/common';

/**
 * Logs the Lezer syntax tree of the current editor state to the console.
 * Optionally, you can specify a range to focus the logging.
 *
 * @param view The CodeMirror EditorView instance.
 * @param from The start position for the tree traversal (optional).
 * @param to The end position for the tree traversal (optional).
 */
export function logLezerTree(view: EditorView, from?: number, to?: number): void {
  const tree = syntaxTree(view.state);
  const doc = view.state.doc;

  console.groupCollapsed('Lezer Syntax Tree:');
  console.log('Document length:', doc.length);
  console.log('Range (requested):', from, '-', to);

  let indentation = 0;
  const indent = () => '  '.repeat(indentation);

  tree.iterate({
    from: from ?? 0,
    to: to ?? doc.length,
    enter: (nodeRef) => {
      const node = nodeRef.node;
      console.log(`${indent()}${node.type.name} [${node.from}-${node.to}] "${doc.sliceString(node.from, node.to)}"`);
      indentation++;
      return true;
    },
    leave: () => {
      indentation--;
    }
  });

  console.groupEnd();
}

/**
 * Logs the direct children of a specific SyntaxNode.
 * Useful when debugging a particular node's internal structure.
 *
 * @param node The parent SyntaxNode to inspect.
 * @param doc The EditorState's document.
 */
export function logNodeChildren(node: SyntaxNode, doc: EditorView['state']['doc']): void {
  console.groupCollapsed(`Children of '${node.type.name}' [${node.from}-${node.to}]:`);
  let cursor = node.firstChild;
  while (cursor) {
    console.log(`- Type=${cursor.type.name} [${cursor.from}-${cursor.to}] "${doc.sliceString(cursor.from, cursor.to)}"`);
    cursor = cursor.nextSibling;
  }
  console.groupEnd();
}