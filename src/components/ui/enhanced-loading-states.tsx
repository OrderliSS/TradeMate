import { ReactNode } from 'react';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LoadingStateProps {
  isLoading?: boolean;
  error?: Error | null;
  isEmpty?: boolean;
  children: ReactNode;
  loadingComponent?: ReactNode;
  errorComponent?: ReactNode;
  emptyComponent?: ReactNode;
  onRetry?: () => void;
  className?: string;
}

export const EnhancedLoadingState = ({
  isLoading,
  error,
  isEmpty,
  children,
  loadingComponent,
  errorComponent,
  emptyComponent,
  onRetry,
  className
}: LoadingStateProps) => {
  if (isLoading) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12", className)}>
        {loadingComponent || (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading data...</p>
          </>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
        {errorComponent || (
          <>
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-medium mb-2">Something went wrong</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              {error.message || 'An unexpected error occurred while loading data.'}
            </p>
            {onRetry && (
              <Button onClick={onRetry} variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
            )}
          </>
        )}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
        {emptyComponent}
      </div>
    );
  }

  return <>{children}</>;
};

// Specialized loading states
export const CustomerLoadingState = ({ count = 8 }: { count?: number }) => (
  <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
    {Array.from({ length: count }).map((_, index) => (
      <div key={index} className="border rounded-lg p-4 space-y-3">
        <div className="animate-pulse">
          <div className="flex items-start justify-between mb-3">
            <div className="flex gap-2">
              <div className="h-5 bg-muted rounded w-16"></div>
              <div className="h-4 w-4 bg-muted rounded-full"></div>
            </div>
            <div className="h-8 w-8 bg-muted rounded"></div>
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-16"></div>
          </div>
          <div className="space-y-1 mt-3">
            <div className="h-3 bg-muted rounded w-full"></div>
            <div className="h-3 bg-muted rounded w-5/6"></div>
            <div className="h-3 bg-muted rounded w-4/5"></div>
          </div>
          <div className="border-t pt-2 mt-3">
            <div className="space-y-1">
              <div className="flex justify-between">
                <div className="h-3 bg-muted rounded w-12"></div>
                <div className="h-3 bg-muted rounded w-6"></div>
              </div>
              <div className="flex justify-between">
                <div className="h-3 bg-muted rounded w-16"></div>
                <div className="h-3 bg-muted rounded w-12"></div>
              </div>
            </div>
          </div>
          <div className="h-8 bg-muted rounded w-full mt-3"></div>
        </div>
      </div>
    ))}
  </div>
);

export const TableLoadingState = ({ rows = 10 }: { rows?: number }) => (
  <div className="space-y-2">
    {Array.from({ length: rows }).map((_, index) => (
      <div key={index} className="animate-pulse border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className="h-10 w-10 bg-muted rounded-full"></div>
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-muted rounded w-48"></div>
              <div className="flex gap-4">
                <div className="h-3 bg-muted rounded w-32"></div>
                <div className="h-3 bg-muted rounded w-24"></div>
                <div className="h-3 bg-muted rounded w-20"></div>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="h-6 w-16 bg-muted rounded"></div>
            <div className="h-8 w-8 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

// Loading state with progress indication
export const ProgressLoadingState = ({ 
  progress, 
  message = 'Loading...' 
}: { 
  progress?: number; 
  message?: string; 
}) => (
  <div className="flex flex-col items-center justify-center py-12 space-y-4">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
    <div className="text-center space-y-2">
      <p className="text-muted-foreground">{message}</p>
      {typeof progress === 'number' && (
        <div className="w-64 bg-muted rounded-full h-2">
          <div 
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  </div>
);

// Skeleton loading with stagger animation
export const StaggeredLoadingState = ({ 
  items = 6,
  Component
}: { 
  items?: number;
  Component: React.ComponentType<{ delay: number }>;
}) => (
  <div className="space-y-4">
    {Array.from({ length: items }).map((_, index) => (
      <Component key={index} delay={index * 100} />
    ))}
  </div>
);