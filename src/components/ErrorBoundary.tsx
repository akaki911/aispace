import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled error in application boundary', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-6 text-center text-slate-100">
          <div className="max-w-md space-y-4">
            <h1 className="text-2xl font-semibold">რაღაც არასწორად წავიდა</h1>
            <p className="text-sm text-slate-300">
              ჩვენს აპლიკაციაში დაფიქსირდა მოულოდნელი შეცდომა. გთხოვთ, განაახლოთ გვერდი ან სცადოთ მოგვიანებით.
            </p>
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              მთავარი გვერდი
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
