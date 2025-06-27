import { EditorView } from '@codemirror/view';
import { RangeSetBuilder, StateField, Extension } from '@codemirror/state';
import { Decoration, DecorationSet } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { SyntaxNode } from '@lezer/common';

/**
 * This extension adds special CSS classes for combined formatting:
 * - highlight + strong
 * - highlight + emphasis 
 * - highlight + strong + emphasis
 */
export const combinedHighlightExtension = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    if (!tr.docChanged && !tr.selection) return decorations;
    return buildCombinedHighlightDecorations(tr.state);
  },
  provide: (field) => EditorView.decorations.from(field),
});

function buildCombinedHighlightDecorations(state: any): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const tree = syntaxTree(state);

  // Walk through the entire document
  tree.iterate({
    enter: (nodeRef) => {
      const node = nodeRef.node;
      
      // Check if this is a Highlight node
      if (node.type.name === 'Highlight') {
        // Store information about whether this contains strong/emphasis formatting
        let hasStrong = false;
        let hasEmphasis = false;
        
        // Recursively check if this node contains strong or emphasis formatting
        checkForFormatting(node);
        
        // Add the appropriate decoration based on the formatting found
        if (hasStrong && hasEmphasis) {
          builder.add(
            node.from, 
            node.to, 
            Decoration.mark({ class: 'cm-highlight-strong-emphasis' })
          );
        } else if (hasStrong) {
          builder.add(
            node.from, 
            node.to, 
            Decoration.mark({ class: 'cm-highlight-strong' })
          );
        } else if (hasEmphasis) {
          builder.add(
            node.from, 
            node.to, 
            Decoration.mark({ class: 'cm-highlight-emphasis' })
          );
        }
        
        // Helper function to recursively check for formatting
        function checkForFormatting(node: SyntaxNode) {
          if (node.type.name === 'StrongEmphasis') {
            hasStrong = true;
            hasEmphasis = true;
            return;
          }
          
          if (node.type.name === 'Strong') {
            hasStrong = true;
          }
          
          if (node.type.name === 'Emphasis') {
            hasEmphasis = true;
          }
          
          // Check children recursively
          let child = node.firstChild;
          while (child) {
            checkForFormatting(child);
            child = child.nextSibling;
          }
        }
      }
      
      // Check the inverse - Strong/Emphasis that contains Highlight
      if (node.type.name === 'Strong' || node.type.name === 'Emphasis' || node.type.name === 'StrongEmphasis') {
        let hasHighlight = false;
        
        // Check if this formatting contains a highlight
        let child = node.firstChild;
        while (child) {
          if (child.type.name === 'Highlight' || containsHighlight(child)) {
            hasHighlight = true;
            break;
          }
          child = child.nextSibling;
        }
        
        // Add appropriate decoration
        if (hasHighlight) {
          if (node.type.name === 'StrongEmphasis') {
            builder.add(
              node.from, 
              node.to, 
              Decoration.mark({ class: 'cm-highlight-strong-emphasis' })
            );
          } else if (node.type.name === 'Strong') {
            builder.add(
              node.from, 
              node.to, 
              Decoration.mark({ class: 'cm-highlight-strong' })
            );
          } else if (node.type.name === 'Emphasis') {
            builder.add(
              node.from, 
              node.to, 
              Decoration.mark({ class: 'cm-highlight-emphasis' })
            );
          }
        }
      }
    }
  });
  
  return builder.finish();
}

// Helper to check if a node contains a Highlight
function containsHighlight(node: SyntaxNode): boolean {
  if (node.type.name === 'Highlight') {
    return true;
  }
  
  let child = node.firstChild;
  while (child) {
    if (containsHighlight(child)) {
      return true;
    }
    child = child.nextSibling;
  }
  
  return false;
} 