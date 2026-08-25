// src/components/common/GameBoundary.tsx
// What the player sees when the game cannot render at all.
//
// ── Why this exists ───────────────────────────────────────────────────────────────────
//
// Measured, not imagined: a save carrying one unknown building type takes the standalone game to
// a completely blank page — `#root` with zero children, no text, no button. And the game's own
// `Reset` and `Load` controls live INSIDE the tree that just died, so there is no way to reach
// them. Reloading rehydrates the same save and dies again. It is not a white screen, it is a loop.
//
// The host has a boundary, but its only offer is `window.location.reload()`, which for a crash
// caused by PERSISTED state is a button that cannot do what it says — the one thing this codebase
// treats as never acceptable.
//
// ── The rule this follows ─────────────────────────────────────────────────────────────
//
// NOTHING IS DESTROYED BEFORE IT IS OFFERED BACK. The save is the player's; a boundary that
// leads with "start fresh" is a boundary that eats domains. Copying it out comes first, and the
// destructive option is only shown where this component actually owns the save.
//
// When the save is CLOUD-BACKED (the OurDaysApp embed passes `initialBlob`/`onPersist`), clearing
// localStorage fixes nothing — the same blob arrives again on the next mount — and writing a fresh
// domain over it would destroy the real one. So there is deliberately no reset button in that
// case: it says where the save lives and stops.

import React from 'react'

/** Set before a reload so a second crash can tell the player that reloading did not help. */
const TRIED_KEY = 'warlord_boundary_reloaded'

interface Props {
  children: React.ReactNode
  /** Which localStorage key holds the save. Absent = this component does not own one. */
  saveKey?: string
  /** True when the save comes from somewhere else (the cloud embed), so local reset is a lie. */
  external?: boolean
  /** The host's theme, when it has one. Otherwise the game's own choice is read from storage. */
  theme?: 'light' | 'dark'
  onError?: (error: Error, info: React.ErrorInfo) => void
}

interface State {
  error: Error | null
  /** The save as it was at the moment of the crash, read once so a later write cannot lose it. */
  snapshot: string | null
  copied: boolean
  reloadFailed: boolean
}

export default class GameBoundary extends React.Component<Props, State> {
  state: State = { error: null, snapshot: null, copied: false, reloadFailed: false }

  componentDidMount() { this.clearMarkIfHealthy() }
  componentDidUpdate() { this.clearMarkIfHealthy() }

  /**
   * The mark is cleared only once the game has ACTUALLY rendered.
   *
   * `componentDidMount` fires even when the boundary mounts showing the error screen — it is the
   * boundary that mounted, not the game — so clearing unconditionally would erase the very mark
   * `componentDidCatch` had just read, and the next crash would offer a plain "Reload" again as
   * though it had never been tried. Without this guard the loop the mark exists to break survives.
   */
  private clearMarkIfHealthy() {
    if (this.state.error) return
    try { window.sessionStorage.removeItem(TRIED_KEY) } catch { /* private mode */ }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Read the save HERE, before anything else touches storage. A crash mid-write is exactly when
    // the copy matters most, and by the time the player presses a button it may already be gone.
    let snapshot: string | null = null
    try {
      snapshot = this.props.saveKey ? window.localStorage.getItem(this.props.saveKey) : null
    } catch { snapshot = null }

    let reloadFailed = false
    try {
      reloadFailed = window.sessionStorage.getItem(TRIED_KEY) === '1'
    } catch { reloadFailed = false }

    this.setState({ snapshot, reloadFailed })
    this.props.onError?.(error, info)
  }

  private reload = () => {
    // Mark first. If the next mount crashes too, the player is told rather than offered the same
    // button a second time.
    try { window.sessionStorage.setItem(TRIED_KEY, '1') } catch { /* private mode */ }
    window.location.reload()
  }

