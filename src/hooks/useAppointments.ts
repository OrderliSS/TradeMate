import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { enhancedToast } from "@/components/ui/enhanced-toast";
import { normalizeUuid } from "@/lib/uuid-utils";
import { useCurrentOrganizationId } from "@/hooks/useOrganization";
import { startOfDay, endOfDay } from "date-fns";
import type { Appointment, AppointmentFormData, AppointmentStatus } from "@/types/appointments";
import { useDataEnvironment } from "@/hooks/useSandbox";
import { logger } from "@/lib/logger";

export const useAppointments = (dateRange?: { start: Date; end: Date }) => {
  const contextOrgId = useCurrentOrganizationId();
  const dataEnvironment = useDataEnvironment();
  
  return useQuery({
    queryKey: ["appointments", contextOrgId, dataEnvironment, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    staleTime: 10000,
    refetchOnWindowFocus: true,
    // Always enabled - we'll fetch org ID via RPC if context isn't ready
    queryFn: async () => {
      // Use context org ID, or fall back to RPC if context isn't ready
      let orgId = contextOrgId;
      if (!orgId) {
        logger.debug('[useAppointments] Context org ID not ready, fetching via RPC', {});
        const { data: rpcOrgId } = await supabase.rpc('get_user_organization_id');
        orgId = rpcOrgId;
      }
      
      if (!orgId) {
        logger.debug('[useAppointments] No organization ID available, returning empty array', {});
        return [];
      }

      logger.debug('[useAppointments] Fetching appointments', { orgId, hasDateRange: !!dateRange });

      // Simplified query - avoid nested self-referencing task join that causes PGRST200 error
      let query = supabase
        .from("appointments")
        .select(`
          id,
          appointment_number,
          title,
          description,
          appointment_type,
          start_time,
          end_time,
          actual_start_time,
          actual_end_time,
          duration,
          location,
          meeting_url,
          customer_id,
          task_id,
          purchase_id,
          attendees,
          reminder_settings,
          status,
          notes,
          outcome_notes,
          confirmed_at,
          confirmed_by,
          rescheduled_from,
          created_by,
          assigned_to,
          created_at,
          updated_at,
          time_confirmed,
          time_period,
          time_window_start,
          time_window_end,
          time_notes,
          organization_id,
          customer:customers(id, name, email, phone),
          task:tasks!appointments_task_id_fkey(
            id,
            title,
            task_number,
            parent_task_id
          )
        `)
        .eq("organization_id", orgId)
        .eq("data_environment", dataEnvironment)
        .order("start_time", { ascending: true });

      if (dateRange) {
        // Use startOfDay/endOfDay to avoid timezone boundary issues
        const rangeStart = startOfDay(dateRange.start).toISOString();
        const rangeEnd = endOfDay(dateRange.end).toISOString();
        query = query
          .gte("start_time", rangeStart)
          .lte("start_time", rangeEnd);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[useAppointments] Error fetching appointments:', error);
        throw error;
      }
      
      logger.debug('[useAppointments] Fetched appointments', { count: data?.length || 0, orgId });
      
      // Return appointments directly - parent_task fetch removed to avoid PGRST200 error
      return (data || []).map((apt: any) => ({
        ...apt,
        task: apt.task || null
      })) as Appointment[];
    },
  });
};

export const useAppointmentStats = () => {
  const orgId = useCurrentOrganizationId();
  const dataEnvironment = useDataEnvironment();
  
  return useQuery({
    queryKey: ["appointment-stats", orgId, dataEnvironment],
    staleTime: 30000,
    refetchOnWindowFocus: false,
    enabled: !!orgId,
    queryFn: async () => {
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);

      const thisWeekStart = new Date(today);
      thisWeekStart.setDate(today.getDate() - today.getDay());
      const thisWeekEnd = new Date(thisWeekStart);
      thisWeekEnd.setDate(thisWeekStart.getDate() + 7);

      // Get today's appointments - include all statuses except cancelled
      const { data: todayAppointments } = await supabase
        .from("appointments")
        .select("*")
        .eq("organization_id", orgId)
        .eq("data_environment", dataEnvironment)
        .gte("start_time", todayStart.toISOString())
        .lt("start_time", todayEnd.toISOString())
        .neq("status", "cancelled");

      // Get this week's appointments - include all statuses except cancelled
      const { data: thisWeekAppointments } = await supabase
        .from("appointments")
        .select("*")
        .eq("organization_id", orgId)
        .eq("data_environment", dataEnvironment)
        .gte("start_time", thisWeekStart.toISOString())
        .lt("start_time", thisWeekEnd.toISOString())
        .neq("status", "cancelled");

      // Get overdue appointments (past scheduled appointments)
      const { data: overdueAppointments } = await supabase
        .from("appointments")
        .select("*")
        .eq("organization_id", orgId)
        .eq("data_environment", dataEnvironment)
        .lt("start_time", today.toISOString())
        .in("status", ["scheduled", "confirmed"]);

      return {
        todayAppointments: todayAppointments?.length || 0,
        thisWeekAppointments: thisWeekAppointments?.length || 0,
        overdueAppointments: overdueAppointments?.length || 0,
      };
    },
  });
};

