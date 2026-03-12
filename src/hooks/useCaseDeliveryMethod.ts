import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

// Mapping from appointment type to delivery method suggestion
const APPOINTMENT_TO_DELIVERY_MAP: Record<string, {
  type: 'personal' | 'pickup' | 'courier';
  closureNotes: string;
  label: string;
  description: string;
}> = {
  'site_visit_install': {
    type: 'personal',
    closureNotes: 'Delivered & Installed',
    label: 'Delivered & Installed',
    description: 'Equipment set up at customer location'
  },
  'customer_visit': {
    type: 'personal',
    closureNotes: 'Delivered to Customer',
    label: 'Delivered to Customer',
    description: 'Hand-delivered directly to customer'
  },
  'demo': {
    type: 'personal',
    closureNotes: 'Delivered to Customer',
    label: 'Delivered to Customer',
    description: 'Demonstrated and left with customer'
  },
  'consultation': {
    type: 'pickup',
    closureNotes: '',
    label: 'Customer Pickup',
    description: 'Customer may collect after consultation'
  }
};

export interface CaseDeliverySuggestion {
  appointmentId: string;
  appointmentTitle: string;
  appointmentType: string;
  appointmentStatus: string;
  appointmentDate: string;
  location?: string;
  suggestedDelivery: {
    type: 'personal' | 'pickup' | 'courier';
    closureNotes: string;
    label: string;
    description: string;
  };
}

export const useCaseDeliveryMethod = (purchaseId?: string) => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['case-delivery-method', purchaseId],
    queryFn: async (): Promise<CaseDeliverySuggestion | null> => {
      if (!purchaseId) return null;

      // Step 1: Get the purchase's case_id
      const { data: purchase, error: purchaseError } = await supabase
        .from('purchases')
        .select('case_id')
        .eq('id', purchaseId)
        .single();

      if (purchaseError || !purchase?.case_id) {
        return null;
      }

      // Step 2: Get appointments linked to this case (task_id = case_id)
      const { data: appointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select('id, title, appointment_type, status, start_time, location')
        .eq('task_id', purchase.case_id)
        .in('status', ['completed', 'scheduled']) // Prioritize completed, but also suggest from scheduled
        .order('status', { ascending: false }) // 'completed' comes first alphabetically after 'scheduled'? Actually use different approach
        .order('start_time', { ascending: false });

      if (appointmentsError || !appointments?.length) {
        return null;
      }

      // Step 3: Find a delivery-relevant appointment (prefer completed ones)
      // Sort to prioritize completed appointments
      const sortedAppointments = [...appointments].sort((a, b) => {
        if (a.status === 'completed' && b.status !== 'completed') return -1;
        if (b.status === 'completed' && a.status !== 'completed') return 1;
        return new Date(b.start_time).getTime() - new Date(a.start_time).getTime();
      });

      for (const appointment of sortedAppointments) {
        const mapping = APPOINTMENT_TO_DELIVERY_MAP[appointment.appointment_type];
        if (mapping) {
          return {
            appointmentId: appointment.id,
            appointmentTitle: appointment.title,
            appointmentType: appointment.appointment_type,
            appointmentStatus: appointment.status,
            appointmentDate: appointment.start_time,
            location: appointment.location || undefined,
            suggestedDelivery: mapping
          };
        }
      }

      return null;
    },
    enabled: !!purchaseId,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Real-time subscription for appointment updates
  useEffect(() => {
    if (!purchaseId) return;

    const channel = supabase
      .channel(`case-delivery-${purchaseId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments'
        },
        () => {
          // Refetch when appointments change
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [purchaseId, refetch]);

  return {
    suggestion: data,
    isLoading,
    error,
    refetch
  };
};
