import React from 'react'

export default function Slider({ label, value, min, max, step, onChange, hint, format }) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <label className="slider">
      <span className="srow">
        <span>{label}</span>
        <span className="sval">{format ? format(value) : value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--pct': `${pct}%` }}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      {hint && <span className="shint">{hint}</span>}
    </label>
  )
}
