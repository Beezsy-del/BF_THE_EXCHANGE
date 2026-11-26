import React from 'react'

export default function Transport({ playing, time, onToggle, onReset, hint, right }) {
  return (
    <footer className="transport">
      <button className="icon" onClick={onToggle} title="Play / pause (Space)" aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? (
          <svg viewBox="0 0 16 16"><rect x="4" y="3" width="3" height="10" /><rect x="9" y="3" width="3" height="10" /></svg>
        ) : (
          <svg viewBox="0 0 16 16"><path d="M5 3l8 5-8 5z" /></svg>
        )}
      </button>
      <button className="icon" onClick={onReset} title="Reset (R)" aria-label="Reset">
        <svg viewBox="0 0 16 16"><path d="M8 3a5 5 0 1 1-4.6 3H1.5L4.5 2.5 7.5 6H5.6A3 3 0 1 0 8 5z" /></svg>
      </button>
      <span className="clock">t = {time.toFixed(2)}</span>
      {hint && <span className="thint">{hint}</span>}
      <span className="spacer" />
      <span className="kbd-hint"><kbd>Space</kbd> play <kbd>R</kbd> reset <kbd>F</kbd> present</span>
      <span className="res">{right}</span>
    </footer>
  )
}
