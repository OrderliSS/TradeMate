import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { enhancedToast } from "@/components/ui/enhanced-toast";

interface AssetSyncResult {
  assets_updated: number;
  orders_allocated: number;
  message: string;
}

export const useAssetDeliverySync = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (stockOrderId: string): Promise<AssetSyncResult> => {
      const { data, error } = await supabase
        .rpc('manual_sync_asset_status', { p_expense_id: stockOrderId });

      if (error) throw error;
      
      return data?.[0] || { assets_updated: 0, orders_allocated: 0, message: 'No data returned' };
    },
    onSuccess: (result) => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ["asset-management"] });
      queryClient.invalidateQueries({ queryKey: ["all-assets"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["allocations"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });

      enhancedToast.success("Asset Status Sync Complete", result.message);
    },
    onError: (error) => {
      enhancedToast.error("Asset Sync Failed", error.message);
    },
  });
};

export const useProductAssetSync = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: string): Promise<AssetSyncResult> => {
      const { data, error } = await supabase
        .rpc('manual_sync_asset_status_by_product', { p_product_id: productId });

      if (error) throw error;
      
      const result = data?.[0];
      return {
        assets_updated: result?.assets_updated || 0,
        orders_allocated: result?.orders_allocated || 0,
        message: result ? `Updated ${result.assets_updated || 0} assets and allocated ${result.orders_allocated || 0} orders` : 'No data returned'
      };
    },
    onSuccess: (result) => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ["asset-management"] });
      queryClient.invalidateQueries({ queryKey: ["all-assets"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["allocations"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-availability"] });

      enhancedToast.success("Product Asset Sync Complete", result.message);
    },
    onError: (error) => {
      enhancedToast.error("Product Asset Sync Failed", error.message);
    },
  });
};

export const useAssetStatusValidation = (expenseId?: string) => {
  return useMutation({
    mutationFn: async (stockOrderId: string) => {
      // Check for assets that might need status updates
      const { data: stockOrder, error: stockOrderError } = await supabase
        .from('stock_orders')
        .select('id, product_id, delivery_status, name')
        .eq('id', stockOrderId)
        .single();

      if (stockOrderError) throw stockOrderError;

      if (stockOrder.delivery_status !== 'delivered') {
        return { needsSync: false, message: 'Stock order is not delivered' };
      }

      // Check for assets with inconsistent status
      const { data: assetsNeedingSync, error: assetsError } = await supabase
        .from('asset_management')
        .select('id, status, transit_status, asset_tag')
        .eq('product_id', stockOrder.product_id)
        .in('status', ['ordered', 'in_transit'])
        .or('transit_status.eq.in_transit,transit_status.eq.pending_transit');

      if (assetsError) throw assetsError;

      return {
        needsSync: (assetsNeedingSync?.length || 0) > 0,
        assetCount: assetsNeedingSync?.length || 0,
        message: assetsNeedingSync?.length 
          ? `${assetsNeedingSync.length} assets need status update`
          : 'All assets are in correct state'
      };
    },
  });
};