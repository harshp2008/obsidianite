import { EditorView, ViewPlugin, DecorationSet, Decoration, ViewUpdate } from '@codemirror/view';
import { Range } from '@codemirror/state';
import { indentationConfig } from './listIndentationExtension';

// Function to check if a line looks like a list item
function isListLine(text: string): boolean {
  // Match both unordered lists (-, +, *) and ordered lists (1., 2., etc.)
  return /^\s*[-*+]|\s*\d+\./.test(text);
}

// Function to calculate indent level for a line
function getLineIndentLevel(text: string, indentSize: number): number {
  let leadingSpaces = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ' ') {
      leadingSpaces++;
    } else {
      break;
    }
  }
  
  return Math.floor(leadingSpaces / indentSize);
}

// Plugin to render indentation guides
export const lineGuidePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    
    constructor(view: EditorView) {
      this.decorations = this.createDecorations(view);
    }
    
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || 
          update.transactions.some(tr => tr.reconfigured)) {
        this.decorations = this.createDecorations(update.view);
      }
    }
    
    createDecorations(view: EditorView) {
      const { state } = view;
      const indentSize = state.field(indentationConfig).indentSize;
      const decorations: Range<Decoration>[] = [];
      
      // Group lines by their indentation level
      const visibleRanges = view.visibleRanges;
      
      for (const { from, to } of visibleRanges) {
        let pos = from;
        
        while (pos <= to) {
          const line = state.doc.lineAt(pos);
          const lineText = line.text;
          
          // Only process list-related lines
          if (isListLine(lineText)) {
            const indentLevel = getLineIndentLevel(lineText, indentSize);
            
            // Use line decoration instead of block decoration
            for (let level = 1; level <= indentLevel; level++) {
              const guideClass = `cm-indent-guide-line-level-${level}`;
              decorations.push(
                Decoration.line({
                  attributes: { class: guideClass }
                }).range(line.from)
              );
            }
          }
          
          // Move to next line
          pos = line.to + 1;
        }
      }
      
      return Decoration.set(decorations);
    }
  },
  {
    decorations: v => v.decorations
  }
);

// CSS for the indent guides
const lineGuideStyles = EditorView.baseTheme({
  ".cm-indent-guide-line-level-1": {
    position: "relative"
  },
  ".cm-indent-guide-line-level-1::before": {
    content: "''",
    position: "absolute",
    left: "calc(var(--indent-visual-size) * 0.5)",
    top: "0",
    height: "100%",
    width: "1px",
    backgroundColor: "rgba(120, 160, 255, 0.3)"  // Increased opacity for better visibility
  },
  ".cm-indent-guide-line-level-2::before": {
    content: "''",
    position: "absolute",
    left: "calc(var(--indent-visual-size) * 1.5)",
    top: "0",
    height: "100%",
    width: "1px",
    backgroundColor: "rgba(180, 140, 255, 0.3)"  // Increased opacity for better visibility
  },
  ".cm-indent-guide-line-level-3::before": {
    content: "''",
    position: "absolute",
    left: "calc(var(--indent-visual-size) * 2.5)",
    top: "0",
    height: "100%",
    width: "1px",
    backgroundColor: "rgba(255, 150, 100, 0.3)"  // Increased opacity for better visibility
  },
  ".cm-indent-guide-line-level-4::before": {
    content: "''",
    position: "absolute",
    left: "calc(var(--indent-visual-size) * 3.5)",
    top: "0",
    height: "100%",
    width: "1px",
    backgroundColor: "rgba(120, 220, 160, 0.3)"  // Increased opacity for better visibility
  }
});

// Export the extension (remove redundant theme settings as they're handled in listIndentationExtension.ts)
export const lineGuideExtension = [
  lineGuidePlugin,
  lineGuideStyles
]; 