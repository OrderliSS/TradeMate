import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useDataEnvironment } from "@/hooks/useSandbox";

export interface OrphanedAllocation {
  allocation_id: string;
  asset_id: string;
  asset_tag: string;
  purchase_id: string;
  customer_name?: string;
  allocation_date: string;
  issue_type: 'completed_purchase' | 'cancelled_purchase' | 'missing_purchase';
}

export const useAllocationCleanup = () => {
  const queryClient = useQueryClient();
  const dataEnvironment = useDataEnvironment();

  const findOrphanedAllocations = useMutation({
    mutationFn: async (productId: string): Promise<OrphanedAllocation[]> => {
      // Find allocations for the product
      const { data: allocations, error } = await supabase
        .from('allocations')
        .select(`
          id,
          asset_id,
          purchase_order_id,
          allocated_at,
          asset_management (
            asset_tag,
            status
          )
        `)
        .eq('product_id', productId)
        .eq('status', 'allocated')
        .eq('data_environment', dataEnvironment);

      if (error) throw error;

      const orphaned: OrphanedAllocation[] = [];

      // Check each allocation's purchase status
      for (const allocation of allocations || []) {
        if (!allocation.purchase_order_id) continue;

        const { data: purchase } = await supabase
          .from('purchases')
          .select('id, order_status, pickup_date, customer_id')
          .eq('id', allocation.purchase_order_id)
          .single();

        if (!purchase) {
          // Missing purchase record
          orphaned.push({
            allocation_id: allocation.id,
            asset_id: allocation.asset_id,
            asset_tag: allocation.asset_management?.asset_tag || 'Unknown',
            purchase_id: allocation.purchase_order_id,
            allocation_date: allocation.allocated_at,
            issue_type: 'missing_purchase'
          });
        } else if (purchase.order_status === 'complete' && purchase.pickup_date) {
          // Purchase is complete and picked up, but asset still allocated
          const { data: customer } = await supabase
            .from('customers')
            .select('name')
            .eq('id', purchase.customer_id)
            .single();

          orphaned.push({
            allocation_id: allocation.id,
            asset_id: allocation.asset_id,
            asset_tag: allocation.asset_management?.asset_tag || 'Unknown',
            purchase_id: allocation.purchase_order_id,
            customer_name: customer?.name,
            allocation_date: allocation.allocated_at,
            issue_type: 'completed_purchase'
          });
        } else if (purchase.order_status === 'complete' && !purchase.pickup_date) {
          // Purchase is complete but not picked up - these should be deallocated
          const { data: customer } = await supabase
            .from('customers')
            .select('name')
            .eq('id', purchase.customer_id)
            .single();

          orphaned.push({
            allocation_id: allocation.id,
            asset_id: allocation.asset_id,
            asset_tag: allocation.asset_management?.asset_tag || 'Unknown',
            purchase_id: allocation.purchase_order_id,
            customer_name: customer?.name,
            allocation_date: allocation.allocated_at,
            issue_type: 'cancelled_purchase' // Using this to represent unpicked orders
          });
        }
      }

      return orphaned;
    },
  });

  const cleanupAllocations = useMutation({
    mutationFn: async (allocationIds: string[]) => {
      // Update allocations to 'fulfilled' or 'cancelled' status
      const { error: allocationError } = await supabase
        .from('allocations')
        .update({ status: 'fulfilled', updated_at: new Date().toISOString() })
        .in('id', allocationIds);

      if (allocationError) throw allocationError;

      // Update corresponding assets to 'sold' status
      const { data: allocations } = await supabase
        .from('allocations')
        .select('asset_id')
        .in('id', allocationIds);

      if (allocations && allocations.length > 0) {
        const assetIds = allocations.map(a => a.asset_id);
        
        const { error: assetError } = await supabase
          .from('asset_management')
          .update({ status: 'sold', updated_at: new Date().toISOString() })
          .in('id', assetIds);

        if (assetError) throw assetError;
      }

      return allocationIds.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["allocations"] });
      queryClient.invalidateQueries({ queryKey: ["asset-management"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(`Cleaned up ${count} orphaned allocations`);
    },
    onError: (error) => {
      toast.error(`Failed to cleanup allocations: ${error.message}`);
    },
  });

  const deallocateAssets = useMutation({
    mutationFn: async (allocationIds: string[]) => {
      // Update allocations to 'cancelled' status and set assets back to 'available'
      const { error: allocationError } = await supabase
        .from('allocations')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .in('id', allocationIds);

      if (allocationError) throw allocationError;

      // Get asset IDs and update them to available
      const { data: allocations } = await supabase
        .from('allocations')
        .select('asset_id')
        .in('id', allocationIds);

      if (allocations && allocations.length > 0) {
        const assetIds = allocations.map(a => a.asset_id);
        
        const { error: assetError } = await supabase
          .from('asset_management')
          .update({ status: 'available', updated_at: new Date().toISOString() })
          .in('id', assetIds);

        if (assetError) throw assetError;
      }

      return allocationIds.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["allocations"] });
      queryClient.invalidateQueries({ queryKey: ["asset-management"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(`Deallocated ${count} assets back to available`);
    },
    onError: (error) => {
      toast.error(`Failed to deallocate assets: ${error.message}`);
    },
  });

  return {
    findOrphanedAllocations,
    cleanupAllocations,
    deallocateAssets
  };
};