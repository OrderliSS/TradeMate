import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDataEnvironment } from "@/hooks/useSandbox";
import { getDataEnvironmentFilter } from "@/lib/sandbox-query-utils";
import { toast } from "sonner";
import { useEffect } from "react";

export interface SotMetricsStateGraph {
  product_id: string;
  total_assets: number;          // Operational assets only: Config + Available + Allocated + Transit
  available: number;             // Sellable units not reserved (safety stock excluded)
  allocated: number;             // Units assigned to orders (may be from any pre-Sold state)
  pending_transit: number;       // Shipped to customer, not yet delivered
  being_configured: number;      // Inventory being prepared/configured
  on_order: number;             // Ordered from vendors, not yet received
  sold: number;                 // Delivered to customers (lifecycle tracking)
  inbound_transit: number;      // Incoming from vendors (optional in Total Assets)
  lifecycle_total: number;      // Total Assets + Sold (historical context)
  available_raw: number;        // Raw available before safety stock adjustment
  safety_stock: number;         // Reserved safety stock per SKU
  allocation_breakdown: {
    from_available: number;     // Allocated from Available stock
    from_config: number;        // Pre-allocated from Configuration
    from_inbound: number;       // Pre-allocated from Inbound Transit
    from_on_order: number;      // Backorder allocation from On Order
    total: number;              // Sum of all allocation sources
  };
  conservation_check: {
    is_valid: boolean;
    total_assets_calculated: number;
    sum_of_states: number;
    lifecycle_total: number;
    available_only_decreases_with_allocation: boolean;
  };
  last_updated: string;
}

export interface AllocationResult {
  success: boolean;
  allocated_quantity: number;
  allocation_id: string | null;
  source_used: 'from_available' | 'from_config' | 'from_inbound' | 'from_on_order' | null;
  message: string;
}

export interface DeallocationResult {
  success: boolean;
  deallocated_quantity: number;
  source_returned: 'from_available' | 'from_config' | 'from_inbound' | 'from_on_order' | null;
  message: string;
}

