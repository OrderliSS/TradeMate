import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface StockOrderAllocation {
  id: string;
  stock_order_id: string;
  product_id: string;
  asset_id: string;
  quantity_allocated: number;
  allocated_at: string;
  allocated_by?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface StockOrderAllocationWithDetails extends StockOrderAllocation {
  stock_order?: {
    id: string;
    name: string;
    expense_number?: string;
    stock_record_number?: string;
    quantity_needed?: number;
    vendor?: string;
    delivery_status?: string;
    product_id?: string;
  };
  product?: {
    id: string;
    name: string;
    price?: number;
  };
  asset?: {
    id: string;
    asset_tag?: string;
    status: string;
  };
}

export const useStockOrderAllocations = (stockOrderId?: string) => {
  return useQuery({
    queryKey: ["stock-order-allocations", stockOrderId],
    queryFn: async () => {
      // Since we don't have a stock_order_allocations table, 
      // we'll use the allocations table filtered by stock_order_id
      let query = supabase
        .from("allocations")
        .select(`
          *,
          stock_order:stock_orders(id, name, stock_record_number, quantity_needed, vendor, delivery_status, product_id),
          product:products!allocations_product_id_fkey(id, name, price),
          asset:asset_management(id, asset_tag, status)
        `)
        .not("stock_order_id", "is", null)
        .order("created_at", { ascending: false });

      if (stockOrderId) {
        query = query.eq("stock_order_id", stockOrderId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map(item => {
        const { stock_order, ...cleanItem } = item as any;
        return {
          ...cleanItem,
          stock_order: stock_order?.error ? null : stock_order
        } as StockOrderAllocationWithDetails;
      });
    },
  });
};

export const useCreateStockOrderAllocation = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      stock_order_id: string;
      product_id: string;
      asset_id: string;
      quantity_allocated: number;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from("allocations")
        .insert([{
          stock_order_id: params.stock_order_id,
          product_id: params.product_id,
          asset_id: params.asset_id,
          status: 'allocated',
          notes: params.notes,
          allocated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-order-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["allocations"] });
      queryClient.invalidateQueries({ queryKey: ["asset-management"] });
      toast({
        title: "Allocation Created",
        description: "Stock order allocation created successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error Creating Allocation",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useDeleteStockOrderAllocation = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (allocationId: string) => {
      const { error } = await supabase
        .from("allocations")
        .delete()
        .eq("id", allocationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-order-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["allocations"] });
      queryClient.invalidateQueries({ queryKey: ["asset-management"] });
      toast({
        title: "Allocation Deleted",
        description: "Stock order allocation deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error Deleting Allocation",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useGetStockOrderAvailableQuantity = (stockOrderId: string) => {
  return useQuery({
    queryKey: ["stock-order-available-quantity", stockOrderId],
    queryFn: async () => {
      // Get stock order details
      const { data: stockOrder, error: stockOrderError } = await supabase
        .from("stock_orders")
        .select("quantity_needed")
        .eq("id", stockOrderId)
        .single();

      if (stockOrderError) throw stockOrderError;

      // Get total allocated quantity
      const { data: allocations, error: allocationsError } = await supabase
        .from("allocations")
        .select("id")
        .eq("stock_order_id", stockOrderId)
        .eq("status", "allocated");

      if (allocationsError) throw allocationsError;

      const totalQuantity = stockOrder?.quantity_needed || 0;
      const allocatedQuantity = allocations?.length || 0;
      const availableQuantity = Math.max(0, totalQuantity - allocatedQuantity);

      return availableQuantity;
    },
    enabled: !!stockOrderId,
  });
};