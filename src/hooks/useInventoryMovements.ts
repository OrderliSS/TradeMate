import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { SecureEnvironment } from "@/lib/secure-environment";
import { useCurrentOrganizationId } from "@/hooks/useOrganization";
import { useDataEnvironment } from "@/hooks/useSandbox";

export interface InventoryMovement {
  id: string;
  product_id: string;
  movement_type: 'receipt' | 'allocation' | 'sale' | 'adjustment' | 'delivery' | 'return' | 'gift' | 'misc';
  quantity_change: number;
  old_stock_quantity: number | null;
  new_stock_quantity: number | null;
  old_stock_allocated: number | null;
  new_stock_allocated: number | null;
  old_stock_in_transit: number | null;
  new_stock_in_transit: number | null;
  reference_id: string | null;
  reference_type: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export const useInventoryMovements = (productId?: string) => {
  const orgId = useCurrentOrganizationId();
  const dataEnvironment = useDataEnvironment();

  return useQuery({
    queryKey: ["inventory-movements", productId],
    queryFn: async () => {
      const client: any = supabase;
      let query = client
        .from("inventory_movements")
        .select(`
          *,
          products(name, sku)
        `)
        .eq("organization_id", orgId)
        .eq("data_environment", dataEnvironment)
        .order("created_at", { ascending: false });

      if (productId) {
        query = query.eq("product_id", productId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
  });
};

export const useCalculateAvailableStock = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: string) => {
      const { data, error } = await supabase
        .rpc('calculate_available_stock', { p_product_id: productId });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
};

export const useLogInventoryMovement = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productId,
      movementType,
      quantityChange,
      referenceId,
      referenceType,
      notes,
    }: {
      productId: string;
      movementType: 'receipt' | 'allocation' | 'sale' | 'adjustment' | 'delivery' | 'return' | 'gift' | 'misc';
      quantityChange: number;
      referenceId?: string;
      referenceType?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .rpc('log_inventory_movement', {
          p_product_id: productId,
          p_movement_type: movementType,
          p_quantity_change: quantityChange,
          p_reference_id: referenceId || null,
          p_reference_type: referenceType || null,
          p_notes: notes || null,
        });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate all inventory-related queries
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-movements"] });
      queryClient.invalidateQueries({ queryKey: ["stock-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["stock-orders"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });

      toast({
        title: "Success",
        description: "Inventory movement logged successfully",
      });
    },
    onError: (error) => {
      SecureEnvironment.error("Failed to log inventory movement:", error);
      toast({
        title: "Error",
        description: "Failed to log inventory movement",
        variant: "destructive",
      });
    },
  });
};