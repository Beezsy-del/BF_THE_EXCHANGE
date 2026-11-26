import React from 'react'

export default function FormulaRow({ def, value, result, onChange }) {
  const bad = !result.ok
  return (
    <div className={`frow ${bad ? 'bad' : ''}`}>
      <div className="flabel">
        <span className="dot" />
        <div>
          <div className="fname">{def.label}</div>
          <div className="funit">{def.unit}</div>
        </div>
      </div>
      <div className="finput">
        <input
          maxLength={4000}
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${def.label} formula`}
          aria-invalid={bad}
        />
        {bad ? (
          <div className="ferr">
            <span className="caret" style={{ left: `calc(${Math.min(result.pos, value.length)}ch + 10px)` }} />
            {result.error}
          </div>
        ) : (
          <div className="fhelp">
            vars: {def.vars.map((v) => <code key={v}>{v}</code>)} <span>· {def.help}</span>
          </div>
        )}
      </div>
    </div>
  )
}
