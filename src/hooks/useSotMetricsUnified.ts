import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDataEnvironment } from "@/hooks/useSandbox";
import { toast } from "@/hooks/use-toast";
import { useEffect } from "react";

export interface SotMetricsUnified {
  product_id: string;
  sku: string;
  product_name: string;

  // Physical inventory
  qty_sellable: number;
  config_hold: number;
  total_assets: number;

  // Allocations by source
  allocated_available: number;
  allocated_inbound: number;
  allocated_on_order: number;
  allocated_total: number;

  // Vendor pipeline
  on_order: number;
  inbound: number;

  // Customer pipeline
  pending_transit: number;
  sold: number;

  // Planning & derived
  safety_stock: number;
  available: number;
  pipeline_total: number;
  on_hand_total: number;
}

export interface SotIntegrityIssue {
  product_id: string;
  sku: string;
  issue_type: string;
  issue_description: string;
  current_value: number;
  expected_value: number;
}

// Unified hook to replace all fragmented SoT data access
export const useSotMetricsUnified = (productId?: string) => {
  const queryClient = useQueryClient();
  const dataEnvironment = useDataEnvironment();

  // Set up real-time subscriptions for all source tables
  useEffect(() => {
    const channel = supabase
      .channel('sot-unified-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'products'
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["sot-metrics-unified"] });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'stock_orders'
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["sot-metrics-unified"] });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'asset_management'
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["sot-metrics-unified"] });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'allocations_v2'
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["sot-metrics-unified"] });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'purchases'
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["sot-metrics-unified"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ["sot-metrics-unified", productId, dataEnvironment],
    queryFn: async (): Promise<SotMetricsUnified | SotMetricsUnified[]> => {
      try {
        // Check if user has access to business intelligence data
        const { data: canAccess, error: accessError } = await supabase
          .rpc('can_access_business_intelligence');

        // Note: We don't throw on accessError here because the RPC might not exist
        if (!accessError && !canAccess) {
          throw new Error('Access denied: Business intelligence requires admin or finance role');
        }

        const { data, error } = await supabase
          .rpc('get_sot_metrics_secure', { p_organization_id: productId || '' } as any);

        if (!error && data) {
          const results = data as unknown as SotMetricsUnified[];
          if (productId) return results[0];
          return results;
        }

        console.warn(`[SoT Metrics] RPC 'get_sot_metrics_secure' failed or missing. Falling back to frontend calculation.`);
      } catch (e) {
        console.warn(`[SoT Metrics] Error calling SoT RPC, falling back to frontend logic.`, e);
      }

      // FALLBACK: Perform frontend calculation using source tables
      const { data: assets, error: assetsError } = await supabase
        .from("asset_management")
        .select("status, transit_status, product_id, category")
        .eq("data_environment", dataEnvironment);

      if (productId) {
        const { data: productAssets } = await supabase
          .from("asset_management")
          .select("status, transit_status, category")
          .eq("product_id", productId)
          .eq("data_environment", dataEnvironment);

        const { data: product } = await supabase
          .from("products")
          .select("id, name, sku, stock_sold")
          .eq("id", productId)
          .single();

        const { count: fulfilledCount } = await supabase
          .from('allocations')
          .select('id', { count: 'exact', head: true })
          .eq('product_id', productId)
          .eq('data_environment', dataEnvironment)
          .eq('status', 'fulfilled');

        // Robust calculation
        let instock = 0; let available = 0; let allocated = 0; let sold = 0; let ordered = 0; let pending_transit = 0;

        (productAssets || []).forEach(a => {
          if (a.status === 'instock') instock++;
          else if (a.status === 'available' || a.status === 'ready') available++;
          else if (a.status === 'allocated') {
            allocated++;
            if (a.transit_status === 'pending_transit') pending_transit++;
          }
          else if (a.status === 'sold') sold++;
          else if (a.status === 'ordered') ordered++;
        });

        const finalSold = Math.max(sold, fulfilledCount || 0, product?.stock_sold || 0);

        return {
          product_id: productId,
          sku: product?.sku || '',
          product_name: product?.name || 'Unknown',
          qty_sellable: available,
          config_hold: 0,
          total_assets: (productAssets?.length || 0),
          allocated_available: allocated,
          allocated_inbound: 0,
          allocated_on_order: 0,
          allocated_total: allocated,
          on_order: ordered,
          inbound: 0,
          pending_transit: pending_transit,
          sold: finalSold,
          safety_stock: 0,
          available: available,
          pipeline_total: ordered,
          on_hand_total: instock + available + allocated
        } as SotMetricsUnified;
      }

      // Bulk fallback logic (simplified)
      return [];
    },
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });
};

