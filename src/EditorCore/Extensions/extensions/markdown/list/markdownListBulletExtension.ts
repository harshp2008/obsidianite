// src/extensions/listBulletExtension.ts
import { EditorView, Decoration, WidgetType, type DecorationSet } from '@codemirror/view';
import { StateField, type EditorState, Range, SelectionRange } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { SyntaxNode } from '@lezer/common';

// Tab size in spaces (requested indentation size)
const TAB_SIZE = 4;

// Helper to check if a selection range is directly adjacent to or inside a given range
function isCursorAdjacentOrInside(selectionRange: SelectionRange, from: number, to: number): boolean {
  // Check if cursor is directly to the left (from - 1) or right (to + 1)
  const isAdjacent = (selectionRange.from === from || selectionRange.from === to ||
                      selectionRange.to === from || selectionRange.to === to);

  // Check if cursor/selection is anywhere within the range
  const isInside = selectionRange.from < to && selectionRange.to > from;

  return isAdjacent || isInside;
}

// Helper to calculate indentation level from spaces
function getIndentationLevel(text: string): number {
  let spaces = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ' ') {
      spaces++;
    } else {
      break;
    }
  }
  
  // Calculate level based on our 4-space indentation
  return Math.floor(spaces / TAB_SIZE);
}

// Check if a list item is empty (just has a list mark but no content)
function isEmptyListItem(state: EditorState, listItemNode: SyntaxNode): boolean {
  // Get the text content of the list item
  const content = state.sliceDoc(listItemNode.from, listItemNode.to).trim();
  
  // Check if it's just a list marker with no content
  // Unordered list markers: -, +, *
  // Ordered list markers: number followed by . or )
  const emptyPatterns = [
    /^(-|\+|\*)\s*$/,      // Empty unordered list items
    /^(\d+\.|\d+\))\s*$/   // Empty ordered list items
  ];
  
  return emptyPatterns.some(pattern => pattern.test(content));
}

// Check if a line is likely to be a list item even if not parsed as one
function isLikelyListLine(state: EditorState, linePos: number): boolean {
  const line = state.doc.lineAt(linePos);
  const lineText = line.text.trim();
  
  // Check for common list markers
  return lineText.startsWith('-') || 
         lineText.startsWith('*') || 
         lineText.startsWith('+') ||
         /^\d+\./.test(lineText);
}

// Create a synthetic list marker when none exists
function createSyntheticListMark(state: EditorState, linePos: number): { from: number, to: number, type: string } | null {
  const line = state.doc.lineAt(linePos);
  const lineText = line.text;
  
  // Find where indentation ends
  let i = 0;
  while (i < lineText.length && lineText[i] === ' ') {
    i++;
  }
  
  // Check for list markers
  if (i < lineText.length) {
    const char = lineText[i];
    if (char === '-' || char === '*' || char === '+') {
      return { 
        from: line.from + i, 
        to: line.from + i + 1,
        type: 'bullet' 
      };
    }
    
    // Check for ordered list markers
    const match = lineText.slice(i).match(/^(\d+)\.(?:\s|$)/);
    if (match) {
      return {
        from: line.from + i,
        to: line.from + i + match[0].length,
        type: 'ordered'
      };
    }
  }
  
  return null;
}

// Define a custom WidgetType for our bullet (for inactive unordered lists)
class CustomBulletWidget extends WidgetType {
  constructor(private bulletChar: string = '•', private level: number = 0) {
    super();
  }

  eq(other: CustomBulletWidget) { 
    return other.bulletChar === this.bulletChar && other.level === this.level; 
  }

  toDOM() {
    const span = document.createElement('span');
    span.textContent = this.bulletChar;
    span.className = 'cm-custom-list-bullet';
    span.setAttribute('aria-hidden', 'true');
    span.setAttribute('data-level', this.level.toString());
    span.style.setProperty('--list-level', this.level.toString());
    return span;
  }

  ignoreEvent() { return true; } // Prevents widget from capturing editor events
}

// Process all lines that might be list items but aren't parsed as such
function processAllPossibleListLines(state: EditorState): Range<Decoration>[] {
  const decorations: Array<Range<Decoration>> = [];
  
  // Process each line
  for (let i = 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i);
    const indentMatch = line.text.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1].length : 0;
    const trimmed = line.text.slice(indent);
    const level = Math.floor(indent / TAB_SIZE);
    
    // Check if this line starts with a list marker but isn't already handled
    if (
      (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('+') || /^\d+\./.test(trimmed))
    ) {
      const markPos = line.from + indent;
      let isHandled = false;
      
      // Check if this line already has list decorations
      syntaxTree(state).iterate({
        from: line.from,
        to: line.to,
        enter: (node) => {
          if (node.type.name === 'ListItem' || node.type.name === 'ListMark') {
            isHandled = true;
            return false;
          }
        }
      });
      
      // If not already handled, add bullet decoration
      if (!isHandled) {
        // For bullet lists
        if (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('+')) {
          // Replace the original mark with a bullet
          decorations.push(
            Decoration.replace({ content: '•' }).range(markPos, markPos + 1)
          );
          
          // Add the empty list item class to the whole line
          decorations.push(
            Decoration.mark({
              class: `cm-empty-list-item cm-list-bullet-container cm-list-level-${level}`,
              attributes: { 'data-level': level.toString() },
              style: `--list-level: ${level}`
            }).range(line.from, line.to)
          );
        }
        // For ordered lists
        else if (/^\d+\./.test(trimmed)) {
          // Just add the ordered list marker class
          const match = trimmed.match(/^(\d+)\./);
          if (match) {
            decorations.push(
              Decoration.mark({
                class: `cm-ordered-list-mark cm-empty-list-item cm-list-level-${level}`,
                attributes: { 'data-level': level.toString() },
                style: `--list-level: ${level}`
              }).range(markPos, markPos + match[0].length)
            );
          }
        }
      }
    }
  }
  
  return decorations;
}

