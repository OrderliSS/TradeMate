import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useShipments(purchaseId: string | undefined) {
  return useQuery({
    queryKey: ['shipments', purchaseId],
    enabled: !!purchaseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipments')
        .select('*')
        .eq('purchase_id', purchaseId!)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });
}
