import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TaskWithCustomer } from "@/types/database";

export const usePurchaseTasks = (purchaseId?: string) => {
  return useQuery({
    queryKey: ["purchase-tasks", purchaseId],
    queryFn: async (): Promise<TaskWithCustomer[]> => {
      if (!purchaseId) return [];
      
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          customer:customers!customer_id(*),
          referred_by_customer:customers!referred_by_customer_id(*)
        `)
        .or(`purchase_order_id.eq.${purchaseId},purchase_id.eq.${purchaseId}`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map(task => ({
        ...task,
        customer: task.customer ? {
          ...(task.customer as any),
          relationship_type: (task.customer as any)?.relationship_type || 'customer',
          status: (task.customer as any)?.status || 'active'
        } : undefined,
        referred_by_customer: task.referred_by_customer ? {
          ...(task.referred_by_customer as any),
          relationship_type: (task.referred_by_customer as any)?.relationship_type || 'customer',
          status: (task.referred_by_customer as any)?.status || 'active'
        } : undefined
      })) as TaskWithCustomer[];
    },
    enabled: !!purchaseId,
  });
};