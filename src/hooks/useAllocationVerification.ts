import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDataEnvironment } from "@/hooks/useSandbox";

interface OrphanedAsset {
  id: string;
  asset_tag: string;
  status: string;
  product_id: string;
  product?: {
    name: string;
  };
}

interface AllocationIntegrityResult {
  orphaned_count: number;
  orphaned_assets: OrphanedAsset[];
  has_issues: boolean;
}

/**
 * Hook to verify allocation integrity and detect orphaned assets
 * Orphaned assets are those marked as 'allocated' but have no active allocation record
 */
export const useAllocationVerification = (productId?: string) => {
  const dataEnvironment = useDataEnvironment();
  
  return useQuery<AllocationIntegrityResult>({
    queryKey: ["allocation-verification", productId, dataEnvironment],
    queryFn: async () => {
      // Find assets marked as 'allocated' but with no active allocation
      let query = supabase
        .from("asset_management")
        .select(`
          id,
          asset_tag,
          status,
          product_id,
          product:products(name)
        `)
        .eq("status", "allocated")
        .eq("data_environment", dataEnvironment);
      
      if (productId) {
        query = query.eq("product_id", productId);
      }
      
      const { data: allocatedAssets, error: assetError } = await query;
      
      if (assetError) throw assetError;
      
      if (!allocatedAssets || allocatedAssets.length === 0) {
        return {
          orphaned_count: 0,
          orphaned_assets: [],
          has_issues: false
        };
      }
      
      // Get all active allocations for these assets
      const assetIds = allocatedAssets.map(a => a.id);
      const { data: activeAllocations, error: allocError } = await supabase
        .from("allocations")
        .select("asset_id")
        .in("asset_id", assetIds)
        .in("status", ["allocated", "pre_allocated", "fulfilled"]);
      
      if (allocError) throw allocError;
      
      // Find assets with no active allocation (orphaned)
      const allocatedAssetIds = new Set(activeAllocations?.map(a => a.asset_id) || []);
      const orphanedAssets = allocatedAssets.filter(asset => !allocatedAssetIds.has(asset.id));
      
      return {
        orphaned_count: orphanedAssets.length,
        orphaned_assets: orphanedAssets,
        has_issues: orphanedAssets.length > 0
      };
    },
    enabled: true, // Always enabled for monitoring
    refetchInterval: 60000, // Refetch every minute for monitoring
  });
};

/**
 * Hook to get allocation statistics for monitoring
 */
export const useAllocationStats = (dataEnv?: 'production' | 'sandbox') => {
  const hookDataEnvironment = useDataEnvironment();
  const dataEnvironment = dataEnv || hookDataEnvironment;
  
  return useQuery({
    queryKey: ["allocation-stats", dataEnvironment],
    queryFn: async () => {
      // Get counts of allocations by status
      const { data: allocations, error } = await supabase
        .from("allocations")
        .select("status")
        .eq("data_environment", dataEnvironment);
      
      if (error) throw error;
      
      const stats = {
        total: allocations?.length || 0,
        allocated: 0,
        pre_allocated: 0,
        released: 0,
        fulfilled: 0,
        cancelled: 0
      };
      
      allocations?.forEach(a => {
        if (a.status === 'allocated') stats.allocated++;
        else if (a.status === 'pre_allocated') stats.pre_allocated++;
        else if (a.status === 'released') stats.released++;
        else if (a.status === 'fulfilled') stats.fulfilled++;
        else if (a.status === 'cancelled') stats.cancelled++;
      });
      
      return stats;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};
