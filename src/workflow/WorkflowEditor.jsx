import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { parseExpr, toSource, compileAst, formatNumber, FUNCTION_ARITY } from '../engine/expr.js'
import { layout, getAt, replaceAt, wrapAt, removeAt, childrenOf, NODE_W, NODE_H, portY } from './tree.js'

// ---------- how each block looks ----------

const CAT_COLOR = {
  Input: '#6aa8ff', Time: '#f2c14e', Parameter: '#4fd1c5', Number: '#9a99a6',
  Constant: '#b8a4ff', Math: '#ff8fb1', Function: '#b48cff', Output: '#7fd18b',
}
const OP_LABEL = {
  '+': 'Add', '-': 'Subtract', '*': 'Multiply', '/': 'Divide', '^': 'Power', '%': 'Wrap (mod)',
  '<': 'Less than', '>': 'Greater than', '<=': 'At most', '>=': 'At least',
}
const OP_SYMBOL = { '*': '×', '/': '÷', '-': '−' }
const FN_LABEL = {
  sin: 'Sine wave', cos: 'Cosine wave', tan: 'Tangent', abs: 'Absolute', sqrt: 'Square root', floor: 'Round down',
  ceil: 'Round up', round: 'Round', fract: 'Fraction', sign: 'Sign', exp: 'Exponential', log: 'Logarithm',
  min: 'Minimum', max: 'Maximum', pow: 'Power', atan2: 'Angle', step: 'Step', clamp: 'Clamp', mix: 'Blend',
  smoothstep: 'Smooth step', hash: 'Random', noise: 'Smooth noise',
}
const CONST_LABEL = { pi: 'π', tau: 'τ', e: 'e' }
const PARAMS = new Set(['wind', 'amp'])

function describe(n, varLabels) {
  switch (n.type) {
    case 'num': return { cat: 'Number', title: formatNumber(n.value) }
    case 'const': return { cat: 'Constant', title: CONST_LABEL[n.name] ?? n.name }
    case 'var':
      if (n.name === 't') return { cat: 'Time', title: 'Time', code: 't' }
      return { cat: PARAMS.has(n.name) ? 'Parameter' : 'Input', title: varLabels[n.name] ?? n.name, code: n.name }
    case 'neg': return { cat: 'Math', title: 'Negate', code: '−x' }
    case 'op': return { cat: 'Math', title: OP_LABEL[n.op], code: OP_SYMBOL[n.op] ?? n.op }
    case 'call': return { cat: 'Function', title: FN_LABEL[n.name] ?? n.name, code: `${n.name}()` }
    default: return { cat: 'Math', title: '?' }
  }
}

const PALETTE_FUNCS = ['sin', 'cos', 'abs', 'sqrt', 'fract', 'hash', 'noise', 'smoothstep', 'clamp', 'mix', 'min', 'max', 'floor']
const PALETTE_OPS = ['+', '-', '*', '/', '^']

