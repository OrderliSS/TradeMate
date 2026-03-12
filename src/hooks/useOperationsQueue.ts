import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganizationId } from "./useOrganization";

export interface QueuedPurchase {
  id: string;
  ticket_number: string | null;
  order_status: string | null;
  allocation_status: string | null;
  created_at: string;
  last_modified_at: string | null;
  purchase_date: string | null;
  total_amount: number | null;
  customer: {
    id: string;
    name: string;
  } | null;
  product: {
    id: string;
    name: string;
  } | null;
}

export const useOperationsQueue = () => {
  const queryClient = useQueryClient();
  const orgId = useCurrentOrganizationId();

  // Set up real-time subscription for instant updates
  useEffect(() => {
    if (!orgId) return;

    const channel = supabase
      .channel('operations-queue-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'purchases',
        filter: `organization_id=eq.${orgId}`
      }, () => {
        // Instantly invalidate and refetch when any purchase changes
        queryClient.invalidateQueries({ queryKey: ["operations-queue", orgId] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, orgId]);

  return useQuery({
    queryKey: ["operations-queue", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      // First fetch purchases without nested relations to avoid RLS recursion
      const { data: purchases, error: purchaseError } = await supabase
        .from("purchases")
        .select(`
          id,
          ticket_number,
          order_status,
          allocation_status,
          created_at,
          last_modified_at,
          purchase_date,
          total_amount,
          customer_id,
          product_id
        `)
        .eq("organization_id", orgId)
        .or("order_status.eq.ordered,order_status.eq.configuring,allocation_status.eq.pending_allocation")
        .not("order_status", "eq", "complete")
        .order("created_at", { ascending: false })
        .limit(30);

      if (purchaseError) throw purchaseError;
      if (!purchases || purchases.length === 0) return [];

      // Get unique customer and product IDs
      const customerIds = [...new Set(purchases.map(p => p.customer_id).filter(Boolean))];
      const productIds = [...new Set(purchases.map(p => p.product_id).filter(Boolean))];

      // Fetch customers and products separately
      const [customersResult, productsResult] = await Promise.all([
        customerIds.length > 0
          ? supabase.from("customers").select("id, name").in("id", customerIds)
          : { data: [], error: null },
        productIds.length > 0
          ? supabase.from("products").select("id, name").in("id", productIds)
          : { data: [], error: null },
      ]);

      const customersMap = new Map(
        (customersResult.data || []).map(c => [c.id, { id: c.id, name: c.name }])
      );
      const productsMap = new Map(
        (productsResult.data || []).map(p => [p.id, { id: p.id, name: p.name }])
      );

      // Map purchases with customer and product data
      return purchases.map(p => ({
        id: p.id,
        ticket_number: p.ticket_number,
        order_status: p.order_status,
        allocation_status: p.allocation_status,
        created_at: p.created_at,
        last_modified_at: p.last_modified_at,
        purchase_date: p.purchase_date,
        total_amount: p.total_amount,
        customer: p.customer_id ? customersMap.get(p.customer_id) || null : null,
        product: p.product_id ? productsMap.get(p.product_id) || null : null,
      })) as QueuedPurchase[];
    },
    refetchInterval: 60000, // Reduced to 60 seconds as backup (realtime handles instant updates)
  });
};
