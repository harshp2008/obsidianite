import { EditorView } from '@codemirror/view';
import { RangeSetBuilder, StateField } from '@codemirror/state';
import { Decoration, DecorationSet } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { SyntaxNode } from '@lezer/common';

/**
 * This extension adds special CSS classes for combined formatting:
 * - highlight + strong
 * - highlight + emphasis 
 * - highlight + strong + emphasis
 * - mixed formatting within highlights
 */
export const combinedHighlightExtension = StateField.define<DecorationSet>({
  create(state) {
    // Initialize with decorations on editor creation
    return buildCombinedHighlightDecorations(state);
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
  
  // Process all highlight nodes in the document
  tree.iterate({
    enter: (nodeRef) => {
      const node = nodeRef.node;
      
      // First check for highlights that contain formatting
      if (node.type.name === 'Highlight') {
        processHighlightNode(node, builder, state.doc);
      }
    }
  });
  
  return builder.finish();
}

// Process a highlight node to find formatting within it
function processHighlightNode(highlightNode: SyntaxNode, builder: RangeSetBuilder<Decoration>, doc: any) {
  // Add base decoration for the entire highlight
  builder.add(
    highlightNode.from,
    highlightNode.to,
    Decoration.mark({ class: 'cm-highlight' })
  );
  
  let hasChildren = false;
  
  // Process each child node for formatting
  let child = highlightNode.firstChild;
  while (child) {
    // Check for formatting nodes within the highlight
    if (child.type.name === 'Strong') {
      hasChildren = true;
      builder.add(
        child.from,
        child.to,
        Decoration.mark({ class: 'cm-highlight-strong' })
      );
    } else if (child.type.name === 'Emphasis') {
      hasChildren = true;
      builder.add(
        child.from,
        child.to,
        Decoration.mark({ class: 'cm-highlight-emphasis' })
      );
    } else if (child.type.name === 'StrongEmphasis') {
      hasChildren = true;
      builder.add(
        child.from,
        child.to,
        Decoration.mark({ class: 'cm-highlight-strong-emphasis' })
      );
      
    }
    
    // Recursively check children of this child for nested formatting
    processNestedFormatting(child, builder, doc);
    
    child = child.nextSibling;
  }
  
  // If this highlight doesn't have any specially formatted children,
  // we don't need to add additional decorations
  if (!hasChildren) {
    // The base cm-highlight class is already applied
  }
}

// Process nested formatting recursively
function processNestedFormatting(node: SyntaxNode, builder: RangeSetBuilder<Decoration>, doc: any) {
  let child = node.firstChild;
  while (child) {
    if (child.type.name === 'Strong') {
      builder.add(
        child.from,
        child.to,
        Decoration.mark({ class: 'cm-highlight-strong' })
      );
    } else if (child.type.name === 'Emphasis') {
      builder.add(
        child.from,
        child.to,
        Decoration.mark({ class: 'cm-highlight-emphasis' })
      );
    } else if (child.type.name === 'StrongEmphasis') {
      builder.add(
        child.from,
        child.to,
        Decoration.mark({ class: 'cm-highlight-strong-emphasis' })
      );
    } else if (child.type.name === 'Highlight') {
      // Also handle nested highlights
      processHighlightNode(child, builder, doc);
    }
    
    // Continue recursion
    processNestedFormatting(child, builder, doc);
    
    child = child.nextSibling;
  }
}

// Create a command to manually force refresh of the decorations
export function refreshHighlightFormatting(view: EditorView) {
  const state = view.state;
  const decorations = buildCombinedHighlightDecorations(state);
  
  // Force refresh by temporarily changing something and then changing it back
  view.dispatch({
    effects: EditorView.scrollIntoView(0)
  });
  
  return true;
} 