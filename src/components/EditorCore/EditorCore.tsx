// src/components/EditorCore/EditorCore.tsx

import  { useRef, useEffect } from 'react'; // Corrected React imports
import { EditorView } from '@codemirror/view'; // Direct import
import { EditorState, Extension } from '@codemirror/state'; // Direct import

import { logLezerTree } from '../../utils/lezerInspector'; // Direct import

import {
  initialContent,
  fullExtensions,
} from './editor_constants'; // Import constants and extensions from the new file

// Import the necessary styles
import './editorCore.css';


interface EditorCoreProps {
  debugMode?: boolean;
  initialDoc?: string; // Allow initial content to be passed as a prop
  onChange?: (doc: string) => void; // Callback for content changes
}

export default function EditorCore({ debugMode = false, initialDoc = initialContent, onChange }: EditorCoreProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (editorRef.current && !viewRef.current) {
      const extensions: Extension[] = [
        ...fullExtensions, // Use the combined extensions from constants
        // Add a listener for document changes, if a callback is provided
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange?.(update.state.doc.toString());
          }
        }),
      ];

      const initialState = EditorState.create({
        doc: initialDoc, // Use initialDoc prop
        extensions: extensions,
      });

      const view = new EditorView({
        state: initialState,
        parent: editorRef.current,
      });

      viewRef.current = view;

      return () => {
        view.destroy();
        viewRef.current = null;
      };
    }
  }, [initialDoc, onChange]); // Re-run effect if initialDoc or onChange changes

  // Effect to handle debugMode changes
  useEffect(() => {
    if (debugMode) {
      console.log('EditorCore mounted with debug mode enabled');
    }
  }, [debugMode]);


  const handleLogTree = () => {
    if (viewRef.current) {
      logLezerTree(viewRef.current);
    }
  };

  let debugComponent = (
    <div className="debug-info">
      <p>Debug Mode: {debugMode ? 'Enabled' : 'Disabled'}</p>
      <button onClick={handleLogTree} className="log-button">Log Lezer Tree</button>
    </div>
  )

  return (
    <div className="App"> {/* This "App" class might be causing conflict with your main App.css */}
      { debugMode ? debugComponent : null } 
      <div ref={editorRef} className="editor-container"></div>
    </div>
  );
}