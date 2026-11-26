import React, { useMemo, useRef } from 'react'
import { COMMANDS, ANIM_PROPS } from '../lang/draw.js'
import { FUNCTION_NAMES } from '../engine/expr.js'

const KEYWORDS = new Set([...COMMANDS, 'RIGHT', 'LEFT', 'AS', 'HSL'])
const FUNCS = new Set(FUNCTION_NAMES)
const PROPS = new Set(ANIM_PROPS)

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Lightweight highlighter: hex colours are drawn in their own colour.
function highlightLine(line) {
  const ci = line.indexOf('//')
  const code = ci >= 0 ? line.slice(0, ci) : line
  const comment = ci >= 0 ? line.slice(ci) : ''
  const html = code.replace(/(#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b)|([A-Za-z_][A-Za-z0-9_]*)|(\d+\.?\d*|\.\d+)|([^A-Za-z0-9_#.]+|[#.])/g,
    (m, hex, word, num, other) => {
      if (hex) return `<span class="t-hex" style="--c:${hex}">${hex}</span>`
      if (word) {
        if (KEYWORDS.has(word.toUpperCase()) && word === word.toUpperCase()) return `<span class="t-kw">${word}</span>`
        if (FUNCS.has(word)) return `<span class="t-fn">${word}</span>`
        if (PROPS.has(word)) return `<span class="t-prop">${word}</span>`
        return `<span class="t-id">${word}</span>`
      }
      if (num) return `<span class="t-num">${num}</span>`
      return esc(other)
    })
  return html + (comment ? `<span class="t-cm">${esc(comment)}</span>` : '')
}

export default function CodeEditor({ value, onChange, errorLine }) {
  const taRef = useRef(null)
  const hlRef = useRef(null)
  const gutRef = useRef(null)
  const lines = value.split('\n')

  const html = useMemo(
    () => lines.map((l, i) => `<div class="hl-line${i + 1 === errorLine ? ' err' : ''}">${highlightLine(l) || ' '}</div>`).join(''),
    [value, errorLine],
  )

  const sync = () => {
    const ta = taRef.current
    hlRef.current.scrollTop = ta.scrollTop
    hlRef.current.scrollLeft = ta.scrollLeft
    gutRef.current.scrollTop = ta.scrollTop
  }

  const onKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = e.target
      const { selectionStart: s, selectionEnd: en } = ta
      const next = value.slice(0, s) + '  ' + value.slice(en)
      onChange(next)
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s + 2 })
    }
    e.stopPropagation()
  }

  return (
    <div className="code">
      <div className="gutter" ref={gutRef} aria-hidden>
        {lines.map((_, i) => (
          <div key={i} className={i + 1 === errorLine ? 'err' : ''}>{i + 1}</div>
        ))}
      </div>
      <div className="code-body">
        <pre className="hl" ref={hlRef} aria-hidden dangerouslySetInnerHTML={{ __html: html }} />
        <textarea
          maxLength={50000}
          ref={taRef}
          value={value}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          onChange={(e) => onChange(e.target.value)}
          onScroll={sync}
          onKeyDown={onKeyDown}
          aria-label="Drawing program"
        />
      </div>
    </div>
  )
}
