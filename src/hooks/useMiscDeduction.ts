import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useCurrentOrganizationId } from "@/hooks/useOrganization";
import { useDataEnvironment } from "@/hooks/useSandbox";

export type MiscReasonCategory = 
  | 'personal_use' 
  | 'damaged' 
  | 'sample' 
  | 'lost' 
  | 'expired'
  | 'other';

export const MISC_REASON_LABELS: Record<MiscReasonCategory, string> = {
  personal_use: 'Personal Use',
  damaged: 'Damaged / Broken',
  sample: 'Product Sample',
  lost: 'Lost Inventory',
  expired: 'Expired / Obsolete',
  other: 'Other',
};

interface MiscDeductionParams {
  productId: string;
  quantity: number;
  reasonCategory: MiscReasonCategory;
  notes?: string;
  updateAssets?: boolean;
}

export const useMiscDeduction = () => {
  const queryClient = useQueryClient();
  const orgId = useCurrentOrganizationId();
  const dataEnvironment = useDataEnvironment();

  return useMutation({
    mutationFn: async ({
      productId,
      quantity,
      reasonCategory,
      notes,
      updateAssets = false,
    }: MiscDeductionParams) => {
      // 1. Get current product data
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('stock_quantity, sot_s3_available, name, sku')
        .eq('id', productId)
        .single();

      if (productError) throw new Error(`Failed to fetch product: ${productError.message}`);

      const currentStock = product.stock_quantity ?? 0;
      const currentSotAvailable = product.sot_s3_available ?? 0;

      // Validate we have enough stock
      if (quantity > currentStock) {
        throw new Error(`Cannot deduct ${quantity} units. Only ${currentStock} available.`);
      }

      const newStock = currentStock - quantity;
      const newSotAvailable = Math.max(0, currentSotAvailable - quantity);

      // 2. Update product stock
      const { error: updateError } = await supabase
        .from('products')
        .update({
          stock_quantity: newStock,
          sot_s3_available: newSotAvailable,
          updated_at: new Date().toISOString(),
        })
        .eq('id', productId);

      if (updateError) throw new Error(`Failed to update stock: ${updateError.message}`);

      // 3. Log inventory movement
      const { error: movementError } = await supabase
        .from('inventory_movements')
        .insert({
          product_id: productId,
          movement_type: 'misc',
          quantity_change: -quantity,
          old_stock_quantity: currentStock,
          new_stock_quantity: newStock,
          reference_type: reasonCategory,
          organization_id: orgId,
          data_environment: dataEnvironment,
          notes: notes || `MISC deduction: ${MISC_REASON_LABELS[reasonCategory]}`,
        });

      if (movementError) {
        console.error('Failed to log inventory movement:', movementError);
        // Non-blocking - continue even if logging fails
      }

      // 4. If updateAssets is true, mark assets as written_off
      let assetsUpdated = 0;
      if (updateAssets) {
        // Find available assets for this product
        const { data: assets, error: assetsError } = await supabase
          .from('asset_management')
          .select('id')
          .eq('product_id', productId)
          .eq('status', 'available')
          .limit(quantity);

        if (!assetsError && assets && assets.length > 0) {
          const assetIds = assets.map(a => a.id);
          
          const { error: assetUpdateError } = await supabase
            .from('asset_management')
            .update({
              status: 'written_off',
              notes: `Written off: ${MISC_REASON_LABELS[reasonCategory]}${notes ? ` - ${notes}` : ''}`,
              updated_at: new Date().toISOString(),
            })
            .in('id', assetIds);

          if (!assetUpdateError) {
            assetsUpdated = assetIds.length;
          } else {
            console.error('Failed to update asset statuses:', assetUpdateError);
          }
        }
      }

      return {
        previousStock: currentStock,
        newStock,
        quantityDeducted: quantity,
        assetsUpdated,
        reasonCategory,
        productName: product.name,
        sku: product.sku,
      };
    },
    onSuccess: (result) => {
      // Invalidate all inventory-related queries
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-movements"] });
      queryClient.invalidateQueries({ queryKey: ["sot-metrics-v2"] });
      queryClient.invalidateQueries({ queryKey: ["sot-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["sot-metrics-unified"] });
      queryClient.invalidateQueries({ queryKey: ["asset-management"] });
      queryClient.invalidateQueries({ queryKey: ["all-assets"] });
      queryClient.invalidateQueries({ queryKey: ["existing-assets-count"] });
      queryClient.invalidateQueries({ queryKey: ["unified-asset-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["product-stock-summary"] });

      let message = `Deducted ${result.quantityDeducted} unit${result.quantityDeducted !== 1 ? 's' : ''} (${MISC_REASON_LABELS[result.reasonCategory]})`;
      if (result.assetsUpdated > 0) {
        message += ` and marked ${result.assetsUpdated} asset${result.assetsUpdated !== 1 ? 's' : ''} as written off`;
      }

      toast({
        title: "MISC Deduction Complete",
        description: message,
      });
    },
    onError: (error) => {
      console.error("MISC deduction failed:", error);
      toast({
        title: "Deduction Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
