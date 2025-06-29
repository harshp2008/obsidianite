// src/components/EditorCore/EditorCore.tsx

import { useRef, useEffect } from 'react';
import { EditorView } from '@codemirror/view';
import { EditorState, Extension } from '@codemirror/state';

import { logLezerTree } from '../../../utils/lezerInspector';
import { refreshHighlightFormatting } from '../extensions/markdown/highlight/combinedHighlightExtension';

import {
  initialContent,
  fullExtensions,
} from './editor_constants';

// Import the toggling functions from the correct path
// Based on your file structure:
// From src/components/EditorCore/EditorCore.tsx, you need to go:
// ../extensions/markdown/list/index.ts to get listExtensions
// and within list/index.ts, we re-exported disableDefaultKey etc.

// Import the necessary styles
import './style/editorCore.css';
import { disableDefaultKey, enableDefaultKey, getAllDefaultKeyStrings } from '../extensions/markdown/keymaps/ToggableDefaultKeymap';


const disableAllKeymapList = [
    "Alt-ArrowLeft",
    "Alt-ArrowRight",
    "Alt-ArrowUp",
    "Shift-Alt-ArrowUp",
    "Alt-ArrowDown",
    "Shift-Alt-ArrowDown",
    "Escape",
    "Mod-Enter",
    "Alt-l",
    "Mod-i",
    "Mod-[",
    "Mod-]",
    "Mod-Alt-\\",
    "Shift-Mod-k",
    "Shift-Mod-\\",
    "Mod-/",
    "Alt-A",
    "Ctrl-m",
    "ArrowLeft",
    "Mod-ArrowLeft",
    null,
    "ArrowRight",
    "Mod-ArrowRight",
    "ArrowUp",
    "ArrowDown",

]

const EnabledDefaultKeymap = [
    "Alt-ArrowLeft",
    "Alt-ArrowRight",
    "Alt-ArrowUp",
    "Shift-Alt-ArrowUp",
    "Alt-ArrowDown",
    "Shift-Alt-ArrowDown",
    "Escape",
    "Mod-Enter",
    "Alt-l",
    "Mod-i",
    "Mod-[",
    "Mod-]",
    "Mod-Alt-\\",
    "Shift-Mod-k",
    "Shift-Mod-\\",
    "Mod-/",
    "Alt-A",
    "Ctrl-m",
    "ArrowLeft",
    "Mod-ArrowLeft",
    null,
    "ArrowRight",
    "Mod-ArrowRight",
    //"ArrowUp",
    //"ArrowDown",
    "PageUp",
    "PageDown",
    "Home",
    "Mod-Home",
    "End",
    "Mod-End",
    "Enter",
    "Mod-a",
    "Backspace",
    "Delete",
    "Mod-Backspace",
    "Mod-Delete"
]



interface EditorCoreProps {
  debugMode?: boolean;
  initialDoc?: string;
  onChange?: (doc: string) => void;
}

export default function EditorCore({ debugMode = false, initialDoc = initialContent, onChange }: EditorCoreProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (editorRef.current && !viewRef.current) {
      const extensions: Extension[] = [
        ...fullExtensions,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange?.(update.state.doc.toString());
          }
        }),
      ];

      const initialState = EditorState.create({
        doc: initialDoc,
        extensions: extensions,
      });

      const view = new EditorView({
        state: initialState,
        parent: editorRef.current,
      });

      viewRef.current = view;

      // --- Apply the toggling logic here after the view is created ---
      // Disable default Tab, Enter, and Shift-Tab to let your custom rigidIndentationKeymap handle them.
      // This is crucial for your list indentation and atomic marker behavior.
      
      disableAllKeymapList.forEach((key) => {
        if (key) {
          disableDefaultKey(view, key);
        }
      });

      // Enable only the necessary keys for your custom behavior
      EnabledDefaultKeymap.forEach((key) => {
        if (key) {
          enableDefaultKey(view, key);
        }
      })
      
      console.log("All default key strings:", Array.from(getAllDefaultKeyStrings())); //

 

      // Force refresh of highlight formatting after initial render
      setTimeout(() => {
        if (viewRef.current) {
          refreshHighlightFormatting(viewRef.current);

          // Give focus to the editor to ensure styles are applied
          viewRef.current.focus();
        }
      }, 100);

      return () => {
        view.destroy();
        viewRef.current = null;
      };
    }
  }, [initialDoc, onChange]);

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
    <div className="debug-info flex flex-row justify-items-start bg-amber-500 gap-5 items-center p-2">

      <span className='h-fit text-black border-2 py-1 px-2 rounded-2xl'>Debug Mode: {debugMode ? 'Enabled' : 'Disabled'}</span>
      <button onClick={handleLogTree} className="log-button">Log Lezer Tree</button>
    </div>
  )

  return (
    <div className="App">
      { debugMode ? debugComponent : null }
      <div ref={editorRef} className="editor-container"></div>
    </div>
  );
}