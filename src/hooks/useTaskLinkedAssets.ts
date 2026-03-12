import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { enhancedToast } from '@/components/ui/enhanced-toast';

/**
 * Hook to update linked assets for a task
 * Uses the asset_configuration_checklist table to track asset-task relationships
 */
export const useUpdateTaskLinkedAssets = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ taskId, assetIds }: { taskId: string; assetIds: string[] }) => {
      // Get current linked assets
      const { data: existing, error: fetchError } = await supabase
        .from('asset_configuration_checklist')
        .select('id, asset_id')
        .eq('task_id', taskId);
      
      if (fetchError) throw fetchError;
      
      const existingAssetIds = (existing || []).map(e => e.asset_id);
      
      // Find assets to add and remove
      const toAdd = assetIds.filter(id => !existingAssetIds.includes(id));
      const toRemove = existingAssetIds.filter(id => !assetIds.includes(id));
      
      // Remove old links
      if (toRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from('asset_configuration_checklist')
          .delete()
          .eq('task_id', taskId)
          .in('asset_id', toRemove);
        
        if (deleteError) throw deleteError;
      }
      
      // Add new links
      if (toAdd.length > 0) {
        const newLinks = toAdd.map(assetId => ({
          task_id: taskId,
          asset_id: assetId,
          is_configured: false,
        }));
        
        const { error: insertError } = await supabase
          .from('asset_configuration_checklist')
          .insert(newLinks);
        
        if (insertError) throw insertError;
      }
      
      return { added: toAdd.length, removed: toRemove.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['linked-assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset-configuration-checklist'] });
      enhancedToast.success('Assets updated', `${result.added} added, ${result.removed} removed`);
    },
    onError: (error: any) => {
      enhancedToast.error('Failed to update assets', error.message);
    },
  });
};

/**
 * Hook to get linked asset IDs for a task from configuration checklist
 */
export const useTaskLinkedAssetIds = (taskId?: string) => {
  return {
    queryKey: ['task-linked-assets', taskId],
    queryFn: async () => {
      if (!taskId) return [];
      
      const { data, error } = await supabase
        .from('asset_configuration_checklist')
        .select('asset_id')
        .eq('task_id', taskId);
      
      if (error) throw error;
      return (data || []).map(d => d.asset_id);
    },
    enabled: !!taskId,
  };
};
