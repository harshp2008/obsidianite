import { EditorState, SelectionRange, EditorSelection, StateField, Extension } from '@codemirror/state';
import { KeyBinding, keymap, EditorView } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { SyntaxNode } from '@lezer/common';

// Default tab size in spaces
const DEFAULT_TAB_SIZE = 8;

/**
 * Configuration for atomic indentation
 */
interface AtomicIndentConfig {
  tabSize: number; // Size of a tab in spaces
  nodeTypes: string[]; // Node types to apply indentation to
}

/**
 * Default configuration
 */
const defaultConfig: AtomicIndentConfig = {
  tabSize: DEFAULT_TAB_SIZE,
  nodeTypes: ['ListItem', 'BulletList', 'OrderedList', 'Blockquote'] // Extended node types
};

/**
 * Check if the position is within a node of the specified types or their children
 * This is a more thorough check than before
 */
function isInNodeTypes(state: EditorState, pos: number, nodeTypes: string[]): boolean {
  const tree = syntaxTree(state);
  let found = false;
  
  // First, check exact position
  tree.iterate({
    from: pos,
    to: pos,
    enter: (node) => {
      // Check current node and all parents
      let current: SyntaxNode | null = node.node;
      while (current && !found) {
        if (nodeTypes.includes(current.type.name)) {
          found = true;
          return false;
        }
        current = current.parent;
      }
    }
  });
  
  // If not found, check the line for list markers
  if (!found) {
    const line = state.doc.lineAt(pos);
    const lineText = line.text;
    
    // If the line starts with list markers or spaces + list markers, consider it a list line
    const trimmed = lineText.trimStart();
    if (
      trimmed.startsWith('-') || 
      trimmed.startsWith('*') || 
      trimmed.startsWith('+') ||
      /^\d+\./.test(trimmed)
    ) {
      found = true;
    }
  }

  return found;
}

/**
 * Get indentation level at a given position
 */
function getIndentationAtPos(state: EditorState, pos: number, tabSize: number): number {
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
 * Get the list mark info for an ordered list item
 */
function getOrderedListMark(state: EditorState, pos: number): { from: number, to: number, number: number } | null {
  const line = state.doc.lineAt(pos);
  const lineText = line.text;
  
  // Find where the indentation ends
  let i = 0;
  while (i < lineText.length && lineText[i] === ' ') {
    i++;
  }
  
  // Check if this looks like an ordered list item (starts with a number followed by a dot)
  const match = lineText.slice(i).match(/^(\d+)\.\s/);
  if (match) {
    const number = parseInt(match[1], 10);
    const from = line.from + i;
    const to = from + match[0].length;
    return { from, to, number };
  }
  
  return null;
}

/**
 * Determine if a line is an ordered list item
 */
function isOrderedListItem(state: EditorState, pos: number): boolean {
  const tree = syntaxTree(state);
  let isOrderedList = false;

  // Check if we're in an OrderedList node
  tree.iterate({
    from: pos,
    to: pos,
    enter: (node) => {
      let current: SyntaxNode | null = node.node;
      while (current && !isOrderedList) {
        if (current.type.name === 'OrderedList') {
          isOrderedList = true;
          return false;
        }
        current = current.parent;
      }
    }
  });
  
  // If not found through parse tree, check line content directly
  if (!isOrderedList) {
    const line = state.doc.lineAt(pos);
    const trimmed = line.text.trimStart();
    isOrderedList = /^\d+\./.test(trimmed);
  }
  
  return isOrderedList;
}

/**
 * Find the next ordered list item in the same indentation level
 */
function findNextOrderedListItem(state: EditorState, pos: number): { from: number, to: number, number: number } | null {
  const currentLine = state.doc.lineAt(pos);
  const currentIndent = getIndentationAtPos(state, pos, DEFAULT_TAB_SIZE);
  
  // Look at lines after the current one
  for (let i = currentLine.number + 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i);
    const indent = getIndentationAtPos(state, line.from, DEFAULT_TAB_SIZE);
    
    // If we find a line with less indentation, stop looking
    if (indent < currentIndent) break;
    
    // If we find a line with the same indentation that's an ordered list
    if (indent === currentIndent && isOrderedListItem(state, line.from)) {
      const mark = getOrderedListMark(state, line.from);
      if (mark) return mark;
    }
  }
  
  return null;
}

/**
 * Snap to the nearest tab stop
 */
function snapToNearestTabStop(spaces: number, forward: boolean, tabSize: number): number {
  const remainder = spaces % tabSize;
  
  if (remainder === 0) {
    // Already at a tab stop
    return forward ? spaces + tabSize : Math.max(0, spaces - tabSize);
  }
  
  // Snap to previous or next tab stop
  return forward
    ? spaces + (tabSize - remainder) // Snap forward to next tab stop
    : Math.max(0, spaces - remainder); // Snap backward to previous tab stop, never below 0
}