export const useUpcomingAppointments = (daysAhead: number = 7) => {
  return useQuery({
    queryKey: ["upcoming-appointments", daysAhead],
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_upcoming_appointments", {
        days_ahead: daysAhead,
      });

      if (error) throw error;
      return data || [];
    },
  });
};

export const useTodaysAppointments = () => {
  const orgId = useCurrentOrganizationId();
  const dataEnvironment = useDataEnvironment();
  
  return useQuery({
    queryKey: ["todays-appointments", orgId, dataEnvironment],
    staleTime: 30000,
    refetchOnWindowFocus: false,
    enabled: !!orgId,
    queryFn: async () => {
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);

      // Simplified query - avoid nested self-referencing task join
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id,
          appointment_number,
          title,
          description,
          appointment_type,
          start_time,
          end_time,
          actual_start_time,
          actual_end_time,
          duration,
          location,
          meeting_url,
          customer_id,
          task_id,
          purchase_id,
          attendees,
          reminder_settings,
          status,
          notes,
          outcome_notes,
          confirmed_at,
          confirmed_by,
          rescheduled_from,
          created_by,
          assigned_to,
          created_at,
          updated_at,
          time_confirmed,
          time_period,
          time_window_start,
          time_window_end,
          time_notes,
          organization_id,
          customer:customers(id, name, email, phone),
          task:tasks!appointments_task_id_fkey(
            id,
            title,
            task_number,
            parent_task_id
          )
        `)
        .eq("organization_id", orgId)
        .eq("data_environment", dataEnvironment)
        .gte("start_time", todayStart.toISOString())
        .lt("start_time", todayEnd.toISOString())
        .order("start_time", { ascending: true });

      if (error) throw error;
      
      return (data || []).map((apt: any) => ({
        ...apt,
        task: apt.task || null
      })) as Appointment[];
    },
  });
};

export const useAppointmentsByTask = (taskId: string | undefined) => {
  return useQuery({
    queryKey: ["appointments-by-task", taskId],
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!taskId) return [];
      
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          *,
          customer:customers(id, name, email, phone),
          purchase:purchases(
            id,
            receipt_number,
            ticket_number,
            order_status,
            total_amount,
            purchase_date,
            quantity,
            product:products(id, name, sku, images, is_bundle, bundle_components)
          )
        `)
        .eq("task_id", taskId)
        .order("start_time", { ascending: true });

      if (error) throw error;
      return data as (Appointment & { purchase?: any })[];
    },
    enabled: !!taskId,
  });
};