function Sparkline({ values, color }) {
  if (values.length < 2) return null
  let lo = Infinity, hi = -Infinity
  for (const v of values) { if (v < lo) lo = v; if (v > hi) hi = v }
  if (hi - lo < 1e-9) return <svg className="spark" viewBox="0 0 48 14"><path d="M0 7H48" stroke={color} /></svg>
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${((i / (values.length - 1)) * 48).toFixed(1)} ${(13 - ((v - lo) / (hi - lo)) * 12).toFixed(1)}`).join('')
  return <svg className="spark" viewBox="0 0 48 14"><path d={d} stroke={color} /></svg>
}

const fmtVal = (v) => (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2))

export default function WorkflowEditor({ value, vars, varLabels, outputLabel, onChange, sampleEnv }) {
  const parsed = useMemo(() => parseExpr(value, vars), [value, vars])
  const lastGood = useRef(null)
  if (parsed.ok) lastGood.current = parsed.ast
  const ast = parsed.ok ? parsed.ast : lastGood.current
  const [selKey, setSelKey] = useState('root')
  const [dropKey, setDropKey] = useState(null)
  const [editingKey, setEditingKey] = useState(null)

  const L = useMemo(() => (ast ? layout(ast) : null), [ast])
  const byKey = useMemo(() => Object.fromEntries((L?.nodes ?? []).map((e) => [e.key, e])), [L])
  const sel = byKey[selKey] ?? L?.root

  // live values: evaluate every block's sub-expression at a sample point
  const fns = useMemo(() => Object.fromEntries((L?.nodes ?? []).map((e) => [e.key, compileAst(e.node)])), [L])
  const [history, setHistory] = useState({})
  const values = useMemo(() => Object.fromEntries(Object.entries(fns).map(([k, fn]) => [k, fn(sampleEnv)])), [fns, sampleEnv])
  useEffect(() => {
    setHistory(previous => {
      const next = {}
      for (const k in values) {
        const old = previous[k]?.fn === fns[k] ? previous[k].values : []
        const v = values[k]
        next[k] = { fn: fns[k], values: old[old.length - 1] !== v || old.length < 2 ? [...old, v].slice(-48) : old }
      }
      return next
    })
  }, [values, fns])

  // fit the graph into the panel
  const viewRef = useRef(null)
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => {
    const el = viewRef.current
    if (!el || !L) return
    const fit = () => {
      const r = el.getBoundingClientRect()
      setScale(Math.max(0.64, Math.min(1, (r.width - 48) / (L.width + 20), (r.height - 40) / (L.height + 20))))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [L])

  if (!ast || !L) return <div className="wf-empty">{parsed.error}</div>

  const commit = (next) => onChange(toSource(next))
  const applyBlock = (block, targetKey) => {
    const target = byKey[targetKey] ?? sel
    let next
    if (block.kind === 'var') next = replaceAt(ast, target.path, { type: 'var', name: block.name })
    else if (block.kind === 'num') next = replaceAt(ast, target.path, { type: 'num', value: 1 })
    else if (block.kind === 'const') next = replaceAt(ast, target.path, { type: 'const', name: block.name })
    else next = wrapAt(ast, target.path, block)
    setSelKey(target.key)
    commit(next)
  }
  const setNode = (path, node) => commit(replaceAt(ast, path, node))

  // drag a number left/right to scrub it
  const scrub = (e, entry) => {
    if (entry.node.type !== 'num' || e.button !== 0) return
    e.preventDefault()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* synthetic events */ }
    const start = entry.node.value
    const x0 = e.clientX
    const mag = Math.abs(start) > 0 ? Math.pow(10, Math.floor(Math.log10(Math.abs(start))) - 1) : 0.01
    let moved = false
    const move = (ev) => {
      const dx = ev.clientX - x0
      if (Math.abs(dx) > 2) moved = true
      if (!moved) return
      const v = Math.round((start + dx * mag * (ev.shiftKey ? 0.1 : 1)) / (mag / 10)) * (mag / 10)
      setNode(entry.path, { type: 'num', value: Number(v.toFixed(6)) })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const onDragStartBlock = (e, block) => {
    e.dataTransfer.setData('application/x-morph-block', JSON.stringify(block))
    e.dataTransfer.effectAllowed = 'copy'
  }
  const onDropNode = (e, key) => {
    e.preventDefault()
    setDropKey(null)
    const raw = e.dataTransfer.getData('application/x-morph-block')
    if (raw) applyBlock(JSON.parse(raw), key)
  }

  const selDesc = describe(sel.node, varLabels)
  const selKids = childrenOf(sel.node)
  const arity = sel.node.type === 'call' ? FUNCTION_ARITY[sel.node.name] : 0

  return (
    <div className={`wf ${parsed.ok ? '' : 'stale'}`}>
      <aside className="wf-palette" aria-label="Blocks">
        <div className="wf-group">
          <h4>Inputs</h4>
          {vars.map((v) => {
            const cat = v === 't' ? 'Time' : PARAMS.has(v) ? 'Parameter' : 'Input'
            return (
              <button key={v} draggable onDragStart={(e) => onDragStartBlock(e, { kind: 'var', name: v })}
                onClick={() => applyBlock({ kind: 'var', name: v })} style={{ '--c': CAT_COLOR[cat] }}
                title={`Replace the selected block with ${v}`}>
                {v === 't' ? 'Time' : varLabels[v] ?? v}<code>{v}</code>
              </button>
            )
          })}
          <button draggable onDragStart={(e) => onDragStartBlock(e, { kind: 'num' })} onClick={() => applyBlock({ kind: 'num' })}
            style={{ '--c': CAT_COLOR.Number }}>Number<code>1</code></button>
          <button draggable onDragStart={(e) => onDragStartBlock(e, { kind: 'const', name: 'pi' })} onClick={() => applyBlock({ kind: 'const', name: 'pi' })}
            style={{ '--c': CAT_COLOR.Constant }}>Pi<code>π</code></button>
        </div>
        <div className="wf-group">
          <h4>Math</h4>
          <div className="wf-ops">
            {PALETTE_OPS.map((op) => (
              <button key={op} draggable onDragStart={(e) => onDragStartBlock(e, { kind: 'op', op })} onClick={() => applyBlock({ kind: 'op', op })}
                style={{ '--c': CAT_COLOR.Math }} title={`Wrap in ${OP_LABEL[op]}`}>{OP_SYMBOL[op] ?? op}</button>
            ))}
          </div>
        </div>
        <div className="wf-group">
          <h4>Functions</h4>
          {PALETTE_FUNCS.map((f) => (
            <button key={f} draggable onDragStart={(e) => onDragStartBlock(e, { kind: 'call', name: f })} onClick={() => applyBlock({ kind: 'call', name: f })}
              style={{ '--c': CAT_COLOR.Function }} title={`Wrap in ${f}()`}>{FN_LABEL[f]}<code>{f}</code></button>
          ))}
        </div>
      </aside>

      <div className="wf-main">
        <div className="wf-inspector">
          <span className="wf-chip" style={{ '--c': CAT_COLOR[selDesc.cat] }}>{selDesc.cat}</span>
          {sel.node.type === 'num' && (
            <input className="wf-num" type="number" step="any" value={sel.node.value}
              onChange={(e) => e.target.value !== '' && !Number.isNaN(+e.target.value) && setNode(sel.path, { type: 'num', value: +e.target.value })} />
          )}
          {sel.node.type === 'var' && (
            <select value={sel.node.name} onChange={(e) => setNode(sel.path, { type: 'var', name: e.target.value })}>
              {vars.map((v) => <option key={v} value={v}>{v === 't' ? 'Time (t)' : `${varLabels[v] ?? v} (${v})`}</option>)}
            </select>
          )}
          {sel.node.type === 'op' && (
            <select value={sel.node.op} onChange={(e) => setNode(sel.path, { ...sel.node, op: e.target.value })}>
              {Object.keys(OP_LABEL).map((op) => <option key={op} value={op}>{OP_LABEL[op]} ({OP_SYMBOL[op] ?? op})</option>)}
            </select>
          )}
          {sel.node.type === 'call' && (
            <select value={sel.node.name} onChange={(e) => setNode(sel.path, { ...sel.node, name: e.target.value })}>
              {Object.keys(FUNCTION_ARITY).filter((f) => FUNCTION_ARITY[f] === arity).map((f) => (
                <option key={f} value={f}>{FN_LABEL[f] ?? f} ({f})</option>
              ))}
            </select>
          )}
          {(sel.node.type === 'const' || sel.node.type === 'neg') && <span className="wf-sel-title">{selDesc.title}</span>}
          <span className="wf-sep" />
          <span className="wf-hint">{sel.node.type === 'num' ? 'drag the number on the block to scrub it' : 'click or drag a block from the left onto any node'}</span>
          <button className="wf-remove" onClick={() => { commit(removeAt(ast, sel.path)); setSelKey(sel.path.length ? sel.key : 'root') }}
            disabled={!selKids.length && sel.key === 'root'}>
            Remove block
          </button>
        </div>

        <div className="wf-view" ref={viewRef} onClick={() => setEditingKey(null)}>
          <div className="wf-fit" style={{ width: L.width * scale, height: L.height * scale }}>
          <div className="wf-canvas" style={{ width: L.width, height: L.height, transform: `scale(${scale})` }}>
            <svg className="wf-wires" width={L.width} height={L.height}>
              {L.nodes.map((e) => e.children.map((c, i) => {
                const x1 = c.x + NODE_W, y1 = c.y + NODE_H / 2
                const x2 = e.x, y2 = e.y + portY(i, e.children.length)
                const mx = (x1 + x2) / 2
                const color = CAT_COLOR[describe(c.node, varLabels).cat]
                const d = `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`
                return (
                  <g key={`${c.key}`}>
                    <path d={d} className="wire" stroke={color} />
                    <path d={d} className="wire-flow" stroke={color} />
                  </g>
                )
              }))}
              {(() => {
                const r = L.root
                const x1 = r.x + NODE_W, y1 = r.y + NODE_H / 2, x2 = L.output.x, y2 = L.output.y + NODE_H / 2
                const d = `M${x1} ${y1} C${(x1 + x2) / 2} ${y1} ${(x1 + x2) / 2} ${y2} ${x2} ${y2}`
                return <g><path d={d} className="wire" stroke={CAT_COLOR.Output} /><path d={d} className="wire-flow" stroke={CAT_COLOR.Output} /></g>
              })()}
            </svg>

            {L.nodes.map((e) => {
              const d = describe(e.node, varLabels)
              const color = CAT_COLOR[d.cat]
              const nIn = e.children.length
              return (
                <div key={e.key}
                  className={`node ${e.key === sel.key ? 'sel' : ''} ${dropKey === e.key ? 'drop' : ''} ${e.node.type === 'num' ? 'scrub' : ''}`}
                  style={{ left: e.x, top: e.y, '--c': color }}
                  onClick={(ev) => { ev.stopPropagation(); setSelKey(e.key) }}
                  onDoubleClick={() => e.node.type === 'num' && setEditingKey(e.key)}
                  onPointerDown={(ev) => { setSelKey(e.key); scrub(ev, e) }}
                  onDragOver={(ev) => { ev.preventDefault(); setDropKey(e.key) }}
                  onDragLeave={() => setDropKey((k) => (k === e.key ? null : k))}
                  onDrop={(ev) => onDropNode(ev, e.key)}
                  role="button"
                  tabIndex={0}
                  aria-pressed={e.key === sel.key}
                  onKeyDown={(ev) => {
                    if (ev.target !== ev.currentTarget) return
                    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); setSelKey(e.key) }
                    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(ev.key)) {
                      ev.preventDefault(); ev.stopPropagation()
                      const nodes = [...ev.currentTarget.parentElement.querySelectorAll('.node[role="button"]')]
                      const delta = ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 1
                      nodes[(nodes.indexOf(ev.currentTarget) + delta + nodes.length) % nodes.length]?.focus()
                    }
                  }}
                  aria-label={`${d.cat}: ${d.title}`}
                >
                  <div className="node-cat">{d.cat}{d.code && <code>{d.code}</code>}</div>
                  {editingKey === e.key ? (
                    <input autoFocus className="node-edit" defaultValue={e.node.value}
                      onClick={(ev) => ev.stopPropagation()} onPointerDown={(ev) => ev.stopPropagation()}
                      onKeyDown={(ev) => {
                        ev.stopPropagation()
                        if (ev.key === 'Enter') { const v = parseFloat(ev.currentTarget.value); if (!Number.isNaN(v)) setNode(e.path, { type: 'num', value: v }); setEditingKey(null) }
                        if (ev.key === 'Escape') setEditingKey(null)
                      }}
                      onBlur={(ev) => { const v = parseFloat(ev.currentTarget.value); if (!Number.isNaN(v)) setNode(e.path, { type: 'num', value: v }); setEditingKey(null) }} />
                  ) : (
                    <div className="node-title">{d.title}</div>
                  )}
                  {e.node.type !== 'num' && e.node.type !== 'const' && (
                    <div className="node-val"><Sparkline values={history[e.key]?.values ?? []} color={color} /><span>{fmtVal(values[e.key] ?? 0)}</span></div>
                  )}
                  {Array.from({ length: nIn }, (_, i) => <span key={i} className="port in" style={{ top: portY(i, nIn) - 4 }} />)}
                  <span className="port out" />
                </div>
              )
            })}

            <div className="node output" style={{ left: L.output.x, top: L.output.y, '--c': CAT_COLOR.Output }}>
              <div className="node-cat">Output</div>
              <div className="node-title">{outputLabel}</div>
              <div className="node-val"><Sparkline values={history.root?.values ?? []} color={CAT_COLOR.Output} /><span>{fmtVal(values.root ?? 0)}</span></div>
              <span className="port in" style={{ top: NODE_H / 2 - 4 }} />
            </div>
          </div>
          </div>
        </div>
        {!parsed.ok && <div className="wf-stale">The expression has an error ({parsed.error}). Showing the last working workflow.</div>}
      </div>
    </div>
  )
}
