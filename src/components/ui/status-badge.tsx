import { Badge, BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  getTaskStatusClasses, 
  getDeliveryStatusClasses, 
  getCampaignStatusClasses, 
  getFinancialClasses,
  getSystemMessageClasses,
  getAssetStatusClasses,
  getTransitStatusClasses 
} from "@/lib/semantic-colors";

type StatusType = 'task' | 'delivery' | 'campaign' | 'financial' | 'system' | 'asset' | 'transit';
type TaskStatus = "active" | "blacklisted" | "suspended" | "new" | "in_progress" | "on_hold" | "completed" | "cancelled";
type DeliveryStatus = "ordered" | "vendor_processing" | "passed_to_carrier" | "shipped" | "in_transit" | "out_for_delivery" | "delivered";
type CampaignStatus = "draft" | "active" | "paused" | "completed";
type FinancialStatus = "profit" | "loss";
type SystemStatus = "info" | "success" | "warning" | "danger";
type AssetStatus = "active" | "instock" | "allocated" | "sold" | "ordered" | "gifted_in" | "gifted_out" | "being_configured" | "available" | "inactive";
type TransitStatus = "available" | "pending_transit" | "in_transit" | "passed_to_local" | "handover_pending" | "being_configured" | "delivered" | "completed";

interface StatusBadgeProps extends Omit<BadgeProps, 'children'> {
  status: string;
  type?: StatusType;
  label?: string;
}

// Customer status mappings for proper display
const customerStatusMap = {
  active: { type: 'system' as const, status: 'success', label: 'Active' },
  blacklisted: { type: 'system' as const, status: 'danger', label: 'Blacklisted' },
  suspended: { type: 'system' as const, status: 'warning', label: 'Suspended' }
};

// Product status mappings for proper display
const productStatusMap = {
  active: { type: 'system' as const, status: 'success', label: 'Active' },
  out_of_stock: { type: 'system' as const, status: 'warning', label: 'Out of Stock' }
};

export function StatusBadge({ status, type = 'task', label, className, ...props }: StatusBadgeProps) {
  // Handle customer and product status mappings
  const customerMapping = (customerStatusMap as any)[status];
  const productMapping = (productStatusMap as any)[status];
  const actualMapping = customerMapping || productMapping;
  const actualType = actualMapping?.type || type;
  const actualStatus = actualMapping?.status || status;
  const mappedLabel = actualMapping?.label;
  
  // Get appropriate color classes based on type
  let statusClasses;
  switch (actualType) {
    case 'delivery':
      statusClasses = getDeliveryStatusClasses(actualStatus as any);
      break;
    case 'campaign':
      statusClasses = getCampaignStatusClasses(actualStatus as any);
      break;
    case 'financial':
      statusClasses = getFinancialClasses(actualStatus as any);
      break;
    case 'system':
      statusClasses = getSystemMessageClasses(actualStatus as any);
      break;
    case 'asset':
      statusClasses = getAssetStatusClasses(actualStatus as any);
      break;
    case 'transit':
      statusClasses = getTransitStatusClasses(actualStatus as any);
      break;
    case 'task':
    default:
      statusClasses = getTaskStatusClasses(actualStatus as any);
      break;
  }

  const displayLabel = label || mappedLabel || actualStatus.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  return (
    <Badge
      className={cn(statusClasses.bg, statusClasses.text, statusClasses.border, "interactive-scale hover:opacity-80", className)}
      {...props}
    >
      {displayLabel}
    </Badge>
  );
}