export const useSotMetricsV2 = (productId?: string) => {
  const queryClient = useQueryClient();
  const dataEnvironment = useDataEnvironment();

  // Set up real-time subscriptions for SoT data changes
  useEffect(() => {
    const channel = supabase
      .channel('sot-metrics-v2-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'products',
        filter: productId ? `id=eq.${productId}` : undefined
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["sot-metrics-v2"] });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'allocations_v2'
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["sot-metrics-v2"] });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'inventory_movements'
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["sot-metrics-v2"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, productId]);

  return useQuery({
    queryKey: ["sot-metrics-v2", productId, dataEnvironment],
    queryFn: async (): Promise<SotMetricsStateGraph | SotMetricsStateGraph[]> => {
      if (productId) {
        try {
          // Get metrics for specific product using state graph function
          const { data, error } = await supabase
            .rpc('calculate_sot_metrics_state_graph', { p_product_id: productId });

          if (!error && data?.[0]) {
            const result = data[0];
            // Type cast the JSON fields
            const breakdown = result.allocation_breakdown as any;
            const conservation = result.conservation_check as any;
            return {
              product_id: result.product_id,
              total_assets: result.total_assets || 0,
              available: result.available || 0,
              allocated: result.allocated || 0,
              pending_transit: result.outbound_transit || 0, // Map outbound_transit to pending_transit
              being_configured: result.being_configured || 0,
              on_order: result.on_order || 0,
              sold: result.sold || 0,
              inbound_transit: result.inbound_transit || 0,
              lifecycle_total: result.lifecycle_total || 0,
              available_raw: result.available_raw || 0,
              safety_stock: result.safety_stock || 0,
              allocation_breakdown: {
                from_available: breakdown?.from_available || 0,
                from_config: breakdown?.from_config || 0,
                from_inbound: breakdown?.from_inbound || 0,
                from_on_order: breakdown?.from_on_order || 0,
                total: breakdown?.total || 0
              },
              conservation_check: {
                is_valid: conservation?.is_valid || false,
                total_assets_calculated: conservation?.total_assets_calculated || 0,
                sum_of_states: conservation?.sum_of_states || 0,
                lifecycle_total: conservation?.lifecycle_total || 0,
                available_only_decreases_with_allocation: conservation?.available_only_decreases_with_allocation || true
              }
            } as SotMetricsStateGraph;
          }
          console.warn(`[SoT Metrics V2] RPC failed or missing for ${productId}. Falling back to manual calculation.`);
        } catch (e) {
          console.warn(`[SoT Metrics V2] Error calling RPC, falling back.`, e);
        }

        // FALLBACK: Manual calculation for specific product
        let assetsQuery = supabase
          .from("asset_management")
          .select("status, transit_status")
          .eq("product_id", productId);

        assetsQuery = assetsQuery.or(getDataEnvironmentFilter(dataEnvironment));

        const { data: assets } = await assetsQuery;

        let allocationsQuery = supabase
          .from("allocations")
          .select("status")
          .eq("product_id", productId)
          .eq("status", "fulfilled");

        allocationsQuery = allocationsQuery.or(getDataEnvironmentFilter(dataEnvironment));

        const { data: allocations } = await allocationsQuery;

        const { data: product } = await supabase
          .from("products")
          .select("id, stock_quantity, sku")
          .eq("id", productId)
          .single();

        let instock = 0; let available = 0; let allocated = 0; let sold = 0; let being_configured = 0; let outbound_transit = 0;

        (assets || []).forEach(a => {
          if (a.status === 'instock') instock++;
          else if (a.status === 'available' || a.status === 'ready') available++;
          else if (a.status === 'allocated') {
            allocated++;
            if (a.transit_status === 'pending_transit') outbound_transit++;
            if (a.transit_status === 'being_configured') being_configured++;
            if (a.transit_status === 'delivered') sold++;
          }
          else if (a.status === 'sold') sold++;
        });

        const finalSold = Math.max(sold, (allocations?.length || 0));

        return {
          product_id: productId,
          total_assets: (assets?.length || 0),
          available: available,
          allocated: allocated,
          pending_transit: outbound_transit,
          being_configured: being_configured,
          on_order: 0,
          sold: finalSold,
          inbound_transit: 0,
          lifecycle_total: (assets?.length || 0) + finalSold,
          available_raw: available,
          safety_stock: 0,
          allocation_breakdown: { from_available: allocated, from_config: 0, from_inbound: 0, from_on_order: 0, total: allocated },
          conservation_check: { is_valid: true, total_assets_calculated: (assets?.length || 0), sum_of_states: 0, lifecycle_total: 0, available_only_decreases_with_allocation: true },
          last_updated: new Date().toISOString()
        };
      }
    },
    enabled: !!productId || productId === undefined,
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });
};

export const useStateGraphAllocation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productId,
      quantity,
      purchaseOrderId,
      customerId,
      notes,
      forceSource
    }: {
      productId: string;
      quantity: number;
      purchaseOrderId?: string;
      customerId?: string;
      notes?: string;
      forceSource?: 'from_available' | 'from_config' | 'from_inbound' | 'from_on_order';
    }) => {
      const { data, error } = await supabase
        .rpc('allocate_with_source', {
          p_product_id: productId,
          p_quantity: quantity,
          p_purchase_order_id: purchaseOrderId,
          p_customer_id: customerId,
          p_notes: notes,
          p_force_source: forceSource
        });

      if (error) throw error;
      return data as unknown as AllocationResult;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }

      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ["sot-metrics-v2"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-availability"] });
      queryClient.invalidateQueries({ queryKey: ["unified-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["allocations"] });
    },
    onError: (error) => {
      toast.error(`Allocation failed: ${error.message}`);
    },
  });
};

export const useStateGraphDeallocation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ allocationId }: { allocationId: string }) => {
      const { data, error } = await supabase
        .rpc('deallocate_by_source', {
          p_allocation_id: allocationId
        });

      if (error) throw error;
      return data as unknown as DeallocationResult;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }

      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ["sot-metrics-v2"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-availability"] });
      queryClient.invalidateQueries({ queryKey: ["unified-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["allocations"] });
    },
    onError: (error) => {
      toast.error(`Deallocation failed: ${error.message}`);
    },
  });
};