export const useCreateAppointment = () => {
  const queryClient = useQueryClient();
  const dataEnvironment = useDataEnvironment();

  return useMutation({
    mutationFn: async (appointmentData: AppointmentFormData) => {
      // Get user's organization ID for RLS compliance
      const { data: orgId } = await supabase.rpc('get_user_organization_id');
      
      if (!orgId) {
        throw new Error('Unable to determine organization. Please ensure you are logged in and belong to an organization.');
      }

      const { data, error } = await supabase
        .from("appointments")
        .insert([{
          title: appointmentData.title,
          description: appointmentData.description,
          appointment_type: appointmentData.appointment_type,
          start_time: appointmentData.start_time.toISOString(),
          end_time: appointmentData.end_time.toISOString(),
          duration: Math.round((appointmentData.end_time.getTime() - appointmentData.start_time.getTime()) / (1000 * 60)),
          location: appointmentData.location,
          meeting_url: appointmentData.meeting_url,
          customer_id: normalizeUuid(appointmentData.customer_id),
          task_id: normalizeUuid(appointmentData.task_id),
          notes: appointmentData.notes,
          reminder_settings: appointmentData.reminder_settings || [],
          status: appointmentData.status || 'scheduled',
          organization_id: orgId,
          data_environment: dataEnvironment,
          // Flexible time scheduling fields
          time_confirmed: appointmentData.time_confirmed ?? true,
          time_period: appointmentData.time_period || null,
          time_window_start: appointmentData.time_window_start || null,
          time_window_end: appointmentData.time_window_end || null,
          time_notes: appointmentData.time_notes || null,
        }])
        .select()
        .single();

      if (error) throw error;

      // Create reminders if specified
      if (appointmentData.reminder_settings?.length) {
        const reminders = appointmentData.reminder_settings.map(reminder => ({
          appointment_id: data.id,
          reminder_type: reminder.type,
          minutes_before: reminder.minutes_before,
          message: reminder.message,
        }));

        await supabase.from("reminders").insert(reminders);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointment-stats"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["todays-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointments-by-task"] });
      queryClient.invalidateQueries({ queryKey: ["parent-task-data"] });
      queryClient.invalidateQueries({ queryKey: ["child-tasks-data"] });
      enhancedToast.success("Success", "Appointment created successfully");
    },
    onError: (error) => {
      enhancedToast.error("Error", "Failed to create appointment");
      console.error("Error creating appointment:", error);
    },
  });
};

export const useUpdateAppointment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...appointmentData }: { id: string } & Partial<AppointmentFormData>) => {
      const updateData: any = {};
      
      // Only include defined values, properly handle UUID fields
      Object.keys(appointmentData).forEach(key => {
        const value = appointmentData[key as keyof AppointmentFormData];
        if (value !== undefined) {
          if (key === 'customer_id' || key === 'task_id' || key === 'purchase_id') {
            updateData[key] = normalizeUuid(value as string);
          } else if (key === 'start_time' || key === 'end_time') {
            updateData[key] = (value as Date).toISOString();
          } else {
            updateData[key] = value;
          }
        }
      });
      
      // Calculate duration if both times are provided
      if (appointmentData.start_time && appointmentData.end_time) {
        updateData.duration = Math.round((appointmentData.end_time.getTime() - appointmentData.start_time.getTime()) / (1000 * 60));
      }

      const { data, error } = await supabase
        .from("appointments")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointment-stats"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointments-by-task"] });
      queryClient.invalidateQueries({ queryKey: ["parent-task-data"] });
      queryClient.invalidateQueries({ queryKey: ["child-tasks-data"] });
      enhancedToast.success("Success", "Appointment updated successfully");
    },
    onError: (error) => {
      enhancedToast.error("Error", "Failed to update appointment");
      console.error("Error updating appointment:", error);
    },
  });
};

