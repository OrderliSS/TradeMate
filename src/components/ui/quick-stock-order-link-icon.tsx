import { useState } from "react";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EnhancedTooltip } from "@/components/ui/enhanced-tooltip";
import { StockOrderLinkingDialog } from "@/components/StockOrderLinkingDialog";

interface QuickStockOrderLinkIconProps {
  purchaseId: string;
  productId: string;
  currentLinkedIds: string[];
  size?: "sm" | "default";
  variant?: "ghost" | "outline" | "secondary";
  showLabel?: boolean;
}

export const QuickStockOrderLinkIcon = ({
  purchaseId,
  productId,
  currentLinkedIds,
  size = "sm",
  variant = "ghost",
  showLabel = false
}: QuickStockOrderLinkIconProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <EnhancedTooltip content="Link additional stock orders to track incoming inventory">
        <Button
          variant={variant}
          size={size}
          onClick={() => setDialogOpen(true)}
          className="h-8 px-2"
        >
          <Link2 className="h-3 w-3" />
          {showLabel && <span className="ml-1 text-xs">Link Orders</span>}
        </Button>
      </EnhancedTooltip>

      <StockOrderLinkingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        purchaseId={purchaseId}
        productId={productId}
        currentLinkedIds={currentLinkedIds}
      />
    </>
  );
};