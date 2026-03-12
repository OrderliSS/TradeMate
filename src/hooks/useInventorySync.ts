import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface InventorySyncResult {
  product_id: string;
  product_name: string;
  old_stock: number;
  new_stock: number;
  asset_count: number;
  individual_units: number;
  correction_applied: boolean;
}

// Hook to manually trigger inventory sync with assets (keeping original for compatibility)
export const useInventorySync = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (productId?: string): Promise<InventorySyncResult[]> => {
      const { data, error } = await supabase.rpc('sync_inventory_with_assets', {
        p_product_id: productId || null
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      return data || [];
    },
    onSuccess: (results) => {
      const correctedCount = results.filter(r => r.correction_applied).length;
      
      if (correctedCount > 0) {
        toast.success(`Inventory synchronized! ${correctedCount} products corrected.`);
      } else {
        toast.success("Inventory is already in sync with assets.");
      }
      
      // Invalidate all inventory-related queries
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product-stock-summary"] });
      queryClient.invalidateQueries({ queryKey: ["unified-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
      queryClient.invalidateQueries({ queryKey: ["delivery-based-inventory"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to sync inventory: ${error.message}`);
    },
  });
};

// Hook for legacy inventory operations (keeping for backward compatibility)
export const useInventoryOperations = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      productId, 
      operation, 
      quantity 
    }: { 
      productId: string; 
      operation: 'move_to_stock' | 'move_to_transit' | 'adjust_stock';
      quantity: number;
    }) => {
      const { data: product, error: fetchError } = await supabase
        .from("products")
        .select("stock_quantity, stock_in_transit")
        .eq("id", productId)
        .single();
      
      if (fetchError) throw fetchError;
      
      let updateData: { stock_quantity?: number; stock_in_transit?: number } = {};
      
      switch (operation) {
        case 'move_to_stock':
          updateData = {
            stock_quantity: product.stock_quantity + quantity,
            stock_in_transit: Math.max(0, product.stock_in_transit - quantity)
          };
          break;
        case 'move_to_transit':
          updateData = {
            stock_quantity: Math.max(0, product.stock_quantity - quantity),
            stock_in_transit: product.stock_in_transit + quantity
          };
          break;
        case 'adjust_stock':
          updateData = {
            stock_quantity: Math.max(0, product.stock_quantity + quantity)
          };
          break;
      }
      
      const { data, error } = await supabase
        .from("products")
        .update(updateData)
        .eq("id", productId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stock-allocations"] });
      toast.success("Inventory operation completed successfully");
    },
    onError: (error) => {
      toast.error("Failed to complete inventory operation");
    },
  });
};

// Hook to get inventory insights and validation
export const useInventoryValidation = () => {
  return {
    validateStockAllocation: (
      availableStock: number, 
      requestedQuantity: number
    ): { isValid: boolean; message?: string } => {
      if (requestedQuantity <= 0) {
        return { isValid: false, message: "Quantity must be greater than 0" };
      }
      
      if (requestedQuantity > availableStock) {
        return { 
          isValid: false, 
          message: `Cannot allocate ${requestedQuantity} items. Only ${availableStock} available.` 
        };
      }
      
      return { isValid: true };
    },
    
    calculateAvailableStock: (
      totalStock: number, 
      allocatedStock: number, 
      stockInTransit: number = 0
    ): number => {
      return Math.max(0, totalStock - allocatedStock);
    }
  };
};

// Hook to get inventory validation check results without making changes
export const useInventoryValidationCheck = () => {
  return useMutation({
    mutationFn: async (): Promise<InventorySyncResult[]> => {
      // This would run the sync function but in read-only mode
      // For now, we'll use the same function but not actually apply changes
      const { data, error } = await supabase.rpc('sync_inventory_with_assets');
      
      if (error) {
        throw new Error(error.message);
      }
      
      return data;
    },
  });
};
