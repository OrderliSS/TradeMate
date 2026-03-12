import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useCreateVendorShop } from "./useCreateVendorShop";
import { getCurrentEnvironment } from "@/lib/environment-utils";
import { logger } from "@/lib/logger";
import React from "react";
import { useDataEnvironment } from "@/hooks/useSandbox";
import { useCurrentOrganizationId } from "./useOrganization";

import { useScopedSupabase } from "@/hooks/useScopedSupabase";

// Fetching all stock orders
export const useStockOrders = () => {
  const dataEnvironment = useDataEnvironment();
  const orgId = useCurrentOrganizationId();
  const scopedSupabase = useScopedSupabase();

  return useQuery({
    queryKey: ["stock-orders", dataEnvironment, orgId],
    queryFn: async () => {
      logger.debug("useStockOrders - Starting query");
      const { data, error } = await scopedSupabase
        .from("stock_orders")
        .select(`
          *,
          product:products(*)
        `)
        .order("created_at", { ascending: false });

      if (error) {
        logger.error("useStockOrders - Error", { error });
        throw error;
      }

      logger.debug("useStockOrders - Success", { count: data?.length });
      return data || [];
    },
    enabled: !!orgId,
  });
};

// Fetching stock orders by category
export const useStockOrdersByCategory = () => {
  const orgId = useCurrentOrganizationId();
  const scopedSupabase = useScopedSupabase();

  return useQuery({
    queryKey: ["stock-orders-by-category", orgId],
    queryFn: async () => {
      logger.debug("useStockOrdersByCategory - Starting query");
      const { data, error } = await scopedSupabase
        .from("stock_orders")
        .select("category, amount");

      if (error) {
        logger.error("useStockOrdersByCategory - Error", { error });
        throw error;
      }

      // Group by category and calculate totals
      const categoryTotals = ((data || []) as any[]).reduce((acc: Record<string, number>, stockOrder) => {
        const category = stockOrder.category || 'Uncategorized';
        acc[category] = (acc[category] || 0) + (stockOrder.amount || 0);
        return acc;
      }, {});

      logger.debug("useStockOrdersByCategory - Success", { categories: Object.keys(categoryTotals || {}) });
      return categoryTotals || {};
    },
    enabled: !!orgId,
  });
};

