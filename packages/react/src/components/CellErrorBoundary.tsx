import * as React from 'react';

/**
 * Props for the CellErrorBoundary component.
 */
export interface CellErrorBoundaryProps {
  children: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  fallback?: React.ReactNode;
  /**
   * Resets the boundary when any entry changes (compared with `Object.is`).
   * Pass values the cell depends on, such as the row item and cell value. When
   * omitted, the boundary resets whenever `children` identity changes.
   */
  resetKeys?: readonly unknown[];
}

interface CellErrorBoundaryState {
  hasError: boolean;
}

const DEFAULT_FALLBACK_STYLE: React.CSSProperties = {
  color: 'var(--ogrid-error, #d32f2f)',
  fontSize: '0.75rem',
  padding: '2px 4px',
};

/**
 * Error boundary for cell renderers and custom editors.
 * Prevents a runtime error in a cell from crashing the entire grid.
 */
export class CellErrorBoundary extends React.Component<
  CellErrorBoundaryProps,
  CellErrorBoundaryState
> {
  constructor(props: CellErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): CellErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  componentDidUpdate(prevProps: CellErrorBoundaryProps, prevState: CellErrorBoundaryState): void {
    // The child threw during this very update. Resetting here would re-render
    // (and re-report) in the same commit, so wait for the next update.
    if (!prevState.hasError && this.state.hasError) return;
    if (!this.state.hasError) return;
    const prevKeys = prevProps.resetKeys;
    const keys = this.props.resetKeys;
    const shouldReset =
      prevKeys && keys
        ? prevKeys.length !== keys.length || keys.some((key, i) => !Object.is(key, prevKeys[i]))
        : prevProps.children !== this.props.children;
    if (shouldReset) {
      this.setState({ hasError: false });
    }
  }

  resetErrorBoundary(): void {
    this.setState({ hasError: false });
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback !== undefined) {
        return this.props.fallback;
      }
      return <span style={DEFAULT_FALLBACK_STYLE}>⚠ Error</span>;
    }

    return this.props.children;
  }
}
