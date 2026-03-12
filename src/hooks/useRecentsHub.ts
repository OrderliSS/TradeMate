import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDataEnvironment } from "@/hooks/useSandbox";

const RECENTS_LIMIT = 8;
const REFETCH_MS = 60_000;

export const useRecentSalesOrders = (enabled: boolean) => {
  const dataEnvironment = useDataEnvironment();
  return useQuery({
    queryKey: ["recents-sales", dataEnvironment],
    enabled,
    refetchInterval: REFETCH_MS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("id, receipt_number, purchase_date, total_amount, quantity, customer:customers!purchases_customer_id_fkey(name), product:products(name)")
        .eq("data_environment", dataEnvironment)
        .order("purchase_date", { ascending: false })
        .limit(RECENTS_LIMIT);
      if (error) throw error;
      return (data || []).map((p: any) => ({
        ...p,
        customer: Array.isArray(p.customer) ? p.customer[0] : p.customer,
        product: Array.isArray(p.product) ? p.product[0] : p.product,
      }));
    },
  });
};

export const useRecentStockOrders = (enabled: boolean) => {
  const dataEnvironment = useDataEnvironment();
  return useQuery({
    queryKey: ["recents-stock", dataEnvironment],
    enabled,
    refetchInterval: REFETCH_MS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_orders")
        .select("id, order_number, vendor_store_name, amount, delivery_status, created_at")
        .eq("data_environment", dataEnvironment)
        .order("created_at", { ascending: false })
        .limit(RECENTS_LIMIT);
      if (error) throw error;
      return data || [];
    },
  });
};

export const useRecentTasks = (enabled: boolean) => {
  const dataEnvironment = useDataEnvironment();
  return useQuery({
    queryKey: ["recents-tasks", dataEnvironment],
    enabled,
    refetchInterval: REFETCH_MS,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("tasks")
        .select("id, title, status, priority, created_at, customer:customers!tasks_customer_id_fkey(name)") as any)
        .eq("data_environment", dataEnvironment)
        .is("parent_task_id", null)
        .neq("task_type", "call")
        .order("created_at", { ascending: false })
        .limit(RECENTS_LIMIT);
      if (error) throw error;
      return (data || []).map((t: any) => ({
        ...t,
        customer: Array.isArray(t.customer) ? t.customer[0] : t.customer,
      }));
    },
  });
};

export const useRecentCases = (enabled: boolean) => {
  const dataEnvironment = useDataEnvironment();
  return useQuery({
    queryKey: ["recents-cases", dataEnvironment],
    enabled,
    refetchInterval: REFETCH_MS,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("tasks")
        .select("id, title, status, priority, created_at, customer:customers!tasks_customer_id_fkey(name)") as any)
        .eq("data_environment", dataEnvironment)
        .not("parent_task_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(RECENTS_LIMIT);
      if (error) throw error;
      return data || [];
    },
  });
};

export const useRecentCalls = (enabled: boolean) => {
  const dataEnvironment = useDataEnvironment();
  return useQuery({
    queryKey: ["recents-calls", dataEnvironment],
    enabled,
    refetchInterval: REFETCH_MS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, status, created_at, call_outcome, customer:customers!customer_id(name)")
        .eq("task_type", "call")
        .eq("data_environment", dataEnvironment)
        .order("created_at", { ascending: false })
        .limit(RECENTS_LIMIT);
      if (error) throw error;
      return (data || []).map((t: any) => ({
        ...t,
        customer: Array.isArray(t.customer) ? t.customer[0] : t.customer,
      }));
    },
  });
};

export const useRecentMeetings = (enabled: boolean) => {
  const dataEnvironment = useDataEnvironment();
  return useQuery({
    queryKey: ["recents-meetings", dataEnvironment],
    enabled,
    refetchInterval: REFETCH_MS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, title, appointment_type, start_time, created_at, customer:customers(name)")
        .eq("data_environment", dataEnvironment)
        .order("created_at", { ascending: false })
        .limit(RECENTS_LIMIT);
      if (error) throw error;
      return (data || []).map((a: any) => ({
        ...a,
        customer: Array.isArray(a.customer) ? a.customer[0] : a.customer,
      }));
    },
  });
};

export const useRecentContacts = (enabled: boolean) => {
  const dataEnvironment = useDataEnvironment();
  return useQuery({
    queryKey: ["recents-contacts", dataEnvironment],
    enabled,
    refetchInterval: REFETCH_MS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, email, phone, created_at")
        .eq("data_environment", dataEnvironment)
        .order("created_at", { ascending: false })
        .limit(RECENTS_LIMIT);
      if (error) throw error;
      return data || [];
    },
  });
};

export const useRecentVendors = (enabled: boolean) => {
  const dataEnvironment = useDataEnvironment();
  return useQuery({
    queryKey: ["recents-vendors", dataEnvironment],
    enabled,
    refetchInterval: REFETCH_MS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_shops")
        .select("id, shop_name, platforms, primary_category, created_at")
        .order("created_at", { ascending: false })
        .limit(RECENTS_LIMIT);
      if (error) throw error;
      return data || [];
    },
  });
};

export const useRecentTracking = (enabled: boolean) => {
  const dataEnvironment = useDataEnvironment();
  return useQuery({
    queryKey: ["recents-tracking", dataEnvironment],
    enabled,
    refetchInterval: REFETCH_MS,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("stock_order_shipments")
        .select("id, tracking_number, vendor_tracking_number, carrier, vendor_carrier, delivery_status, created_at") as any)
        .order("created_at", { ascending: false })
        .limit(RECENTS_LIMIT);
      if (error) throw error;
      return data || [];
    },
  });
};
