import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorFallback } from './error-fallback';
import { forceUnlockInteraction } from '@/utils/forceUnlockInteraction';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Force unlock interaction immediately so error UI is clickable
    forceUnlockInteraction();
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to activity logs or error tracking service
    this.logError(error, errorInfo);
  }

  logError = async (error: Error, errorInfo: ErrorInfo) => {
    try {
      // You can integrate with your error tracking service here
      console.error('Error logged:', {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error}
          resetError={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}