  private copy = async () => {
    const text = this.state.snapshot
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      this.setState({ copied: true })
      return
    } catch { /* no clipboard permission, or an insecure context — fall through */ }
    // The fallback matters: inside a Capacitor WebView the async clipboard is not always there.
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      this.setState({ copied: true })
    } catch { /* nothing more to try; the textarea below still shows the text */ }
  }

  private reset = () => {
    const { saveKey } = this.props
    if (!saveKey) return
    try {
      window.localStorage.removeItem(saveKey)
      window.sessionStorage.removeItem(TRIED_KEY)
    } catch { /* nothing to clear */ }
    window.location.reload()
  }

  render() {
    const { error, snapshot, copied, reloadFailed } = this.state
    if (!error) return this.props.children

    const canReset = !!this.props.saveKey && !this.props.external
    const btn = 'px-3 py-2 min-h-[38px] rounded border text-sm'

    // The boundary paints its own root, so it has to carry the theme itself — the tokens live on
    // `.warlord`, and a recovery screen in the wrong palette reads as a second thing being broken.
    let dark = this.props.theme === 'dark'
    if (!this.props.theme && this.props.saveKey) {
      try { dark = window.localStorage.getItem(`${this.props.saveKey}:dark`) === 'true' } catch { dark = false }
    }

    return (
      <div className={`warlord${dark ? ' dark' : ''} min-h-screen p-4 sm:p-6`}>
        <div className="max-w-2xl mx-auto space-y-4 rounded-lg border border-wl-line bg-wl-panel p-4">
          <h1 className="font-serif text-xl font-bold text-wl-ink">The domain could not be drawn.</h1>

          <p className="text-sm text-wl-muted">
            {reloadFailed
              ? 'Reloading did not help, so the trouble is in the saved domain rather than in this session.'
              : 'Something in the game threw while rendering. If it was a one-off, reloading will clear it.'}
          </p>

          <pre className="text-[11px] font-mono whitespace-pre-wrap text-wl-bad-ink bg-wl-panel-muted rounded p-2 overflow-x-auto">
            {error.message || String(error)}
          </pre>

          <div className="flex flex-wrap gap-2">
            {/* Reload is offered first only while it might still be the answer. Once it has been
                tried and failed, leading with it would be the same lie a second time. */}
            {!reloadFailed && (
              <button onClick={this.reload} className={`${btn} border-wl-accent bg-wl-accent text-wl-accent-ink`}>
                Reload
              </button>
            )}
            {snapshot && (
              <button onClick={this.copy} className={`${btn} border-wl-line bg-wl-panel-muted text-wl-ink`}>
                {copied ? 'Copied ✓' : 'Copy my save'}
              </button>
            )}
            {reloadFailed && (
              <button onClick={this.reload} className={`${btn} border-wl-line bg-wl-panel-muted text-wl-ink`}>
                Reload again
              </button>
            )}
          </div>

          {snapshot && (
            <details className="text-[11px]">
              <summary className="cursor-pointer text-wl-muted">
                Show the saved domain ({snapshot.length.toLocaleString()} characters)
              </summary>
              {/* Shown as text as well as copied: a clipboard can be refused, and a player who
                  can see their save can always keep it by hand. */}
              <textarea
                readOnly
                value={snapshot}
                onFocus={(e) => e.currentTarget.select()}
                className="mt-2 w-full h-40 font-mono text-[10px] rounded border border-wl-line bg-wl-panel-muted text-wl-ink p-2"
              />
            </details>
          )}

          {canReset ? (
            <div className="border-t border-wl-line pt-3 space-y-2">
              <p className="text-[11px] text-wl-muted">
                Starting again <strong>deletes this saved domain</strong>. Copy it out first if you want to keep it —
                once it is gone nothing here can bring it back.
              </p>
              <button onClick={this.reset} className={`${btn} border-wl-bad text-wl-bad-ink bg-wl-bad-surface`}>
                Delete the save and start a new domain
              </button>
            </div>
          ) : (
            <p className="border-t border-wl-line pt-3 text-[11px] text-wl-muted">
              {/* No reset here, on purpose: the blob is handed in from outside, so clearing local
                  storage would change nothing, and writing a fresh domain over it would destroy
                  the real one. */}
              This domain is stored outside the game, so there is nothing here to clear — the copy above is
              the thing worth keeping.
            </p>
          )}
        </div>
      </div>
    )
  }
}
