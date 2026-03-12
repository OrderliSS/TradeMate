import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export interface PurchaseAllocationForStockOrder {
  id: string;
  status: string;
  allocated_at: string;
  purchase_order_id: string | null;
  stock_order_id: string | null;
  source?: 'allocations' | 'fallback_purchase_link';
  purchases: {
    id: string;
    ticket_number: string | null;
    receipt_number: string | null;
    status: string | null;
    order_status: string | null;
    quantity: number | null;
    total_amount: number | null;
    purchase_date: string | null;
    customers: { name: string; email: string | null } | null;
    product: { name: string } | null;
  } | null;
}

export const usePurchaseAllocationsForStockOrder = (stockOrderId?: string) => {
  const queryClient = useQueryClient();

  // Real-time subscription for instant updates
  useEffect(() => {
    if (!stockOrderId) return;

    const channel = supabase
      .channel(`purchase-allocations-for-stock-order-${stockOrderId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'allocations',
        filter: `stock_order_id=eq.${stockOrderId}`
      }, () => {
        queryClient.invalidateQueries({ 
          queryKey: ["purchase-allocations-for-stock-order", stockOrderId] 
        });
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'purchases'
      }, () => {
        queryClient.invalidateQueries({ 
          queryKey: ["purchase-allocations-for-stock-order", stockOrderId] 
        });
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'customers'
      }, () => {
        queryClient.invalidateQueries({ 
          queryKey: ["purchase-allocations-for-stock-order", stockOrderId] 
        });
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'products'
      }, () => {
        queryClient.invalidateQueries({ 
          queryKey: ["purchase-allocations-for-stock-order", stockOrderId] 
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [stockOrderId, queryClient]);

  return useQuery({
    queryKey: ["purchase-allocations-for-stock-order", stockOrderId],
    queryFn: async () => {
      if (!stockOrderId) return [];

      console.log('[usePurchaseAllocationsForStockOrder] Fetching for stockOrderId:', stockOrderId);

      // STRATEGY: Try allocations first, then fallback to purchases.linked_stock_order_ids
      
      // 1. Try allocations table first
      const { data: allocationsData, error: allocationsError } = await supabase
        .from("allocations")
        .select(`
          id,
          status,
          allocated_at,
          purchase_order_id,
          stock_order_id
        `)
        .eq("stock_order_id", stockOrderId)
        .not("purchase_order_id", "is", null)
        .order("allocated_at", { ascending: false });

      if (allocationsError) {
        console.warn('[usePurchaseAllocationsForStockOrder] Allocations query error:', allocationsError);
      }

      console.log('[usePurchaseAllocationsForStockOrder] Allocations found:', allocationsData?.length || 0);

      // 2. FALLBACK: Query purchases where linked_stock_order_ids contains this stockOrderId
      // NOTE: We fetch raw IDs here, then separately fetch customer/product data
      const { data: fallbackPurchases, error: fallbackError } = await supabase
        .from("purchases")
        .select(`
          id,
          ticket_number,
          receipt_number,
          status,
          order_status,
          quantity,
          total_amount,
          purchase_date,
          linked_stock_order_ids,
          customer_id,
          product_id
        `)
        .contains("linked_stock_order_ids", [stockOrderId]);

      if (fallbackError) {
        console.warn('[usePurchaseAllocationsForStockOrder] Fallback query error:', fallbackError);
      }

      console.log('[usePurchaseAllocationsForStockOrder] Fallback purchases found:', fallbackPurchases?.length || 0);

      // Build a set of purchase IDs from allocations
      const allocationPurchaseIds = new Set(
        (allocationsData || []).map(a => a.purchase_order_id).filter(Boolean)
      );

      // Build results from allocations
      const results: PurchaseAllocationForStockOrder[] = [];

      // Collect all purchase IDs we need to fetch
      const allPurchaseIds = new Set<string>();
      allocationsData?.forEach(a => {
        if (a.purchase_order_id) allPurchaseIds.add(a.purchase_order_id);
      });
      fallbackPurchases?.forEach(p => {
        if (!allocationPurchaseIds.has(p.id)) allPurchaseIds.add(p.id);
      });

      if (allPurchaseIds.size === 0) {
        console.log('[usePurchaseAllocationsForStockOrder] No purchases to fetch');
        return [];
      }

      // Fetch all purchases with raw IDs (no joins)
      const { data: purchasesData, error: purchasesError } = await supabase
        .from("purchases")
        .select(`
          id,
          ticket_number,
          receipt_number,
          status,
          order_status,
          quantity,
          total_amount,
          purchase_date,
          customer_id,
          product_id
        `)
        .in("id", [...allPurchaseIds]);

      if (purchasesError) {
        console.warn('[usePurchaseAllocationsForStockOrder] Purchases fetch error:', purchasesError);
      }

      console.log('[usePurchaseAllocationsForStockOrder] Purchases fetched:', purchasesData?.length || 0);

      // Collect unique customer and product IDs
      const customerIds = [...new Set(purchasesData?.map(p => p.customer_id).filter(Boolean) || [])];
      const productIds = [...new Set(purchasesData?.map(p => p.product_id).filter(Boolean) || [])];

      console.log('[usePurchaseAllocationsForStockOrder] Customer IDs to fetch:', customerIds);
      console.log('[usePurchaseAllocationsForStockOrder] Product IDs to fetch:', productIds);

      // Fetch customers and products separately
      const [customersResult, productsResult] = await Promise.all([
        customerIds.length > 0 
          ? supabase.from("customers").select("id, name, email").in("id", customerIds)
          : { data: [], error: null },
        productIds.length > 0
          ? supabase.from("products").select("id, name").in("id", productIds)
          : { data: [], error: null }
      ]);

      if (customersResult.error) {
        console.warn('[usePurchaseAllocationsForStockOrder] Customers fetch error:', customersResult.error);
      }
      if (productsResult.error) {
        console.warn('[usePurchaseAllocationsForStockOrder] Products fetch error:', productsResult.error);
      }

      console.log('[usePurchaseAllocationsForStockOrder] Customers fetched:', customersResult.data?.length || 0);
      console.log('[usePurchaseAllocationsForStockOrder] Products fetched:', productsResult.data?.length || 0);

      // Create lookup maps with explicit types
      const customersMap = new Map<string, { id: string; name: string; email: string | null }>();
      customersResult.data?.forEach(c => customersMap.set(c.id, c));
      
      const productsMap = new Map<string, { id: string; name: string }>();
      productsResult.data?.forEach(p => productsMap.set(p.id, p));

      // Enrich purchases with customer and product data
      const enrichedPurchasesMap = new Map(
        purchasesData?.map(p => [
          p.id,
          {
            id: p.id,
            ticket_number: p.ticket_number,
            receipt_number: p.receipt_number,
            status: p.status,
            order_status: p.order_status,
            quantity: p.quantity,
            total_amount: p.total_amount,
            purchase_date: p.purchase_date,
            customers: p.customer_id ? customersMap.get(p.customer_id) || null : null,
            product: p.product_id ? productsMap.get(p.product_id) || null : null,
          }
        ]) || []
      );

      // Build results from allocations
      if (allocationsData && allocationsData.length > 0) {
        const uniqueByPurchase = new Map<string, PurchaseAllocationForStockOrder>();
        allocationsData.forEach((item) => {
          if (item.purchase_order_id && !uniqueByPurchase.has(item.purchase_order_id)) {
            const purchaseData = enrichedPurchasesMap.get(item.purchase_order_id);
            uniqueByPurchase.set(item.purchase_order_id, {
              ...item,
              source: 'allocations',
              purchases: purchaseData || null,
            } as PurchaseAllocationForStockOrder);
          }
        });

        results.push(...Array.from(uniqueByPurchase.values()));
      }

      // Add fallback purchases that aren't already in results
      if (fallbackPurchases && fallbackPurchases.length > 0) {
        for (const purchase of fallbackPurchases) {
          if (!allocationPurchaseIds.has(purchase.id)) {
            const enrichedPurchase = enrichedPurchasesMap.get(purchase.id);
            results.push({
              id: `fallback-${purchase.id}`,
              status: 'allocated',
              allocated_at: new Date().toISOString(),
              purchase_order_id: purchase.id,
              stock_order_id: stockOrderId,
              source: 'fallback_purchase_link',
              purchases: enrichedPurchase || null,
            });
          }
        }
      }

      console.log('[usePurchaseAllocationsForStockOrder] Final results:', results.length, results);
      return results;
    },
    enabled: !!stockOrderId,
  });
};
