import React from 'react'

// If any screen throws, show a calm recovery card instead of a blank page.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false })
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="recover">
        <div className="recover-card">
          <p className="eyebrow">Something went wrong</p>
          <h2>This screen hit a snag.</h2>
          <p>Your other work is safe. Go back home, or clear the saved state if the problem keeps coming back.</p>
          <div className="cta">
            <button className="primary" onClick={this.props.onHome}>Go home</button>
            <button className="ghost" onClick={this.props.onReset}>Clear saved work</button>
          </div>
        </div>
      </div>
    )
  }
}
