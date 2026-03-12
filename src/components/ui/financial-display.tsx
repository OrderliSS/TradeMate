import React from 'react';
import { cn } from "@/lib/utils";
import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react';

interface FinancialDisplayProps {
  amount: number | null | undefined;
  currency?: string;
  showSymbol?: boolean;
  showTrend?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'compact' | 'featured';
}

export const FinancialDisplay: React.FC<FinancialDisplayProps> = ({
  amount,
  currency = 'USD',
  showSymbol = true,
  showTrend = false,
  className,
  size = 'md',
  variant = 'default'
}) => {
  if (amount === null || amount === undefined) {
    return <span className={cn("text-muted-foreground", className)}>-</span>;
  }

  const isPositive = amount >= 0;
  const formatAmount = (value: number) => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: showSymbol ? 'currency' : 'decimal',
      currency: showSymbol ? currency : undefined,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(value));
    
    return value < 0 ? `-${formatted}` : formatted;
  };

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg font-semibold'
  };

  const variantClasses = {
    default: 'inline-flex items-center gap-1',
    compact: 'inline-flex items-center gap-0.5 text-sm',
    featured: 'inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-financial-profit/10 border border-financial-profit/20'
  };

  const amountColor = isPositive ? 'text-financial-profit' : 'text-financial-loss';

  return (
    <span className={cn(
      variantClasses[variant],
      sizeClasses[size],
      amountColor,
      "font-medium transition-colors",
      className
    )}>
      {showSymbol && variant === 'featured' && (
        <DollarSign className="h-4 w-4" />
      )}
      
      <span className="currency-style">
        {formatAmount(amount)}
      </span>
      
      {showTrend && (
        isPositive ? (
          <TrendingUp className="h-4 w-4 text-financial-profit" />
        ) : (
          <TrendingDown className="h-4 w-4 text-financial-loss" />
        )
      )}
    </span>
  );
};