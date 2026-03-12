import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EnhancedTooltip } from "@/components/ui/enhanced-tooltip";
import { CopyableBadge } from "@/components/ui/copyable-badge";
import { Package, ExternalLink, Copy } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDateAsStored } from "@/lib/date-utils";

interface Purchase {
  id: string;
  ticket_number?: string;
  receipt_number?: string;
  total_amount?: number;
  purchase_date?: string;
  order_status?: string;
  product?: {
    name: string;
  };
}

interface PurchaseLinkBadgeProps {
  purchase: Purchase;
  size?: "sm" | "default";
  showLink?: boolean;
  className?: string;
}

export const PurchaseLinkBadge = ({ 
  purchase, 
  size = "default", 
  showLink = true,
  className 
}: PurchaseLinkBadgeProps) => {
  const purchaseRef = purchase.ticket_number || purchase.receipt_number || `#${purchase.id.slice(0, 8)}`;
  
  const tooltipContent = (
    <div className="space-y-1 text-xs">
      <div className="font-medium">{purchase.product?.name || 'Product'}</div>
      <div>Reference: {purchaseRef}</div>
      {purchase.total_amount && <div>Amount: ${purchase.total_amount.toFixed(2)}</div>}
      {purchase.purchase_date && <div>Date: {formatDateAsStored(purchase.purchase_date, "MMM d, yyyy")}</div>}
      {purchase.order_status && <div>Status: {purchase.order_status.toUpperCase()}</div>}
    </div>
  );

  const badgeContent = (
    <div className="flex items-center gap-1">
      <Badge 
        variant="outline" 
        className={`gap-1 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 ${size === "sm" ? "px-1.5 py-0.5 text-xs h-5" : ""} ${className}`}
      >
        <Package className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
        {purchaseRef}
        {showLink && <ExternalLink className="h-3 w-3" />}
      </Badge>
      <button
        onClick={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          try {
            await navigator.clipboard.writeText(purchaseRef);
            // You could add toast here if needed
          } catch (err) {
            console.error('Failed to copy:', err);
          }
        }}
        className="w-5 h-5 p-0 hover:bg-blue-100 border border-blue-200 rounded-sm flex items-center justify-center bg-blue-50 hover:bg-blue-100 transition-colors"
        title={`Copy ${purchaseRef}`}
      >
        <Copy className="h-3 w-3 text-blue-700" />
      </button>
    </div>
  );

  if (!showLink) {
    return (
      <EnhancedTooltip content={tooltipContent}>
        {badgeContent}
      </EnhancedTooltip>
    );
  }

  return (
    <EnhancedTooltip content={tooltipContent}>
      <Link to={`/purchases/${purchase.id}`}>
        {badgeContent}
      </Link>
    </EnhancedTooltip>
  );
};