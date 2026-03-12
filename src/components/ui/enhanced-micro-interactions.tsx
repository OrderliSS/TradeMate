import React from "react";
import { cn } from "@/lib/utils";

/**
 * Enhanced Micro-Interactions
 * Provides consistent interactive effects across the application
 */

// Hover scale animation for interactive elements
const HoverScale = ({ children, className, scale = "scale-105", ...props }: {
  children: React.ReactNode;
  className?: string;
  scale?: string;
  [key: string]: any;
}) => {
  return (
    <div
      className={cn(
        "transition-transform duration-200 hover:cursor-pointer",
        `hover:${scale}`,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

// Ripple effect for buttons and cards
const RippleEffect = ({ children, className, ...props }: {
  children: React.ReactNode;
  className?: string;
  [key: string]: any;
}) => {
  const [ripples, setRipples] = React.useState<Array<{ x: number; y: number; id: number }>>([]);

  const addRipple = (event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const newRipple = { x, y, id: Date.now() };

    setRipples(prev => [...prev, newRipple]);

    setTimeout(() => {
      setRipples(prev => prev.filter(ripple => ripple.id !== newRipple.id));
    }, 600);
  };

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      onMouseDown={addRipple}
      {...props}
    >
      {children}
      {ripples.map(ripple => (
        <span
          key={ripple.id}
          className="absolute rounded-full bg-white/30 animate-ping pointer-events-none"
          style={{
            left: ripple.x - 10,
            top: ripple.y - 10,
            width: 20,
            height: 20,
          }}
        />
      ))}
    </div>
  );
};

// Loading skeleton with shimmer effect
const ShimmerSkeleton = ({ className, ...props }: {
  className?: string;
  [key: string]: any;
}) => {
  return (
    <div
      className={cn(
        "animate-pulse bg-gradient-to-r from-muted via-muted/50 to-muted bg-[length:200%_100%]",
        className
      )}
      style={{
        backgroundImage: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
        animation: "shimmer 2s infinite"
      }}
      {...props}
    />
  );
};

// Pulse glow effect for notifications
const PulseGlow = ({ children, className, color = "primary", ...props }: {
  children: React.ReactNode;
  className?: string;
  color?: "primary" | "success" | "warning" | "danger";
  [key: string]: any;
}) => {
  const glowColors = {
    primary: "shadow-[0_0_20px_hsl(var(--primary)/0.5)]",
    success: "shadow-[0_0_20px_hsl(var(--success)/0.5)]",
    warning: "shadow-[0_0_20px_hsl(var(--warning)/0.5)]",
    danger: "shadow-[0_0_20px_hsl(var(--destructive)/0.5)]"
  };

  return (
    <div
      className={cn(
        "animate-pulse",
        glowColors[color],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

// Stagger animation for lists
const StaggerChildren = ({ children, className, delay = 0.1, ...props }: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  [key: string]: any;
}) => {
  const childArray = React.Children.toArray(children);

  return (
    <div className={cn("space-y-1", className)} {...props}>
      {childArray.map((child, index) => (
        <div
          key={index}
          className="animate-fade-in"
          style={{
            animationDelay: `${index * delay}s`,
            animationFillMode: "both"
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
};

// Floating animation for cards
const FloatingCard = ({ children, className, ...props }: {
  children: React.ReactNode;
  className?: string;
  [key: string]: any;
}) => {
  return (
    <div
      className={cn(
        "transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-elegant)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

// Interactive border animation
const AnimatedBorder = ({ children, className, ...props }: {
  children: React.ReactNode;
  className?: string;
  [key: string]: any;
}) => {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-border/50 transition-all duration-300",
        "before:absolute before:inset-0 before:rounded-lg before:p-[1px] before:bg-gradient-to-r before:from-primary/50 before:to-primary/20",
        "before:opacity-0 before:transition-opacity before:duration-300 hover:before:opacity-100",
        "before:-z-10",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export {
  HoverScale,
  RippleEffect,
  ShimmerSkeleton,
  PulseGlow,
  StaggerChildren,
  FloatingCard,
  AnimatedBorder
};