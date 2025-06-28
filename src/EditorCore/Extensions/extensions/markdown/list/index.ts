// src/EditorCore/Extensions/extensions/markdown/list/index.ts
import { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { listBulletExtension } from './listBullet/listBulletExtension';
import { listIndentationExtension, setIndentSize } from './indentation/listIndentationExtension';
import { rigidIndentationExtension } from './indentation/rigidIndentationExtension';
import { lineGuideExtension } from './indentation/lineGuideExtension';
import { markdownStructuralClassesExtension } from './markdownStructuralClassesExtension';

// Log that our extensions are being loaded
console.log("Loading list extensions...");

// Create a debugging extension to verify loading
const listDebugExtension = EditorView.updateListener.of(update => {
  if (update.docChanged) {
    console.log("Document updated - list extensions are active");
  }
});

// Export all list extensions as a single combined extension
export const listExtensions: Extension[] = [
  listBulletExtension,
  ...listIndentationExtension,
  ...rigidIndentationExtension,
  //...lineGuideExtension,
  listDebugExtension,

  markdownStructuralClassesExtension
];

console.log("List extensions loaded:", listExtensions);

// Export the helper function to customize indentation
export { setIndentSize }; 