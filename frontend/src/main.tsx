import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import '@fontsource-variable/space-grotesk'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './styles/tokens.css'
import './styles/themes/iris.css'
import './styles/themes/ember.css'
import './styles/themes/electric.css'
import { LanguageProvider } from './i18n'
import { ThemeProvider } from './theme/ThemeProvider'
import { applyAccent, readStoredAccent } from './theme/accent'
import App from './App.tsx'

// Applied before first paint so the stored accent never flashes.
applyAccent(readStoredAccent())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </LanguageProvider>
    </ThemeProvider>
  </StrictMode>,
)
