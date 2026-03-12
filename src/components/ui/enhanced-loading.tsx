import React from "react";
import { cn } from "@/lib/utils";

/**
 * Enhanced Loading Components
 * Provides sophisticated loading states and skeleton loaders
 */

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const LoadingSpinner = ({ size = "md", className }: LoadingSpinnerProps) => {
  const sizes = {
    sm: "h-4 w-4",
    md: "h-8 w-8", 
    lg: "h-12 w-12"
  };

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div
        className={cn(
          "animate-spin rounded-full border-2 border-primary border-t-transparent",
          sizes[size]
        )}
      />
    </div>
  );
};

interface LoadingDotsProps {
  className?: string;
}

export const LoadingDots = ({ className }: LoadingDotsProps) => {
  return (
    <div className={cn("flex items-center space-x-1", className)}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-2 w-2 rounded-full bg-primary animate-bounce"
          style={{ animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </div>
  );
};

interface LoadingPulseProps {
  className?: string;
}

export const LoadingPulse = ({ className }: LoadingPulseProps) => {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div className="relative">
        <div className="h-8 w-8 rounded-full border-4 border-primary/20" />
        <div className="absolute top-0 left-0 h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-pulse" />
      </div>
    </div>
  );
};

interface SkeletonLoaderProps {
  lines?: number;
  className?: string;
}

export const SkeletonLoader = ({ lines = 3, className }: SkeletonLoaderProps) => {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-4 bg-muted rounded animate-pulse",
            i === lines - 1 && "w-3/4" // Last line shorter
          )}
        />
      ))}
    </div>
  );
};

interface CardSkeletonProps {
  className?: string;
}

export const CardSkeleton = ({ className }: CardSkeletonProps) => {
  return (
    <div className={cn("border border-border rounded-lg p-6 space-y-4", className)}>
      <div className="flex items-start space-x-4">
        <div className="h-12 w-12 bg-muted rounded animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-muted rounded animate-pulse" />
          <div className="h-3 bg-muted rounded animate-pulse w-3/4" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-muted rounded animate-pulse" />
        <div className="h-3 bg-muted rounded animate-pulse w-5/6" />
      </div>
    </div>
  );
};

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export const TableSkeleton = ({ rows = 5, columns = 4, className }: TableSkeletonProps) => {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex space-x-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div
              key={colIndex}
              className="h-8 bg-muted rounded animate-pulse flex-1"
              style={{ animationDelay: `${(rowIndex * columns + colIndex) * 0.1}s` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

interface LoadingOverlayProps {
  children: React.ReactNode;
  loading: boolean;
  className?: string;
}

export const LoadingOverlay = ({ children, loading, className }: LoadingOverlayProps) => {
  return (
    <div className={cn("relative", className)}>
      {children}
      {loading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <LoadingSpinner size="lg" />
        </div>
      )}
    </div>
  );
};