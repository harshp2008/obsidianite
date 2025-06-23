// C:\Users\harsh\Desktop\obsidianite\src\components\EditorCore\EditorCore.tsx


import { defaultConfig } from './editor_core_config';
import {
    useRef,
    useEffect,
    Extension,
    EditorView,
    history,
    keymap,
    historyKeymap,
    defaultKeymap,
    highlightSelectionMatches,
    searchKeymap,
    dropCursor, 
    lintKeymap, 
    drawSelection, 
    highlightActiveLine, 
    rectangularSelection, 
    crosshairCursor, 
    highlightActiveLineGutter, 
    EditorState, 
    markdown, 
    markdownLanguage, 
    GFM, 
    markdownHighlightExtension, 
    javascript, 
    syntaxHighlighting, 
    oneDark, 
    customHighlightStyle, 
    mySelectionTheme, 
    markdownLinkTransformation, 
    markdownSyntaxHiding, 
    listBulletExtension, 
    horizontalRuleExtension, 
    logLezerTree
} from  './editor_core_imports'

// Import the necessary styles
import './editorCore.css';


interface EditorCoreProps {
  debugMode?: boolean;
}

// Make it that debug mode is false by default
// This allows the component to be used without passing props, defaulting to debugMode: false 

export default function EditorCore( { debugMode = false } : EditorCoreProps ) {

  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (editorRef.current && !viewRef.current) {
      const basicExtensionsWithoutLineNumbers: Extension[] = [
        history(),
        keymap.of(historyKeymap),
        keymap.of(defaultKeymap),
        highlightSelectionMatches(), // Ensure this is present for proper selection match highlighting
        keymap.of(searchKeymap),
        dropCursor(),
        keymap.of(lintKeymap),
        drawSelection(), // Essential for CodeMirror to draw its own selection background
        highlightActiveLine(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLineGutter(),
      ];

      const initialState = EditorState.create({
        doc: defaultConfig,
        extensions: [
          ...basicExtensionsWithoutLineNumbers,
          markdown({
            base: markdownLanguage,
            extensions: [GFM, markdownHighlightExtension], // GFM is an extension bundle providing Tables, TaskList, Strikethrough, and Autolink.
          }),
          javascript(),
          syntaxHighlighting(customHighlightStyle),
          oneDark, // Your base theme
          mySelectionTheme, // <--- ADD YOUR CUSTOM SELECTION THEME HERE (after oneDark to override)
          markdownLinkTransformation,
          markdownSyntaxHiding,
          listBulletExtension,
          horizontalRuleExtension
        ],
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
  }, []);

  const handleLogTree = () => {
    if (viewRef.current) {
      logLezerTree(viewRef.current);
    }
  };

    useEffect(() => {
        if (debugMode) {
        console.log('EditorCore mounted with debug mode enabled');
        }
    }, [debugMode]);


    let debugComponent = (
        <div className="debug-info">
            <p>Debug Mode: {debugMode ? 'Enabled' : 'Disabled'}</p>
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
