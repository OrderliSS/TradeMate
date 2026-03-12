import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LinkedReminder {
  id: string;
  task_number: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
  priority: string | null;
}

/**
 * Hook to fetch a reminder linked to a specific purchase
 * Returns the existing reminder if one exists with purchase_id = purchaseId
 */
export const useLinkedReminder = (purchaseId: string | null | undefined) => {
  return useQuery({
    queryKey: ['linked-reminder', purchaseId],
    enabled: !!purchaseId,
    queryFn: async () => {
      if (!purchaseId) return null;
      
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          id,
          task_number,
          title,
          description,
          due_date,
          status,
          priority
        `)
        .eq('task_type', 'reminder')
        .eq('purchase_id', purchaseId)
        .neq('status', 'archived')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data as LinkedReminder | null;
    }
  });
};
