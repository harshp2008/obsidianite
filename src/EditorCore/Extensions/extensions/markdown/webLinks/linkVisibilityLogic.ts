// src/extensions/linkVisibilityLogic.ts

import { EditorView } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';
import { SyntaxNode } from '@lezer/common';

// Helper: Checks if two ranges intersect
function intersects(range1From: number, range1To: number, range2From: number, range2To: number): boolean {
  return range1From < range2To && range1To > range2From;
}

// Helper: Determines if the cursor is strictly inside the link's effective content (text or URL)
function isCursorInsideLinkContent(selection: EditorSelection, linkNode: SyntaxNode): boolean {
  const linkTextNode = linkNode.getChild('LinkText');
  const urlNode = linkNode.getChild('URL');

  // Check if selection is within LinkText
  if (linkTextNode && selection.main.from >= linkTextNode.from && selection.main.to <= linkTextNode.to) {
    return true;
  }

  // Check if selection is within URL
  if (urlNode && selection.main.from >= urlNode.from && selection.main.to <= urlNode.to) {
    return true;
  }

  return false;
}

// Helper: Determines if the cursor is at the exact boundary of the link node
function isCursorAtLinkBoundary(selection: EditorSelection, linkNode: SyntaxNode): boolean {
  return selection.main.empty && (
    selection.main.head === linkNode.from || selection.main.head === linkNode.to
  );
}

// Helper: Determines if the cursor is adjacent to the link (within 1 character) but outside its main bounds
// This function will be adjusted to reduce "proximity" for links.
function isCursorAdjacentToLink(selection: EditorSelection, linkNode: SyntaxNode): boolean {
  if (!selection.main.empty) return false; // Only for empty cursors

  const cursorPos = selection.main.head;
  const linkFrom = linkNode.from;
  const linkTo = linkNode.to;

  // We want to remove the 'one character away' rule.
  // The cursor must be *at* the boundary, not one step away.
  return cursorPos === linkFrom || cursorPos === linkTo;
}

// Helper: Determines if the link text is empty (i.e., [])
function isLinkTextEmpty(view: EditorView, linkNode: SyntaxNode): boolean {
  const doc = view.state.doc;
  let openBracketNode: SyntaxNode | null = null;
  let closeBracketNode: SyntaxNode | null = null;
  
  // Find bracket nodes
  let currentChild = linkNode.firstChild;
  while (currentChild) {
    if (currentChild.type.name === 'LinkMark') {
      const markText = doc.sliceString(currentChild.from, currentChild.to);
      if (markText === '[') {
        openBracketNode = currentChild;
      } else if (markText === ']') {
        closeBracketNode = currentChild;
      }
    }
    currentChild = currentChild.nextSibling;
  }
  
  // Check if brackets exist and if there's text between them
  if (openBracketNode && closeBracketNode && openBracketNode.to < closeBracketNode.from) {
    const linkText = doc.sliceString(openBracketNode.to, closeBracketNode.from).trim();
    return linkText.length === 0;
  }
  
  return false;
}

// Helper: Check if URL part is incomplete (missing closing parenthesis)
function isUrlPartIncomplete(view: EditorView, linkNode: SyntaxNode): boolean {
  const doc = view.state.doc;
  let hasOpenParen = false;
  let hasCloseParen = false;
  
  let currentChild = linkNode.firstChild;
  while (currentChild) {
    if (currentChild.type.name === 'LinkMark') {
      const markText = doc.sliceString(currentChild.from, currentChild.to);
      if (markText === '(') hasOpenParen = true;
      if (markText === ')') hasCloseParen = true;
    }
    currentChild = currentChild.nextSibling;
  }
  
  return hasOpenParen && !hasCloseParen;
}


/**
 * Determines whether the raw markdown of a link should be shown instead of the transformed widget.
 *
 * @param view The EditorView instance.
 * @param linkNode The SyntaxNode representing the 'Link'.
 * @returns True if raw markdown should be shown, false otherwise.
 */
export function shouldShowRawMarkdown(view: EditorView, linkNode: SyntaxNode): boolean {
  const { state } = view;
  const selection = state.selection;

  // Rule 0: If the link text is empty, don't show raw markdown anymore
  // We'll handle empty links with CSS styling instead
  // if (isLinkTextEmpty(view, linkNode)) {
  //   return true;
  // }
  
  // Rule 0.5: If URL part is incomplete (e.g., "[](" without closing ")"), show raw
  if (isUrlPartIncomplete(view, linkNode)) {
    return true;
  }

  // Rule 1: If any part of the selection overlaps with the entire link node, show raw.
  for (const range of selection.ranges) {
    if (intersects(range.from, range.to, linkNode.from, linkNode.to)) {
      // console.log("Showing Raw: Selection intersects entire link.", { range, linkNode }); // Debugging
      return true;
    }
  }

  // Rule 2: If the cursor is strictly inside the LinkText or URL nodes, show raw.
  // This handles cases like `[cursor|text](url)` or `[text](cursor|url)`.
  if (isCursorInsideLinkContent(selection, linkNode)) {
    // console.log("Showing Raw: Cursor inside LinkText or URL content.", { selection, linkNode }); // Debugging
    return true;
  }

  // Rule 3: If the cursor is at the exact start or end boundary of the link node, show raw.
  // This handles cases like `|[text](url)` or `[text](url)|`.
  if (isCursorAtLinkBoundary(selection, linkNode)) {
    // console.log("Showing Raw: Cursor at exact link boundary.", { selection, linkNode }); // Debugging
    return true;
  }

  // Rule 4: If the cursor is an empty selection and immediately adjacent (within 1 character)
  // to the overall link node, show raw.
  // This is the rule for "proximity" that we are tightening.
  // AFTER ADJUSTMENT: This will now only catch if the cursor is EXACTLY at the boundary,
  // effectively making Rule 3 and Rule 4 for empty selections behave very similarly,
  // but keeping `isCursorAdjacentToLink` for semantic clarity if other "proximity" needs arise.
  if (isCursorAdjacentToLink(selection, linkNode)) {
    // console.log("Showing Raw: Cursor adjacent to link (tightened proximity).", { selection, linkNode }); // Debugging
    return true;
  }

  // Default: If none of the above conditions are met, show the transformed widget.
  return false;
}