import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import GameBoundary from './components/common/GameBoundary'
import './styles.css'
// Standalone owns its save, so the boundary may offer to clear it — after offering it back.
createRoot(document.getElementById('root')!).render(
  <GameBoundary saveKey="warlord_save">
    <App />
  </GameBoundary>,
)
