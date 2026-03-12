import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { getCurrentEnvironment } from "@/lib/environment-utils";

export const usePurchaseOrderAllocations = (purchaseOrderId?: string) => {
  const queryClient = useQueryClient();

  // Real-time subscriptions for instant updates
  useEffect(() => {
    if (!purchaseOrderId) return;

    const channel = supabase
      .channel(`purchase-order-allocations-${purchaseOrderId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'allocations'
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["purchase-order-allocations", purchaseOrderId] });
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'stock_orders'
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["purchase-order-allocations", purchaseOrderId] });
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'asset_management'
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["purchase-order-allocations", purchaseOrderId] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [purchaseOrderId, queryClient]);

  return useQuery({
    queryKey: ["purchase-order-allocations", purchaseOrderId],
    queryFn: async () => {
      if (!purchaseOrderId) return [];

      // Fetch allocations from allocations table
      const { data: allocationsData, error: allocationsError } = await supabase
        .from("allocations")
        .select(`
          *,
          stock_order:stock_orders(
            id, 
            name, 
            stock_record_number, 
            quantity_needed, 
            vendor, 
            delivery_status,
            product:products(id, name, price, purchase_category)
          ),
          product:products!allocations_product_id_fkey(id, name, price, purchase_category),
          asset:asset_management(id, asset_tag, status)
        `)
        .eq("purchase_order_id", purchaseOrderId)
        .order("created_at", { ascending: false });

      if (allocationsError) throw allocationsError;

      // Also fetch directly from asset_management as fallback (for robustness)
      const { data: assetData, error: assetError } = await supabase
        .from("asset_management")
        .select(`
          id,
          asset_tag,
          status,
          product_id,
          purchase_order_id,
          product:products(id, name, price, purchase_category)
        `)
        .eq("purchase_order_id", purchaseOrderId)
        .eq("status", "allocated");

      if (assetError) throw assetError;

      // Group allocations data
      const groupedData = (allocationsData || []).reduce((acc, item) => {
        const stockOrderId = item.stock_order_id;
        const productData = Array.isArray(item.product) ? item.product[0] : item.product;
        
        // For stock order allocations
        if (stockOrderId) {
          if (!acc[stockOrderId]) {
            const stockOrder = Array.isArray(item.stock_order) ? item.stock_order[0] : item.stock_order;
            acc[stockOrderId] = {
              stock_order_id: stockOrderId,
              quantity_allocated: 0,
              stock_order: stockOrder,
              product: stockOrder?.product || productData,
            };
          }
          acc[stockOrderId].quantity_allocated += 1;
        }
        // For direct purchase order allocations (main product)
        else if (item.product_id) {
          const directKey = `direct_${item.product_id}`;
          if (!acc[directKey]) {
            acc[directKey] = {
              product_id: item.product_id,
              quantity_allocated: 0,
              product: productData,
              is_direct_allocation: true,
            };
          }
          acc[directKey].quantity_allocated += 1;
        }
        
        return acc;
      }, {} as Record<string, any>);

      // Add assets from asset_management that aren't already counted
      const allocatedAssetIds = new Set(
        (allocationsData || []).map(a => a.asset_id).filter(Boolean)
      );
      
      (assetData || []).forEach(asset => {
        if (!allocatedAssetIds.has(asset.id)) {
          const directKey = `direct_${asset.product_id}`;
          if (!groupedData[directKey]) {
            const productData = Array.isArray(asset.product) ? asset.product[0] : asset.product;
            groupedData[directKey] = {
              product_id: asset.product_id,
              quantity_allocated: 0,
              product: productData,
              is_direct_allocation: true,
            };
          }
          groupedData[directKey].quantity_allocated += 1;
        }
      });

      return Object.values(groupedData);
    },
    enabled: !!purchaseOrderId,
  });
};
