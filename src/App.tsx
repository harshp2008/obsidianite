import { useEffect, useRef } from 'react';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import type { Extension } from '@codemirror/state'; // Fix: type-only import

import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';

import { javascript } from '@codemirror/lang-javascript';

import { history, historyKeymap } from '@codemirror/commands';
import { defaultKeymap } from '@codemirror/commands';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { lintKeymap } from '@codemirror/lint';

import {
  dropCursor,
  drawSelection,
  highlightActiveLine,
  rectangularSelection,
  crosshairCursor,
  highlightActiveLineGutter,
} from '@codemirror/view';

import { oneDark } from '@codemirror/theme-one-dark';

import { markdownLinkTransformation } from './extensions/markdownLinkTransformation';
import { logLezerTree } from './utils/lezerInspector';
import { markdownSyntaxHiding } from './extensions/markdownSyntaxHiding';

import './App.css';
import { listBulletExtension } from './extensions/markdownListBulletExtension';

const customHighlightStyle = HighlightStyle.define([
  { tag: tags.heading1, fontSize: '2.5em', fontWeight: 'bold', color: '#e06c75' },
  { tag: tags.heading2, fontSize: '2em', fontWeight: 'bold', color: '#e06c75' },
  { tag: tags.heading3, fontSize: '1.75em', fontWeight: 'bold', color: '#e06c75' },
  { tag: tags.heading4, fontSize: '1.5em', fontWeight: 'bold', color: '#e06c75' },
  { tag: tags.heading5, fontSize: '1.25em', fontWeight: 'bold', color: '#e06c75' },
  { tag: tags.heading6, fontSize: '1.1em', fontWeight: 'bold', color: '#e06c75' },

  { tag: tags.strong, fontWeight: 'bold', color: '#c678dd' },
  { tag: tags.emphasis, fontStyle: 'italic', color: '#e5c07b' },

  { tag: tags.link, color: '#61afef', textDecoration: 'underline' },
  { tag: tags.url, color: '#61afef' },

  { tag: tags.monospace, color: '#f8f8f2' }, // Use monospace for inline code text
  // { tag: tags.code, color: '#98c379' }, // REMOVED: `tags.code` is not directly exposed this way. Fenced code block styling is handled by JS language support.
  // { tag: tags.listMark, color: '#e5c07b' }, // REMOVED: This will be hidden by markdownSyntaxHiding
]);

function App() {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (editorRef.current && !viewRef.current) {
      const basicExtensionsWithoutLineNumbers: Extension[] = [
        history(),
        keymap.of(historyKeymap),
        keymap.of(defaultKeymap),
        highlightSelectionMatches(),
        keymap.of(searchKeymap),
        dropCursor(),
        keymap.of(lintKeymap),
        drawSelection(),
        highlightActiveLine(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLineGutter(),
      ];

      const initialState = EditorState.create({
        doc: `## My Markdown Doc

This is some **bold** text and *italic* text.

### A Subheading

\`\`\`javascript
console.log("Hello from a JS code block!");
const x = 10;
\`\`\`

- List item 1
- List item 2

[Link to Google](https://www.google.com)
`,
        extensions: [
          ...basicExtensionsWithoutLineNumbers,
          markdown({
            base: markdownLanguage,
          }),
          javascript(),
          syntaxHighlighting(customHighlightStyle),
          oneDark,
          markdownLinkTransformation,
          markdownSyntaxHiding,
          listBulletExtension,
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

  return (
    <div className="App">
      <header className="app-header">
        <h1 className="app-title">CodeMirror 6 Markdown Editor</h1>
        <button onClick={handleLogTree} className="log-button">Log Lezer Tree</button>
      </header>
      <div ref={editorRef} className="editor-container"></div>
    </div>
  );
}

export default App;