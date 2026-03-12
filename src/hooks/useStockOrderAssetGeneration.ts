import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface StockOrderAssetGenerationParams {
  stockOrderId: string;
  productId: string;
  quantity: number;
  status?: string;
  shipmentId?: string; // NEW: Optional shipment linking
}

interface StockOrderAssetGenerationResult {
  success: boolean;
  createdCount: number;
  assetTags: string[];
  errors: string[];
}

export const useStockOrderAssetGeneration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      stockOrderId, 
      productId, 
      quantity, 
      status = 'in_transit',
      shipmentId // NEW: Optional shipment ID
    }: StockOrderAssetGenerationParams): Promise<StockOrderAssetGenerationResult> => {
      console.log('useStockOrderAssetGeneration: Starting asset generation from stock order', {
        stockOrderId, productId, quantity, status, shipmentId
      });

      const { data, error } = await supabase.rpc('generate_assets_from_stock_order', {
        p_stock_order_id: stockOrderId,
        p_product_id: productId,
        p_quantity: quantity,
        p_status: status,
        p_shipment_id: shipmentId || null // Pass shipment ID if provided
      });

      if (error) {
        console.error('useStockOrderAssetGeneration: RPC call failed', error);
        throw new Error(`Failed to generate assets: ${error.message}. Details: ${error.details || 'No additional details'}`);
      }

      if (!data || data.length === 0) {
        throw new Error('No data returned from asset generation function');
      }

      const result = data[0];
      console.log('useStockOrderAssetGeneration: Generation completed', result);

      // Log errors if present
      if (result.error_messages && result.error_messages.length > 0) {
        console.error('Asset generation errors:', result.error_messages);
      }

      return {
        success: result.created_count > 0 && (!result.error_messages || result.error_messages.length === 0),
        createdCount: result.created_count,
        assetTags: result.asset_tags || [],
        errors: result.error_messages || []
      };
    },
    onSuccess: async (result, variables) => {
      console.log('useStockOrderAssetGeneration: Success callback', result);
      
      // Invalidate all relevant queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["asset-management"] }),
        queryClient.invalidateQueries({ queryKey: ["all-assets"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["stock-orders", variables.stockOrderId] }),
        queryClient.invalidateQueries({ queryKey: ["stock-order-shipments", variables.stockOrderId] }),
        queryClient.invalidateQueries({ queryKey: ["stock-order-shipments-for-assets", variables.stockOrderId] }),
        queryClient.invalidateQueries({ queryKey: ["allocated-assets-via-stock-order", variables.stockOrderId] }),
      ]);

      if (result.success && result.createdCount > 0) {
        toast({
          title: "Assets Generated Successfully",
          description: `Created ${result.createdCount} asset records in "in transit" status: ${result.assetTags.join(', ')}`,
        });
      } else if (result.errors && result.errors.length > 0) {
        // Show all errors
        toast({
          title: "Asset Generation Failed",
          description: result.errors.join('; '),
          variant: "destructive",
        });
      } else if (result.createdCount === 0) {
        toast({
          title: "No Assets Created",
          description: "No assets were generated. Check console for details.",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      console.error('useStockOrderAssetGeneration: Mutation error', error);
      toast({
        title: "Error Generating Assets",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};