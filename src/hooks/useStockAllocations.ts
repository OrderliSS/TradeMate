import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useInventoryValidation } from "./useInventorySync";
import { SecureEnvironment } from "@/lib/secure-environment";
import { useEffect } from "react";

export interface StockAllocation {
  id: string;
  product_id: string;
  purchase_id: string;
  quantity_allocated: number;
  allocated_at: string;
  created_at: string;
  updated_at: string;
}

export interface StockAllocationWithDetails extends StockAllocation {
  product: {
    name: string;
    stock_quantity: number;
  };
  purchase: {
    customer: {
      name: string;
    };
    quantity: number;
    purchase_date: string;
    pickup_date?: string;
  };
}

export interface PurchaseWithCustomer {
  id: string;
  customer_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  purchase_date: string;
  notes?: string;
  pickup_date?: string;
  customer: {
    name: string;
  };
  product: {
    name: string;
  };
}

export const useStockAllocations = (productId?: string) => {
  const queryClient = useQueryClient();
  
  // Set up real-time subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('stock-allocations-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'stock_allocations' 
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["stock-allocations"] });
        queryClient.invalidateQueries({ queryKey: ["unpicked-purchases-with-allocations"] });
        queryClient.invalidateQueries({ queryKey: ["product-stock-summary"] });
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'purchases' 
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["unpicked-purchases"] });
        queryClient.invalidateQueries({ queryKey: ["unpicked-purchases-with-allocations"] });
        queryClient.invalidateQueries({ queryKey: ["completed-purchases-with-allocations"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ["stock-allocations", productId],
    queryFn: async () => {
      let query = supabase
        .from("stock_allocations")
        .select(`
          *,
          product:products(name, stock_quantity),
          purchase:purchases!inner(
            quantity,
            purchase_date,
            pickup_date,
            customer:customers!inner(name)
          )
        `);
      
      if (productId) {
        query = query.eq("product_id", productId);
      }
      
      const { data, error } = await query;
      
      if (error) {
        throw new Error(error.message);
      }
      
      return data as any;
    },
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });
};

export const useUnpickedPurchases = (productId: string) => {
  return useQuery({
    queryKey: ["unpicked-purchases", productId],
    queryFn: async () => {
      SecureEnvironment.log("Fetching unpicked purchases for product", { productId });
      
      const { data, error } = await supabase
        .from("purchases")
        .select(`
          id,
          customer_id,
          product_id,
          quantity,
          unit_price,
          total_amount,
          purchase_date,
          notes,
          pickup_date,
          customer:customers!purchases_customer_id_fkey(name),
          product:products(name)
        `)
        .eq("product_id", productId)
        .is("pickup_date", null);
      
      if (error) {
        SecureEnvironment.error("Error fetching unpicked purchases:", error);
        throw new Error(error.message);
      }
      
      SecureEnvironment.log("Fetched unpicked purchases", { count: data.length });
      return data as PurchaseWithCustomer[];
    },
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });
};

export const useUnpickedPurchasesWithAllocations = (productId: string) => {
  return useQuery({
    queryKey: ["unpicked-purchases-with-allocations", productId],
    queryFn: async () => {
      SecureEnvironment.log("Fetching unpicked purchases with allocation info", { productId });
      
      const [purchasesResult, allocationsResult] = await Promise.all([
        supabase
          .from("purchases")
          .select(`
            id,
            customer_id,
            product_id,
            quantity,
            unit_price,
            total_amount,
            purchase_date,
            notes,
            pickup_date,
          customer:customers!purchases_customer_id_fkey(name),
            product:products(name)
          `)
          .eq("product_id", productId)
          .is("pickup_date", null),
        supabase
          .from("stock_allocations")
          .select("purchase_id, quantity_allocated")
          .eq("product_id", productId)
      ]);
      
      if (purchasesResult.error) {
        throw new Error(purchasesResult.error.message);
      }
      
      if (allocationsResult.error) {
        throw new Error(allocationsResult.error.message);
      }
      
      const allocationsMap = new Map();
      allocationsResult.data.forEach(allocation => {
        allocationsMap.set(allocation.purchase_id, allocation.quantity_allocated);
      });
      
      const purchasesWithAllocations = purchasesResult.data.map(purchase => ({
        ...purchase,
        allocated_quantity: allocationsMap.get(purchase.id) || 0,
        has_allocation: allocationsMap.has(purchase.id),
        remaining_quantity: purchase.quantity - (allocationsMap.get(purchase.id) || 0)
      }));
      
      SecureEnvironment.log("Fetched purchases with allocations", { count: purchasesWithAllocations.length });
      return purchasesWithAllocations;
    },
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });
};