export const useUpdateAppointmentStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: AppointmentStatus; note?: string }) => {
      // First fetch current appointment to get existing notes
      const { data: current, error: fetchError } = await supabase
        .from("appointments")
        .select("notes")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      // Build updated notes with status change entry
      const timestamp = new Date().toLocaleString('en-AU', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const statusLabel = status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      let statusNote = `[${timestamp} - Status changed to "${statusLabel}"]`;
      if (note?.trim()) {
        statusNote += `\n${note.trim()}`;
      }
      statusNote += '\n---';

      const updatedNotes = current?.notes 
        ? `${statusNote}\n\n${current.notes}`
        : statusNote;

      const { data, error } = await supabase
        .from("appointments")
        .update({ 
          status: status as any,
          notes: updatedNotes
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointment-stats"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["todays-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointments-by-task"] });
      queryClient.invalidateQueries({ queryKey: ["parent-task-data"] });
      queryClient.invalidateQueries({ queryKey: ["child-tasks-data"] });
      enhancedToast.success("Success", "Appointment status updated successfully");
    },
    onError: (error) => {
      enhancedToast.error("Error", "Failed to update appointment status");
      console.error("Error updating appointment status:", error);
    },
  });
};

export const useRescheduleAppointment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, start_time, end_time, reason }: { 
      id: string; 
      start_time: string; 
      end_time: string; 
      reason?: string;
    }) => {
      // Fetch current appointment to get existing notes
      const { data: current, error: fetchError } = await supabase
        .from("appointments")
        .select("notes")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      // Build reschedule note
      const timestamp = new Date().toLocaleString('en-AU', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const startDate = new Date(start_time);
      const endDate = new Date(end_time);
      const newTimeStr = `${startDate.toLocaleDateString('en-AU', { 
        weekday: 'short', 
        day: 'numeric', 
        month: 'short' 
      })} ${startDate.toLocaleTimeString('en-AU', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })} - ${endDate.toLocaleTimeString('en-AU', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })}`;
      
      let rescheduleNote = `[${timestamp} - Rescheduled to ${newTimeStr}]`;
      if (reason?.trim()) {
        rescheduleNote += `\nReason: ${reason.trim()}`;
      }
      rescheduleNote += '\n---';

      const updatedNotes = current?.notes 
        ? `${rescheduleNote}\n\n${current.notes}`
        : rescheduleNote;

      // Calculate new duration
      const duration = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));

      const { data, error } = await supabase
        .from("appointments")
        .update({ 
          start_time,
          end_time,
          duration,
          notes: updatedNotes
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointment-stats"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["todays-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointments-by-task"] });
      queryClient.invalidateQueries({ queryKey: ["parent-task-data"] });
      queryClient.invalidateQueries({ queryKey: ["child-tasks-data"] });
      enhancedToast.success("Success", "Appointment rescheduled successfully");
    },
    onError: (error) => {
      enhancedToast.error("Error", "Failed to reschedule appointment");
      console.error("Error rescheduling appointment:", error);
    },
  });
};

export const useDeleteAppointment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("appointments")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, deletedId) => {
      // Optimistically remove from all appointment queries
      queryClient.setQueriesData(
        { queryKey: ["appointments"] },
        (oldData: any) => {
          if (!oldData) return oldData;
          return Array.isArray(oldData) 
            ? oldData.filter((appointment: any) => appointment.id !== deletedId)
            : oldData;
        }
      );

      // Optimistically update appointment-stats
      queryClient.setQueryData(["appointment-stats"], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          todayAppointments: Math.max(0, (old.todayAppointments || 0) - 1)
        };
      });
      
      // Remove specific appointment queries from cache
      queryClient.removeQueries({ queryKey: ["appointments-by-task"] });
      queryClient.removeQueries({ queryKey: ["appointment", deletedId] });

      enhancedToast.success("Success", "Appointment deleted successfully");
    },
    onError: (error) => {
      enhancedToast.error("Error", "Failed to delete appointment");
      console.error("Error deleting appointment:", error);
    },
  });
};