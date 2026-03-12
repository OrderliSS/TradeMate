import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { navigateWithEnvironment } from '@/lib/environment-url-helper';
import { forceUnlockInteraction } from '@/utils/forceUnlockInteraction';

interface ErrorFallbackProps {
  error: Error;
  resetError?: () => void;
}

export function ErrorFallback({ error, resetError }: ErrorFallbackProps) {
  const isDevelopment = import.meta.env.DEV;

  // Self-healing: force unlock interaction when error screen renders
  useEffect(() => {
    console.log('[ErrorFallback] Running self-healing unlock');
    forceUnlockInteraction();
    
    // Run again after a delay to catch any late animations
    const timer = setTimeout(() => {
      forceUnlockInteraction();
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-xl">Something went wrong</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            We're sorry, but something unexpected happened. Our team has been notified and is working on a fix.
          </p>

          {isDevelopment && (
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <p className="font-mono text-sm text-destructive font-semibold">
                {error.message}
              </p>
              {error.stack && (
                <pre className="text-xs overflow-auto max-h-64 text-muted-foreground">
                  {error.stack}
                </pre>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            {resetError && (
              <Button onClick={resetError} variant="default">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            )}
            <Button
              onClick={() => navigateWithEnvironment('/')}
              variant="outline"
            >
              <Home className="h-4 w-4 mr-2" />
              Go Home
            </Button>
          </div>

          <p className="text-xs text-muted-foreground pt-4">
            If this problem persists, please contact support with the error details above.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