export const useCompletedPurchasesWithAllocations = () => {
  return useQuery({
    queryKey: ["completed-purchases-with-allocations"],
    queryFn: async () => {
      SecureEnvironment.log("Fetching all completed purchases with allocation info for cross-product allocation");
      
      const purchasesQuery = supabase
        .from("purchases")
        .select(`
          id,
          customer_id,
          product_id,
          quantity,
          unit_price,
          total_amount,
          purchase_date,
          notes,
          pickup_date,
          customer:customers!purchases_customer_id_fkey(name),
          product:products(name)
        `)
        .not("pickup_date", "is", null);
      
      const allocationsQuery = supabase
        .from("stock_allocations")
        .select("purchase_id, quantity_allocated");
      
      const [purchasesResult, allocationsResult] = await Promise.all([
        purchasesQuery,
        allocationsQuery
      ]);
      
      if (purchasesResult.error) {
        throw new Error(purchasesResult.error.message);
      }
      
      if (allocationsResult.error) {
        throw new Error(allocationsResult.error.message);
      }
      
      const allocationsMap = new Map();
      allocationsResult.data.forEach(allocation => {
        allocationsMap.set(allocation.purchase_id, allocation.quantity_allocated);
      });
      
      const purchasesWithAllocations = purchasesResult.data.map(purchase => ({
        ...purchase,
        allocated_quantity: allocationsMap.get(purchase.id) || 0,
        has_allocation: allocationsMap.has(purchase.id),
        remaining_quantity: purchase.quantity - (allocationsMap.get(purchase.id) || 0),
        is_completed: true
      }));
      
      SecureEnvironment.log("Fetched completed purchases with allocations", { count: purchasesWithAllocations.length });
      return purchasesWithAllocations;
    },
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });
};

