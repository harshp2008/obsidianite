import { EditorView, keymap } from '@codemirror/view';
import { EditorState, EditorSelection, SelectionRange } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';

// Tab size in spaces (requested indentation size)
const TAB_SIZE = 4;

/**
 * Checks if the cursor is on a list item line
 */
function isOnListLine(state: EditorState, pos: number): boolean {
  const line = state.doc.lineAt(pos);
  const tree = syntaxTree(state);
  let isListItem = false;

  tree.iterate({
    from: line.from,
    to: line.to,
    enter: (nodeRef) => {
      // Check if the node is a list-related node
      const node = nodeRef.node;
      if (node.type.name === 'ListItem' || 
          node.type.name === 'ListMark' ||
          node.type.name === 'BulletList' ||
          node.type.name === 'OrderedList') {
        isListItem = true;
        return false; // Stop iteration once we found a list item
      }
    }
  });
  
  // If not found through parse tree, check line content directly
  if (!isListItem) {
    const text = state.sliceDoc(line.from, line.to).trimStart();
    if (text.startsWith('-') || 
        text.startsWith('*') || 
        text.startsWith('+') ||
        /^\d+\./.test(text)) {
      isListItem = true;
    }
  }

  return isListItem;
}

/**
 * Check if the cursor is on an ordered list item
 */
function isOrderedListItem(state: EditorState, pos: number): boolean {
  const line = state.doc.lineAt(pos);
  const tree = syntaxTree(state);
  let isOrderedList = false;

  tree.iterate({
    from: line.from,
    to: line.to,
    enter: (nodeRef) => {
      // Find OrderedList node
      const node = nodeRef.node;
      if (node.type.name === 'OrderedList') {
        isOrderedList = true;
        return false;
      }
    }
  });
  
  // If not found in parse tree, check text directly
  if (!isOrderedList) {
    const text = state.sliceDoc(line.from, line.to).trimStart();
    if (/^\d+\./.test(text)) {
      isOrderedList = true;
    }
  }

  return isOrderedList;
}

/**
 * Find the indentation level at the start of a line
 */
function getIndentationAtLine(state: EditorState, pos: number): number {
  const line = state.doc.lineAt(pos);
  const lineContent = line.text;
  
  // Count leading spaces
  let indentSize = 0;
  for (let i = 0; i < lineContent.length; i++) {
    if (lineContent[i] === ' ') {
      indentSize++;
    } else {
      break;
    }
  }
  
  return indentSize;
}

/**
 * Get the list mark and number from an ordered list item
 */
function getOrderedListMark(state: EditorState, pos: number): { from: number, to: number, number: number } | null {
  const line = state.doc.lineAt(pos);
  const lineContent = line.text;
  
  // Find where the indentation ends
  let i = 0;
  while (i < lineContent.length && lineContent[i] === ' ') {
    i++;
  }
  
  // Check if this looks like an ordered list item (starts with a number followed by a dot)
  const match = lineContent.slice(i).match(/^(\d+)\.\s/);
  if (match) {
    const number = parseInt(match[1], 10);
    const from = line.from + i;
    const to = from + match[0].length;
    return { from, to, number };
  }
  
  return null;
}

/**
 * Update ordered list numbers after indentation changes
 */
function updateOrderedListNumbers(view: EditorView, linePos: number): void {
  const state = view.state;
  const currentLine = state.doc.lineAt(linePos);
  const currentIndent = getIndentationAtLine(state, linePos);
  const changes = [];
  
  // Find all ordered list items at the same indentation level
  const orderedItems: {pos: number, number: number}[] = [];
  
  // First, check the current line
  if (isOrderedListItem(state, linePos)) {
    const mark = getOrderedListMark(state, linePos);
    if (mark) {
      orderedItems.push({pos: linePos, number: mark.number});
    }
  }
  
  // Look for subsequent ordered list items at the same level
  for (let i = currentLine.number + 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i);
    const indent = getIndentationAtLine(state, line.from);
    
    // If we find a line with less indentation, stop looking
    if (indent < currentIndent) break;
    
    // If we find a line with the same indentation that's an ordered list
    if (indent === currentIndent && isOrderedListItem(state, line.from)) {
      const mark = getOrderedListMark(state, line.from);
      if (mark) {
        orderedItems.push({pos: line.from, number: mark.number});
      }
    }
  }
  
  // Update numbers to be sequential
  for (let i = 0; i < orderedItems.length; i++) {
    const item = orderedItems[i];
    const mark = getOrderedListMark(state, item.pos);
    
    if (mark && mark.number !== i + 1) {
      changes.push({
        from: mark.from,
        to: mark.from + mark.number.toString().length,
        insert: (i + 1).toString()
      });
    }
  }
  
  if (changes.length > 0) {
    view.dispatch({ changes });
  }
}

