import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export interface StockOrderAllocation {
  id: string;
  stock_order_id: string;
  purchase_id: string;
  quantity_allocated: number;
  allocated_at: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  stock_order?: {
    id: string;
    name: string;
    delivery_status?: string;
    stock_record_number?: string;
  };
  purchases?: {
    id: string;
    ticket_number: string;
  };
}

export const useStockOrderAllocations = () => {
  const queryClient = useQueryClient();
  
  // Set up real-time subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('stock-order-allocations-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'stock_order_allocations' 
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["stock-order-allocations"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ["stock-order-allocations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_order_allocations")
        .select(`
          *,
          stock_order:stock_orders(
            id,
            name,
            delivery_status,
            stock_record_number
          ),
          purchases(
            id,
            ticket_number
          )
        `)
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error('Error fetching stock order allocations:', error);
        throw error;
      }
      
      return (data || []) as StockOrderAllocation[];
    },
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });
};

export const useStockOrderAllocationsByOrder = (stockOrderId: string) => {
  return useQuery({
    queryKey: ["stock-order-allocations-by-order", stockOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_order_allocations")
        .select(`
          *,
          stock_order:stock_orders(
            id,
            name,
            delivery_status,
            stock_record_number
          ),
          purchases(
            id,
            ticket_number
          )
        `)
        .eq("stock_order_id", stockOrderId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return (data || []) as StockOrderAllocation[];
    },
    enabled: !!stockOrderId,
    staleTime: 5000,
  });
};
