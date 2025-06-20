// src/extensions/markdownSyntaxHiding/helpers.ts

import { SelectionRange } from '@codemirror/state';
import { SyntaxNode } from '@lezer/common';

/**
 * Checks if a selection range intersects with a node's range.
 * @param selectionRange The CodeMirror SelectionRange.
 * @param nodeFrom The start position of the node.
 * @param nodeTo The end position of the node.
 * @returns True if there's an intersection, false otherwise.
 */
export function intersects(selectionRange: SelectionRange, nodeFrom: number, nodeTo: number): boolean {
  // A range [A, B) intersects with [C, D) if A < D and B > C
  return selectionRange.from < nodeTo && selectionRange.to > nodeFrom;
}

/**
 * Checks if the cursor head is adjacent to a node (at its start or end boundary).
 * @param head The cursor head position.
 * @param nodeFrom The start position of the node.
 * @param nodeTo The end position of the node.
 * @returns True if the cursor is adjacent, false otherwise.
 */
export function isCursorAdjacent(head: number, nodeFrom: number, nodeTo: number): boolean {
  return head === nodeFrom || head === nodeTo;
}

/**
 * Checks if the cursor head is within or at the boundaries of a given syntax node.
 * This is useful for determining if a marker's parent content is being interacted with.
 * @param head The cursor head position.
 * @param node The SyntaxNode to check against.
 * @returns True if the cursor is within or at the boundaries of the node, false otherwise.
 */
export function isCursorInNode(head: number, node: SyntaxNode): boolean {
    return head >= node.from && head <= node.to;
}

// Define common content node names whose markers should show if cursor is within them
export const CONTENT_NODE_NAMES_FOR_MARKER_REVEAL = new Set([
    "StrongEmphasis",
    "Emphasis",
    "InlineCode",
    "URL",
    "Highlight",
    "Strikethrough",
    "ATXHeading",
    "Blockquote",
    // Add other relevant inline/block parent types here if needed for broader reveal
]);