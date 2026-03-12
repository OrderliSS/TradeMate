/**
 * Canonical Inventory Metrics Hook
 * 
 * This is the SINGLE SOURCE OF TRUTH for all inventory calculations.
 * All screens must use this hook instead of:
 * - useProductStockSummary
 * - useUnifiedAssetMetrics
 * - product.stock_quantity
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import {
  calculateInventoryMetrics,
  InventoryMetricsResult,
  AssetForCalculation
} from "@/lib/inventory-status-definitions";

export interface CanonicalInventoryMetrics extends InventoryMetricsResult {
  productId: string;
  requiresConfig: boolean;
  productName?: string;
  sku?: string;
}

import { useDataEnvironment } from "@/hooks/useSandbox";

/**
 * Fetch canonical inventory metrics for a single product
 */
export function useCanonicalInventoryMetrics(productId: string | undefined) {
  const queryClient = useQueryClient();
  const dataEnvironment = useDataEnvironment();

  // Set up real-time subscriptions for immediate updates
  useEffect(() => {
    if (!productId) return;

    const channel = supabase
      .channel(`canonical-inventory-${productId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'asset_management',
        filter: `product_id=eq.${productId}`
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["canonical-inventory", productId] });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'allocations',
        filter: `product_id=eq.${productId}`
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["canonical-inventory", productId] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [productId, queryClient]);

  return useQuery({
    queryKey: ["canonical-inventory", productId, dataEnvironment],
    queryFn: async (): Promise<CanonicalInventoryMetrics> => {
      if (!productId) {
        throw new Error("Product ID is required");
      }

      // Fetch product info and assets in parallel
      const [productResult, assetsResult] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, sku, requires_configuration, category")
          .eq("id", productId)
          .single(),
        supabase
          .from("asset_management")
          .select("id, status, transit_status")
          .eq("product_id", productId)
          .eq("data_environment", dataEnvironment)
      ]);

      if (productResult.error) throw productResult.error;
      if (assetsResult.error) throw assetsResult.error;

      const product = productResult.data;
      const assets: AssetForCalculation[] = assetsResult.data || [];

      // Determine if config is required
      const requiresConfig = product?.requires_configuration ?? false;

      // Calculate metrics using canonical logic
      const metrics = calculateInventoryMetrics(assets, requiresConfig);

      return {
        ...metrics,
        productId,
        requiresConfig,
        productName: product?.name,
        sku: product?.sku,
      };
    },
    enabled: !!productId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Fetch canonical inventory metrics for all products (batch)
 * Used by product catalogue for efficient display
 */
export function useCanonicalInventoryMetricsForProducts(productIds: string[]) {
  const queryClient = useQueryClient();
  const dataEnvironment = useDataEnvironment();

  // Set up real-time subscriptions for all products
  useEffect(() => {
    if (productIds.length === 0) return;

    const channel = supabase
      .channel('canonical-inventory-all')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'asset_management'
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["canonical-inventory-batch"] });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'allocations'
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["canonical-inventory-batch"] });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'products'
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["canonical-inventory-batch"] });
        queryClient.invalidateQueries({ queryKey: ["products"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [productIds.length, queryClient]);

  return useQuery({
    queryKey: ["canonical-inventory-batch", productIds, dataEnvironment],
    queryFn: async (): Promise<Map<string, CanonicalInventoryMetrics>> => {
      if (productIds.length === 0) {
        return new Map();
      }

      // Fetch all products and assets in parallel
      const [productsResult, assetsResult] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, sku, requires_configuration, category")
          .in("id", productIds),
        supabase
          .from("asset_management")
          .select("id, status, transit_status, product_id")
          .in("product_id", productIds)
          .eq("data_environment", dataEnvironment)
      ]);

      if (productsResult.error) throw productsResult.error;
      if (assetsResult.error) throw assetsResult.error;

      // Group assets by product
      const assetsByProduct = new Map<string, AssetForCalculation[]>();
      (assetsResult.data || []).forEach(asset => {
        if (asset.product_id) {
          if (!assetsByProduct.has(asset.product_id)) {
            assetsByProduct.set(asset.product_id, []);
          }
          assetsByProduct.get(asset.product_id)!.push(asset);
        }
      });

      // Create product lookup
      const productsById = new Map<string, typeof productsResult.data[0]>();
      (productsResult.data || []).forEach(product => {
        productsById.set(product.id, product);
      });

      // Calculate metrics for each product
      const result = new Map<string, CanonicalInventoryMetrics>();

      productIds.forEach(productId => {
        const product = productsById.get(productId);
        const assets = assetsByProduct.get(productId) || [];
        const requiresConfig = product?.requires_configuration ?? false;

        const metrics = calculateInventoryMetrics(assets, requiresConfig);

        result.set(productId, {
          ...metrics,
          productId,
          requiresConfig,
          productName: product?.name,
          sku: product?.sku,
        });
      });

      return result;
    },
    enabled: productIds.length > 0,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Simple hook to get computed in-stock count for display
 * Replaces product.stock_quantity in catalogue views
 */
export function useProductInStockCount(productId: string | undefined) {
  const { data: metrics, isLoading } = useCanonicalInventoryMetrics(productId);

  return {
    inStock: metrics?.inStock ?? 0,
    available: metrics?.available ?? 0,
    ready: metrics?.ready ?? 0,
    configPending: metrics?.configPending ?? 0,
    requiresConfig: metrics?.requiresConfig ?? false,
    isLoading,
  };
}
