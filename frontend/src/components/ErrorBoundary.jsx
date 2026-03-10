import { Component } from "react"
import { AlertTriangle } from "lucide-react"
import Button from "./ui/Button.jsx"

function DefaultFallback({ onReset }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border border-red-500/30 bg-red-900/10 p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-300">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-semibold text-white">Something went wrong</h2>
        <p className="mt-2 text-sm text-slate-300">
          The page hit an unexpected error. You can reload this section and continue.
        </p>
        <div className="mt-5 flex justify-center">
          <Button onClick={onReset} variant="secondary" size="md">
            Reload section
          </Button>
        </div>
      </div>
    </div>
  )
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error) {
    // Keep diagnostics in console for debugging while preserving UX.
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      const Fallback = this.props.fallback || DefaultFallback
      return <Fallback error={this.state.error} onReset={this.handleReset} />
    }

    return this.props.children
  }
}
