import { Component, type ErrorInfo, type ReactNode } from 'react';

import { Button } from './Button';
import { EmptyState } from './EmptyState';

export interface SectionErrorBoundaryProps {
  readonly title: string;
  readonly description: string;
  readonly onRetry?: () => void;
  readonly resetKey?: string | number | null;
  readonly children: ReactNode;
}

interface SectionErrorBoundaryState {
  readonly hasError: boolean;
}

export class SectionErrorBoundary extends Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  state: SectionErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): SectionErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Fail-fast at the section surface: keep the rest of the dashboard mounted.
  }

  override componentDidUpdate(
    prevProps: Readonly<SectionErrorBoundaryProps>,
  ): void {
    if (
      this.state.hasError &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.setState({ hasError: false });
    }
  }

  private readonly handleRetry = (): void => {
    this.setState({ hasError: false });
    this.props.onRetry?.();
  };

  override render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <EmptyState
        tone="error"
        title={this.props.title}
        description={this.props.description}
        action={
          <Button variant="secondary" onClick={this.handleRetry}>
            重试
          </Button>
        }
      />
    );
  }
}