// Creating a stock order
export const useCreateStockOrder = () => {
  const queryClient = useQueryClient();
  const { mutateAsync: createVendorShop } = useCreateVendorShop();
  const dataEnvironment = useDataEnvironment();
  const orgId = useCurrentOrganizationId();
  const scopedSupabase = useScopedSupabase();

  return useMutation({
    mutationFn: async (stockOrderData: any) => {
      logger.debug("useCreateStockOrder - Starting mutation", { data: stockOrderData });

      // Validate required fields
      if (!stockOrderData.name) {
        throw new Error("Stock order name is required");
      }

      // Handle vendor shop creation if needed
      if (stockOrderData.vendor_store_name && !stockOrderData.skipVendorShopCreation) {
        try {
          await createVendorShop({
            shop_name: stockOrderData.vendor_store_name,
            platforms: [stockOrderData.vendor || 'Unknown']
          });
        } catch (vendorError) {
          logger.warn("Failed to create vendor shop, continuing with stock order creation", { error: vendorError });
        }
      }

      const { data, error } = await scopedSupabase
        .from("stock_orders")
        .insert({ ...stockOrderData, data_environment: dataEnvironment })
        .select()
        .single();

      if (error) {
        logger.error("useCreateStockOrder - Error", { error });
        throw error;
      }

      logger.debug("useCreateStockOrder - Success", { data });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-orders"] });
      queryClient.invalidateQueries({ queryKey: ["stock-orders-by-category"] });
      toast({
        title: "Stock Order Created",
        description: "The stock order has been successfully created.",
      });
    },
    onError: (error) => {
      logger.error("useCreateStockOrder - Error", { error });
      toast({
        title: "Error Creating Stock Order",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

// Updating a stock order
export const useUpdateStockOrder = () => {
  const queryClient = useQueryClient();
  const orgId = useCurrentOrganizationId();
  const scopedSupabase = useScopedSupabase();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      logger.debug("useUpdateStockOrder - Starting mutation", { id, updates });

      // Clean the updates object
      const validFields = [
        'name', 'category', 'amount', 'product_id', 'quantity_needed', 'notes',
        'vendor', 'order_number', 'purchase_date', 'vendor_store_name',
        'delivery_status', 'tracking_number', 'carrier', 'estimated_delivery_date',
        'actual_delivery_date', 'shipping_cost', 'tracking_number_2', 'carrier_2',
        'delivery_status_2', 'estimated_delivery_date_2', 'actual_delivery_date_2',
        'vendor_internal_status', 'vendor_notes', 'passed_to_carrier_date',
        'vendor_tracking_number', 'vendor_tracking_number_2', 'vendor_carrier',
        'tax_amount', 'subtotal', 'subcategory', 'discount_amount'
      ];

      const cleanedUpdates = Object.keys(updates)
        .filter(key => validFields.includes(key))
        .reduce((obj: any, key) => {
          obj[key] = updates[key];
          return obj;
        }, {});

      const { data, error } = await scopedSupabase
        .from("stock_orders")
        .update(cleanedUpdates)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        logger.error("useUpdateStockOrder - Error", { error });
        throw error;
      }

      logger.debug("useUpdateStockOrder - Success", { data });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["stock-orders"] });
      queryClient.invalidateQueries({ queryKey: ["stock-orders-by-category"] });
      queryClient.invalidateQueries({ queryKey: ["stock-orders", data.id] });
      // Also invalidate shop detail page cache so order numbers refresh there
      queryClient.invalidateQueries({ queryKey: ["shop-stock-orders"] });
      toast({
        title: "Stock Order Updated",
        description: "The stock order has been successfully updated.",
      });
    },
    onError: (error) => {
      logger.error("useUpdateStockOrder - Error", { error });
      toast({
        title: "Error Updating Stock Order",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

// Fetching a single stock order with real-time updates
export const useStockOrder = (id: string) => {
  const queryClient = useQueryClient();
  const orgId = useCurrentOrganizationId();
  const scopedSupabase = useScopedSupabase();

  const query = useQuery({
    queryKey: ["stock-orders", id, orgId],
    queryFn: async () => {
      logger.debug("useStockOrder - Starting query", { id });
      const { data, error } = await scopedSupabase
        .from("stock_orders")
        .select(`
          *,
          product:products(*)
        `)
        .eq("id", id)
        .single();

      if (error) {
        logger.error("useStockOrder - Error", { error });
        throw error;
      }

      logger.debug("useStockOrder - Success", { data });
      return data;
    },
    enabled: !!id && !!orgId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Set up real-time subscription
  React.useEffect(() => {
    if (!id) return;

    logger.debug("useStockOrder - Setting up real-time subscription", { id });

    const stockOrderSubscription = supabase
      .channel(`stock-order-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stock_orders',
          filter: `id=eq.${id}`
        },
        (payload) => {
          logger.debug('useStockOrder - Real-time update received', { payload });
          queryClient.invalidateQueries({ queryKey: ["stock-orders", id] });
        }
      )
      .subscribe();

    return () => {
      logger.debug("useStockOrder - Cleaning up subscription");
      stockOrderSubscription.unsubscribe();
    };
  }, [id, queryClient]);

  return query;
};

// Deleting a stock order
export const useDeleteStockOrder = () => {
  const queryClient = useQueryClient();
  const orgId = useCurrentOrganizationId();
  const scopedSupabase = useScopedSupabase();

  return useMutation({
    mutationFn: async (id: string) => {
      logger.debug("useDeleteStockOrder - Starting deletion", { id });
      const { error } = await scopedSupabase
        .from("stock_orders")
        .delete()
        .eq("id", id);

      if (error) {
        logger.error("useDeleteStockOrder - Error", { error });
        throw error;
      }

      logger.debug("useDeleteStockOrder - Success");
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-orders"] });
      queryClient.invalidateQueries({ queryKey: ["stock-orders-by-category"] });
      toast({
        title: "Stock Order Deleted",
        description: "The stock order has been successfully deleted.",
      });
    },
    onError: (error) => {
      logger.error("useDeleteStockOrder - Error", { error });
      toast({
        title: "Error Deleting Stock Order",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
