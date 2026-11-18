import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './index.css'
import './menu.css'
import './griddle.css'

const root = document.getElementById('root')
if (!root) {
  throw new Error('Elemento #root ausente')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
