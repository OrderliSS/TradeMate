import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { enhancedToast } from "@/components/ui/enhanced-toast";

interface AssetStatusUpdateParams {
  assetId: string;
  newStatus: string;
  notes?: string;
}

interface BulkAssetStatusUpdateParams {
  assetIds: string[];
  newStatus: string;
  notes?: string;
}

export const useAssetStatusManager = () => {
  const queryClient = useQueryClient();

  const updateSingleAssetStatus = useMutation({
    mutationFn: async ({ assetId, newStatus, notes }: AssetStatusUpdateParams) => {
      const { data, error } = await supabase
        .from('asset_management')
        .update({ 
          status: newStatus === 'in_transit' ? 'instock' : newStatus, 
          notes: notes,
          transit_status: newStatus === 'in_transit' ? 'in_transit' : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', assetId)
        .select()
        .single();

      if (error) {
        console.error('useAssetStatusManager: Status update failed', error);
        throw new Error(`Failed to update asset status: ${error.message}`);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-management"] });
      queryClient.invalidateQueries({ queryKey: ["all-assets"] });
      
      enhancedToast.success("Asset Status Updated", "The asset status has been successfully changed.");
    },
    onError: (error) => {
      enhancedToast.error("Error Updating Asset Status", error.message);
    },
  });

  const updateBulkAssetStatus = useMutation({
    mutationFn: async ({ assetIds, newStatus, notes }: BulkAssetStatusUpdateParams) => {
      console.log('Starting bulk asset status update:', { assetIds, newStatus, notes });
      
      // Validate authentication
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        console.error('Authentication check failed:', sessionError);
        throw new Error('Authentication required. Please refresh the page and try again.');
      }
      
      console.log('Session validated for bulk update:', { 
        userId: session.user?.id, 
        email: session.user?.email,
        hasAccessToken: !!session.access_token 
      });

      // Validate asset IDs
      if (!assetIds || assetIds.length === 0) {
        throw new Error('No assets selected for bulk update');
      }

      console.log('Attempting bulk update via Supabase...');
      const { data, error } = await supabase
        .from('asset_management')
        .update({ 
          status: newStatus === 'in_transit' ? 'instock' : newStatus, 
          notes: notes,
          transit_status: newStatus === 'in_transit' ? 'in_transit' : null,
          updated_at: new Date().toISOString()
        })
        .in('id', assetIds)
        .select();

      if (error) {
        console.error('useAssetStatusManager: Bulk status update failed', {
          error,
          assetIds,
          newStatus,
          notes,
          sessionUserId: session.user?.id,
          errorDetails: error.details,
          errorHint: error.hint,
          errorCode: error.code
        });
        throw new Error(`Failed to update asset statuses: ${error.message} (Code: ${error.code || 'Unknown'})`);
      }

      console.log('Bulk asset status update successful:', { 
        updatedCount: data?.length || 0,
        assetIds: data?.map(asset => asset.id) || []
      });
      
      return { successful: data?.map(asset => asset.id) || [], failed: [] };
    },
    onSuccess: (result) => {
      console.log('Bulk update success, invalidating queries...');
      
      // COMPREHENSIVE query invalidation - force immediate refresh
      queryClient.invalidateQueries({ queryKey: ["asset-management"] });
      queryClient.invalidateQueries({ queryKey: ["all-assets"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["asset-status-overview"] });
      queryClient.invalidateQueries({ queryKey: ["unified-asset-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["unified-asset-metrics-all-products"] });
      queryClient.invalidateQueries({ queryKey: ["asset-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["allocations"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product-stock-summary"] });
      queryClient.invalidateQueries({ queryKey: ["sot-metrics"] });
      
      // Force refetch immediately to update UI
      queryClient.refetchQueries({ queryKey: ["unified-asset-metrics-all-products"] });
      queryClient.refetchQueries({ queryKey: ["asset-management"] });
      
      const { successful, failed } = result;
      
      if (failed.length === 0) {
        enhancedToast.success("Bulk Status Update Completed", `Successfully updated ${successful.length} assets. Metrics refreshed.`);
      } else {
        enhancedToast.error("Bulk Status Update Partial Success", `Updated ${successful.length} assets. ${failed.length} failed. Check console for details.`);
        console.error('Bulk update failures:', failed);
      }
    },
    onError: (error) => {
      console.error('Bulk update error:', error);
      enhancedToast.error("Error in Bulk Status Update", error.message);
    },
  });

  // Manual asset status update without validation (direct database update)
  const forceUpdateAssetStatus = useMutation({
    mutationFn: async ({ assetId, newStatus, notes }: AssetStatusUpdateParams) => {
      

      const { data, error } = await supabase
        .from('asset_management')
        .update({ 
          status: newStatus === 'in_transit' ? 'instock' : newStatus, 
          notes: notes,
          transit_status: newStatus === 'in_transit' ? 'in_transit' : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', assetId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to force update asset status: ${error.message}`);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-management"] });
      queryClient.invalidateQueries({ queryKey: ["all-assets"] });
      
      enhancedToast.success("Asset Status Force Updated", "The asset status has been updated (bypassing validation).");
    },
    onError: (error) => {
      enhancedToast.error("Error Force Updating Asset Status", error.message);
    },
  });

  return {
    updateSingleAssetStatus,
    updateBulkAssetStatus,
    forceUpdateAssetStatus,
    isUpdatingSingle: updateSingleAssetStatus.isPending,
    isUpdatingBulk: updateBulkAssetStatus.isPending,
    isForceUpdating: forceUpdateAssetStatus.isPending
  };
};

// Hook to get valid status transitions
export const useAssetStatusTransitions = () => {
  const getValidTransitions = (currentStatus: string): string[] => {
    switch (currentStatus) {
      case 'ordered':
        return ['instock', 'in_transit', 'cancelled'];
      case 'instock':
        return ['being_configured', 'ready', 'cancelled'];
      case 'being_configured':
        return ['ready', 'instock', 'cancelled'];
      case 'in_transit':
        return ['ready', 'delivered', 'cancelled'];
      case 'ready':
        return ['allocated', 'in_transit', 'maintenance', 'retired'];
      case 'allocated':
        return ['sold', 'ready', 'in_transit'];
      case 'available':
        return ['allocated', 'in_transit', 'maintenance', 'written_off', 'retired'];
      case 'sold':
        return ['returned'];
      case 'maintenance':
        return ['ready', 'retired'];
      case 'retired':
        return ['ready'];
      case 'written_off':
        return []; // Terminal state - no transitions allowed
      default:
        return ['instock', 'being_configured', 'ready', 'retired', 'written_off'];
    }
  };

  const isValidTransition = (currentStatus: string, newStatus: string): boolean => {
    const validTransitions = getValidTransitions(currentStatus);
    return validTransitions.includes(newStatus);
  };

  return { getValidTransitions, isValidTransition };
};