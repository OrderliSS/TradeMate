import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AssetDiscrepancy {
  product_id: string;
  product_name: string;
  issue_type: string;
  issue_description: string;
  severity: 'high' | 'medium' | 'low';
  affected_count: number;
  suggested_action: string;
  asset_details: any;
}

export interface ReconciliationPlan {
  plan_id: string;
  product_id: string;
  action_type: string;
  action_description: string;
  priority: number;
  estimated_impact: string;
  requires_approval: boolean;
  action_data: any;
}

export const useAssetReconciliation = (productId?: string) => {
  const queryClient = useQueryClient();

  const analyzeDiscrepancies = useQuery({
    queryKey: ["asset-discrepancies", productId],
    queryFn: async (): Promise<AssetDiscrepancy[]> => {
      const { data, error } = await supabase.rpc('analyze_asset_discrepancies', {
        p_product_id: productId || null
      });
      
      if (error) throw error;
      return (data || []).map(item => ({
        ...item,
        severity: item.severity as 'high' | 'medium' | 'low'
      }));
    },
    enabled: !!productId,
  });

  const generatePlan = useQuery({
    queryKey: ["reconciliation-plan", productId],
    queryFn: async (): Promise<ReconciliationPlan[]> => {
      const { data, error } = await supabase.rpc('generate_reconciliation_plan', {
        p_product_id: productId || null
      });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!productId && (analyzeDiscrepancies.data?.length || 0) > 0,
  });

  const applyAction = useMutation({
    mutationFn: async ({
      actionType,
      productId,
      actionData,
      approvedBy
    }: {
      actionType: string;
      productId: string;
      actionData: any;
      approvedBy?: string;
    }) => {
      const { data, error } = await supabase.rpc('apply_reconciliation_action', {
        p_action_type: actionType,
        p_product_id: productId,
        p_action_data: actionData,
        p_approved_by: approvedBy || null
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["asset-discrepancies"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliation-plan"] });
      queryClient.invalidateQueries({ queryKey: ["asset-management"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["allocations"] });
      
      const message = typeof result === 'object' && result && 'message' in result 
        ? String(result.message) 
        : "Reconciliation action completed successfully";
      toast.success(message);
    },
    onError: (error: any) => {
      toast.error(`Reconciliation failed: ${error.message}`);
    },
  });

  return {
    discrepancies: analyzeDiscrepancies.data || [],
    isAnalyzing: analyzeDiscrepancies.isLoading,
    reconciliationPlan: generatePlan.data || [],
    isPlanGenerating: generatePlan.isLoading,
    applyAction,
    isApplying: applyAction.isPending,
    refetchAnalysis: () => {
      analyzeDiscrepancies.refetch();
      generatePlan.refetch();
    }
  };
};