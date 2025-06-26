import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import EditorCore from './EditorCore/Extensions/editor/EditorCore.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
     <EditorCore debugMode />
  </StrictMode>,
)