/**
 * Handle tab key to increase indentation
 */
function handleTab(view: EditorView, config: AtomicIndentConfig): boolean {
  const state = view.state;
  const { selection } = state;
  
  // Check if cursor is in a supported node type
  if (!isInNodeTypes(state, selection.main.from, config.nodeTypes)) {
    return false; 
  }
  
  const changes = [];
  const newSelection: SelectionRange[] = [];

  // Process each selection range
  for (const range of selection.ranges) {
    const line = state.doc.lineAt(range.from);
    const currentIndent = getIndentationAtPos(state, range.from, config.tabSize);
    const newIndent = snapToNearestTabStop(currentIndent, true, config.tabSize);
    
    // Check if this is an ordered list item
    const isOrdered = isOrderedListItem(state, range.from);
    
    if (newIndent !== currentIndent) {
      const indentChange = newIndent - currentIndent;
      
      if (indentChange > 0) {
        // Add spaces to increase indentation
        const spacesToAdd = ' '.repeat(indentChange);
        changes.push({
          from: line.from,
          insert: spacesToAdd
        });
        
        // If it's an ordered list item, reset the number to 1
        if (isOrdered) {
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
      // No change in indentation, keep selection as is
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
 * Update the numbers of ordered list items when unindenting
 * This function updates the next list items in sequence
 */
function updateOrderedListNumbers(view: EditorView, linePos: number, startNumber: number = 1): void {
  const state = view.state;
  const currentIndent = getIndentationAtPos(state, linePos, DEFAULT_TAB_SIZE);
  const currentLine = state.doc.lineAt(linePos);
  const changes = [];
  
  // Set the first item's number
  const firstMark = getOrderedListMark(state, linePos);
  if (firstMark && firstMark.number !== startNumber) {
    changes.push({
      from: firstMark.from,
      to: firstMark.from + firstMark.number.toString().length,
      insert: startNumber.toString()
    });
  }
  
  // Update subsequent items in the same indentation level
  let nextNumber = startNumber + 1;
  for (let i = currentLine.number + 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i);
    const indent = getIndentationAtPos(state, line.from, DEFAULT_TAB_SIZE);
    
    // If we find a line with less indentation, stop looking
    if (indent < currentIndent) break;
    
    // If we find a line with the same indentation that's an ordered list
    if (indent === currentIndent && isOrderedListItem(state, line.from)) {
      const mark = getOrderedListMark(state, line.from);
      if (mark && mark.number !== nextNumber) {
        changes.push({
          from: mark.from,
          to: mark.from + mark.number.toString().length,
          insert: nextNumber.toString()
        });
      }
      nextNumber++;
    }
  }
  
  if (changes.length > 0) {
    view.dispatch({ changes });
  }
}

/**
 * Handle shift+tab to decrease indentation
 */
function handleShiftTab(view: EditorView, config: AtomicIndentConfig): boolean {
  const state = view.state;
  const { selection } = state;
  
  // Check if cursor is in a supported node type
  if (!isInNodeTypes(state, selection.main.from, config.nodeTypes)) {
    return false;
  }
  
  const changes = [];
  const newSelection: SelectionRange[] = [];
  let updateListNumbers = false;
  let updatePosition = 0;

  // Process each selection range
  for (const range of selection.ranges) {
    const line = state.doc.lineAt(range.from);
    const currentIndent = getIndentationAtPos(state, range.from, config.tabSize);
    
    // Check if this is an ordered list item
    const isOrdered = isOrderedListItem(state, range.from);
    
    if (currentIndent > 0) {
      const newIndent = snapToNearestTabStop(currentIndent, false, config.tabSize);
      const indentChange = currentIndent - newIndent;
      
      if (indentChange > 0) {
        // Remove spaces to decrease indentation
        changes.push({
          from: line.from,
          to: line.from + indentChange,
          insert: ''
        });
        
        // Flag to update ordered list numbers after unindenting
        if (isOrdered) {
          updateListNumbers = true;
          updatePosition = line.from;
        }
        
        // Adjust selection position after removing spaces
        const newFrom = Math.max(line.from, range.from - indentChange);
        const newTo = Math.max(line.from, range.to - indentChange);
        newSelection.push(EditorSelection.range(newFrom, newTo));
      } else {
        // No change in indentation, keep selection as is
        newSelection.push(range);
      }
    } else {
      // No indentation to remove, keep selection as is
      newSelection.push(range);
    }
  }
  
  if (changes.length > 0) {
    view.dispatch({
      changes,
      selection: EditorSelection.create(newSelection)
    });
    
    // Update ordered list numbers after the indentation changes have been applied
    if (updateListNumbers) {
      // Use setTimeout to ensure this runs after the indentation changes are applied
      setTimeout(() => updateOrderedListNumbers(view, updatePosition), 10);
    }
    
    return true;
  }
  
  return false;
}

/**
 * Handle left/right arrows to snap cursor to tab stops
 */
function handleArrow(view: EditorView, forward: boolean, config: AtomicIndentConfig): boolean {
  const state = view.state;
  const { selection } = state;
  
  // Only handle single cursor
  if (selection.ranges.length !== 1) return false;
  
  const range = selection.main;
  if (!range.empty) return false; // Only handle collapsed cursor
  
  const line = state.doc.lineAt(range.from);
  
  // Check if we're in a supported node type
  if (!isInNodeTypes(state, range.from, config.nodeTypes)) {
    return false;
  }
  
  const lineContent = line.text;
  const cursorCol = range.from - line.from;
  
  // Special handling for left arrow at beginning of content (after indentation)
  if (!forward && cursorCol > 0) {
    let i = 0;
    while (i < lineContent.length && lineContent[i] === ' ') {
      i++;
    }
    
    // If we're right after the indentation and pressing left,
    // snap to the last tab stop in the indentation
    if (cursorCol === i) {
      const indentSize = getIndentationAtPos(state, range.from, config.tabSize);
      if (indentSize > 0) {
        const newCol = Math.floor(indentSize / config.tabSize) * config.tabSize;
        view.dispatch({
          selection: EditorSelection.cursor(line.from + newCol)
        });
        return true;
      }
    }
  }
  
  // Only handle if in the indentation area
  let onlySpacesBefore = true;
  for (let i = 0; i < cursorCol; i++) {
    if (lineContent[i] !== ' ') {
      onlySpacesBefore = false;
      break;
    }
  }
  
  if (!onlySpacesBefore) return false;
  
  // For right arrow, check if the next character would still be a space
  if (forward && (cursorCol >= lineContent.length || lineContent[cursorCol] !== ' ')) {
    // If we're at the end of spaces and pressing right arrow,
    // move to the actual content
    let i = cursorCol;
    while (i < lineContent.length && lineContent[i] === ' ') {
      i++;
    }
    
    if (i > cursorCol) {
      view.dispatch({
        selection: EditorSelection.cursor(line.from + i)
      });
      return true;
    }
    return false;
  }
  
  // Snap to previous or next tab stop
  const newCol = snapToNearestTabStop(cursorCol, forward, config.tabSize);
  
  if (newCol !== cursorCol) {
    view.dispatch({
      selection: EditorSelection.cursor(line.from + newCol)
    });
    return true;
  }
  
  return false;
}

/**
 * Create a state field to track atomic indentation
 */
const atomicIndentState = StateField.define<boolean>({
  create: () => false,
  update: (value, tr) => tr.selection ? true : value,
  compare: (a, b) => a === b,
  provide: () => EditorView.updateListener.of(update => {
    if (update.selectionSet) {
      // Force cursor snapping when selection changes
      const view = update.view;
      const pos = view.state.selection.main.from;
      const line = view.state.doc.lineAt(pos);
      const cursorCol = pos - line.from;
      
      // Check if we're in indentation area
      let onlySpacesBefore = true;
      for (let i = 0; i < cursorCol; i++) {
        const lineContent = line.text;
        if (i < lineContent.length && lineContent[i] !== ' ') {
          onlySpacesBefore = false;
          break;
        }
      }
      
      // If in indentation area of a list, snap cursor
      if (onlySpacesBefore && isInNodeTypes(view.state, pos, defaultConfig.nodeTypes)) {
        const newCol = snapToNearestTabStop(cursorCol, false, defaultConfig.tabSize);
        if (newCol !== cursorCol) {
          view.dispatch({
            selection: EditorSelection.cursor(line.from + newCol)
          });
        }
      }
    }
  })
});

/**
 * Create atom indent extension with custom configuration
 */
export function atomicIndent(config: Partial<AtomicIndentConfig> = {}): Extension {
  // Merge with default config
  const fullConfig = { ...defaultConfig, ...config };
  
  // Create keybindings
  const indentKeymap: KeyBinding[] = [
    { key: 'Tab', run: (view) => handleTab(view, fullConfig) },
    { key: 'Shift-Tab', run: (view) => handleShiftTab(view, fullConfig) },
    { key: 'ArrowLeft', run: (view) => handleArrow(view, false, fullConfig) },
    { key: 'ArrowRight', run: (view) => handleArrow(view, true, fullConfig) }
  ];
  
  return [
    keymap.of(indentKeymap),
    atomicIndentState
  ];
}

/**
 * Default atomic indent extension with standard settings
 */
export const atomicIndentExtension = atomicIndent(); 