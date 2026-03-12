import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { enhancedToast } from "@/components/ui/enhanced-toast";

interface OrphanedAsset {
  asset_id: string;
  asset_tag: string;
  product_name: string;
  old_status: string;
  old_purchase_order_id: string;
  action: string;
}

export const useOrphanedAssetCleanup = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      purchaseId, 
      productId, 
      dryRun = false 
    }: { 
      purchaseId?: string; 
      productId?: string; 
      dryRun?: boolean;
    }) => {
      const { data, error } = await supabase.rpc('cleanup_orphaned_allocated_assets_v2', {
        p_purchase_id: purchaseId || null,
        p_product_id: productId || null,
        p_dry_run: dryRun
      });
      
      if (error) throw error;
      return data as OrphanedAsset[];
    },
    onSuccess: (data, variables) => {
      if (!variables.dryRun) {
        // Always invalidate queries when cleanup runs to ensure UI updates immediately
        queryClient.invalidateQueries({ queryKey: ["asset-management"] });
        queryClient.invalidateQueries({ queryKey: ["allocations"] });
        queryClient.invalidateQueries({ queryKey: ["stock-allocations"] });
        queryClient.invalidateQueries({ queryKey: ["stock-order-allocations"] });
        queryClient.invalidateQueries({ queryKey: ["available-assets"] });
        queryClient.invalidateQueries({ queryKey: ["purchases"] });
        // Force immediate refetch to ensure warning banner updates instantly
        queryClient.invalidateQueries({ queryKey: ["orphaned-assets-check"] });
        queryClient.refetchQueries({ queryKey: ["orphaned-assets-check"] });
        
        if (data && data.length > 0) {
          enhancedToast.success(
            "Orphaned Assets Fixed",
            `Reset ${data.length} orphaned asset${data.length > 1 ? 's' : ''} to available status`
          );
        } else {
          enhancedToast.success("No Issues Found", "All assets have proper allocation records");
        }
      }
    },
    onError: (error: Error) => {
      enhancedToast.error("Cleanup Failed", error.message);
    }
  });
};

export const useOrphanedAssetCheck = (purchaseId?: string, enabled = false) => {
  return useQuery({
    queryKey: ['orphaned-assets-check', purchaseId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('cleanup_orphaned_allocated_assets_v2', {
        p_purchase_id: purchaseId || null,
        p_product_id: null,
        p_dry_run: true // Just check, don't fix
      });
      
      if (error) throw error;
      return (data as OrphanedAsset[]) || [];
    },
    enabled,
    refetchInterval: 30000, // Check every 30 seconds when enabled
  });
};
