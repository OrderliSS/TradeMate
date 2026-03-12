import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDataEnvironment } from "@/hooks/useSandbox";
import { toast } from "sonner";
import { useEffect } from "react";
import { useCurrentOrganizationId } from "./useOrganization";

/**
 * Source of Truth metrics interface representing inventory state breakdown
 */
export interface SotMetrics {
  total_assets: number;
  available: number;
  allocated: number;
  pending_transit: number;
  being_configured: number;
  on_order: number;
  sold: number;
  inbound_transit: number;
}

export interface SotTransitionResult {
  success: boolean;
  intent: string;
  quantity: number;
  transitions: Array<{
    step: string;
    from_state: string;
    to_state: string;
    quantity: number;
  }>;
  product_id: string;
}

/**
 * Hook for retrieving Source of Truth metrics
 * 
 * Fetches comprehensive inventory state metrics for a product or all products.
 * Automatically subscribes to real-time updates.
 * 
 * @param productId - Optional product ID. If omitted, returns metrics for all active products
 * @returns Query result with SoT metrics
 */
export const useSotMetrics = (productId?: string) => {
  const queryClient = useQueryClient();
  const dataEnvironment = useDataEnvironment();
  const organizationId = useCurrentOrganizationId();

  // Set up real-time subscriptions for SoT data changes
  useEffect(() => {
    const channel = supabase
      .channel('sot-metrics-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'products',
        filter: productId ? `id=eq.${productId}` : undefined
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["sot-metrics"] });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'inventory_movements'
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["sot-metrics"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, productId, organizationId]);

  return useQuery({
    queryKey: ["sot-metrics", productId, dataEnvironment, organizationId],
    queryFn: async (): Promise<SotMetrics | SotMetrics[]> => {
      if (productId) {
        // Get metrics for specific product using the canonical RPC
        const { data, error } = await supabase
          .rpc('calculate_sot_metrics_state_graph', { p_product_id: productId });

        if (error) throw error;
        const rawData = data?.[0];

        // Map the database fields to the expected interface
        return {
          total_assets: rawData?.total_assets || 0,
          available: rawData?.available || 0,
          allocated: rawData?.allocated || 0,
          pending_transit: rawData?.outbound_transit || 0,
          being_configured: rawData?.being_configured || 0,
          on_order: rawData?.on_order || 0,
          sold: rawData?.sold || 0,
          inbound_transit: rawData?.inbound_transit || 0
        };
      } else {
        // Get metrics for all products
        const { data: products, error: productsError } = await supabase
          .from("products")
          .select("id")
          .eq("organization_id", organizationId)
          .eq("status", "active");

        if (productsError) throw productsError;

        const metricsPromises = products.map(async (product) => {
          const { data, error } = await supabase
            .rpc('calculate_sot_metrics_state_graph', { p_product_id: product.id });

          if (error) throw error;
          const rawData = data?.[0];

          return {
            total_assets: rawData?.total_assets || 0,
            available: rawData?.available || 0,
            allocated: rawData?.allocated || 0,
            pending_transit: rawData?.outbound_transit || 0,
            being_configured: rawData?.being_configured || 0,
            on_order: rawData?.on_order || 0,
            sold: rawData?.sold || 0,
            inbound_transit: rawData?.inbound_transit || 0
          };
        });

        return await Promise.all(metricsPromises);
      }
    },
    enabled: (!!productId || productId === undefined) && !!organizationId,
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });
};

/**
 * Hook for SoT state transitions
 * 
 * Performs controlled state transitions in the Source of Truth system.
 * Handles complex multi-step transitions like "increase_sold" or "receive_goods".
 * 
 * @returns Mutation function for state transitions
 * @example
 * ```tsx
 * const transition = useSotTransition();
 * transition.mutate({
 *   productId: 'prod-123',
 *   intent: 'increase_sold',
 *   quantity: 5
 * });
 * ```
 */
export const useSotTransition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productId,
      intent,
      quantity,
      reason,
      referenceId,
      referenceType
    }: {
      productId: string;
      intent: 'increase_sold' | 'increase_allocated' | 'increase_pending_transit' | 'receive_goods' | 'cancel_allocation';
      quantity: number;
      reason?: string;
      referenceId?: string;
      referenceType?: string;
    }) => {
      const { data, error } = await supabase
        .rpc('sot_transition', {
          p_product_id: productId,
          p_intent: intent,
          p_quantity: quantity,
          p_reason: reason,
          p_reference_id: referenceId,
          p_reference_type: referenceType
        });

      if (error) throw error;
      return data as unknown as SotTransitionResult;
    },
    onSuccess: (data) => {
      const intentLabels = {
        'increase_sold': 'Mark as Sold',
        'increase_allocated': 'Allocate Stock',
        'increase_pending_transit': 'Ship to Customer',
        'receive_goods': 'Receive Goods',
        'cancel_allocation': 'Cancel Allocation'
      };

      toast.success(`${intentLabels[data.intent]} completed: ${data.quantity} units`);

      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ["sot-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-availability"] });
      queryClient.invalidateQueries({ queryKey: ["unified-inventory"] });
    },
    onError: (error) => {
      toast.error(`SoT transition failed: ${error.message}`);
    },
  });
};

/**
 * Hook for bulk SoT metrics calculation
 * 
 * Efficiently fetches metrics for multiple products simultaneously.
 * Returns a keyed object for easy lookup.
 * 
 * @param productIds - Array of product IDs to fetch metrics for
 * @returns Query result with metrics keyed by product ID
 */
export const useBulkSotMetrics = (productIds: string[]) => {
  const dataEnvironment = useDataEnvironment();
  const organizationId = useCurrentOrganizationId();

  return useQuery({
    queryKey: ["bulk-sot-metrics", productIds, dataEnvironment, organizationId],
    queryFn: async (): Promise<Record<string, SotMetrics>> => {
      const metricsPromises = productIds.map(async (productId) => {
        const { data, error } = await supabase
          .rpc('calculate_sot_metrics_state_graph', { p_product_id: productId });

        if (error) {
          console.error(`Error fetching SoT metrics for ${productId}:`, error);
          return {
            productId,
            metrics: {
              total_assets: 0,
              available: 0,
              allocated: 0,
              pending_transit: 0,
              being_configured: 0,
              on_order: 0,
              sold: 0,
              inbound_transit: 0
            }
          };
        }

        const rawData = data?.[0];

        return {
          productId,
          metrics: {
            total_assets: rawData?.total_assets || 0,
            available: rawData?.available || 0,
            allocated: rawData?.allocated || 0,
            pending_transit: rawData?.outbound_transit || 0,
            being_configured: rawData?.being_configured || 0,
            on_order: rawData?.on_order || 0,
            sold: rawData?.sold || 0,
            inbound_transit: rawData?.inbound_transit || 0
          }
        };
      });

      const results = await Promise.all(metricsPromises);
      return results.reduce((acc, { productId, metrics }) => {
        acc[productId] = metrics;
        return acc;
      }, {} as Record<string, SotMetrics>);
    },
    enabled: productIds.length > 0 && !!organizationId,
    staleTime: 5000,
  });
};