export const useCreateStockAllocation = () => {
  const queryClient = useQueryClient();
  const { validateStockAllocation } = useInventoryValidation();
  
  return useMutation({
    mutationFn: async (allocation: {
      product_id: string;
      purchase_id: string;
      quantity_allocated: number;
      availableStock?: number;
      isRetroactive?: boolean;
    }) => {
      // Validate allocation if availableStock is provided and not retroactive
      if (allocation.availableStock !== undefined && !allocation.isRetroactive) {
        const validation = validateStockAllocation(
          allocation.availableStock, 
          allocation.quantity_allocated
        );
        
        if (!validation.isValid) {
          throw new Error(validation.message);
        }
      }
      
      const { data, error } = await supabase
        .from("stock_allocations")
        .insert([{
          product_id: allocation.product_id,
          purchase_id: allocation.purchase_id,
          quantity_allocated: allocation.quantity_allocated
        }])
        .select()
        .single();
      
      if (error) {
        throw new Error(error.message);
      }
      
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["stock-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["unpicked-purchases-with-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["completed-purchases-with-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["product-stock-summary"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      
      if (variables.isRetroactive) {
        toast.success("Stock retroactively allocated to completed order");
      } else {
        toast.success("Stock allocated successfully");
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to allocate stock: ${error.message}`);
    },
  });
};

export const useUpdateStockAllocation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      id, 
      quantity_allocated 
    }: { 
      id: string; 
      quantity_allocated: number; 
    }) => {
      const { data, error } = await supabase
        .from("stock_allocations")
        .update({ quantity_allocated })
        .eq("id", id)
        .select()
        .single();
      
      if (error) {
        throw new Error(error.message);
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["unpicked-purchases-with-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["completed-purchases-with-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["product-stock-summary"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Stock allocation updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update stock allocation: ${error.message}`);
    },
  });
};

export const useDeleteStockAllocation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("stock_allocations")
        .delete()
        .eq("id", id);
      
      if (error) {
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["unpicked-purchases-with-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["completed-purchases-with-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["product-stock-summary"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Stock allocation removed successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove stock allocation: ${error.message}`);
    },
  });
};

export const useProductStockSummary = (productId: string) => {
  return useQuery({
    queryKey: ["product-stock-summary", productId],
    queryFn: async () => {
      const [productResult, stockAllocationsResult, assetAllocationsResult, assetsResult, sotMetricsResult] = await Promise.all([
        supabase
          .from("products")
          .select("stock_quantity, stock_in_transit, stock_sold, is_multi_unit, quantity_per_pack, consumption_per_primary_unit, asset_priority, sot_s3_available, sot_s1_inbound_transit, sot_s4_allocated")
          .eq("id", productId)
          .single(),
        supabase
          .from("stock_allocations")
          .select("quantity_allocated")
          .eq("product_id", productId),
        supabase
          .from("allocations")
          .select("id")
          .eq("product_id", productId)
          .eq("status", "allocated"),
        supabase
          .from("asset_management")
          .select("id, status, parent_asset_id")
          .eq("product_id", productId)
          .in("status", ["active", "available", "allocated"]),
        supabase
          .rpc('calculate_sot_metrics_state_graph', { p_product_id: productId })
      ]);
      
      if (productResult.error) {
        throw new Error(productResult.error.message);
      }
      
      if (stockAllocationsResult.error) {
        throw new Error(stockAllocationsResult.error.message);
      }
      
      if (assetAllocationsResult.error) {
        throw new Error(assetAllocationsResult.error.message);
      }

      if (assetsResult.error) {
        throw new Error(assetsResult.error.message);
      }
      
      const product = productResult.data;
      
      // Use SoT metrics when available, fallback to legacy fields
      const useSoTMetrics = sotMetricsResult.data && Array.isArray(sotMetricsResult.data) && sotMetricsResult.data.length > 0;
      const sotMetrics = useSoTMetrics ? sotMetricsResult.data[0] : null;
      
      const totalStock = useSoTMetrics 
        ? sotMetrics.available + sotMetrics.allocated
        : product.stock_quantity || 0;
        
      const stockInTransit = useSoTMetrics 
        ? sotMetrics.inbound_transit
        : product.stock_in_transit || 0;
      const stockSold = product.stock_sold || 0;
      const consumptionPerPrimaryUnit = product.consumption_per_primary_unit;
      const assetPriority = product.asset_priority;
      
      // Calculate asset counts correctly for multi-unit vs single-unit products
      const assets = assetsResult.data;
      const actualAssetCount = product.is_multi_unit 
        ? assets.filter(asset => asset.parent_asset_id !== null).length  // Only individual units for multi-unit
        : assets.length; // All assets for single-unit
      
      // Calculate total allocations - use SoT metrics when available
      const stockAllocatedQuantity = stockAllocationsResult.data.reduce(
        (sum, allocation) => sum + allocation.quantity_allocated, 
        0
      );
      const assetAllocatedQuantity = assetAllocationsResult.data.length;
      const totalAllocated = useSoTMetrics 
        ? sotMetrics.allocated 
        : stockAllocatedQuantity + assetAllocatedQuantity;
      
      // Available stock calculation - prioritize SoT metrics for accuracy
      const availableStock = useSoTMetrics 
        ? sotMetrics.available
        : Math.max(0, totalStock - totalAllocated);
      
      return {
        totalStock,
        totalAllocated,
        stockInTransit,
        stockSold,
        availableStock,
        stockAllocated: stockAllocatedQuantity,
        assetAllocated: assetAllocatedQuantity,
        actualAssetCount, // Actual count of assets that should match totalStock
        consumptionPerPrimaryUnit,
        assetPriority,
        // Include SoT metrics for transparency
        usingSoTMetrics: useSoTMetrics,
        sotMetrics: sotMetrics,
      };
    },
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });
};