import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useCasesByCustomer = (customerId: string | undefined) => {
  return useQuery({
    queryKey: ["cases-by-customer", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, task_number, task_type, status, created_at")
        .eq("customer_id", customerId)
        .is("parent_task_id", null)
        .in("status", ["pending", "on_hold"])
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });
};
