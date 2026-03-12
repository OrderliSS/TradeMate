import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Task } from "@/types/database";
import { useDataEnvironment } from "@/hooks/useSandbox";

export interface CallRecordWithCustomer extends Task {
  customer?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  // Call-specific fields from the database
  call_type?: string;
  call_outcome?: string;
  call_duration_minutes?: number;
  activity_date?: string;
}

export const useCallRecords = () => {
  const dataEnvironment = useDataEnvironment();
  
  return useQuery({
    queryKey: ["call-records", dataEnvironment],
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          customer:customers!customer_id(id, name, email, phone)
        `)
        .eq("task_type", "call")
        .eq("data_environment", dataEnvironment)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Transform the data to match the expected type
      return (data || []).map(item => ({
        ...item,
        customer: Array.isArray(item.customer) ? item.customer[0] : item.customer,
        // Map activity_date from the database record if it exists
        activity_date: (item as any).activity_date || item.created_at,
        call_type: (item as any).call_type,
        call_outcome: (item as any).call_outcome,
        call_duration_minutes: (item as any).call_duration_minutes,
      })) as CallRecordWithCustomer[];
    },
  });
};
