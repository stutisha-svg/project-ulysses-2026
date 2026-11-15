import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './material'
import './shell.css'
import './theme/tokens.css'

const root = document.getElementById('root')
if (!root) {
  throw new Error('Root element missing')
}

// Selected segments use a light fill. The built-in tick stays hidden.
const hideSegmentCheck = new MutationObserver(() => {
  document.querySelectorAll('md-outlined-segmented-button').forEach((node) => {
    const shadow = (node as HTMLElement).shadowRoot
    if (!shadow || shadow.querySelector('[data-hide-check]')) return
    const style = document.createElement('style')
    style.dataset.hideCheck = ''
    style.textContent =
      '.md3-segmented-button{padding-inline:10px!important}.md3-segmented-button__checkmark{display:none!important}.md3-segmented-button--selected .md3-segmented-button__icon{opacity:1!important}.md3-segmented-button--without-icon .md3-segmented-button__leading{display:none!important}.md3-segmented-button--with-icon .md3-segmented-button__graphic{width:var(--_icon-size)!important}'
    shadow.appendChild(style)
  })
})
hideSegmentCheck.observe(root, { childList: true, subtree: true })

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
