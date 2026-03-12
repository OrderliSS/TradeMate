import { Badge } from "@/components/ui/badge";
import { Crown, Star, UserCheck } from "lucide-react";
import { CustomerTier } from "@/types/database";
import { cn } from "@/lib/utils";

interface CustomerTierBadgeProps {
  tier: CustomerTier;
  showIcon?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const getTierConfig = (tier: CustomerTier) => {
  switch (tier) {
    case 'vip':
      return {
        label: 'VIP',
        icon: Crown,
        className: 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white border-yellow-300 hover:from-yellow-500 hover:to-amber-600 shadow-lg shadow-yellow-200/50',
        iconClassName: 'text-white drop-shadow-sm'
      };
    case 'frequent_buyer':
      return {
        label: 'Frequent Buyer',
        icon: Star,
        className: 'bg-gradient-to-r from-blue-600 to-blue-700 text-white border-blue-500 hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-300/60',
        iconClassName: 'text-white drop-shadow-sm'
      };
    case 'standard':
      return {
        label: 'Standard',
        icon: UserCheck,
        className: 'bg-transparent text-foreground border-border hover:bg-accent/50',
        iconClassName: 'text-muted-foreground'
      };
  }
};

const getSizeClasses = (size: 'sm' | 'md' | 'lg') => {
  switch (size) {
    case 'sm':
      return 'text-xs px-2 py-0.5 h-5';
    case 'md':
      return 'text-sm px-2.5 py-1 h-6';
    case 'lg':
      return 'text-sm px-3 py-1.5 h-8';
  }
};

export function CustomerTierBadge({ 
  tier, 
  showIcon = true, 
  className, 
  size = 'md' 
}: CustomerTierBadgeProps) {
  const config = getTierConfig(tier);
  const Icon = config.icon;
  const sizeClasses = getSizeClasses(size);
  const iconSize = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5';

  return (
    <Badge 
      variant="secondary"
      className={cn(
        config.className,
        sizeClasses,
        'font-medium border transition-colors',
        className
      )}
    >
      {showIcon && <Icon className={cn(iconSize, config.iconClassName, 'mr-1.5')} />}
      {config.label}
    </Badge>
  );
}