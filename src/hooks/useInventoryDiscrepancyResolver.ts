import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DiscrepancyAnalysis {
  product_id: string;
  product_name: string;
  sku: string;
  database_stock: number;
  asset_count: number;
  allocated_count: number;
  discrepancy: number;
  suggested_action: string;
  allocation_issues?: AllocationIssue[];
}

export interface AllocationIssue {
  allocation_id: string;
  purchase_id: string;
  customer_name?: string;
  quantity_allocated: number;
  allocation_type: 'stock' | 'asset';
  status: string;
  issue_description: string;
}

export const useInventoryDiscrepancyResolver = () => {
  const queryClient = useQueryClient();

  const analyzeDiscrepancies = useMutation({
    mutationFn: async (productId?: string): Promise<DiscrepancyAnalysis[]> => {
      // Get product data with stock information
      const { data: products, error: productError } = await supabase
        .from('products')
        .select('id, name, sku, stock_quantity')
        .eq(productId ? 'id' : 'status', productId || 'active');

      if (productError) throw productError;

      const analyses: DiscrepancyAnalysis[] = [];

      for (const product of products) {
        // Get asset count
        const { count: assetCount, error: assetError } = await supabase
          .from('asset_management')
          .select('*', { count: 'exact', head: true })
          .eq('product_id', product.id);

        if (assetError) throw assetError;

        // Get allocated stock count
        const { data: stockAllocations, error: stockAllocError } = await supabase
          .from('stock_allocations')
          .select('quantity_allocated')
          .eq('product_id', product.id);

        if (stockAllocError) throw stockAllocError;

        const allocatedStock = stockAllocations?.reduce((sum, alloc) => sum + (alloc.quantity_allocated || 0), 0) || 0;

        // Get asset allocations count
        const { count: assetAllocations, error: assetAllocError } = await supabase
          .from('allocations')
          .select('*', { count: 'exact', head: true })
          .eq('product_id', product.id)
          .eq('status', 'allocated');

        if (assetAllocError) throw assetAllocError;

        const totalAllocated = allocatedStock + (assetAllocations || 0);
        const discrepancy = product.stock_quantity - (assetCount || 0);

        let suggestedAction = 'No action needed';
        if (Math.abs(discrepancy) > 0) {
          if (discrepancy > 0) {
            suggestedAction = `Reduce database stock by ${discrepancy} units to match assets`;
          } else {
            suggestedAction = `Create ${Math.abs(discrepancy)} missing asset records or increase stock`;
          }
        }

        analyses.push({
          product_id: product.id,
          product_name: product.name,
          sku: product.sku || '',
          database_stock: product.stock_quantity || 0,
          asset_count: assetCount || 0,
          allocated_count: totalAllocated,
          discrepancy,
          suggested_action: suggestedAction
        });
      }

      return analyses.filter(analysis => Math.abs(analysis.discrepancy) > 0);
    },
  });

  const resolveDiscrepancy = useMutation({
    mutationFn: async ({ 
      productId, 
      action 
    }: { 
      productId: string; 
      action: 'sync_to_assets' | 'create_missing_assets' | 'investigate_allocations';
    }) => {
      switch (action) {
        case 'sync_to_assets':
          // Use the existing sync function
          const { data: syncResult, error: syncError } = await supabase
            .rpc('sync_inventory_with_assets', { p_product_id: productId });
          
          if (syncError) throw syncError;
          return { action, result: syncResult };

        case 'investigate_allocations':
          // Get allocation conflicts for this product
          const { data: conflicts, error: conflictError } = await supabase
            .rpc('identify_allocation_conflicts')
            .eq('product_id', productId);
          
          if (conflictError) throw conflictError;
          return { action, result: conflicts };

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["asset-management"] });
      queryClient.invalidateQueries({ queryKey: ["allocations"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-availability"] });
      
      if (result.action === 'sync_to_assets') {
        toast.success("Inventory synchronized with asset count");
      } else if (result.action === 'investigate_allocations') {
        toast.info("Allocation conflicts identified");
      }
    },
    onError: (error) => {
      toast.error(`Failed to resolve discrepancy: ${error.message}`);
    },
  });

  const deallocateOrphanedStock = useMutation({
    mutationFn: async (allocationIds: string[]) => {
      const { error } = await supabase
        .from('stock_allocations')
        .delete()
        .in('id', allocationIds);
      
      if (error) throw error;
      return allocationIds.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["stock-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(`Deallocated ${count} orphaned allocations`);
    },
    onError: (error) => {
      toast.error(`Failed to deallocate: ${error.message}`);
    },
  });

  return {
    analyzeDiscrepancies,
    resolveDiscrepancy,
    deallocateOrphanedStock
  };
};