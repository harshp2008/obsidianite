import { keymap, EditorView } from '@codemirror/view';
import { StateField, StateEffect } from '@codemirror/state';
import { indentUnit } from '@codemirror/language';

// Create a configurable effect for changing indent size
export const setIndentSizeEffect = StateEffect.define<number>();

// Default indentation size (8 spaces by default as requested)
const DEFAULT_INDENT_SIZE = 5;
// Log to console that we're using 8-space indentation
console.log("Setting up list indentation with 8-space indent");

// Create a state field to store indentation configuration
export const indentationConfig = StateField.define<{
  indentSize: number
}>({
  create() {
    return { 
      indentSize: DEFAULT_INDENT_SIZE 
    };
  },
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setIndentSizeEffect)) {
        return { ...value, indentSize: effect.value };
      }
    }
    return value;
  }
});

/**
 * Check if a line looks like a list item (ordered or unordered)
 */
function isListLine(text: string): boolean {
  // Match both unordered lists (-, +, *) and ordered lists (1., 2., etc.)
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
 * Handle Tab key press to indent list items
 */
function indentList(view: EditorView): boolean {
  const { state } = view;
  const { selection } = state;
  const indentSize = state.field(indentationConfig).indentSize;
  const changes = [];
  
  // Get all affected lines (either from selection or current line)
  const lineRanges = [];
  
  for (const range of selection.ranges) {
    const startLine = state.doc.lineAt(range.from);
    const endLine = state.doc.lineAt(range.to);
    
    for (let lineNo = startLine.number; lineNo <= endLine.number; lineNo++) {
      lineRanges.push(state.doc.line(lineNo));
    }
  }
  
  // Deduplicate line ranges
  const uniqueLines = [...new Map(lineRanges.map(line => [line.from, line])).values()];
  
  // Process each line
  for (const line of uniqueLines) {
    if (isListLine(line.text)) {
      // Add indentation
      changes.push({
        from: line.from,
        to: line.from,
        insert: ' '.repeat(indentSize)
      });
    }
  }
  
  // Apply changes if any
  if (changes.length > 0) {
    view.dispatch({ changes });
    return true;
  }
  
  return false;
}

/**
 * Handle Shift+Tab key press to outdent list items
 */
function outdentList(view: EditorView): boolean {
  const { state } = view;
  const { selection } = state;
  const indentSize = state.field(indentationConfig).indentSize;
  const changes = [];
  
  // Get all affected lines (either from selection or current line)
  const lineRanges = [];
  
  for (const range of selection.ranges) {
    const startLine = state.doc.lineAt(range.from);
    const endLine = state.doc.lineAt(range.to);
    
    for (let lineNo = startLine.number; lineNo <= endLine.number; lineNo++) {
      lineRanges.push(state.doc.line(lineNo));
    }
  }
  
  // Deduplicate line ranges
  const uniqueLines = [...new Map(lineRanges.map(line => [line.from, line])).values()];
  
  // Process each line
  for (const line of uniqueLines) {
    if (isListLine(line.text)) {
      const leadingSpaces = countLeadingSpaces(line.text);
      const dedentAmount = Math.min(leadingSpaces, indentSize);
      
      // Only dedent if there are spaces to remove
      if (dedentAmount > 0) {
        changes.push({
          from: line.from,
          to: line.from + dedentAmount,
          insert: ''
        });
      }
    }
  }
  
  // Apply changes if any
  if (changes.length > 0) {
    view.dispatch({ changes });
    return true;
  }
  
  return false;
}

// Direct DOM event handlers for Tab key with highest priority
const tabKeyHandler = EditorView.domEventHandlers({
  keydown: (event, view) => {
    // Only handle Tab key
    if (event.key === 'Tab') {
      // Prevent default Tab behavior immediately
      event.preventDefault();
      
      return event.shiftKey
        ? outdentList(view) 
        : indentList(view);
    }
    return false;
  }
});

// CSS variable for indent size
const indentSizeStyle = EditorView.theme({
  "&": {
    "--indent-size": `${DEFAULT_INDENT_SIZE}ch`,
    "--indent-visual-size": "32px"
  }
});

// Update CSS when indent size changes
const updateIndentStyle = EditorView.updateListener.of(update => {
  const newSize = update.state.field(indentationConfig).indentSize;
  const root = update.view.dom.closest(".App") || document.documentElement;
  if (root) {
    (root as HTMLElement).style.setProperty("--indent-size", `${newSize}ch`);
    // Always update the visual size to match too
    (root as HTMLElement).style.setProperty("--indent-visual-size", `${newSize * 4}px`);
    console.log(`Indent size updated: ${newSize} spaces, visual size: ${newSize * 4}px`);
  }
});

// High-priority keymap for Tab/Shift+Tab
const tabKeymap = keymap.of([
  { key: 'Tab', run: indentList, preventDefault: true },
  { key: 'Shift-Tab', run: outdentList, preventDefault: true }
]); // Higher priority than default keymaps

// Create the indentation extension
export const listIndentationExtension = [
  indentationConfig,
  indentSizeStyle,
  updateIndentStyle,
  tabKeyHandler,
  tabKeymap,
  indentUnit.of(' '.repeat(DEFAULT_INDENT_SIZE))
];

// Helper function to set indent size
export function setIndentSize(view: EditorView, size: number) {
  view.dispatch({
    effects: [setIndentSizeEffect.of(size)]
  });
} 