import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_name: string;
  supplier_id?: string;
  status: 'draft' | 'ordered' | 'partial' | 'completed' | 'cancelled';
  order_date?: string;
  expected_delivery_date?: string;
  total_amount: number;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderLine {
  id: string;
  po_id: string;
  product_id: string;
  ordered_qty: number;
  received_qty: number;
  unit_price?: number;
  total_price?: number;
  created_at: string;
  updated_at: string;
  product?: {
    id: string;
    name: string;
    sku?: string;
  };
}

export interface PurchaseOrderWithLines extends PurchaseOrder {
  lines: PurchaseOrderLine[];
}

export const usePurchaseOrders = (statusFilter?: string[]) => {
  return useQuery({
    queryKey: ["purchase-orders", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("purchase_orders")
        .select(`
          *,
          lines:purchase_order_lines(
            *,
            product:products(id, name, sku)
          )
        `);

      if (statusFilter && statusFilter.length > 0) {
        query = query.in("status", statusFilter);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;
      return data as PurchaseOrderWithLines[];
    },
  });
};

export const usePurchaseOrder = (id: string) => {
  return useQuery({
    queryKey: ["purchase-order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(`
          *,
          lines:purchase_order_lines(
            *,
            product:products(id, name, sku)
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as PurchaseOrderWithLines;
    },
    enabled: !!id,
  });
};

export interface CreatePurchaseOrderInput {
  supplier_name: string;
  supplier_id?: string;
  status?: 'draft' | 'ordered' | 'partial' | 'completed' | 'cancelled';
  order_date?: string;
  expected_delivery_date?: string;
  total_amount?: number;
  notes?: string;
  created_by?: string;
}

export const useCreatePurchaseOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreatePurchaseOrderInput) => {
      const { data: po, error } = await supabase
        .from("purchase_orders")
        .insert(data as any)
        .select()
        .single();

      if (error) throw error;
      return po as PurchaseOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast.success("Purchase order created successfully");
    },
    onError: (error) => {
      console.error("Error creating purchase order:", error);
      toast.error("Failed to create purchase order");
    },
  });
};

export const useUpdatePurchaseOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<PurchaseOrder> }) => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as PurchaseOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-order"] });
      toast.success("Purchase order updated successfully");
    },
    onError: (error) => {
      console.error("Error updating purchase order:", error);
      toast.error("Failed to update purchase order");
    },
  });
};

export const useDeletePurchaseOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("purchase_orders")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast.success("Purchase order deleted successfully");
    },
    onError: (error) => {
      console.error("Error deleting purchase order:", error);
      toast.error("Failed to delete purchase order");
    },
  });
};

export const usePOProgress = (poId: string) => {
  return useQuery({
    queryKey: ["po-progress", poId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_po_progress", {
        p_po_id: poId,
      });

      if (error) throw error;
      return data as Array<{
        product_id: string;
        product_name: string;
        ordered_qty: number;
        received_qty: number;
        remaining_qty: number;
      }>;
    },
    enabled: !!poId,
  });
};