// Hook for integrity monitoring
export const useSotIntegrityReport = () => {
  return useQuery({
    queryKey: ["sot-integrity-report"],
    queryFn: async (): Promise<SotIntegrityIssue[]> => {
      const { data, error } = await supabase
        .rpc('get_sot_integrity_report');

      if (error) throw error;
      return data || [];
    },
    staleTime: 30000, // Refresh every 30 seconds
  });
};

// Hook for allocation operations with idempotency
export const useSotAllocation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productId,
      quantity,
      sourceType,
      orderId,
      customerId
    }: {
      productId: string;
      quantity: number;
      sourceType: 'from_available' | 'from_inbound' | 'from_on_order';
      orderId: string;
      customerId?: string;
    }) => {
      // Create idempotent allocation with dedupe key
      const dedupeKey = `${orderId}:${productId}:${sourceType}`;

      const { data, error } = await supabase
        .from('allocations_v2')
        .upsert({
          product_id: productId,
          quantity,
          allocation_source_type: sourceType,
          purchase_order_id: orderId,
          customer_id: customerId,
          status: 'reserved',
          notes: `Allocated ${quantity} units from ${sourceType}`
        }, {
          onConflict: 'product_id,purchase_order_id,allocation_source_type',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Allocation Successful",
        description: `Allocated ${data.quantity} units successfully`
      });

      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ["sot-metrics-unified"] });
      queryClient.invalidateQueries({ queryKey: ["sot-integrity-report"] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Allocation Failed",
        description: error.message
      });
    },
  });
};

// Hook for deallocation
export const useSotDeallocation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      allocationId
    }: {
      allocationId: string;
    }) => {
      const { data, error } = await supabase
        .from('allocations_v2')
        .delete()
        .eq('id', allocationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Deallocation Successful",
        description: `Removed allocation of ${data.quantity} units`
      });

      queryClient.invalidateQueries({ queryKey: ["sot-metrics-unified"] });
      queryClient.invalidateQueries({ queryKey: ["sot-integrity-report"] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Deallocation Failed",
        description: error.message
      });
    },
  });
};

// Convenience hook for bulk metrics (multiple products)
export const useBulkSotMetricsUnified = (productIds: string[]) => {
  return useQuery({
    queryKey: ["sot-metrics-unified-bulk", productIds],
    queryFn: async (): Promise<Record<string, SotMetricsUnified>> => {
      // Check if user has access to business intelligence data
      const { data: canAccess, error: accessError } = await supabase
        .rpc('can_access_business_intelligence');

      if (accessError) throw accessError;

      if (!canAccess) {
        throw new Error('Access denied: Business intelligence requires admin or finance role');
      }

      // Get metrics for each product securely
      const metricsPromises = productIds.map(async (productId) => {
        const { data, error } = await supabase
          .rpc('get_sot_metrics_secure', { p_organization_id: productId } as any);

        if (error) throw error;
        const results = data as unknown as SotMetricsUnified[];
        return { productId, data: results?.[0] };
      });

      const results = await Promise.all(metricsPromises);
      const metricsRecord: Record<string, SotMetricsUnified> = {};

      results.forEach(({ productId, data }) => {
        if (data) {
          metricsRecord[productId] = data;
        }
      });

      return metricsRecord;
    },
    enabled: productIds.length > 0,
    staleTime: 5000,
  });
};