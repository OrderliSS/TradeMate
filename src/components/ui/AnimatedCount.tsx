/**
 * Animated Count Component
 * 
 * Displays a number with smooth animation when value changes.
 * Includes subtle highlight effect on change.
 */

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedCountProps {
  value: number;
  duration?: number;
  className?: string;
  highlightOnChange?: boolean;
  highlightColor?: string;
  formatValue?: (value: number) => string;
}

export function AnimatedCount({
  value,
  duration = 300,
  className,
  highlightOnChange = true,
  highlightColor = 'bg-primary/20',
  formatValue = (v) => v.toLocaleString(),
}: AnimatedCountProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const previousValue = useRef(value);
  const isFirstRender = useRef(true);
  
  useEffect(() => {
    // Skip animation on first render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setDisplayValue(value);
      previousValue.current = value;
      return;
    }
    
    if (value === previousValue.current) return;
    
    // Trigger highlight
    if (highlightOnChange) {
      setIsHighlighted(true);
      const highlightTimeout = setTimeout(() => setIsHighlighted(false), 500);
      
      return () => clearTimeout(highlightTimeout);
    }
  }, [value, highlightOnChange]);
  
  useEffect(() => {
    if (isFirstRender.current) return;
    if (value === previousValue.current) return;
    
    const startValue = previousValue.current;
    const diff = value - startValue;
    const startTime = performance.now();
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic for smooth deceleration
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.round(startValue + diff * easeProgress);
      
      setDisplayValue(currentValue);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        previousValue.current = value;
      }
    };
    
    requestAnimationFrame(animate);
  }, [value, duration]);
  
  return (
    <span
      className={cn(
        'inline-block transition-all duration-300',
        isHighlighted && highlightOnChange && [
          'scale-110',
          highlightColor,
          'rounded px-0.5 -mx-0.5',
        ],
        className
      )}
    >
      {formatValue(displayValue)}
    </span>
  );
}

// Variant for displaying change direction
interface AnimatedCountWithDirectionProps extends AnimatedCountProps {
  showDirection?: boolean;
}

export function AnimatedCountWithDirection({
  value,
  showDirection = true,
  ...props
}: AnimatedCountWithDirectionProps) {
  const [direction, setDirection] = useState<'up' | 'down' | null>(null);
  const previousValue = useRef(value);
  
  useEffect(() => {
    if (value > previousValue.current) {
      setDirection('up');
    } else if (value < previousValue.current) {
      setDirection('down');
    }
    
    previousValue.current = value;
    
    const timeout = setTimeout(() => setDirection(null), 1000);
    return () => clearTimeout(timeout);
  }, [value]);
  
  return (
    <span className="inline-flex items-center gap-1">
      <AnimatedCount value={value} {...props} />
      {showDirection && direction && (
        <span
          className={cn(
            'text-xs transition-opacity duration-500',
            direction === 'up' ? 'text-green-500' : 'text-red-500',
          )}
        >
          {direction === 'up' ? '↑' : '↓'}
        </span>
      )}
    </span>
  );
}
