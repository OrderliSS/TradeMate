import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AssetConfigItem {
  id: string;
  task_id: string;
  asset_id: string;
  purchase_id: string | null;
  product_id: string | null;
  is_configured: boolean;
  configured_at: string | null;
  configured_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  asset?: {
    id: string;
    asset_tag: string | null;
    serial_number: string | null;
    status: string;
    product?: {
      id: string;
      name: string;
      purchase_category: string | null;
    };
  };
}

export const useAssetConfigChecklist = (taskId?: string) => {
  return useQuery({
    queryKey: ["asset-config-checklist", taskId],
    queryFn: async (): Promise<AssetConfigItem[]> => {
      if (!taskId) return [];

      const { data, error } = await supabase
        .from("asset_configuration_checklist")
        .select(`
          *,
          asset:asset_management(
            id,
            asset_tag,
            serial_number,
            status,
            product:products(id, name, purchase_category)
          )
        `)
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      
      return (data || []).map(item => ({
        ...item,
        asset: Array.isArray(item.asset) ? item.asset[0] : item.asset
      })) as AssetConfigItem[];
    },
    enabled: !!taskId,
  });
};

export const useCreateConfigChecklist = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      taskId, 
      purchaseId 
    }: { 
      taskId: string; 
      purchaseId: string;
    }) => {
      // Get all allocated assets for this purchase that require configuration
      const { data: allocatedAssets, error: assetsError } = await supabase
        .from("asset_management")
        .select(`
          id,
          product_id,
          product:products(id, name, requires_configuration)
        `)
        .eq("purchase_order_id", purchaseId)
        .eq("status", "allocated");

      if (assetsError) throw assetsError;

      // Filter to assets that require configuration using the explicit flag
      const configurableAssets = (allocatedAssets || []).filter(asset => {
        const product = Array.isArray(asset.product) ? asset.product[0] : asset.product;
        return product?.requires_configuration === true;
      });

      if (configurableAssets.length === 0) {
        // If no category filtering, include all allocated assets
        const allAssets = allocatedAssets || [];
        if (allAssets.length === 0) {
          throw new Error("No allocated assets found for this purchase");
        }
        
        // Insert checklist items for all assets
        const checklistItems = allAssets.map(asset => ({
          task_id: taskId,
          asset_id: asset.id,
          purchase_id: purchaseId,
          product_id: asset.product_id,
          is_configured: false,
        }));

        const { error: insertError } = await supabase
          .from("asset_configuration_checklist")
          .upsert(checklistItems, { onConflict: 'task_id,asset_id' });

        if (insertError) throw insertError;
        return { created: allAssets.length };
      }

      // Insert checklist items
      const checklistItems = configurableAssets.map(asset => ({
        task_id: taskId,
        asset_id: asset.id,
        purchase_id: purchaseId,
        product_id: asset.product_id,
        is_configured: false,
      }));

      const { error: insertError } = await supabase
        .from("asset_configuration_checklist")
        .upsert(checklistItems, { onConflict: 'task_id,asset_id' });

      if (insertError) throw insertError;
      return { created: configurableAssets.length };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["asset-config-checklist", variables.taskId] });
      toast.success(`${data.created} assets added to configuration checklist`);
    },
    onError: (error) => {
      console.error("Failed to create config checklist:", error);
      toast.error("Failed to create configuration checklist");
    },
  });
};

export const useToggleAssetConfigured = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      checklistItemId, 
      isConfigured,
      notes 
    }: { 
      checklistItemId: string; 
      isConfigured: boolean;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const updateData: Record<string, any> = {
        is_configured: isConfigured,
        configured_at: isConfigured ? new Date().toISOString() : null,
        configured_by: isConfigured ? user?.id : null,
      };

      if (notes !== undefined) {
        updateData.notes = notes;
      }

      const { data, error } = await supabase
        .from("asset_configuration_checklist")
        .update(updateData)
        .eq("id", checklistItemId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["asset-config-checklist"] });
      toast.success(data.is_configured ? "Asset marked as configured" : "Asset marked as pending");
    },
    onError: (error) => {
      console.error("Failed to toggle asset configuration:", error);
      toast.error("Failed to update asset status");
    },
  });
};
