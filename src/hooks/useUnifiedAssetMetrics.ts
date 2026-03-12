import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAssetPriority } from "@/lib/asset-categories";
import { useEffect } from "react";
import { useDataEnvironment } from "@/hooks/useSandbox";

export interface UnifiedAssetMetrics {
  total: number;
  instock: number; // Delivered but not configured
  available: number; // Ready for customers
  allocatable: number; // Combined: instock + available (can be allocated)
  allocated: number;
  allocatedAvailable: number;
  allocatedInTransit: number;
  allocatedButNotDelivered: number;
  beingConfigured: number;
  sold: number;
  // Bundle-aware sold counts
  soldStandalone: number;  // Sold directly (not as bundle component)
  soldViaBundle: number;   // Sold as part of a bundle
  ordered: number;
  // Additional breakdown for inventory displays
  onHand: number;
  reserved: number;
  pendingDeliveries: number;
  completeAssets: number;
  trueAvailable: number;
  // Total assets in transit (both allocated and non-allocated)
  totalInTransit: number;
  // Written off assets (MISC deductions - damaged, retired, etc.)
  writtenOff: number;
  // Gifted assets (separate from written off)
  gifted: number;
}

export const useUnifiedAssetMetrics = (productId?: string) => {
  const queryClient = useQueryClient();

  // Enhanced real-time subscriptions for better cache invalidation
  useEffect(() => {
    const channel = supabase
      .channel('unified-asset-metrics-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'asset_management'
      }, () => {
        // Invalidate all related queries immediately
        queryClient.invalidateQueries({ queryKey: ["unified-asset-metrics"] });
        queryClient.invalidateQueries({ queryKey: ["unified-asset-metrics-all-products"] });
        queryClient.invalidateQueries({ queryKey: ["all-assets"] });
        queryClient.invalidateQueries({ queryKey: ["asset-management"] });

        if (productId) {
          queryClient.invalidateQueries({ queryKey: ["unified-asset-metrics", productId] });
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'allocations'
      }, () => {
        // Asset allocations changed
        queryClient.invalidateQueries({ queryKey: ["unified-asset-metrics"] });
        queryClient.invalidateQueries({ queryKey: ["unified-asset-metrics-all-products"] });
        queryClient.invalidateQueries({ queryKey: ["allocations"] });

        if (productId) {
          queryClient.invalidateQueries({ queryKey: ["unified-asset-metrics", productId] });
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'products'
      }, (payload) => {
        // Product stock changes
        queryClient.invalidateQueries({ queryKey: ["unified-asset-metrics"] });
        queryClient.invalidateQueries({ queryKey: ["unified-asset-metrics-all-products"] });
        queryClient.invalidateQueries({ queryKey: ["products"] });

        if (productId && payload.new && (payload.new as any)?.id === productId) {
          queryClient.invalidateQueries({ queryKey: ["unified-asset-metrics", productId] });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, productId]);

  const dataEnvironment = useDataEnvironment();

  return useQuery({
    queryKey: ["unified-asset-metrics", productId, dataEnvironment],
    queryFn: async (): Promise<UnifiedAssetMetrics> => {
      // Get all assets for the product or all assets if no productId
      const assetsQuery = supabase
        .from("asset_management")
        .select("id, status, transit_status, product_id, parent_asset_id, asset_type, category");

      if (productId) {
        assetsQuery.eq("product_id", productId);
      }

      const { data: assets, error } = await assetsQuery.eq("data_environment", dataEnvironment);
      if (error) throw error;

      // Get bundle-aware sold counts from allocations table
      let soldStandalone = 0;
      let soldViaBundle = 0;

      if (productId) {
        // Count standalone sold (fulfilled allocations without parent_bundle_id)
        const { count: standaloneCount } = await supabase
          .from('allocations')
          .select('id', { count: 'exact', head: true })
          .eq('product_id', productId)
          .eq('data_environment', dataEnvironment)
          .is('parent_bundle_id', null)
          .eq('status', 'fulfilled');

        // Count bundle sold (fulfilled allocations with parent_bundle_id)
        const { count: bundleCount } = await supabase
          .from('allocations')
          .select('id', { count: 'exact', head: true })
          .eq('product_id', productId)
          .eq('data_environment', dataEnvironment)
          .not('parent_bundle_id', 'is', null)
          .eq('status', 'fulfilled');

        soldStandalone = standaloneCount || 0;
        soldViaBundle = bundleCount || 0;
      }

      // Fetch legacy stock_sold from products table as a final fallback
      let legacyStockSold = 0;
      if (productId) {
        const { data: prodData } = await supabase
          .from("products")
          .select("stock_sold")
          .eq("id", productId)
          .single();
        legacyStockSold = prodData?.stock_sold || 0;
      }

      // Get product information to determine if it's multi-unit
      let isMultiUnit = false;
      if (productId) {
        const { data: productData } = await supabase
          .from("products")
          .select("is_multi_unit")
          .eq("id", productId)
          .single();

        isMultiUnit = productData?.is_multi_unit || false;
      }

      // Simplified asset counting - no pack handling needed
      const assetsToCount = assets || [];

      // Initialize counters
      const total = assetsToCount.length;
      let instock = 0; // Delivered but not configured
      let available = 0; // Ready for customers
      let allocated = 0;
      let allocatedAvailable = 0;
      let allocatedInTransit = 0;
      let allocatedButNotDelivered = 0;
      let beingConfigured = 0;
      let sold = 0;
      let ordered = 0;
      let totalInTransit = 0;
      let writtenOff = 0;
      let gifted = 0;

      // Count assets by status and transit_status - different logic for primary vs secondary assets
      assetsToCount.forEach(asset => {
        const assetPriority = getAssetPriority(asset.category || 'device');
        const isSecondaryAsset = assetPriority === 'secondary';

        // Count total assets in transit based on EITHER status OR transit_status
        if (asset.status === 'in_transit' || asset.transit_status === 'in_transit') {
          totalInTransit++;
        }

        switch (asset.status) {
          case 'instock':
            instock++;
            break;
          case 'available':
          case 'ready':
            // All available/ready assets count toward available/ready column
            available++;
            break;
          case 'allocated':
            allocated++;
            switch (asset.transit_status) {
              case 'available':
                allocatedAvailable++;
                break;
              case 'pending_transit':
                allocatedButNotDelivered++;
                break;
              case 'in_transit':
                allocatedInTransit++;
                break;
              case 'being_configured':
                beingConfigured++;
                break;
              case 'delivered':
              case 'completed':
                sold++;
                break;
              default:
                allocatedAvailable++;
            }
            break;
          case 'sold':
            sold++;
            break;
          case 'ordered':
            ordered++;
            break;
          case 'in_transit':
            // Assets physically in transit - already counted in totalInTransit above
            // These are not yet in stock, so don't increment instock
            break;
          case 'written_off':
          case 'retired':
          case 'damaged':
            // Assets removed from active inventory via MISC deduction
            writtenOff++;
            break;
          case 'gift':
            // Assets gifted out (separate tracking)
            gifted++;
            break;
          default:
            // Handle any other statuses
            break;
        }
      });

      // Calculate final sold count. Use the asset-based count as primary, 
      // but ensure it's at least as high as the unique fulfilled allocations count.
      // Final fallback: Use legacy stock_sold from products table if everything else is 0.
      const allocationBasedSold = soldStandalone + soldViaBundle;
      const finalSold = Math.max(sold, allocationBasedSold, legacyStockSold);

      const allocatable = instock + available;

      return {
        total,
        instock,
        available,
        allocatable,
        allocated,
        allocatedAvailable,
        allocatedInTransit,
        allocatedButNotDelivered,
        beingConfigured,
        sold: finalSold,
        soldStandalone: Math.max(soldStandalone, allocationBasedSold > 0 ? (soldStandalone / allocationBasedSold) * finalSold : finalSold),
        soldViaBundle: Math.max(soldViaBundle, allocationBasedSold > 0 ? (soldViaBundle / allocationBasedSold) * finalSold : 0),
        ordered,
        onHand: total,
        reserved: allocatedInTransit,
        pendingDeliveries: allocatedButNotDelivered,
        completeAssets: total,
        trueAvailable: allocatable,
        totalInTransit,
        writtenOff,
        gifted,
      };
    },
    enabled: true,
    refetchOnWindowFocus: true,
    staleTime: 30000, // Cache for 30 seconds, rely on real-time subscriptions for updates
  });
};

export const useUnifiedAssetMetricsForProducts = (products: any[]) => {
  const queryClient = useQueryClient();

  // Enhanced real-time subscriptions for product-wide metrics
  useEffect(() => {
    const channel = supabase
      .channel('unified-asset-metrics-products-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'asset_management'
      }, () => {
        // Invalidate all related queries immediately
        queryClient.invalidateQueries({ queryKey: ["unified-asset-metrics-all-products"] });
        queryClient.invalidateQueries({ queryKey: ["unified-asset-metrics"] });
        queryClient.invalidateQueries({ queryKey: ["all-assets"] });
        queryClient.invalidateQueries({ queryKey: ["asset-management"] });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'allocations'
      }, () => {
        // Asset allocations changed
        queryClient.invalidateQueries({ queryKey: ["unified-asset-metrics-all-products"] });
        queryClient.invalidateQueries({ queryKey: ["unified-asset-metrics"] });
        queryClient.invalidateQueries({ queryKey: ["allocations"] });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'products'
      }, () => {
        // Product stock changes
        queryClient.invalidateQueries({ queryKey: ["unified-asset-metrics-all-products"] });
        queryClient.invalidateQueries({ queryKey: ["unified-asset-metrics"] });
        queryClient.invalidateQueries({ queryKey: ["products"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const dataEnvironment = useDataEnvironment();

  return useQuery({
    queryKey: ["unified-asset-metrics-all-products", dataEnvironment],
    queryFn: async () => {
      const { data: assets, error } = await supabase
        .from("asset_management")
        .select("id, status, transit_status, product_id, parent_asset_id, asset_type, category");

      if (error) throw error;

      // Fetch all fulfilled allocations to calculate bundle-aware sold counts
      const { data: fulfilledAllocations } = await supabase
        .from('allocations')
        .select('product_id, parent_bundle_id')
        .eq('data_environment', dataEnvironment)
        .eq('status', 'fulfilled');

      // Group fulfilled allocations by product
      const allocationsByProduct = new Map<string, { standalone: number; bundle: number }>();
      (fulfilledAllocations || []).forEach(alloc => {
        if (!allocationsByProduct.has(alloc.product_id)) {
          allocationsByProduct.set(alloc.product_id, { standalone: 0, bundle: 0 });
        }
        const counts = allocationsByProduct.get(alloc.product_id)!;
        if (alloc.parent_bundle_id) {
          counts.bundle++;
        } else {
          counts.standalone++;
        }
      });

      const metricsByProduct: { [productId: string]: UnifiedAssetMetrics } = {};

      products.forEach(product => {
        const productAssets = assets?.filter(asset => asset.product_id === product.id) || [];

        // Simplified asset counting - no pack handling needed
        const assetsToCount = productAssets;

        // Get bundle-aware sold counts for this product
        const soldCounts = allocationsByProduct.get(product.id) || { standalone: 0, bundle: 0 };

        // Calculate metrics for this product
        const total = assetsToCount.length;
        let instock = 0; // Delivered but not configured
        let available = 0; // Ready for customers
        let allocated = 0;
        let allocatedAvailable = 0;
        let allocatedInTransit = 0;
        let allocatedButNotDelivered = 0;
        let beingConfigured = 0;
        let sold = 0;
        let ordered = 0;
        let totalInTransit = 0;
        let writtenOff = 0;
        let gifted = 0;

        assetsToCount.forEach(asset => {
          const assetPriority = getAssetPriority(asset.category || 'device');
          const isSecondaryAsset = assetPriority === 'secondary';

          // Count total assets in transit based on EITHER status OR transit_status
          if (asset.status === 'in_transit' || asset.transit_status === 'in_transit') {
            totalInTransit++;
          }

          switch (asset.status) {
            case 'instock':
              instock++;
              break;
            case 'available':
            case 'ready':
              // All available/ready assets count toward available/ready column
              available++;
              break;
            case 'allocated':
              allocated++;
              switch (asset.transit_status) {
                case 'available':
                  allocatedAvailable++;
                  break;
                case 'pending_transit':
                  allocatedButNotDelivered++;
                  break;
                case 'in_transit':
                  allocatedInTransit++;
                  break;
                case 'being_configured':
                  beingConfigured++;
                  break;
                case 'delivered':
                case 'completed':
                  sold++;
                  break;
                default:
                  allocatedAvailable++;
              }
              break;
            case 'sold':
              sold++;
              break;
            case 'ordered':
              ordered++;
              break;
            case 'in_transit':
              // Assets physically in transit - already counted in totalInTransit above
              break;
            case 'written_off':
            case 'retired':
            case 'damaged':
              // Assets removed from active inventory via MISC deduction
              writtenOff++;
              break;
            case 'gift':
              // Assets gifted out (separate tracking)
              gifted++;
              break;
          }
        });

        // Calculate missing assets based on expected stock quantity
        const missingAssets = Math.max(0, (product.stock_quantity || 0) - total);

        // Combined allocatable count
        const allocatable = instock + available;

        // Calculate final sold count using robust fallback logic.
        // Include product.stock_sold as a final legacy fallback.
        const allocationBasedSold = soldCounts.standalone + soldCounts.bundle;
        const finalSold = Math.max(sold, allocationBasedSold, product.stock_sold || 0);

        metricsByProduct[product.id] = {
          total,
          instock,
          available,
          allocatable,
          allocated,
          allocatedAvailable,
          allocatedInTransit,
          allocatedButNotDelivered,
          beingConfigured,
          sold: finalSold,
          soldStandalone: Math.max(soldCounts.standalone, allocationBasedSold > 0 ? (soldCounts.standalone / allocationBasedSold) * finalSold : finalSold),
          soldViaBundle: Math.max(soldCounts.bundle, allocationBasedSold > 0 ? (soldCounts.bundle / allocationBasedSold) * finalSold : 0),
          ordered,
          onHand: total,
          reserved: allocatedInTransit,
          pendingDeliveries: allocatedButNotDelivered,
          completeAssets: total,
          trueAvailable: allocatable,
          totalInTransit,
          writtenOff,
          gifted,
        };
      });

      return metricsByProduct;
    },
    enabled: products.length > 0,
    refetchOnWindowFocus: true,
    staleTime: 30000, // Cache for 30 seconds, rely on real-time subscriptions for updates
  });
};