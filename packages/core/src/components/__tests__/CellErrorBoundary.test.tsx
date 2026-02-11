import * as React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CellErrorBoundary } from '../CellErrorBoundary';

// Suppress console.error during error boundary tests (React logs caught errors)
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  (console.error as jest.Mock).mockRestore();
});

describe('CellErrorBoundary', () => {
  it('renders children normally when no error occurs', () => {
    render(
      <CellErrorBoundary>
        <div data-testid="cell-content">Hello World</div>
      </CellErrorBoundary>
    );

    expect(screen.getByTestId('cell-content')).toBeInTheDocument();
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('catches errors and renders default fallback', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    render(
      <CellErrorBoundary>
        <ThrowError />
      </CellErrorBoundary>
    );

    expect(screen.getByText('⚠ Error')).toBeInTheDocument();
  });

  it('calls onError callback when an error is caught', () => {
    const onError = jest.fn();
    const ThrowError = () => {
      throw new Error('Test error');
    };

    render(
      <CellErrorBoundary onError={onError}>
        <ThrowError />
      </CellErrorBoundary>
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Test error' }),
      expect.objectContaining({ componentStack: expect.any(String) })
    );
  });

  it('renders custom fallback when provided', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    render(
      <CellErrorBoundary fallback={<div data-testid="custom-fallback">Custom Error UI</div>}>
        <ThrowError />
      </CellErrorBoundary>
    );

    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
    expect(screen.getByText('Custom Error UI')).toBeInTheDocument();
  });

  it('resets error state when children change', () => {
    const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
      if (shouldThrow) {
        throw new Error('Test error');
      }
      return <div data-testid="success">Success</div>;
    };

    const { rerender } = render(
      <CellErrorBoundary>
        <ThrowError shouldThrow={true} />
      </CellErrorBoundary>
    );

    // Error should be caught
    expect(screen.getByText('⚠ Error')).toBeInTheDocument();

    // Re-render with different children (no error)
    rerender(
      <CellErrorBoundary>
        <ThrowError shouldThrow={false} />
      </CellErrorBoundary>
    );

    // Error should be cleared
    expect(screen.getByTestId('success')).toBeInTheDocument();
    expect(screen.queryByText('⚠ Error')).not.toBeInTheDocument();
  });
});
