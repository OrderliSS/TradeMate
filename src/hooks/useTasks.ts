import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Task, TaskWithCustomer } from "@/types/database";
import { toast } from "@/hooks/use-toast";
import { shouldFilterTask, getTaskUrgencyStatus } from "@/lib/task-utils";
import { getCurrentEnvironment } from "@/lib/environment-utils";
import { useDataEnvironment } from "@/hooks/useSandbox";
import { useCurrentOrganizationId } from "./useOrganization";

export const useTasks = (
  status?: 'pending' | 'completed' | 'archived',
  options?: { includeCompleted?: boolean; enabled?: boolean }
) => {
  const dataEnvironment = useDataEnvironment();
  const orgId = useCurrentOrganizationId();

  return useQuery({
    queryKey: ["tasks", status, options?.includeCompleted, dataEnvironment, orgId],
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<TaskWithCustomer[]> => {
      let query = supabase
        .from("tasks")
        .select(`
          *,
          customer:customers!customer_id(*),
          referred_by_customer:customers!referred_by_customer_id(*),
          purchase_order:purchase_orders!purchase_order_id(id, po_number, supplier_name, status, total_amount)
        `)
        .eq("data_environment", dataEnvironment)
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });

      if (status === 'pending') {
        // Cases tab - show parent items (cases) only, including in_progress
        // Exclude reminders - they have their own tab
        if (options?.includeCompleted) {
          // Include completed AND archived when filter requests it
          query = query.in("status", ['pending', 'on_hold', 'in_progress', 'completed', 'archived']).is("parent_task_id", null).neq("task_type", "reminder");
        } else {
          query = query.in("status", ['pending', 'on_hold', 'in_progress']).is("parent_task_id", null).neq("task_type", "reminder");
        }
      } else if (status === 'completed' || status === 'archived') {
        query = query.eq("status", status);
      } else {
        // Tasks tab (no status) - show child tasks only (items WITH a parent_task_id)
        // Exclude calls - they belong in the case's Calls tab, not the main Tasks tab
        query = query.not("parent_task_id", "is", null).neq("task_type", "call");
      }

      const { data, error } = await query;

      if (error) throw error;

      // Batch fetch ALL purchases in a single query (instead of N+1 queries)
      const purchaseIds = (data || [])
        .filter(task => task.purchase_id)
        .map(task => task.purchase_id);

      let purchasesMap = new Map();
      if (purchaseIds.length > 0) {
        const { data: purchases } = await supabase
          .from("purchases")
          .select(`
            id,
            receipt_number,
            ticket_number,
            quantity,
            total_amount,
            purchase_date,
            order_status,
            product:products(*)
          `)
          .in("id", purchaseIds);

        // Create a map for O(1) lookup
        purchasesMap = new Map((purchases || []).map(p => [p.id, p]));
      }

      // Map purchases to tasks
      const tasksWithPurchases = (data || []).map(task => ({
        ...task,
        purchase: task.purchase_id ? purchasesMap.get(task.purchase_id) || null : null,
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
      }));

      // Apply enhanced filtering for pending tasks or when no status specified (default to active tasks)
      // Skip filtering if includeCompleted is true
      if ((status === 'pending' || status === undefined) && !options?.includeCompleted) {
        return (tasksWithPurchases.filter(task => !shouldFilterTask(task as any)) as unknown as TaskWithCustomer[]);
      }

      return (tasksWithPurchases as unknown as TaskWithCustomer[]);
    },
    enabled: (options?.enabled !== false) && !!orgId,
  });
};

