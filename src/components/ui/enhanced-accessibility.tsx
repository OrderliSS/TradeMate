import React from "react";
import { cn } from "@/lib/utils";

/**
 * Enhanced Accessibility Components
 * Provides advanced focus management, ARIA support, and keyboard navigation
 */

interface SkipLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export const SkipLink = ({ href, children, className }: SkipLinkProps) => {
  return (
    <a
      href={href}
      className={cn(
        "sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50",
        "bg-primary text-primary-foreground px-4 py-2 rounded-md",
        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        "transition-all duration-200",
        className
      )}
    >
      {children}
    </a>
  );
};

interface FocusTrapProps {
  children: React.ReactNode;
  active?: boolean;
  className?: string;
}

export const FocusTrap = ({ children, active = true, className }: FocusTrapProps) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    firstElement?.focus();

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [active]);

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
};

interface AnnouncementProps {
  message: string;
  priority?: 'polite' | 'assertive';
  className?: string;
}

export const LiveAnnouncement = ({ message, priority = 'polite', className }: AnnouncementProps) => {
  return (
    <div
      role="status"
      aria-live={priority}
      aria-atomic="true"
      className={cn("sr-only", className)}
    >
      {message}
    </div>
  );
};

interface KeyboardNavProps {
  children: React.ReactNode;
  onNavigate?: (direction: 'up' | 'down' | 'left' | 'right') => void;
  className?: string;
}

export const KeyboardNavigation = ({ children, onNavigate, className }: KeyboardNavProps) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!onNavigate) return;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        onNavigate('up');
        break;
      case 'ArrowDown':
        e.preventDefault();
        onNavigate('down');
        break;
      case 'ArrowLeft':
        e.preventDefault();
        onNavigate('left');
        break;
      case 'ArrowRight':
        e.preventDefault();
        onNavigate('right');
        break;
    }
  };

  return (
    <div onKeyDown={handleKeyDown} className={className}>
      {children}
    </div>
  );
};

interface ProgressIndicatorProps {
  value: number;
  max?: number;
  label?: string;
  description?: string;
  className?: string;
}

export const AccessibleProgressIndicator = ({ 
  value, 
  max = 100, 
  label, 
  description,
  className 
}: ProgressIndicatorProps) => {
  const percentage = Math.round((value / max) * 100);

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="flex justify-between text-sm">
          <span>{label}</span>
          <span aria-label={`${percentage} percent complete`}>{percentage}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label || "Progress indicator"}
        aria-describedby={description ? `progress-desc-${Math.random()}` : undefined}
        className="w-full bg-muted rounded-full h-2 overflow-hidden"
      >
        <div
          className="h-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
      {description && (
        <p id={`progress-desc-${Math.random()}`} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
};

interface ExpandableContentProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  className?: string;
}

export const AccessibleExpandable = ({ 
  trigger, 
  children, 
  expanded = false, 
  onExpandedChange,
  className 
}: ExpandableContentProps) => {
  const [internalExpanded, setInternalExpanded] = React.useState(expanded);
  const contentId = React.useId();
  const triggerId = React.useId();

  const isExpanded = onExpandedChange ? expanded : internalExpanded;
  const setExpanded = onExpandedChange || setInternalExpanded;

  return (
    <div className={className}>
      <div
        id={triggerId}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-controls={contentId}
        onClick={() => setExpanded(!isExpanded)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded(!isExpanded);
          }
        }}
        className="cursor-pointer focus-glow"
      >
        {trigger}
      </div>
      <div
        id={contentId}
        aria-labelledby={triggerId}
        className={cn(
          "transition-all duration-300 overflow-hidden",
          isExpanded ? "opacity-100" : "opacity-0 max-h-0"
        )}
      >
        {isExpanded && children}
      </div>
    </div>
  );
};

// High contrast mode detection hook
export const useHighContrast = () => {
  const [isHighContrast, setIsHighContrast] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setIsHighContrast(e.matches);
    };

    setIsHighContrast(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return isHighContrast;
};

// Reduced motion preference hook
export const useReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return prefersReducedMotion;
};