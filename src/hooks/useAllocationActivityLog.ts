import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentEnvironment } from "@/lib/environment-utils";

export interface AllocationActivityLog {
  id: string;
  created_at: string;
  user_id?: string;
  action: 'created' | 'released' | 'updated' | 'failed' | 'auto_fixed';
  allocation_id?: string;
  purchase_order_id?: string;
  stock_order_id?: string;
  product_id?: string;
  asset_ids: string[];
  asset_tags?: string[];
  quantity: number;
  status: 'success' | 'failure' | 'partial';
  error_message?: string;
  metadata?: any;
  ip_address?: string;
  user_agent?: string;
}

interface LogAllocationActivityParams {
  action: 'created' | 'released' | 'updated' | 'failed' | 'auto_fixed';
  allocation_id?: string;
  purchase_order_id?: string;
  stock_order_id?: string;
  product_id?: string;
  asset_ids: string[];
  asset_tags?: string[];
  status: 'success' | 'failure' | 'partial';
  error_message?: string;
  metadata?: any;
}

export const useLogAllocationActivity = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: LogAllocationActivityParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("allocation_activity_log")
        .insert({
          user_id: user?.id,
          action: params.action,
          allocation_id: params.allocation_id,
          purchase_order_id: params.purchase_order_id,
          stock_order_id: params.stock_order_id,
          product_id: params.product_id,
          asset_ids: params.asset_ids,
          asset_tags: params.asset_tags,
          quantity: params.asset_ids.length,
          status: params.status,
          error_message: params.error_message,
          metadata: params.metadata || {},
          user_agent: navigator.userAgent,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allocation-activity-logs"] });
    },
  });
};

export const useAllocationActivityLogs = (purchaseOrderId?: string, productId?: string) => {
  return useQuery({
    queryKey: ['allocation-activity-logs', purchaseOrderId, productId],
    queryFn: async () => {
      let query = supabase
        .from('allocation_activity_log')
        .select(`
          *,
          profiles:user_id(full_name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (purchaseOrderId) {
        query = query.eq('purchase_order_id', purchaseOrderId);
      }

      if (productId) {
        query = query.eq('product_id', productId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as (AllocationActivityLog & { profiles?: { full_name?: string; email?: string } })[];
    },
    enabled: !!(purchaseOrderId || productId),
  });
};
