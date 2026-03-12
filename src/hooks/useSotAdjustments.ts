import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SotAdjustment {
  adj_id: number;
  sku: string;
  location: string;
  metric: string;
  delta: number | null;
  value_override: number | null;
  effective_at: string;
  expires_at: string | null;
  reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface SotLabel {
  field_key: string;
  display_name: string;
  description: string | null;
  display_group: string | null;
  sort_order: number | null;
  is_visible: boolean;
}

interface CreateAdjustmentParams {
  sku: string;
  metric: string;
  delta?: number;
  value_override?: number;
  reason?: string;
  expires_at?: string;
  location?: string;
}

export function useSotAdjustments(sku?: string) {
  return useQuery({
    queryKey: ['sot-adjustments', sku],
    queryFn: async () => {
      let query = supabase
        .from('sot_adjustments')
        .select('*')
        .order('created_at', { ascending: false });

      if (sku) {
        query = query.eq('sku', sku);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SotAdjustment[];
    },
  });
}

export function useSotLabels() {
  return useQuery({
    queryKey: ['sot-labels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sot_labels')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as SotLabel[];
    },
  });
}

export function useCreateSotAdjustment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: CreateAdjustmentParams) => {
      const { data, error } = await supabase.rpc('create_sot_adjustment', {
        p_sku: params.sku,
        p_metric: params.metric,
        p_delta: params.delta ?? null,
        p_value_override: params.value_override ?? null,
        p_reason: params.reason || 'Manual Adjustment',
        p_expires_at: params.expires_at || null,
        p_location: params.location || 'DEFAULT'
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sot-adjustments'] });
      queryClient.invalidateQueries({ queryKey: ['sot-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['unified-sot-metrics'] });

      toast({
        title: "Adjustment Created",
        description: `Successfully ${variables.delta ? 'adjusted' : 'pinned'} ${variables.metric} for ${variables.sku}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create adjustment: ${error.message}`,
        variant: "destructive",
      });
    },
  });
}

export function useRemoveSotAdjustment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (adjId: number) => {
      const { data, error } = await supabase.rpc('remove_sot_adjustment', {
        p_adj_id: adjId
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sot-adjustments'] });
      queryClient.invalidateQueries({ queryKey: ['sot-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['unified-sot-metrics'] });

      toast({
        title: "Adjustment Removed",
        description: "Successfully removed the adjustment",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to remove adjustment: ${error.message}`,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateSotLabel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (label: Partial<SotLabel> & { field_key: string }) => {
      const { data, error } = await supabase
        .from('sot_labels')
        .update(label)
        .eq('field_key', label.field_key)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sot-labels'] });

      toast({
        title: "Label Updated",
        description: "Successfully updated display label",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update label: ${error.message}`,
        variant: "destructive",
      });
    },
  });
}