// Hook for fetching allocations with source information
export const useAllocationsBySource = (productId: string) => {
  return useQuery({
    queryKey: ["allocations-by-source", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("allocations_v2")
        .select(`
          id,
          quantity,
          allocation_source_type,
          allocation_source_id,
          status,
          notes,
          allocated_at,
          purchase_order_id,
          customer_id
        `)
        .eq("product_id", productId)
        .neq("status", "cancelled")
        .order("allocated_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!productId,
  });
};

// Hook for bulk SoT metrics calculation using state graph
export const useBulkSotMetricsV2 = (productIds: string[]) => {
  const dataEnvironment = useDataEnvironment();

  return useQuery({
    queryKey: ["bulk-sot-metrics-v2", productIds, dataEnvironment],
    queryFn: async (): Promise<Record<string, SotMetricsStateGraph>> => {
      const metricsPromises = productIds.map(async (productId) => {
        const { data, error } = await supabase
          .rpc('calculate_sot_metrics_state_graph', { p_product_id: productId });

        if (error) {
          console.error(`Error fetching SoT metrics for ${productId}:`, error);
          return {
            productId,
            metrics: {
              product_id: productId,
              total_assets: 0,
              available: 0,
              allocated: 0,
              pending_transit: 0,
              being_configured: 0,
              on_order: 0,
              sold: 0,
              inbound_transit: 0,
              lifecycle_total: 0,
              available_raw: 0,
              safety_stock: 0,
              allocation_breakdown: {
                from_available: 0,
                from_config: 0,
                from_inbound: 0,
                from_on_order: 0,
                total: 0
              },
              conservation_check: {
                is_valid: true,
                total_assets_calculated: 0,
                sum_of_states: 0,
                lifecycle_total: 0,
                available_only_decreases_with_allocation: true
              },
              last_updated: new Date().toISOString()
            }
          };
        }

        const result = data?.[0];
        if (!result) {
          return {
            productId,
            metrics: {
              product_id: productId,
              total_assets: 0,
              available: 0,
              allocated: 0,
              pending_transit: 0,
              being_configured: 0,
              on_order: 0,
              sold: 0,
              inbound_transit: 0,
              lifecycle_total: 0,
              available_raw: 0,
              safety_stock: 0,
              allocation_breakdown: {
                from_available: 0,
                from_config: 0,
                from_inbound: 0,
                from_on_order: 0,
                total: 0
              },
              conservation_check: {
                is_valid: true,
                total_assets_calculated: 0,
                sum_of_states: 0,
                lifecycle_total: 0,
                available_only_decreases_with_allocation: true
              },
              last_updated: new Date().toISOString()
            }
          };
        }

        // Type cast the JSON fields  
        const breakdown = result.allocation_breakdown as any;
        const conservation = result.conservation_check as any;
        return {
          productId,
          metrics: {
            product_id: result.product_id,
            total_assets: result.total_assets || 0,
            available: result.available || 0,
            allocated: result.allocated || 0,
            pending_transit: result.outbound_transit || 0, // Map outbound_transit to pending_transit
            being_configured: result.being_configured || 0,
            on_order: result.on_order || 0,
            sold: result.sold || 0,
            inbound_transit: result.inbound_transit || 0,
            lifecycle_total: result.lifecycle_total || 0,
            available_raw: result.available_raw || 0,
            safety_stock: result.safety_stock || 0,
            allocation_breakdown: {
              from_available: breakdown?.from_available || 0,
              from_config: breakdown?.from_config || 0,
              from_inbound: breakdown?.from_inbound || 0,
              from_on_order: breakdown?.from_on_order || 0,
              total: breakdown?.total || 0
            },
            conservation_check: {
              is_valid: conservation?.is_valid || false,
              total_assets_calculated: conservation?.total_assets_calculated || 0,
              sum_of_states: conservation?.sum_of_states || 0,
              lifecycle_total: conservation?.lifecycle_total || 0,
              available_only_decreases_with_allocation: conservation?.available_only_decreases_with_allocation || true
            }
          } as SotMetricsStateGraph
        };
      });

      const results = await Promise.all(metricsPromises);
      return results.reduce((acc, { productId, metrics }) => {
        acc[productId] = metrics;
        return acc;
      }, {} as Record<string, SotMetricsStateGraph>);
    },
    enabled: productIds.length > 0,
    staleTime: 5000,
  });
};