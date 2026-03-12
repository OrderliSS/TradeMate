import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invokeEdgeFunction } from '@/lib/edge-function-client';

interface TrackPackageInput {
  tracking_number: string;
  purchase_id: string;
  carrier_code?: string;
  org_id: string;
}

export function useTrackPackage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: TrackPackageInput) => {
      const { data, error } = await invokeEdgeFunction('track-package', {
        body: input,
      });
      if (error) throw error;
      return data as { shipment: any; events: any[]; stubbed: boolean };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['shipments', variables.purchase_id] });
      queryClient.invalidateQueries({ queryKey: ['tracking-usage'] });
    },
  });
}
