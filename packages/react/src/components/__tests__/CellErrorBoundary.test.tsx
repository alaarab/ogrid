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

  it('other cells continue rendering normally when one errors', () => {
    const ThrowError = () => {
      throw new Error('Cell error');
    };

    render(
      <div>
        <CellErrorBoundary>
          <div data-testid="cell-before">Before</div>
        </CellErrorBoundary>
        <CellErrorBoundary>
          <ThrowError />
        </CellErrorBoundary>
        <CellErrorBoundary>
          <div data-testid="cell-after">After</div>
        </CellErrorBoundary>
      </div>
    );

    expect(screen.getByTestId('cell-before')).toBeInTheDocument();
    expect(screen.getByText('⚠ Error')).toBeInTheDocument();
    expect(screen.getByTestId('cell-after')).toBeInTheDocument();
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

  it('handles error in a nested component (deeply nested throw)', () => {
    const DeepNested = () => {
      throw new Error('Deep error');
    };
    const Wrapper = () => (
      <div>
        <span>
          <DeepNested />
        </span>
      </div>
    );

    render(
      <CellErrorBoundary>
        <Wrapper />
      </CellErrorBoundary>
    );

    expect(screen.getByText('⚠ Error')).toBeInTheDocument();
  });

  it('two separate boundaries can independently catch different errors', () => {
    const ThrowA = () => { throw new Error('Error A'); };
    const ThrowB = () => { throw new Error('Error B'); };

    render(
      <div>
        <CellErrorBoundary>
          <ThrowA />
        </CellErrorBoundary>
        <CellErrorBoundary>
          <ThrowB />
        </CellErrorBoundary>
      </div>
    );

    // Both boundaries caught their errors  -  default fallback ⚠ Error appears twice
    const errorElements = screen.getAllByText('⚠ Error');
    expect(errorElements).toHaveLength(2);
  });

  it('onError is called with both error and errorInfo (contains componentStack)', () => {
    const onError = jest.fn();
    const ThrowWithMessage = () => {
      throw new Error('Specific error message');
    };

    render(
      <CellErrorBoundary onError={onError}>
        <ThrowWithMessage />
      </CellErrorBoundary>
    );

    expect(onError).toHaveBeenCalledTimes(1);
    const [error, errorInfo] = onError.mock.calls[0];
    expect(error.message).toBe('Specific error message');
    expect(typeof errorInfo.componentStack).toBe('string');
  });

  it('fallback prop replaces default ⚠ Error text', () => {
    const ThrowError = () => { throw new Error('any'); };

    render(
      <CellErrorBoundary fallback={<span data-testid="my-fallback">cell unavailable</span>}>
        <ThrowError />
      </CellErrorBoundary>
    );

    expect(screen.queryByText('⚠ Error')).not.toBeInTheDocument();
    expect(screen.getByTestId('my-fallback')).toBeInTheDocument();
    expect(screen.getByText('cell unavailable')).toBeInTheDocument();
  });

  it('sibling boundaries are independent  -  one error does not prevent others from rendering', () => {
    const ThrowError = () => { throw new Error('isolated'); };
    const Fine = ({ label }: { label: string }) => <div data-testid={label}>{label}</div>;

    render(
      <div>
        <CellErrorBoundary><Fine label="before" /></CellErrorBoundary>
        <CellErrorBoundary><ThrowError /></CellErrorBoundary>
        <CellErrorBoundary><Fine label="after" /></CellErrorBoundary>
      </div>
    );

    expect(screen.getByTestId('before')).toBeInTheDocument();
    expect(screen.getByText('⚠ Error')).toBeInTheDocument();
    expect(screen.getByTestId('after')).toBeInTheDocument();
  });
});
