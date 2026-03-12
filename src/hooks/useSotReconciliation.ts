import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Result from SoT variance detection reconciliation
 */
export interface VarianceResult {
  product_id: string;
  product_name: string;
  variance_type: string;
  expected_value: number;
  actual_value: number;
  variance: number;
  severity: 'critical' | 'warning' | 'info';
}

export interface RefreshResult {
  product_id: string;
  refreshed_at: string;
  status: string;
  message: string;
}

/**
 * Hook for bulk SoT reconciliation and variance detection
 * 
 * Automatically checks all products for Source of Truth metric variances,
 * identifying conservation errors and inconsistencies.
 * 
 * @returns Query result with variance data and loading states
 * @example
 * ```tsx
 * const { data: variances, isLoading } = useSotReconciliation();
 * ```
 */
export const useSotReconciliation = () => {
  return useQuery({
    queryKey: ["sot-reconciliation"],
    queryFn: async (): Promise<VarianceResult[]> => {
      const { data, error } = await supabase
        .rpc('reconcile_sot_metrics_bulk');
      
      if (error) throw error;
      return (data || []) as VarianceResult[];
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Check for variances every minute
  });
};

/**
 * Hook for manual refresh of SoT metrics
 * 
 * Triggers a full recalculation of Source of Truth metrics for specified products.
 * Use this when you need to ensure metrics are up-to-date after bulk operations.
 * 
 * @returns Mutation function and state
 * @example
 * ```tsx
 * const refresh = useSotRefresh();
 * refresh.mutate(['product-id-1', 'product-id-2']);
 * ```
 */
export const useSotRefresh = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (productIds?: string[]) => {
      const { data, error } = await supabase
        .rpc('refresh_sot_metrics', { 
          p_product_ids: productIds || null 
        });
      
      if (error) throw error;
      return data as RefreshResult[];
    },
    onSuccess: (results) => {
      const successCount = results.filter(r => r.status === 'success').length;
      toast.success(`Successfully refreshed ${successCount} product(s)`);
      
      // Invalidate all SoT-related queries
      queryClient.invalidateQueries({ queryKey: ["sot-metrics-v2"] });
      queryClient.invalidateQueries({ queryKey: ["sot-reconciliation"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error) => {
      toast.error(`Refresh failed: ${error.message}`);
    },
  });
};

/**
 * Hook for SoT configuration management
 * 
 * Retrieves SoT configuration settings for a product or all products.
 * Configuration includes allocation priorities, thresholds, and calculation rules.
 * 
 * @param productId - Optional product ID. If omitted, returns all configurations
 * @returns Query result with configuration data
 */
export const useSotConfiguration = (productId?: string) => {
  return useQuery({
    queryKey: ["sot-configuration", productId],
    queryFn: async () => {
      const query = supabase
        .from("sot_configuration")
        .select("*");
      
      if (productId) {
        query.eq("product_id", productId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      return productId ? data?.[0] : data;
    },
    enabled: !!productId || productId === undefined,
  });
};

/**
 * Hook for updating SoT configuration
 * 
 * Updates configuration settings that control how SoT metrics are calculated
 * and allocated for a specific product.
 * 
 * @returns Mutation function for updating configuration
 */
export const useSotConfigurationUpdate = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      productId,
      configuration
    }: {
      productId: string;
      configuration: {
        on_order_definition?: 'ordered_not_shipped' | 'ordered_not_received';
        pending_transit_scope?: 'outbound_only' | 'bidirectional';
        total_includes_inbound?: boolean;
        safety_stock_threshold?: number;
        allocation_priority_order?: string[];
        allow_preallocation?: boolean;
        enable_variance_alerts?: boolean;
        conservation_check_frequency?: string;
      };
    }) => {
      const { data, error } = await supabase
        .from("sot_configuration")
        .upsert({
          product_id: productId,
          ...configuration,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("SoT configuration updated successfully");
      queryClient.invalidateQueries({ queryKey: ["sot-configuration"] });
      queryClient.invalidateQueries({ queryKey: ["sot-metrics-v2"] });
    },
    onError: (error) => {
      toast.error(`Configuration update failed: ${error.message}`);
    },
  });
};

/**
 * Hook for SoT audit log retrieval
 * 
 * Fetches audit trail of SoT metric changes and reconciliation actions.
 * 
 * @param productId - Optional product ID to filter logs
 * @param limit - Maximum number of log entries to return (default: 50)
 * @returns Query result with audit log entries
 */
export const useSotAuditLog = (productId?: string, limit = 50) => {
  return useQuery({
    queryKey: ["sot-audit-log", productId, limit],
    queryFn: async () => {
      const query = supabase
        .from("sot_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      
      if (productId) {
        query.eq("product_id", productId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
};