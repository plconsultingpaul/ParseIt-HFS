import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold text-red-600 mb-2">
                Something went wrong
              </h1>
              <p className="text-gray-600">
                The application encountered an unexpected error
              </p>
            </div>

            {this.state.error && (
              <div className="bg-gray-100 rounded-lg p-4 mb-6">
                <h2 className="font-semibold text-gray-800 mb-2">Error Details:</h2>
                <pre className="text-sm text-gray-700 whitespace-pre-wrap overflow-auto">
                  {this.state.error.message}
                </pre>
                {this.state.error.stack && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-800">
                      Stack Trace
                    </summary>
                    <pre className="mt-2 text-xs text-gray-600 whitespace-pre-wrap overflow-auto">
                      {this.state.error.stack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="flex gap-4 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Reload Page
              </button>
              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Clear Cache & Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
