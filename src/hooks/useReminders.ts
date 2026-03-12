import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useDataEnvironment } from "@/hooks/useSandbox";

export interface ReminderWithDetails {
  id: string;
  task_number: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
  priority: string | null;
  task_type: string | null;
  purchase_id: string | null;
  customer_id: string | null;
  created_at: string;
  updated_at: string;
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
  purchase: {
    id: string;
    receipt_number: string | null;
    ticket_number: string | null;
  } | null;
}

export const useReminders = (filters?: { status?: string; showCompleted?: boolean }) => {
  const dataEnvironment = useDataEnvironment();
  
  return useQuery({
    queryKey: ['reminders', filters, dataEnvironment],
    refetchOnMount: 'always',
    staleTime: 0,
    queryFn: async () => {
      // Step 1: Fetch reminders without purchase join (no FK exists)
      let query = supabase
        .from('tasks')
        .select(`
          id,
          task_number,
          title,
          description,
          due_date,
          status,
          priority,
          task_type,
          purchase_id,
          customer_id,
          created_at,
          updated_at,
          customer:customers!tasks_customer_id_fkey(id, name, email, phone)
        `)
        .eq('task_type', 'reminder')
        .eq('data_environment', dataEnvironment)
        .order('due_date', { ascending: true, nullsFirst: false });
      
      if (filters?.status) {
        query = query.eq('status', filters.status as any);
      }
      
      if (!filters?.showCompleted) {
        query = query.neq('status', 'completed').neq('status', 'archived');
      }
      
      const { data: remindersData, error: remindersError } = await query;
      
      if (remindersError) throw remindersError;
      
      const reminders = remindersData || [];
      
      // Step 2: Fetch purchases for reminders that have purchase_id
      const purchaseIds = reminders
        .map(r => r.purchase_id)
        .filter((id): id is string => id !== null);
      
      const purchasesMap = new Map<string, { id: string; receipt_number: string | null; ticket_number: string | null }>();
      
      if (purchaseIds.length > 0) {
        const { data: purchasesData } = await supabase
          .from('purchases')
          .select('id, receipt_number, ticket_number')
          .in('id', purchaseIds);
        
        if (purchasesData) {
          purchasesData.forEach(p => purchasesMap.set(p.id, p));
        }
      }
      
      // Step 3: Map purchases onto reminders
      return reminders.map(item => ({
        ...item,
        customer: Array.isArray(item.customer) ? item.customer[0] || null : item.customer,
        purchase: item.purchase_id ? purchasesMap.get(item.purchase_id) || null : null,
      })) as ReminderWithDetails[];
    }
  });
};

export const useUpdateReminderStatus = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'pending' | 'in_progress' | 'completed' | 'on_hold' | 'waiting_response' | 'archived' }) => {
      const { error } = await supabase
        .from('tasks')
        .update({ status })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error) => {
      console.error('Error updating reminder:', error);
      toast.error('Failed to update reminder');
    }
  });
};

export const useUpdateReminderDate = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      id, 
      dueDate, 
      purchaseId,
      reason,
      notes 
    }: { 
      id: string; 
      dueDate: string | null; 
      purchaseId?: string | null;
      reason?: string;
      notes?: string;
    }) => {
      // Update the reminder's due_date
      const { error: taskError } = await supabase
        .from('tasks')
        .update({ due_date: dueDate })
        .eq('id', id);
      
      if (taskError) throw taskError;
      
      // If there's a linked purchase, also update its fulfillment_pending_until and follow_up_date
      if (purchaseId && dueDate) {
        const updateData: Record<string, any> = { 
          fulfillment_pending_until: dueDate,
          follow_up_date: dueDate 
        };
        
        // If a reason is provided, update the pending reason too
        if (reason) {
          updateData.fulfillment_pending_reason = reason;
        }
        
        const { error: purchaseError } = await supabase
          .from('purchases')
          .update(updateData as any)
          .eq('id', purchaseId);
        
        if (purchaseError) {
          console.error('Error updating purchase dates:', purchaseError);
          // Don't throw - the reminder was updated successfully
        }
        
        // Add a case note if we have a reason or notes
        if (reason || notes) {
          const { data: purchaseData } = await supabase
            .from('purchases')
            .select('case_id')
            .eq('id', purchaseId)
            .single();
          
          if (purchaseData?.case_id) {
            const { data: userData } = await supabase.auth.getUser();
            
            let noteContent = `Reminder rescheduled to ${dueDate ? new Date(dueDate).toLocaleDateString() : 'no date'}`;
            if (reason) {
              noteContent += `\nReason: ${reason}`;
            }
            if (notes) {
              noteContent += `\n\nNotes: ${notes}`;
            }
            
            await supabase.from('task_notes').insert({
              task_id: purchaseData.case_id,
              note_content: noteContent,
              note_type: 'system',
              created_by: userData.user?.id,
            });
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      queryClient.invalidateQueries({ queryKey: ['linked-reminder'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['purchase'] });
      queryClient.invalidateQueries({ queryKey: ['task-notes'] });
      toast.success('Reminder date updated');
    },
    onError: (error) => {
      console.error('Error updating reminder date:', error);
      toast.error('Failed to update reminder date');
    }
  });
};
