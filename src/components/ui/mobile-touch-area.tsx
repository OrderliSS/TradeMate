import { ReactNode, TouchEvent, useState } from 'react';
import { cn } from '@/lib/utils';

interface MobileTouchAreaProps {
  children: ReactNode;
  onTap?: () => void;
  onLongPress?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  className?: string;
  disabled?: boolean;
  longPressDuration?: number;
  swipeThreshold?: number;
}

export function MobileTouchArea({
  children,
  onTap,
  onLongPress,
  onSwipeLeft,
  onSwipeRight,
  className,
  disabled = false,
  longPressDuration = 500,
  swipeThreshold = 50,
}: MobileTouchAreaProps) {
  const [touchStart, setTouchStart] = useState<{ x: number; y: number; time: number } | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [isPressed, setIsPressed] = useState(false);

  const handleTouchStart = (e: TouchEvent) => {
    if (disabled) return;

    const touch = e.touches[0];
    setTouchStart({
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    });
    setIsPressed(true);

    if (onLongPress) {
      const timer = setTimeout(() => {
        onLongPress();
        setTouchStart(null);
      }, longPressDuration);
      setLongPressTimer(timer);
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (disabled || !touchStart) return;

    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStart.x);
    const deltaY = Math.abs(touch.clientY - touchStart.y);

    // If moved too much, cancel long press
    if ((deltaX > 10 || deltaY > 10) && longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (disabled || !touchStart) return;

    setIsPressed(false);

    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;
    const duration = Date.now() - touchStart.time;

    // Swipe detection
    if (Math.abs(deltaX) > swipeThreshold && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX > 0 && onSwipeRight) {
        onSwipeRight();
      } else if (deltaX < 0 && onSwipeLeft) {
        onSwipeLeft();
      }
    }
    // Tap detection (short press with minimal movement)
    else if (duration < longPressDuration && Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
      onTap?.();
    }

    setTouchStart(null);
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={cn(
        'touch-manipulation select-none transition-transform',
        isPressed && 'scale-[0.98]',
        className
      )}
    >
      {children}
    </div>
  );
}