function createListBulletDecorations(state: EditorState): DecorationSet {
  const decorations: Array<Range<Decoration>> = [];
  const tree = syntaxTree(state);
  const { main: primarySelection } = state.selection;
  
  // Helper function to add a bullet decoration at a position
  function addBulletDecoration(pos: number, isEmpty: boolean = false, level: number = 0) {
    // Create the bullet widget
    decorations.push(
      Decoration.widget({
        widget: new CustomBulletWidget('•', level),
        side: 0
      }).range(pos)
    );
    
    // Add a class if the list item is empty
    if (isEmpty) {
      const line = state.doc.lineAt(pos);
      decorations.push(
        Decoration.mark({ 
          class: `cm-empty-list-item cm-list-bullet-container cm-list-level-${level}`,
          attributes: { 'data-level': level.toString() },
          style: `--list-level: ${level}`
        }).range(line.from, line.to)
      );
    }
  }

  // Helper to create an ordered list marker decoration
  function addOrderedListDecoration(from: number, to: number, isEmpty: boolean = false, level: number = 0) {
    decorations.push(
      Decoration.mark({ 
        class: `cm-ordered-list-mark cm-list-level-${level}`,
        attributes: { 'data-level': level.toString() },
        style: `--list-level: ${level}`
      }).range(from, to)
    );
    
    if (isEmpty) {
      const line = state.doc.lineAt(from);
      decorations.push(
        Decoration.mark({ 
          class: `cm-empty-list-item cm-list-level-${level}`,
          attributes: { 'data-level': level.toString() },
          style: `--list-level: ${level}`
        }).range(line.from, line.to)
      );
    }
  }
  
  // First pass: Process all lines that might be list items but aren't parsed as such
  decorations.push(...processAllPossibleListLines(state));

  // Process each visible ListItem node
  tree.iterate({
    from: 0,
    to: state.doc.length,
    enter: (nodeRef) => {
      const { node } = nodeRef;

      // First, handle list items
      if (node.type.name === 'ListItem') {
        const listItemFrom = node.from;
        const listItemTo = node.to;
        
        // Check if this list item is part of an OrderedList or BulletList
        let listType = '';
        let currentNode = node.parent;
        
        while (currentNode) {
          if (currentNode.type.name === 'OrderedList') {
            listType = 'ordered';
            break;
          } else if (currentNode.type.name === 'BulletList') {
            listType = 'bullet';
            break;
          }
          currentNode = currentNode.parent;
        }
        
        // Check if this is an empty list item
        const isEmpty = isEmptyListItem(state, node);
        
        // Get the text of the line to calculate indentation level
        const lineStart = state.doc.lineAt(listItemFrom).from;
        const lineText = state.sliceDoc(lineStart, listItemFrom);
        const indentLevel = getIndentationLevel(lineText);
        
        // Add indentation class to the list item
        decorations.push(
          Decoration.mark({
            class: `cm-list-item cm-list-level-${indentLevel}${isEmpty ? ' cm-empty-list-item' : ''}`,
            attributes: { 'data-level': indentLevel.toString() },
            style: `--list-level: ${indentLevel}`
          }).range(listItemFrom, listItemTo)
        );
        
        // For empty list items that might not have proper mark nodes
        if (isEmpty && listType === 'bullet') {
          // Look for a list mark in this item
          let hasListMark = false;
          let markPos = listItemFrom;
          
          // Check if this ListItem has a ListMark child
          for (let cursor = node.cursor(); cursor.firstChild();) {
            if (cursor.type.name === 'ListMark') {
              hasListMark = true;
              markPos = cursor.from;
              break;
            }
          }
          
          // If no list mark was found, create a synthetic one
          if (!hasListMark) {
            const syntheticMark = createSyntheticListMark(state, listItemFrom);
            if (syntheticMark && syntheticMark.type === 'bullet') {
              addBulletDecoration(syntheticMark.from, true, indentLevel);
            }
          }
        }
      }
      
      // Now handle ListMark nodes
      if (node.type.name === 'ListMark') {
        const listMarkFrom = node.from;
        const listMarkTo = node.to;

        // Find the parent list type (BulletList or OrderedList)
        let parentListNode: SyntaxNode | null = null;
        let listItemNode: SyntaxNode | null = null;
        let currentParent = node.parent;
        
        // Traverse up: ListMark -> ListItem -> (BulletList/OrderedList)
        if (currentParent && currentParent.type.name === 'ListItem') {
            listItemNode = currentParent;
            parentListNode = currentParent.parent;
        }

        // If not part of a valid list structure, skip
        if (!parentListNode || !listItemNode) {
            return;
        }

        // Check if this is an empty list item
        const isEmpty = listItemNode && isEmptyListItem(state, listItemNode);
        
        // Get the indentation level
        const lineStart = state.doc.lineAt(listMarkFrom).from;
        const lineText = state.sliceDoc(lineStart, listMarkFrom);
        const indentLevel = getIndentationLevel(lineText);
        
        // Add a class for empty list items
        if (isEmpty) {
          const line = state.doc.lineAt(listMarkFrom);
          decorations.push(
            Decoration.mark({ 
              class: `cm-empty-list-item cm-list-level-${indentLevel}`,
              attributes: { 'data-level': indentLevel.toString() },
              style: `--list-level: ${indentLevel}`
            }).range(line.from, line.to)
          );
        }

        // --- Ordered Lists: Always show the original number ---
        if (parentListNode.type.name === 'OrderedList') {
            // For ordered lists, add a class for styling
            addOrderedListDecoration(listMarkFrom, listMarkTo, isEmpty, indentLevel);
            return;
        }

        // --- Unordered Lists: Always show bullet, even when empty ---
        if (parentListNode.type.name === 'BulletList') {
            // Check if cursor is directly adjacent to or inside the ListMark range
            const cursorIsAdjacentToMark = isCursorAdjacentOrInside(primarySelection, listMarkFrom, listMarkTo);

            if (cursorIsAdjacentToMark) {
                // When cursor is adjacent, do NOT hide the mark
                // This allows the original markdown character ('-', '+', '*') to be visible.
                decorations.push(
                  Decoration.mark({ 
                    class: `cm-list-mark-active cm-list-level-${indentLevel}`,
                    attributes: { 'data-level': indentLevel.toString() },
                    style: `--list-level: ${indentLevel}`
                  }).range(listMarkFrom, listMarkTo)
                );
            } else {
                // When cursor is NOT adjacent, replace the original mark and insert the custom bullet.
                // 1. Replace the actual markdown list mark characters with zero-width spaces.
                for (let i = listMarkFrom; i < listMarkTo; i++) {
                    decorations.push(Decoration.replace({ content: '​' }).range(i, i + 1));
                }

                // 2. Insert the custom bullet widget at the start of the original mark's position.
                addBulletDecoration(listMarkFrom, isEmpty, indentLevel);
            }
            
            // Always ensure there's proper styling for the list item that contains this mark
            if (listItemNode) {
              decorations.push(
                Decoration.mark({ 
                  class: `cm-list-bullet-container cm-list-level-${indentLevel}${isEmpty ? ' cm-empty-list-item' : ''}`,
                  attributes: { 'data-level': indentLevel.toString() },
                  style: `--list-level: ${indentLevel}`
                }).range(listItemNode.from, listItemNode.to)
              );
            }
        }
      }
    }
  });
  
  // Handle standalone list marker lines like lone "-" that might not be parsed as list items
  for (let i = 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i);
    const trimmed = line.text.trim();
    
    // Handle any standalone list markers: "-" without content
    if (trimmed === '-' || trimmed === '*' || trimmed === '+') {
      // Check if this line was already handled
      let alreadyHandled = false;
      tree.iterate({
        from: line.from,
        to: line.to,
        enter: (node) => {
          if (node.type.name === 'ListItem' || node.type.name === 'ListMark') {
            alreadyHandled = true;
            return false;
          }
        }
      });
      
      if (!alreadyHandled) {
        // Find the position of the marker
        const indentMatch = line.text.match(/^(\s*)/);
        const indentLength = indentMatch ? indentMatch[1].length : 0;
        const markPos = line.from + indentLength;
        const level = Math.floor(indentLength / TAB_SIZE);
        
        // Replace the marker with a bullet point
        decorations.push(
          Decoration.replace({ 
            content: '•'
          }).range(markPos, markPos + 1)
        );
        
        // Apply styling to the whole line
        decorations.push(
          Decoration.mark({
            class: `cm-list-item cm-empty-list-item cm-list-bullet-container cm-list-level-${level}`,
            attributes: { 'data-level': level.toString() },
            style: `--list-level: ${level}`
          }).range(line.from, line.to)
        );
      }
    }
  }
  
  return Decoration.set(decorations, true);
}

export const listBulletExtension = StateField.define<DecorationSet>({
  create(state) {
    return createListBulletDecorations(state);
  },
  update(decorations, transaction) {
    // Recompute decorations if document content or selection changes
    if (transaction.docChanged || transaction.selection) {
      return createListBulletDecorations(transaction.state);
    }
    return decorations;
  },
  provide: (field) => EditorView.decorations.from(field),
});