export const useTaskById = (id: string | undefined) => {
  const orgId = useCurrentOrganizationId();
  return useQuery({
    queryKey: ["task", id, orgId],
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<TaskWithCustomer | null> => {
      if (!id) return null;

      // Fetch task WITHOUT the invalid profiles join (created_by references auth.users, not profiles)
      const { data: task, error } = await supabase
        .from("tasks")
        .select(`
          *,
          customer:customers!customer_id(*),
          referred_by_customer:customers!referred_by_customer_id(*),
          purchase_order:purchase_orders!purchase_order_id(id, po_number, supplier_name, status, total_amount)
        `)
        .eq("id", id)
        .eq("organization_id", orgId)
        .maybeSingle();

      if (error) throw error;
      if (!task) return null;

      // Fetch profile separately if created_by exists (profiles table uses user id as primary key)
      let created_by_profile = null;
      if (task.created_by) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name, email, employee_id")
          .eq("id", task.created_by)
          .maybeSingle();
        created_by_profile = profileData;
      }

      // Fetch purchase if linked
      let purchase = null;
      if (task?.purchase_id) {
        const { data: purchaseData } = await supabase
          .from("purchases")
          .select(`
            id,
            receipt_number,
            ticket_number,
            quantity,
            total_amount,
            purchase_date,
            order_status,
            product:products(*)
          `)
          .eq("id", task.purchase_id)
          .maybeSingle();
        purchase = purchaseData;
      }

      return {
        ...task,
        purchase,
        purchase_order: task.purchase_order?.[0] || undefined,
        created_by_profile,
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
      };
    },
    enabled: !!id && !!orgId,
  });
};

export const useChildTasks = (parentId: string | undefined) => {
  const orgId = useCurrentOrganizationId();
  return useQuery({
    queryKey: ["child-tasks", parentId, orgId],
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<TaskWithCustomer[]> => {
      if (!parentId) return [];

      const { data: tasks, error } = await supabase
        .from("tasks")
        .select(`
          *,
          customer:customers!customer_id(*)
        `)
        .eq("parent_task_id", parentId)
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (tasks || []).map(task => ({
        ...task,
        customer: task.customer ? {
          ...(task.customer as any),
          relationship_type: (task.customer as any)?.relationship_type || 'customer',
          status: (task.customer as any)?.status || 'active'
        } : undefined
      }));
    },
    enabled: !!parentId && !!orgId,
  });
};

export const useTaskStats = () => {
  const dataEnvironment = useDataEnvironment();
  const orgId = useCurrentOrganizationId();

  return useQuery({
    queryKey: ["task-stats", dataEnvironment, orgId],
    queryFn: async () => {
      console.log(`📋 [Task Stats] Querying ${dataEnvironment} database...`);

      try {
        // Get parent tasks (cases) with active statuses - matching useTasks('pending') logic
        const { data: allCases, error: casesError } = await supabase
          .from("tasks")
          .select("id, due_date, follow_up_date, status")
          .eq("data_environment", dataEnvironment)
          .eq("organization_id", orgId)
          .in("status", ['pending', 'on_hold', 'in_progress'])
          .is("parent_task_id", null) // Only parent tasks (cases)
          .neq("task_type", "reminder"); // Exclude reminders

        if (casesError) throw casesError;

        // Get child tasks (actual tasks) with active statuses
        const { data: allChildTasks, error: childError } = await supabase
          .from("tasks")
          .select("id, due_date, follow_up_date, status")
          .eq("data_environment", dataEnvironment)
          .eq("organization_id", orgId)
          .in("status", ['pending', 'on_hold', 'in_progress'])
          .not("parent_task_id", "is", null) // Only child tasks
          .neq("task_type", "call"); // Exclude calls

        if (childError) throw childError;

        // Apply the same logic as our task utilities (using static import)
        // Filter out stale cases
        const activeCases = (allCases || []).filter(task => {
          const taskForUtility = {
            status: task.status,
            due_date: task.due_date,
            follow_up_date: task.follow_up_date
          } as any;
          return !shouldFilterTask(taskForUtility);
        });

        // Filter out stale child tasks
        const activeChildTasks = (allChildTasks || []).filter(task => {
          const taskForUtility = {
            status: task.status,
            due_date: task.due_date,
            follow_up_date: task.follow_up_date
          } as any;
          return !shouldFilterTask(taskForUtility);
        });

        let overdueTasks = 0;
        let dueTodayTasks = 0;

        for (const task of activeCases) {
          const taskForUtility = {
            due_date: task.due_date,
            follow_up_date: task.follow_up_date
          } as any;

          const urgencyStatus = getTaskUrgencyStatus(taskForUtility);
          if (urgencyStatus === 'overdue') overdueTasks++;
          else if (urgencyStatus === 'due_today') dueTodayTasks++;
        }

        const result = {
          pendingCases: activeCases.length,
          pendingTasks: activeChildTasks.length,
          overdueTasks,
          dueTodayTasks,
        };

        console.log(`✅ [Task Stats] Success on ${dataEnvironment}:`, result);
        return result;

      } catch (error: any) {
        console.error(`❌ [Task Stats] Failed on ${dataEnvironment}:`, error);

        if (error.message?.includes('Failed to fetch') ||
          error.message?.includes('timeout') ||
          error.message?.includes('NetworkError')) {
          const connectionError = new Error(`Connection to ${dataEnvironment} database failed`);
          (connectionError as any).isConnectionError = true;
          throw connectionError;
        }

        throw error;
      }
    },
    retry: 1,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    enabled: !!orgId,
  });
};

