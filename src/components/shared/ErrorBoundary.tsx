import { Component, ReactNode } from 'react'

interface State { hasError: boolean }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-dvh px-8 text-center bg-gray-50">
          <i className="ti ti-alert-triangle text-5xl text-gray-300 mb-4" />
          <p className="text-base font-semibold text-gray-700 mb-1">משהו השתבש</p>
          <p className="text-sm text-gray-500 mb-6">נסה לרענן את הדף</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-purple-700 text-white text-sm font-medium rounded-xl hover:bg-purple-800 active:scale-95 transition-all"
          >
            רענן
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
