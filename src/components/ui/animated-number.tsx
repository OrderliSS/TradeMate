/**
 * AnimatedNumber Component
 * 
 * Displays a number with smooth count-up/down animation when the value changes.
 * Optionally shows a pulse effect on change.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedNumberProps {
  value: number;
  duration?: number; // Animation duration in ms
  formatValue?: (value: number) => string;
  className?: string;
  showPulse?: boolean; // Show pulse effect on change
  pulseClassName?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

export function AnimatedNumber({
  value,
  duration = 200,
  formatValue,
  className,
  showPulse = true,
  pulseClassName,
  prefix = '',
  suffix = '',
  decimals = 0,
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isPulsing, setIsPulsing] = useState(false);
  const previousValueRef = useRef(value);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const formatNumber = useCallback(
    (num: number): string => {
      if (formatValue) {
        return formatValue(num);
      }
      return num.toFixed(decimals);
    },
    [formatValue, decimals]
  );

  useEffect(() => {
    const previousValue = previousValueRef.current;
    
    // No animation needed if value hasn't changed
    if (previousValue === value) {
      return;
    }

    // Trigger pulse effect
    if (showPulse) {
      setIsPulsing(true);
      const pulseTimer = setTimeout(() => setIsPulsing(false), 300);
      // Cleanup pulse timer if component unmounts
      return () => clearTimeout(pulseTimer);
    }
  }, [value, showPulse]);

  useEffect(() => {
    const previousValue = previousValueRef.current;
    
    if (previousValue === value) {
      return;
    }

    const startValue = previousValue;
    const endValue = value;
    const difference = endValue - startValue;
    
    // Cancel any existing animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-out cubic for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentValue = startValue + difference * easeOut;
      
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
        startTimeRef.current = null;
        previousValueRef.current = endValue;
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [value, duration]);

  // Update ref when animation completes or on initial render
  useEffect(() => {
    previousValueRef.current = value;
  }, []);

  return (
    <span
      className={cn(
        'inline-block tabular-nums transition-colors',
        isPulsing && 'animate-update-pulse',
        isPulsing && pulseClassName,
        className
      )}
    >
      {prefix}
      {formatNumber(displayValue)}
      {suffix}
    </span>
  );
}

// Convenience component for currency values
interface AnimatedCurrencyProps extends Omit<AnimatedNumberProps, 'formatValue' | 'prefix' | 'decimals'> {
  value: number;
  currency?: string;
  locale?: string;
}

export function AnimatedCurrency({
  value,
  currency = 'AUD',
  locale = 'en-AU',
  ...props
}: AnimatedCurrencyProps) {
  const formatCurrency = useCallback(
    (num: number): string => {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(num);
    },
    [currency, locale]
  );

  return <AnimatedNumber value={value} formatValue={formatCurrency} {...props} />;
}

// Convenience component for percentage values
interface AnimatedPercentageProps extends Omit<AnimatedNumberProps, 'suffix' | 'decimals'> {
  value: number;
  decimals?: number;
}

export function AnimatedPercentage({
  value,
  decimals = 1,
  ...props
}: AnimatedPercentageProps) {
  return (
    <AnimatedNumber
      value={value}
      decimals={decimals}
      suffix="%"
      {...props}
    />
  );
}

export default AnimatedNumber;
