import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/dm-sans/latin-400.css'
import '@fontsource/dm-sans/latin-500.css'
import '@fontsource/dm-sans/latin-600.css'
import '@fontsource/dm-sans/latin-700.css'
import '@fontsource/manrope/latin-600.css'
import '@fontsource/manrope/latin-700.css'
import '@fontsource/manrope/latin-800.css'
import App from './App'
import './styles.css'

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: boolean }> {
  state = { error: false }
  static getDerivedStateFromError() {
    return { error: true }
  }
  render() {
    if (this.state.error)
      return (
        <main className="fatal-error">
          <img src="/zetta.svg" alt="Zetta" />
          <h1>Vamos tentar de novo?</h1>
          <p>
            O Zetta encontrou um problema inesperado. As apresentações já salvas continuam neste
            navegador.
          </p>
          <button className="button primary" onClick={() => location.reload()}>
            Reabrir o Zetta
          </button>
        </main>
      )
    return this.props.children
  }
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
