import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useCallback } from "react";
import { useDataEnvironment } from "@/hooks/useSandbox";

export interface UnifiedInventoryData {
  product_id: string;
  product_name: string;
  sku: string | null;
  category: string | null;
  total_stock: number;
  allocated_stock: number;
  available_stock: number;
  pending_deliveries: number;
  complete_assets: number;
  true_available_stock: number;
  stock_in_transit: number;
  stock_sold: number;
  unit_price: number | null;
  total_value: number;
  reorder_level: number;
  needs_reorder: boolean;
}

export const useUnifiedInventory = () => {
  const queryClient = useQueryClient();
  const dataEnvironment = useDataEnvironment();

  // Set up real-time subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('inventory-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'products'
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["unified-inventory", dataEnvironment] });
        queryClient.invalidateQueries({ queryKey: ["inventory-summary", dataEnvironment] });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'stock_orders'
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["unified-inventory", dataEnvironment] });
        queryClient.invalidateQueries({ queryKey: ["inventory-summary", dataEnvironment] });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'allocations'
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["unified-inventory", dataEnvironment] });
        queryClient.invalidateQueries({ queryKey: ["inventory-summary", dataEnvironment] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, dataEnvironment]);

  return useQuery({
    queryKey: ["unified-inventory", dataEnvironment],
    queryFn: async () => {
      // Get products data first
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select(`
          id,
          name,
          sku,
          category,
          stock_quantity,
          stock_in_transit,
          stock_sold,
          price,
          reorder_level
        `)
        .eq("data_environment", dataEnvironment);

      if (productsError) throw productsError;

      // Get unified balance for each product
      const unifiedData: UnifiedInventoryData[] = [];

      for (const product of productsData || []) {
        try {
          const { data: balanceData, error: balanceError } = await supabase
            .rpc('calculate_unified_inventory_balance', { p_product_id: product.id });

          // SECURITY FIX: Calculate Sold counts from allocations to ensure accurate environment isolation
          const { count: fulfilledCount } = await supabase
            .from('allocations')
            .select('id', { count: 'exact', head: true })
            .eq('product_id', product.id)
            .eq('data_environment', dataEnvironment)
            .eq('status', 'fulfilled');

          if (balanceError) {
            const totalStock = product.stock_quantity || 0;
            unifiedData.push({
              product_id: product.id,
              product_name: product.name,
              sku: product.sku,
              category: product.category,
              total_stock: totalStock,
              allocated_stock: 0,
              available_stock: totalStock,
              pending_deliveries: 0,
              complete_assets: 0,
              true_available_stock: totalStock,
              stock_in_transit: product.stock_in_transit || 0,
              stock_sold: Math.max(fulfilledCount || 0, product.stock_sold || 0),
              unit_price: product.price,
              total_value: (product.price || 0) * totalStock,
              reorder_level: product.reorder_level || 0,
              needs_reorder: totalStock <= (product.reorder_level || 0)
            });
            continue;
          }

          const balance = balanceData?.[0];
          if (balance) {
            unifiedData.push({
              product_id: product.id,
              product_name: product.name,
              sku: product.sku,
              category: product.category,
              total_stock: product.stock_quantity || 0,
              allocated_stock: balance.allocated_units,
              available_stock: balance.available_units,
              pending_deliveries: balance.pending_transit_units,
              complete_assets: 0,
              true_available_stock: balance.available_units,
              stock_in_transit: balance.pending_transit_units,
              stock_sold: Math.max(fulfilledCount || 0, product.stock_sold || 0),
              unit_price: product.price,
              total_value: (product.price || 0) * product.stock_quantity,
              reorder_level: product.reorder_level || 0,
              needs_reorder: balance.available_units <= (product.reorder_level || 0)
            });
          }
        } catch (error) {
          console.error(`Error processing product ${product.id}:`, error);
        }
      }

      return unifiedData;
    },
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });
};

export const useInventorySummary = () => {
  const queryClient = useQueryClient();
  const dataEnvironment = useDataEnvironment();

  useEffect(() => {
    const channel = supabase
      .channel('inventory-summary-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'products'
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["inventory-summary", dataEnvironment] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, dataEnvironment]);

  return useQuery({
    queryKey: ["inventory-summary", dataEnvironment],
    queryFn: async () => {
      const { data: stockData, error: stockError } = await supabase
        .rpc('calculate_true_available_stock');

      if (stockError) throw stockError;

      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select(`
          id,
          name,
          stock_quantity,
          stock_in_transit,
          stock_sold,
          price,
          reorder_level
        `)
        .eq("data_environment", dataEnvironment);

      if (productsError) throw productsError;

      return (productsData || []).reduce((acc, product) => {
        const stockInfo = stockData?.find(s => s.product_id === product.id);
        const totalStock = product.stock_quantity || 0;
        const trueAvailableStock = stockInfo?.true_available || 0;

        acc.totalProducts += 1;
        acc.totalValue += (product.price || 0) * totalStock;
        acc.totalStock += totalStock;
        acc.totalAllocated += stockInfo?.allocated_stock || 0;
        acc.totalAvailable += trueAvailableStock;
        acc.totalInTransit += product.stock_in_transit || 0;
        acc.totalPendingDeliveries += stockInfo?.pending_deliveries || 0;
        acc.totalCompleteAssets += (stockInfo as any)?.complete_assets || 0;

        if (trueAvailableStock <= (product.reorder_level || 0)) acc.lowStockItems += 1;
        if (trueAvailableStock === 0) acc.outOfStockItems += 1;

        return acc;
      }, {
        totalProducts: 0,
        totalValue: 0,
        totalStock: 0,
        totalAllocated: 0,
        totalAvailable: 0,
        totalInTransit: 0,
        totalPendingDeliveries: 0,
        totalCompleteAssets: 0,
        lowStockItems: 0,
        outOfStockItems: 0,
      });
    },
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });
};