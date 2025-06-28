import { EditorView, ViewPlugin, keymap, ViewUpdate } from '@codemirror/view';
import { indentationConfig } from './listIndentationExtension';

/**
 * Check if a line has a list marker (either at the start or indented)
 */
function isListLine(text: string): boolean {
  return /^\s*[-*+]|\s*\d+\./.test(text);
}

/**
 * Count leading spaces in a line
 */
function countLeadingSpaces(text: string): number {
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ' ') {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Check if cursor is in the indentation area of a line
 */
function isInIndentArea(line: string, cursorOffset: number): boolean {
  const leadingSpaces = countLeadingSpaces(line);
  return cursorOffset <= leadingSpaces;
}

/**
 * Get the next valid tab stop position
 */
function getNextTabStop(cursorOffset: number, indentSize: number, maxSpaces: number): number {
  // Calculate next tab stop position
  let nextStop = Math.ceil(cursorOffset / indentSize) * indentSize;
  
  // If we're already at a tab stop, move to the next one
  if (nextStop === cursorOffset) {
    nextStop += indentSize;
  }
  
  // Don't go beyond the leading spaces
  return Math.min(nextStop, maxSpaces);
}

/**
 * Get the previous valid tab stop position
 */
function getPrevTabStop(cursorOffset: number, indentSize: number): number {
  // If at beginning of line, stay there
  if (cursorOffset === 0) {
    return 0;
  }
  
  // If exactly at a tab stop, go to previous one
  if (cursorOffset % indentSize === 0) {
    return Math.max(0, cursorOffset - indentSize);
  }
  
  // Otherwise go to the current tab stop
  return Math.floor(cursorOffset / indentSize) * indentSize;
}

/**
 * Handle horizontal arrow key navigation within indentation areas
 */
function handleArrowNavigation(view: EditorView, key: string): boolean {
  const { state } = view;
  const { selection } = state;
  
  // Only handle single cursor (not selection)
  if (selection.ranges.length !== 1 || !selection.main.empty) {
    return false;
  }
  
  const cursorPos = selection.main.head;
  const line = state.doc.lineAt(cursorPos);
  const offsetInLine = cursorPos - line.from;
  const indentSize = state.field(indentationConfig).indentSize;
  
  // Only handle list lines
  if (!isListLine(line.text)) {
    return false;
  }
  
  // Only handle if in indentation area
  if (!isInIndentArea(line.text, offsetInLine)) {
    return false;
  }
  
  // Get leading spaces
  const leadingSpaces = countLeadingSpaces(line.text);
  
  if (key === 'ArrowLeft') {
    // Move to previous tab stop
    const newPos = getPrevTabStop(offsetInLine, indentSize);
    if (newPos !== offsetInLine) {
      view.dispatch({
        selection: { anchor: line.from + newPos },
        scrollIntoView: true
      });
      return true;
    }
  } else if (key === 'ArrowRight') {
    // Move to next tab stop
    const newPos = getNextTabStop(offsetInLine, indentSize, leadingSpaces);
    if (newPos !== offsetInLine) {
      view.dispatch({
        selection: { anchor: line.from + newPos },
        scrollIntoView: true
      });
      return true;
    }
  }
  
  return false;
}

/**
 * DOM event handler for arrow keys
 */
const arrowKeyHandler = EditorView.domEventHandlers({
  keydown: (event, view) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      // Don't handle if modifier keys are pressed
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
        return false;
      }
      
      if (handleArrowNavigation(view, event.key)) {
        event.preventDefault();
        return true;
      }
    }
    return false;
  }
});

/**
 * High-priority keymap for arrow keys
 */
const arrowKeymap = keymap.of([
  { 
    key: 'ArrowLeft', 
    run: view => handleArrowNavigation(view, 'ArrowLeft'),
    shift: view => handleArrowNavigation(view, 'ArrowLeft'),
    preventDefault: true
  },
  { 
    key: 'ArrowRight', 
    run: view => handleArrowNavigation(view, 'ArrowRight'),
    shift: view => handleArrowNavigation(view, 'ArrowRight'),
    preventDefault: true
  }
]); // Higher priority than default

/**
 * ViewPlugin that handles mouse clicks in indentation areas
 */
const clickHandler = ViewPlugin.fromClass(class {
  constructor(_view: EditorView) {}
  
  update(update: ViewUpdate) {
    // Only handle selection changes from mouse clicks
    if (!update.selectionSet || !update.transactions.some((tr: any) => tr.isUserEvent('select.pointer'))) {
      return;
    }
    
    const { state } = update.view;
    const { selection } = state;
    
    // Only handle single cursor (not selection)
    if (selection.ranges.length !== 1 || !selection.main.empty) {
      return;
    }
    
    const cursorPos = selection.main.head;
    const line = state.doc.lineAt(cursorPos);
    const offsetInLine = cursorPos - line.from;
    const indentSize = state.field(indentationConfig).indentSize;
    
    // Only handle list lines
    if (!isListLine(line.text)) {
      return;
    }
    
    // Only handle if in indentation area
    if (!isInIndentArea(line.text, offsetInLine)) {
      return;
    }
    
    // Find nearest tab stop
    const roundedPos = Math.round(offsetInLine / indentSize) * indentSize;
    const leadingSpaces = countLeadingSpaces(line.text);
    const snapPos = Math.min(roundedPos, leadingSpaces);
    
    // Only dispatch if we're not already at that position
    if (snapPos !== offsetInLine) {
      setTimeout(() => {
        update.view.dispatch({
          selection: { anchor: line.from + snapPos },
          scrollIntoView: true
        });
      }, 0);
    }
  }
});

// Export the rigid indentation extension
export const rigidIndentationExtension = [
  arrowKeyHandler,
  arrowKeymap,
  clickHandler
]; 