export const useCreateTask = () => {
  const queryClient = useQueryClient();
  const dataEnvironment = useDataEnvironment();
  const orgId = useCurrentOrganizationId();

  return useMutation({
    mutationFn: async (task: Omit<Task, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("tasks")
        .insert([{ ...task, data_environment: dataEnvironment, organization_id: orgId }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-stats"] });
      queryClient.invalidateQueries({ queryKey: ["child-tasks"] });
      toast({
        title: "Success",
        description: "Task created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create task",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...task }: Partial<Task> & { id: string }) => {
      const { data, error } = await supabase
        .from("tasks")
        .update(task)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-stats"] });
      queryClient.invalidateQueries({ queryKey: ["task", data.id] });
      queryClient.invalidateQueries({ queryKey: ["child-tasks"] });
      toast({
        title: "Success",
        description: "Task updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update task",
        variant: "destructive",
      });
    },
  });
};

export const useDeleteTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // First, handle related appointments by setting their task_id to null
      const { error: appointmentError } = await supabase
        .from("appointments")
        .update({ task_id: null })
        .eq("task_id", id);

      if (appointmentError) {
        console.error("Error updating related appointments:", appointmentError);
        // Continue with deletion even if appointment update fails
      }

      // Then delete the task
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, deletedId) => {
      // Optimistically remove from all task queries
      queryClient.setQueriesData(
        { queryKey: ["tasks"] },
        (oldData: any) => {
          if (!oldData) return oldData;
          return Array.isArray(oldData)
            ? oldData.filter((task: any) => task.id !== deletedId)
            : oldData;
        }
      );

      // Also update call-records query (since call records are tasks)
      queryClient.setQueryData(["call-records"], (oldData: any) => {
        if (!oldData || !Array.isArray(oldData)) return oldData;
        return oldData.filter((task: any) => task.id !== deletedId);
      });

      // Optimistically update task-stats
      queryClient.setQueryData(["task-stats"], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pendingTasks: Math.max(0, (old.pendingTasks || 0) - 1)
        };
      });

      // Remove the specific task from cache
      queryClient.removeQueries({ queryKey: ["task", deletedId] });
      queryClient.removeQueries({ queryKey: ["child-tasks", deletedId] });
      queryClient.invalidateQueries({ queryKey: ["child-tasks"] });

      toast({
        title: "Success",
        description: "Task deleted successfully",
      });
    },
    onError: (error) => {
      console.error("Task deletion error:", error);
      toast({
        title: "Error",
        description: "Failed to delete task. Please try again.",
        variant: "destructive",
      });
    },
  });
};

export const useBulkArchiveTasks = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const orgId = useCurrentOrganizationId();
      const { error } = await supabase
        .from("tasks")
        .update({ status: "archived" })
        .eq("status", "completed")
        .eq("organization_id", orgId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-stats"] });
      toast({
        title: "Success",
        description: "All completed tasks archived successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to archive completed tasks",
        variant: "destructive",
      });
    },
  });
};