import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LinkedCall {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  task_type: string;
  call_outcome?: string;
  activity_date?: string;
  created_at: string;
  customer?: { id: string; name: string } | null;
}

export interface LinkedMeeting {
  id: string;
  title: string;
  description?: string;
  appointment_type: string;
  status: string;
  start_time: string;
  end_time: string;
  location?: string;
  notes?: string;
  outcome_notes?: string;
  created_at: string;
  customer?: { id: string; name: string } | null;
}

export interface LinkedTask {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  task_type: string;
  task_number?: string;
  due_date?: string;
  created_at: string;
  customer?: { id: string; name: string } | null;
}

export interface LinkedCase {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  task_type: string;
  task_number?: string;
  due_date?: string;
  created_at: string;
  customer?: { id: string; name: string } | null;
}

export interface LinkedReminder {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  task_type: string;
  task_number?: string;
  due_date?: string;
  created_at: string;
  customer?: { id: string; name: string } | null;
}

export interface PurchaseLinkedRecords {
  calls: LinkedCall[];
  meetings: LinkedMeeting[];
  tasks: LinkedTask[];
  cases: LinkedCase[];
  reminders: LinkedReminder[];
}

export const usePurchaseLinkedRecords = (purchaseId?: string) => {
  return useQuery({
    queryKey: ["purchase-linked-records", purchaseId],
    queryFn: async (): Promise<PurchaseLinkedRecords> => {
      if (!purchaseId) return { calls: [], meetings: [], tasks: [], cases: [], reminders: [] };

      // Fetch calls (tasks with task_type = 'call')
      const { data: callsData, error: callsError } = await supabase
        .from("tasks")
        .select(`
          id,
          title,
          description,
          status,
          priority,
          task_type,
          call_outcome,
          activity_date,
          created_at,
          customer:customers!customer_id(id, name)
        `)
        .or(`purchase_order_id.eq.${purchaseId},purchase_id.eq.${purchaseId}`)
        .eq("task_type", "call")
        .order("activity_date", { ascending: false, nullsFirst: false });

      if (callsError) throw callsError;

      // Fetch meetings (appointments linked to this purchase)
      const { data: meetingsData, error: meetingsError } = await supabase
        .from("appointments")
        .select(`
          id,
          title,
          description,
          appointment_type,
          status,
          start_time,
          end_time,
          location,
          notes,
          outcome_notes,
          created_at,
          customer:customers!customer_id(id, name)
        `)
        .eq("purchase_id", purchaseId)
        .order("start_time", { ascending: false });

      if (meetingsError) throw meetingsError;

      // Fetch reminders (tasks with task_type = 'reminder')
      const { data: remindersData, error: remindersError } = await supabase
        .from("tasks")
        .select(`
          id,
          title,
          description,
          status,
          priority,
          task_type,
          task_number,
          due_date,
          created_at,
          customer:customers!customer_id(id, name)
        `)
        .or(`purchase_order_id.eq.${purchaseId},purchase_id.eq.${purchaseId}`)
        .eq("task_type", "reminder")
        .neq("status", "archived")
        .order("due_date", { ascending: true, nullsFirst: false });

      if (remindersError) throw remindersError;

      // Fetch cases (parent tasks - no parent_task_id, excluding call and reminder)
      const { data: casesData, error: casesError } = await supabase
        .from("tasks")
        .select(`
          id,
          title,
          description,
          status,
          priority,
          task_type,
          task_number,
          due_date,
          created_at,
          customer:customers!customer_id(id, name)
        `)
        .or(`purchase_order_id.eq.${purchaseId},purchase_id.eq.${purchaseId}`)
        .is("parent_task_id", null)
        .not("task_type", "in", "(call,reminder)")
        .order("created_at", { ascending: false });

      if (casesError) throw casesError;

      // Fetch tasks (child tasks - have parent_task_id, excluding call and reminder)
      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select(`
          id,
          title,
          description,
          status,
          priority,
          task_type,
          task_number,
          due_date,
          created_at,
          customer:customers!customer_id(id, name)
        `)
        .or(`purchase_order_id.eq.${purchaseId},purchase_id.eq.${purchaseId}`)
        .not("parent_task_id", "is", null)
        .not("task_type", "in", "(call,reminder)")
        .order("created_at", { ascending: false });

      if (tasksError) throw tasksError;

      // Map data to proper types
      const calls: LinkedCall[] = (callsData || []).map((c: any) => ({
        ...c,
        customer: c.customer ? { id: c.customer.id, name: c.customer.name } : null,
      }));

      const meetings: LinkedMeeting[] = (meetingsData || []).map((m: any) => ({
        ...m,
        customer: m.customer ? { id: m.customer.id, name: m.customer.name } : null,
      }));

      const reminders: LinkedReminder[] = (remindersData || []).map((r: any) => ({
        ...r,
        customer: r.customer ? { id: r.customer.id, name: r.customer.name } : null,
      }));

      const cases: LinkedCase[] = (casesData || []).map((c: any) => ({
        ...c,
        customer: c.customer ? { id: c.customer.id, name: c.customer.name } : null,
      }));

      const tasks: LinkedTask[] = (tasksData || []).map((t: any) => ({
        ...t,
        customer: t.customer ? { id: t.customer.id, name: t.customer.name } : null,
      }));

      return { calls, meetings, tasks, cases, reminders };
    },
    enabled: !!purchaseId,
  });
};
