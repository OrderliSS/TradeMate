import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { enhancedToast } from "@/components/ui/enhanced-toast";
import type { Appointment, AppointmentFormData } from "@/types/appointments";

interface ConfirmAppointmentParams {
  appointmentId: string;
  status: 'completed' | 'no_show';
  outcomeNotes?: string;
  purchaseId?: string | null;
  appointmentDate?: string;
  actualStartTime?: string;
  actualEndTime?: string;
}

interface RescheduleAppointmentParams {
  originalAppointmentId: string;
  newAppointmentData: {
    title: string;
    description?: string;
    appointment_type: string;
    start_time: Date;
    end_time: Date;
    location?: string;
    meeting_url?: string;
    customer_id?: string;
    task_id?: string;
    notes?: string;
  };
  outcomeNotes?: string;
}

export const useConfirmAppointmentOutcome = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ appointmentId, status, outcomeNotes, purchaseId, appointmentDate, actualStartTime, actualEndTime }: ConfirmAppointmentParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('appointments')
        .update({
          status,
          confirmed_at: new Date().toISOString(),
          confirmed_by: user?.id,
          outcome_notes: outcomeNotes || null,
          actual_start_time: actualStartTime || null,
          actual_end_time: actualEndTime || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', appointmentId)
        .select()
        .single();

      if (error) throw error;

      // If completed with a linked purchase, update the purchase date to the actual start time (or scheduled time as fallback)
      if (status === 'completed' && purchaseId) {
        const purchaseDate = actualStartTime || appointmentDate;
        if (purchaseDate) {
          const { error: purchaseError } = await supabase
            .from('purchases')
            .update({
              purchase_date: purchaseDate,
              updated_at: new Date().toISOString(),
            })
            .eq('id', purchaseId);

          if (purchaseError) {
            console.error('Failed to update purchase date:', purchaseError);
            // Don't throw - appointment was updated successfully
          }
        }
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointments-by-task'] });
      queryClient.invalidateQueries({ queryKey: ['todays-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['task'] });
      
      const statusLabel = variables.status === 'completed' ? 'Meeting confirmed as completed' : 'Marked as no-show';
      enhancedToast.success(statusLabel);
    },
    onError: (error) => {
      enhancedToast.error('Failed to update appointment', error.message);
    }
  });
};

export const useRescheduleAppointment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ originalAppointmentId, newAppointmentData, outcomeNotes }: RescheduleAppointmentParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // First, update original appointment to 'rescheduled' status
      const { error: updateError } = await supabase
        .from('appointments')
        .update({
          status: 'rescheduled',
          confirmed_at: new Date().toISOString(),
          confirmed_by: user?.id,
          outcome_notes: outcomeNotes || 'Rescheduled to new appointment',
          updated_at: new Date().toISOString(),
        })
        .eq('id', originalAppointmentId);

      if (updateError) throw updateError;

      // Calculate duration in minutes
      const duration = Math.round(
        (newAppointmentData.end_time.getTime() - newAppointmentData.start_time.getTime()) / 60000
      );

      // Create new appointment with link to original
      const { data: newAppointment, error: createError } = await supabase
        .from('appointments')
        .insert([{
          title: newAppointmentData.title,
          description: newAppointmentData.description,
          appointment_type: newAppointmentData.appointment_type as any,
          start_time: newAppointmentData.start_time.toISOString(),
          end_time: newAppointmentData.end_time.toISOString(),
          duration,
          location: newAppointmentData.location,
          meeting_url: newAppointmentData.meeting_url,
          customer_id: newAppointmentData.customer_id || null,
          task_id: newAppointmentData.task_id || null,
          notes: newAppointmentData.notes,
          status: 'scheduled' as any,
          created_by: user?.id,
          rescheduled_from: originalAppointmentId,
        }])
        .select()
        .single();

      if (createError) throw createError;
      return newAppointment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointments-by-task'] });
      queryClient.invalidateQueries({ queryKey: ['todays-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-appointments'] });
      
      enhancedToast.success('Appointment rescheduled successfully');
    },
    onError: (error) => {
      enhancedToast.error('Failed to reschedule appointment', error.message);
    }
  });
};

// Helper to check if an appointment needs confirmation
export const needsConfirmation = (appointment: { start_time: string; status: string }) => {
  const startTime = new Date(appointment.start_time);
  const now = new Date();
  const isPast = startTime < now;
  const isUnconfirmed = ['scheduled', 'confirmed', 'in_progress'].includes(appointment.status);
  
  return isPast && isUnconfirmed;
};