/**
 * Snaps cursor position to nearest tab stop
 */
function snapToNearestTabStop(spaces: number, forward: boolean): number {
  const remainder = spaces % TAB_SIZE;
  
  if (remainder === 0) {
    // Already at a tab stop
    return forward ? spaces + TAB_SIZE : Math.max(0, spaces - TAB_SIZE);
  }
  
  // Snap to previous or next tab stop
  return forward
    ? spaces + (TAB_SIZE - remainder)  // Snap forward to next tab stop
    : Math.max(0, spaces - remainder); // Snap backward to previous tab stop
}

/**
 * Handle tab key for indenting lists
 */
function handleTab(view: EditorView): boolean {
  const state = view.state;
  const { selection } = state;
  
  // Check if cursor is on a list item
  if (!isOnListLine(state, selection.main.from)) {
    return false;
  }
  
  const changes = [];
  const newSelection: SelectionRange[] = [];

  // Process each selection range
  for (const range of selection.ranges) {
    const line = state.doc.lineAt(range.from);
    const currentIndent = getIndentationAtLine(state, range.from);
    const newIndent = snapToNearestTabStop(currentIndent, true);
    
    const isOrderedList = isOrderedListItem(state, range.from);
    
    if (newIndent !== currentIndent) {
      const indentChange = newIndent - currentIndent;
      
      if (indentChange > 0) {
        // Add spaces to increase indentation
        const spacesToAdd = ' '.repeat(indentChange);
        changes.push({
          from: line.from,
          insert: spacesToAdd
        });
        
        // If it's an ordered list item and we're indenting, reset the number to 1
        if (isOrderedList) {
          const listMark = getOrderedListMark(state, range.from);
          if (listMark) {
            // Replace the number with 1
            changes.push({
              from: listMark.from,
              to: listMark.from + listMark.number.toString().length,
              insert: "1"
            });
          }
        }
        
        // Adjust selection position after adding spaces
        newSelection.push(EditorSelection.range(
          range.from + indentChange,
          range.to + indentChange
        ));
      }
    } else {
      // No change in indentation, keep the selection as is
      newSelection.push(range);
    }
  }
  
  if (changes.length > 0) {
    view.dispatch({
      changes,
      selection: EditorSelection.create(newSelection)
    });
    return true;
  }
  
  return false;
}

/**
 * Handle shift+tab to decrease indentation
 */
function handleShiftTab(view: EditorView): boolean {
  const state = view.state;
  const { selection } = state;
  
  // Check if cursor is on a list item
  if (!isOnListLine(state, selection.main.from)) {
    return false;
  }
  
  const changes = [];
  const newSelection: SelectionRange[] = [];
  let updateListNumbersPos: number | null = null;

  // Process each selection range
  for (const range of selection.ranges) {
    const line = state.doc.lineAt(range.from);
    const currentIndent = getIndentationAtLine(state, range.from);
    
    if (currentIndent > 0) {
      const newIndent = snapToNearestTabStop(currentIndent, false);
      const indentChange = currentIndent - newIndent;
      
      if (indentChange > 0) {
        // Remove spaces to decrease indentation
        changes.push({
          from: line.from,
          to: line.from + indentChange,
          insert: ''
        });
        
        // If this is an ordered list item, mark it for number updating
        if (isOrderedListItem(state, line.from)) {
          updateListNumbersPos = line.from;
        }
        
        // Adjust selection position after removing spaces
        const newFrom = Math.max(line.from, range.from - indentChange);
        const newTo = Math.max(line.from, range.to - indentChange);
        newSelection.push(EditorSelection.range(newFrom, newTo));
      } else {
        // No change in indentation, keep the selection as is
        newSelection.push(range);
      }
    } else {
      // No indentation to remove, keep the selection as is
      newSelection.push(range);
    }
  }
  
  if (changes.length > 0) {
    view.dispatch({
      changes,
      selection: EditorSelection.create(newSelection)
    });
    
    // Update ordered list numbers if needed
    if (updateListNumbersPos !== null) {
      setTimeout(() => {
        updateOrderedListNumbers(view, updateListNumbersPos!);
      }, 10);
    }
    
    return true;
  }
  
  return false;
}

/**
 * List indentation extension
 */
export const listIndentationExtension = keymap.of([
  { key: 'Tab', run: handleTab },
  { key: 'Shift-Tab', run: handleShiftTab }
]); 