import { Badge } from "@/components/ui/badge";
import { 
  User, 
  ShoppingCart, 
  Briefcase, 
  Gift, 
  UserCheck, 
  Users,
  CreditCard,
  Truck,
  Crown,
  Settings,
  Eye,
  Target
} from "lucide-react";
import { cn } from "@/lib/utils";

export type RelationshipType = 
  | 'customer' 
  | 'client' 
  | 'recipient' 
  | 'beneficiary' 
  | 'participant'
  | 'prospect'
  | 'lead'
  | 'primary_contact'
  | 'purchasing_contact'
  | 'billing_contact'
  | 'shipping_contact'
  | 'decision_maker'
  | 'technical_contact';

interface RelationshipTypeBadgeProps {
  type: RelationshipType;
  size?: 'sm' | 'default';
  showIcon?: boolean;
  className?: string;
}

const getRelationshipConfig = (type: RelationshipType) => {
  switch (type) {
    case 'customer':
      return {
        icon: User,
        label: 'Customer',
        className: 'bg-success-bg text-success border-success-border'
      };
    case 'client':
      return {
        icon: Briefcase,
        label: 'Client',
        className: 'bg-info-bg text-info border-info-border'
      };
    case 'recipient':
      return {
        icon: Gift,
        label: 'Recipient',
        className: 'bg-campaign-active-bg text-campaign-active border-campaign-active-border'
      };
    case 'prospect':
      return {
        icon: Target,
        label: 'Prospect',
        className: 'bg-warning-bg text-warning border-warning-border'
      };
    case 'lead':
      return {
        icon: Eye,
        label: 'Lead',
        className: 'bg-delivery-ordered-bg text-delivery-ordered border-delivery-ordered-border'
      };
    case 'beneficiary':
      return {
        icon: UserCheck,
        label: 'Beneficiary',
        className: 'bg-financial-profit-bg text-financial-profit border-financial-profit-border'
      };
    case 'participant':
      return {
        icon: Users,
        label: 'Participant',
        className: 'bg-delivery-processing-bg text-delivery-processing border-delivery-processing-border'
      };
    case 'primary_contact':
      return {
        icon: User,
        label: 'Primary Contact',
        className: 'bg-primary/10 text-primary border-primary/20'
      };
    case 'purchasing_contact':
      return {
        icon: ShoppingCart,
        label: 'Purchasing',
        className: 'bg-success-bg text-success border-success-border'
      };
    case 'billing_contact':
      return {
        icon: CreditCard,
        label: 'Billing',
        className: 'bg-info-bg text-info border-info-border'
      };
    case 'shipping_contact':
      return {
        icon: Truck,
        label: 'Shipping',
        className: 'bg-delivery-intransit-bg text-delivery-intransit border-delivery-intransit-border'
      };
    case 'decision_maker':
      return {
        icon: Crown,
        label: 'Decision Maker',
        className: 'bg-campaign-active-bg text-campaign-active border-campaign-active-border'
      };
    case 'technical_contact':
      return {
        icon: Settings,
        label: 'Technical',
        className: 'bg-delivery-processing-bg text-delivery-processing border-delivery-processing-border'
      };
    default:
      return {
        icon: User,
        label: (type as string).charAt(0).toUpperCase() + (type as string).slice(1),
        className: 'bg-muted text-muted-foreground border-muted'
      };
  }
};

export const RelationshipTypeBadge = ({ 
  type, 
  size = 'default', 
  showIcon = true,
  className 
}: RelationshipTypeBadgeProps) => {
  const config = getRelationshipConfig(type);
  const Icon = config.icon;
  
  const sizeClasses = {
    sm: 'text-xs h-5 px-2 gap-1',
    default: 'text-sm h-6 px-2.5 gap-1.5'
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    default: 'h-3.5 w-3.5'
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium capitalize inline-flex items-center',
        sizeClasses[size],
        config.className,
        className
      )}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      <span>{config.label}</span>
    </Badge>
  );
};