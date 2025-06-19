import { useEffect, useRef } from 'react';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import type { Extension } from '@codemirror/state';

import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';

import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags, Tag } from '@lezer/highlight';

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

export const customTags = {
  mark: Tag.define()
};

const customHighlightStyle = HighlightStyle.define([
  { tag: tags.heading1, class: 'cm-header cm-header-1' },
  { tag: tags.heading2, class: 'cm-header cm-header-2' },
  { tag: tags.heading3, class: 'cm-header cm-header-3' },
  { tag: tags.heading4, class: 'cm-header cm-header-4' },
  { tag: tags.heading5, class: 'cm-header cm-header-5' },
  { tag: tags.heading6, class: 'cm-header cm-header-6' },

  { tag: tags.strong, class: 'cm-strong' },
  { tag: tags.emphasis, class: 'cm-emphasis' },

  { tag: tags.link, class: 'cm-link' },
  { tag: tags.url, class: 'cm-url' },

  { tag: tags.monospace, class: 'cm-inline-code',
  },

  { tag: tags.strikethrough, class: 'cm-strikethrough' },
  { tag: customTags.mark, class: 'cm-highlight' },
  { tag: tags.quote, class: 'cm-blockquote' }
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

==highlight==
~~strikethrough~~
\`inline code\`

### A Subheading

\`\`\`javascript
console.log("Hello from a JS code block!");
const x = 10;
\`\`\`

1. Ordered item 1
2. Ordered item 2

- List item 1
- List item 2

> A blockquote

[Link to Google](https://www.google.com)
`,
        extensions: [
          ...basicExtensionsWithoutLineNumbers,
          markdown({
            base: markdownLanguage,
            extensions: [GFM],
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