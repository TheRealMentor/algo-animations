import { useEffect, useState } from 'react'
import { Visualizer } from './components/Visualizer'
import { ComplexityLab } from './components/ComplexityLab'
import { STRUCTURES, structureById } from './structures/registry'

type Tab = 'visualize' | 'complexity'
type Theme = 'light' | 'dark'

/**
 * Seeded from the OS preference rather than starting at a "system" value.
 *
 * With a three-state theme, the first click on the toggle resolves
 * system → dark, which is a no-op when the OS is already dark and reads as a
 * broken button. Resolving up front means the toggle always flips visibly.
 */
const initialTheme = (): Theme =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'

export default function App() {
  const [tab, setTab] = useState<Tab>('visualize')
  const [structureId, setStructureId] = useState(STRUCTURES[0].id)
  const [theme, setTheme] = useState<Theme>(initialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const structure = structureById(structureId)

  return (
    <div className="app">
      <header className="masthead">
        <div>
          <h1>Algorithm Playground</h1>
          <p className="tagline">
            Step through an algorithm, then scale the input and watch the cost curve bend.
          </p>
        </div>

        <div className="spacer" />

        <div className="tabs" role="tablist" aria-label="View">
          <button role="tab" aria-selected={tab === 'visualize'} onClick={() => setTab('visualize')}>
            Visualizer
          </button>
          <button
            role="tab"
            aria-selected={tab === 'complexity'}
            onClick={() => setTab('complexity')}
          >
            Complexity Lab
          </button>
        </div>

        <button
          className="icon-button"
          onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          aria-label="Toggle colour theme"
          title="Toggle colour theme"
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </header>

      {/* Always rendered, even with one structure: the taxonomy is part of how
          the app explains itself, and new structures slot in with no layout
          change. */}
      <nav className="structure-nav" aria-label="Data structure">
        <span className="structure-nav-label">Data structure</span>
        <div className="picker">
          {STRUCTURES.map((s) => (
            <button
              key={s.id}
              className="chip chip-structure"
              aria-pressed={s.id === structureId}
              onClick={() => setStructureId(s.id)}
            >
              {s.name}
              <span className="chip-count">{s.algorithms.length}</span>
            </button>
          ))}
        </div>
        <p className="structure-nav-blurb">{structure.blurb}</p>
      </nav>

      <main>
        {tab === 'visualize' ? (
          <Visualizer key={structure.id} structure={structure} />
        ) : (
          <ComplexityLab key={structure.id} structure={structure} />
        )}
      </main>
    </div>
  )
}
