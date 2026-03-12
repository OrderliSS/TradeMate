import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { enhancedToast } from "@/components/ui/enhanced-toast";
import { getCurrentEnvironment } from "@/lib/environment-utils";
import { useLogAllocationActivity } from "@/hooks/useAllocationActivityLog";
import { useDataEnvironment } from "@/hooks/useSandbox";
import { ASSET_CATEGORIES, getCategoryConfig } from "@/lib/asset-categories";
import { useCurrentOrganizationId } from "./useOrganization";

export interface Allocation {
  id: string;
  stock_order_id?: string;
  purchase_order_id?: string;
  product_id: string;
  asset_id: string;
  status: 'allocated' | 'pre_allocated' | 'released' | 'fulfilled';
  allocated_at: string;
  allocated_by?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface AllocationWithDetails extends Allocation {
  purchase_order_id?: string;
  product?: {
    id: string;
    name: string;
    price?: number;
  };
  asset?: {
    id: string;
    asset_tag?: string;
    status: string;
    category?: string;
    transit_status?: string;
  };
  stock_order?: {
    id: string;
    name: string;
    expense_number?: string;
  };
  purchase_order?: {
    id: string;
    ticket_number?: string;
    receipt_number?: string;
    total_amount?: number;
    order_status?: string;
    pickup_date?: string;
    customer?: {
      name: string;
    };
  };
}

export const useAllocations = (productId?: string) => {
  const currentEnv = getCurrentEnvironment();
  const dataEnvironment = useDataEnvironment();
  const organizationId = useCurrentOrganizationId();

  return useQuery({
    queryKey: ["allocations", productId, currentEnv, dataEnvironment, organizationId],
    queryFn: async () => {
      let query = supabase
        .from("allocations")
        .select(`
          *,
          product:products!allocations_product_id_fkey(id, name, price),
          asset:asset_management(id, asset_tag, status, category, sold_price, pricing_notes, purchase_order_id, transit_status, environment),
          stock_order:stock_orders(id, name, stock_record_number),
          purchase_order:purchases!allocations_purchase_order_id_fkey(id, quantity, receipt_number, total_amount, order_status, pickup_date, customer:customers!purchases_customer_id_fkey(name), product:products(name))
        `)
        .eq("data_environment", dataEnvironment)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (productId) {
        query = query.eq("product_id", productId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []).map(asset => {
        // Remove any SelectQueryError fields and ensure proper typing
        const { stock_order, ...cleanAsset } = asset as any;
        return {
          ...cleanAsset,
          stock_order: stock_order?.error ? null : stock_order
        } as AllocationWithDetails;
      });
    },
  });
};

export const useAvailableAssets = (productId: string, includeBackfill = false) => {
  const organizationId = useCurrentOrganizationId();
  return useQuery({
    queryKey: ["available-assets", productId, includeBackfill, organizationId],
    queryFn: async () => {
      // First get product info to check if it's multi-unit
      const { data: product, error: productError } = await supabase
        .from("products")
        .select("is_multi_unit")
        .eq("id", productId)
        .single();

      if (productError) throw productError;

      // First get all allocated asset IDs
      const { data: allocatedAssets, error: allocError } = await supabase
        .from("allocations")
        .select("asset_id")
        .in("status", ["allocated", "pre_allocated", "fulfilled"]);

      if (allocError) throw allocError;

      const allocatedAssetIds = allocatedAssets?.map(a => a.asset_id) || [];

      if (includeBackfill) {
        // For backfill mode, return all unallocated assets for this product
        let query = supabase
          .from("asset_management")
          .select("*")
          .eq("product_id", productId)
          .in("status", ["available", "sold"]);

        // For multi-unit products, only show individual units (not packs)
        if (product.is_multi_unit) {
          query = query.not("parent_asset_id", "is", null);
        }

        // Filter out already allocated assets
        if (allocatedAssetIds.length > 0) {
          query = query.not("id", "in", `(${allocatedAssetIds.join(',')})`);
        }

        const { data, error } = await query;
        if (error) throw error;

        return data || [];
      } else {
        // Regular behavior - only available, unallocated assets (exclude ordered/in-transit)
        let query = supabase
          .from("asset_management")
          .select("*")
          .eq("product_id", productId)
          .in("status", ["available", "instock"]);

        // For multi-unit products, only show individual units (not packs)
        if (product.is_multi_unit) {
          query = query.not("parent_asset_id", "is", null);
        }

        // Filter out allocated assets if there are any
        if (allocatedAssetIds.length > 0) {
          query = query.not("id", "in", `(${allocatedAssetIds.join(',')})`);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data || [];
      }
    },
    enabled: !!productId && !!organizationId,
  });
};

// New hook for category-based asset allocation
export const useAvailableAssetsByCategory = (productId: string, includeBackfill = false) => {
  const organizationId = useCurrentOrganizationId();
  return useQuery({
    queryKey: ["available-assets-by-category", productId, includeBackfill, organizationId],
    queryFn: async () => {
      // Using static import for asset categories
      // First get product info to check if it's multi-unit
      const { data: product, error: productError } = await supabase
        .from("products")
        .select("is_multi_unit")
        .eq("id", productId)
        .single();

      if (productError) throw productError;

      // Get all allocated asset IDs
      const { data: allocatedAssets, error: allocError } = await supabase
        .from("allocations")
        .select("asset_id")
        .in("status", ["allocated", "pre_allocated", "fulfilled"]);

      if (allocError) throw allocError;

      const allocatedAssetIds = allocatedAssets?.map(a => a.asset_id) || [];

      // Get assets for the product
      let query = supabase
        .from("asset_management")
        .select("*")
        .eq("product_id", productId);

      // For multi-unit products, only show individual units (not packs)
      if (product.is_multi_unit) {
        query = query.not("parent_asset_id", "is", null);
      }

      if (includeBackfill) {
        query = query.in("status", ["available", "instock", "sold"]);
      } else {
        query = query.in("status", ["available", "instock"]);
      }

      // Filter out allocated assets if there are any
      if (allocatedAssetIds.length > 0) {
        query = query.not("id", "in", `(${allocatedAssetIds.join(',')})`);
      }

      const { data: assets, error } = await query;
      if (error) throw error;

      // Group assets by category priority
      const categorizedAssets = {
        primary: [] as any[],
        secondary: [] as any[],
        uncategorized: [] as any[]
      };

      (assets || []).forEach(asset => {
        const categoryConfig = getCategoryConfig(asset.category || 'device');

        // Only include serializable properties from categoryConfig
        // Note: icon removed to prevent circular structure JSON error
        const serializableConfig = {
          asset_priority: categoryConfig.asset_priority,
          name: categoryConfig.name,
        };

        if (categoryConfig.asset_priority === 'primary') {
          categorizedAssets.primary.push({
            ...asset,
            categoryConfig: serializableConfig
          });
        } else if (categoryConfig.asset_priority === 'secondary') {
          categorizedAssets.secondary.push({
            ...asset,
            categoryConfig: serializableConfig
          });
        } else {
          categorizedAssets.uncategorized.push({
            ...asset,
            categoryConfig: serializableConfig
          });
        }
      });

      return {
        primary: categorizedAssets.primary,
        secondary: categorizedAssets.secondary,
        uncategorized: categorizedAssets.uncategorized,
        all: assets || []
      };
    },
    enabled: !!productId && !!organizationId,
  });
};

// Hook to fetch assets for multiple products (fixes Rules of Hooks violation)
export const useMultiProductAssetsByCategory = (productIds: string[], includeBackfill = false, purchaseOrderId?: string) => {
  const organizationId = useCurrentOrganizationId();
  // Filter out empty/invalid product IDs before creating queries
  const validProductIds = productIds.filter(id => id && id.trim() !== '');

  // Log which product IDs are being queried for debugging
  console.log('📊 useMultiProductAssetsByCategory - querying products:', validProductIds, 'purchaseOrderId:', purchaseOrderId);

  const results = useQueries({
    queries: validProductIds.map(productId => ({
      queryKey: ["available-assets-by-category", productId, includeBackfill, purchaseOrderId, organizationId],
      queryFn: async () => {
        console.log(`📦 Fetching assets for product: ${productId}`);

        // First get the product name
        const { data: productData } = await supabase
          .from('products')
          .select('name')
          .eq('id', productId)
          .eq('organization_id', organizationId)
          .single();

        console.log(`📦 Product ${productId} name: ${productData?.name}`);

        // Fetch assets with both available AND allocated status to show already-allocated assets
        const { data, error } = await supabase
          .from('asset_management')
          .select('*')
          .eq('product_id', productId)
          .eq('organization_id', organizationId)
          .in('status', ['available', 'allocated', 'instock', 'in_transit', 'sold', 'fulfilled', 'picked_up', 'ready', 'being_configured', 'reserved'])
          .order('created_at', { ascending: false });

        if (error) {
          console.error(`❌ Error fetching assets for product ${productId}:`, error);
          throw error;
        }

        console.log(`✅ Found ${data?.length || 0} assets for product ${productId} (${productData?.name})`);

        // Get unique purchase_order_ids from assets to check their status
        const linkedPurchaseIds = [...new Set(
          (data || [])
            .map(a => a.purchase_order_id)
            .filter((id): id is string => !!id)
        )];

        // Terminal statuses that mean the order is done and assets should be available
        const terminalStatuses = ['complete', 'completed', 'fulfilled', 'cancelled', 'picked_up'];

        let completedPurchaseIds = new Set<string>();
        if (linkedPurchaseIds.length > 0) {
          const { data: linkedPurchases } = await supabase
            .from('purchases')
            .select('id, order_status')
            .eq('organization_id', organizationId)
            .in('id', linkedPurchaseIds);

          completedPurchaseIds = new Set(
            (linkedPurchases || [])
              .filter(p => terminalStatuses.includes(p.order_status || ''))
              .map(p => p.id)
          );
        }

        // Get product purchase_category to properly categorize assets
        const { data: productInfo } = await supabase
          .from('products')
          .select('purchase_category, category')
          .eq('id', productId)
          .eq('organization_id', organizationId)
          .single();

        // Filter and mark assets based on asset_management.purchase_order_id field
        const processedAssets = (data || []).map(asset => {
          const isAllocatedToThisPO = asset.purchase_order_id === purchaseOrderId;
          const isAllocatedToAnyPO = asset.status === 'allocated' && asset.purchase_order_id;
          const hasStaleLink = asset.purchase_order_id && completedPurchaseIds.has(asset.purchase_order_id);

          // Terminal statuses that mean the asset is physically gone
          const isPhysicallyGone = ['sold', 'fulfilled', 'picked_up', 'retired'].includes(asset.status);

          return {
            ...asset,
            isAllocated: isAllocatedToAnyPO && !hasStaleLink,
            isAllocatedToCurrentPO: isAllocatedToThisPO,
            isPhysicallyGone,
            allocationStatus: isAllocatedToThisPO ? 'allocated_to_current_po' : 'available',
            hasStaleLink, // Flag for UI to show "Previously allocated" badge if needed
            // Add the product's hierarchical category for proper grouping
            productCategory: productInfo?.category || asset.category || 'Other',
          };
        }).filter(asset => {
          // Show asset if:
          // 1. Linked to current PO (must always show even if sold/fulfilled)
          if (asset.purchase_order_id === purchaseOrderId) return true;

          // 2. Not linked to anything and NOT physically gone/sold
          if (!asset.purchase_order_id && !asset.isPhysicallyGone) return true;

          // 3. Linked to a FULFILLED/CANCELLED PO (stale link) and NOT physically gone
          // This allows reusing tags from cancelled orders
          if (asset.hasStaleLink && !asset.isPhysicallyGone) return true;

          // Otherwise, don't show it in the allocation list
          return false;
        });

        const purchaseCategory = productInfo?.purchase_category || 'main';

        // Categorize by product purchase_category (not asset_priority)
        const categorized: {
          primary: typeof processedAssets;
          secondary: typeof processedAssets;
          uncategorized: typeof processedAssets;
        } = {
          primary: [],
          secondary: [],
          uncategorized: []
        };

        processedAssets.forEach(asset => {
          // Use product's purchase_category for proper classification
          if (purchaseCategory === 'main') {
            categorized.primary.push(asset);
          } else if (['secondary', 'component', 'consumable', 'addon'].includes(purchaseCategory)) {
            categorized.secondary.push(asset);
          } else {
            categorized.uncategorized.push(asset);
          }
        });

        return {
          productId,
          productName: productData?.name || 'Unknown Product',
          data: categorized
        };
      },
      enabled: !!productId && productId.trim() !== '' && !!organizationId,
    })),
  });

  return {
    data: results.map(r => r.data).filter((d): d is NonNullable<typeof d> => d !== undefined),
    isLoading: results.some(r => r.isLoading),
    error: results.find(r => r.error)?.error || null,
  };
};

// Hook to fetch purchase order product details
export const usePurchaseOrderProduct = (purchaseOrderId?: string) => {
  const organizationId = useCurrentOrganizationId();
  return useQuery({
    queryKey: ["purchase-order-product", purchaseOrderId, organizationId],
    queryFn: async () => {
      if (!purchaseOrderId) return null;

      const { data, error } = await supabase
        .from("purchases")
        .select(`
          product_id,
          quantity,
          secondary_items,
          product:products(id, name, is_bundle, bundle_components)
        `)
        .eq("id", purchaseOrderId)
        .eq("organization_id", organizationId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!purchaseOrderId,
  });
};

export interface CreateAllocationParams {
  stock_order_id?: string;
  purchase_order_id?: string;
  product_id: string;
  asset_ids: string[];
  notes?: string;
  includeInTransit?: boolean;
}

export interface PurchaseOrderAllocation extends Allocation {
  purchase_order?: {
    id: string;
    customer?: {
      name: string;
    };
    product?: {
      name: string;
    };
    quantity: number;
    receipt_number?: string;
    total_amount?: number;
  };
}

export const useCreateAllocation = () => {
  const queryClient = useQueryClient();
  const logActivity = useLogAllocationActivity();
  const organizationId = useCurrentOrganizationId();

  return useMutation({
    mutationFn: async (params: CreateAllocationParams & { isBackfill?: boolean }) => {
      const startTime = Date.now();
      let assetTags: string[] = [];

      try {
        // Validate asset_ids array is not empty and contains no null values
        if (!params.asset_ids || params.asset_ids.length === 0) {
          throw new Error("Cannot create allocation: No assets selected");
        }

        const nullAssets = params.asset_ids.filter(id => !id);
        if (nullAssets.length > 0) {
          throw new Error("Cannot create allocation: Asset IDs cannot be null or undefined");
        }

        // Pre-validate assets before allocation
        const { data: assetStatuses, error: assetError } = await supabase
          .from("asset_management")
          .select("id, status, asset_tag")
          .in("id", params.asset_ids);

        if (assetError) {
          throw new Error(`Failed to verify asset status: ${assetError.message}`);
        }

        if (!assetStatuses || assetStatuses.length !== params.asset_ids.length) {
          throw new Error("Some assets were not found in the system");
        }

        // Store asset tags for logging
        assetTags = assetStatuses.map(a => a.asset_tag || a.id.slice(0, 8));

        // Check if any assets are already allocated
        const { data: existingAllocations, error: allocError } = await supabase
          .from("allocations")
          .select("asset_id, purchase_order_id")
          .in("asset_id", params.asset_ids)
          .in("status", ["allocated", "pre_allocated"]);

        if (allocError) {
          throw new Error(`Failed to check existing allocations: ${allocError.message}`);
        }

        // Only reject assets allocated to OTHER purchase orders
        const conflictingAllocations = existingAllocations?.filter(a =>
          a.purchase_order_id !== params.purchase_order_id
        ) || [];

        if (conflictingAllocations.length > 0) {
          const allocatedAssetIds = conflictingAllocations.map(a => a.asset_id);
          const conflictingAssets = assetStatuses.filter(a => allocatedAssetIds.includes(a.id));
          throw new Error(`Assets already allocated to other orders: ${conflictingAssets.map(a => a.asset_tag || a.id).join(', ')}`);
        }

        // Track which assets are already allocated to THIS purchase order
        const alreadyAllocatedToCurrentPO = (existingAllocations || [])
          .filter(a => a.purchase_order_id === params.purchase_order_id)
          .map(a => a.asset_id);

        // Validate asset statuses - allow allocated status if already allocated to this PO
        const invalidAssets = assetStatuses.filter(a => {
          const isAllocatedToThisPO = alreadyAllocatedToCurrentPO.includes(a.id);
          const validStatuses = ['available', 'instock', 'in_transit', ...(isAllocatedToThisPO ? ['allocated'] : [])];
          return !validStatuses.includes(a.status);
        });

        // Detect and auto-fix orphaned allocated assets (marked as allocated but no allocation record exists)
        const orphanedAssets = assetStatuses.filter(a => {
          const hasNoAllocationRecord = !alreadyAllocatedToCurrentPO.includes(a.id) &&
            !conflictingAllocations.some(ca => ca.asset_id === a.id);
          return a.status === 'allocated' && hasNoAllocationRecord;
        });

        // Auto-reset orphaned assets to 'available' status
        if (orphanedAssets.length > 0) {
          console.log('🔧 Auto-fixing orphaned allocated assets:', orphanedAssets.map(a => a.asset_tag).join(', '));

          // Reset orphaned assets in a single update
          const { error: resetError } = await supabase
            .from('asset_management')
            .update({
              status: 'available',
              purchase_order_id: null,
              updated_at: new Date().toISOString()
            })
            .in('id', orphanedAssets.map(a => a.id));

          if (resetError) {
            console.error('Failed to reset orphaned assets:', resetError);
          } else {
            // Update local status for re-validation
            orphanedAssets.forEach(a => a.status = 'available');

            enhancedToast.warning(
              "Data Inconsistency Fixed",
              `${orphanedAssets.length} asset${orphanedAssets.length > 1 ? 's were' : ' was'} marked as allocated without records. Automatically reset to available.`
            );
          }
        }

        // Re-validate after potential auto-fix
        const finalInvalidAssets = assetStatuses.filter(a => {
          const isAllocatedToThisPO = alreadyAllocatedToCurrentPO.includes(a.id);
          const validStatuses = ['available', 'instock', 'in_transit', ...(isAllocatedToThisPO ? ['allocated'] : [])];
          return !validStatuses.includes(a.status);
        });

        if (finalInvalidAssets.length > 0) {
          const invalidList = finalInvalidAssets.map(a => `${a.asset_tag || a.id} (${a.status})`).join(', ');
          throw new Error(`Assets not available for allocation: ${invalidList}`);
        }

        // Filter out assets already allocated to current PO to avoid duplicates
        const assetsToAllocate = params.asset_ids.filter(id =>
          !alreadyAllocatedToCurrentPO.includes(id)
        );

        // If no new assets to allocate, return early with success
        if (assetsToAllocate.length === 0) {
          enhancedToast.success(
            "Assets Already Allocated",
            `All ${params.asset_ids.length} selected asset${params.asset_ids.length > 1 ? 's are' : ' is'} already allocated to this order.`
          );
          return [];
        }

        // Try transactional allocation first for purchase orders (atomic operation)
        if (params.purchase_order_id) {
          console.log('🔐 Using transactional allocation for purchase order');
          const { data: transactionalData, error: transactionalError } = await supabase
            .rpc('allocate_assets_transactional', {
              p_purchase_order_id: params.purchase_order_id,
              p_product_id: params.product_id,
              p_asset_ids: assetsToAllocate,
              p_environment: getCurrentEnvironment(),
              p_notes: params.notes,
              p_organization_id: organizationId
            });

          if (!transactionalError && transactionalData) {
            // Check for any errors in the results - the RPC returns 'success' or 'failed'
            const dataArray = Array.isArray(transactionalData) ? transactionalData : [];
            const failedAssets = dataArray.filter((r: any) => r.status === 'failed');
            const successfulAssets = dataArray.filter((r: any) => r.status === 'success');

            if (failedAssets.length > 0) {
              console.warn('⚠️ Some assets failed to allocate:', failedAssets);
            }

            if (successfulAssets.length > 0) {
              console.log(`✅ Transactional allocation succeeded for ${successfulAssets.length} assets`);
              // Fetch full allocation data for return
              const { data: fullAllocations } = await supabase
                .from("allocations")
                .select(`
              *,
                product:products!allocations_product_id_fkey(id, name, price),
                asset:asset_management(id, asset_tag, status, sold_price, pricing_notes, purchase_order_id),
                stock_order:stock_orders(id, name, stock_record_number),
                purchase_order:purchases!allocations_purchase_order_id_fkey(id, quantity, receipt_number, total_amount, order_status, pickup_date, customer:customers!purchases_customer_id_fkey(name), product:products(name))
              `)
                .in('id', successfulAssets.map((r: any) => r.allocation_id));

              return fullAllocations || [];
            }

            if (failedAssets.length === assetsToAllocate.length) {
              throw new Error(`All assets failed to allocate: ${failedAssets.map((r: any) => r.error_message).join(', ')}`);
            }
          } else {
            console.warn('⚠️ Transactional allocation failed, falling back to manual method:', transactionalError);
          }
        }

        // Fallback: Manual allocation (existing logic)
        const allocations = assetsToAllocate.map(asset_id => {
          // Double-check asset_id is valid
          if (!asset_id) {
            throw new Error("Invalid asset_id: Cannot create allocation with null or undefined asset_id");
          }

          const asset = assetStatuses.find(a => a.id === asset_id);
          const isInTransit = asset?.status === 'in_transit';
          const isInstock = asset?.status === 'instock';

          return {
            stock_order_id: params.stock_order_id,
            purchase_order_id: params.purchase_order_id,
            product_id: params.product_id,
            asset_id: asset_id,
            organization_id: organizationId,
            status: (isInTransit && params.includeInTransit) ? 'pre_allocated' as const : 'allocated' as const,
            allocated_by: undefined, // Will be set by server
            notes: params.notes ? (params.isBackfill ? `[BACKFILL] ${params.notes}` : params.notes) : (params.isBackfill ? '[BACKFILL] Asset allocated to catch up with sold inventory' : undefined),
          };
        });

        const { data, error } = await supabase
          .from("allocations")
          .insert(allocations)
          .select(`
          *,
          product:products!allocations_product_id_fkey(id, name, price),
          asset:asset_management(id, asset_tag, status, sold_price, pricing_notes, purchase_order_id),
          stock_order:stock_orders(id, name, stock_record_number),
          purchase_order:purchases!allocations_purchase_order_id_fkey(id, quantity, receipt_number, total_amount, order_status, pickup_date, customer:customers!purchases_customer_id_fkey(name), product:products(name))
        `);

        if (error) throw error;

        // Auto-link expenses when allocating assets to purchase orders
        if (params.purchase_order_id && data) {
          // Get purchase order details
          const { data: purchaseOrder } = await supabase
            .from("purchases")
            .select("product_id, quantity, total_amount")
            .eq("id", params.purchase_order_id)
            .single();

          if (purchaseOrder) {
            // Find delivered stock orders for the same product that haven't been fully allocated
            const { data: availableStockOrders } = await supabase
              .from("stock_orders")
              .select(`
              id,
              quantity_needed,
              delivery_status,
              name
            `)
              .eq("product_id", purchaseOrder.product_id)
              .eq("delivery_status", "delivered")
              .order("actual_delivery_date", { ascending: true });

            if (availableStockOrders && availableStockOrders.length > 0) {
              // Get existing stock order allocations to calculate available quantities
              const { data: existingAllocations } = await supabase
                .from("stock_order_allocations")
                .select("stock_order_id, quantity_allocated");

              const stockOrderAvailability = availableStockOrders.map(stockOrder => {
                const allocated = existingAllocations
                  ?.filter(alloc => alloc.stock_order_id === stockOrder.id)
                  ?.reduce((sum, alloc) => sum + alloc.quantity_allocated, 0) || 0;

                return {
                  ...stockOrder,
                  available: stockOrder.quantity_needed - allocated
                };
              }).filter(stockOrder => stockOrder.available > 0);

              // Auto-create stock order allocations for the newly allocated assets
              let remainingToAllocate = params.asset_ids.length;
              const stockOrderAllocationsToCreate = [];

              for (const stockOrder of stockOrderAvailability) {
                if (remainingToAllocate <= 0) break;

                const quantityToAllocate = Math.min(remainingToAllocate, stockOrder.available);
                if (quantityToAllocate > 0) {
                  stockOrderAllocationsToCreate.push({
                    stock_order_id: stockOrder.id,
                    purchase_id: params.purchase_order_id,
                    quantity_allocated: quantityToAllocate,
                    notes: `Auto-linked when allocating assets`
                  });
                  remainingToAllocate -= quantityToAllocate;
                }
              }

              // Insert the stock order allocations
              if (stockOrderAllocationsToCreate.length > 0) {
                await supabase
                  .from("stock_order_allocations")
                  .insert(stockOrderAllocationsToCreate);
              }
            }
          }
        }

        // Update asset pricing and status for all allocations
        if (params.purchase_order_id) {
          // Get purchase order details to calculate per-asset pricing
          const { data: purchaseOrder, error: orderError } = await supabase
            .from("purchases")
            .select("total_amount, quantity")
            .eq("id", params.purchase_order_id)
            .single();

          if (!orderError && purchaseOrder) {
            const pricePerAsset = purchaseOrder.total_amount / purchaseOrder.quantity;

            const assetUpdates = params.asset_ids.map(assetId => {
              const asset = assetStatuses.find(a => a.id === assetId);
              const currentStatus = asset?.status;

              return supabase
                .from("asset_management")
                .update({
                  status: "allocated",
                  sold_price: pricePerAsset,
                  pricing_notes: params.isBackfill ? "Backfilled allocation - calculated from order total" : "Allocated to purchase order",
                  purchase_order_id: params.purchase_order_id,
                  notes: params.isBackfill ? `Allocated to purchase order via backfill allocation (was ${currentStatus})` : `Allocated to purchase order (was ${currentStatus})`
                })
                .eq("id", assetId);
            });

            const updateResults = await Promise.allSettled(assetUpdates);
            const failedUpdates = updateResults.filter(result => result.status === 'rejected');

            if (failedUpdates.length > 0) {
              console.warn(`${failedUpdates.length} asset updates failed:`, failedUpdates);
              // Don't throw here - allocation was successful, just log the asset update failures
            }

            // Update purchase allocation_status to 'allocated' when assets are allocated
            await supabase
              .from("purchases")
              .update({ allocation_status: 'allocated' })
              .eq("id", params.purchase_order_id)
              .eq("allocation_status", "pending_allocation");
          }
        }

        return (data || []).map(item => {
          // Clean up any SelectQueryError fields
          const { stock_order, ...cleanItem } = item as any;
          return {
            ...cleanItem,
            stock_order: stock_order?.error ? null : stock_order
          } as AllocationWithDetails;
        });

      } catch (error: any) {
        // Log failed allocation attempt
        logActivity.mutate({
          action: 'failed',
          purchase_order_id: params.purchase_order_id,
          stock_order_id: params.stock_order_id,
          product_id: params.product_id,
          asset_ids: params.asset_ids,
          asset_tags: assetTags,
          status: 'failure',
          error_message: error.message || error.toString(),
          metadata: {
            isBackfill: params.isBackfill,
            includeInTransit: params.includeInTransit,
            duration_ms: Date.now() - startTime
          }
        });

        throw error;
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["allocations"] });
      queryClient.invalidateQueries({ queryKey: ["available-assets"] });
      queryClient.invalidateQueries({ queryKey: ["available-assets-preallocation"] });
      queryClient.invalidateQueries({ queryKey: ["available-assets-by-category-preallocation"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-health"] });
      queryClient.invalidateQueries({ queryKey: ["asset-management"] });
      queryClient.invalidateQueries({ queryKey: ["stock-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-asset-status"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-order-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-asset-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["unified-asset-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["available-assets-by-category"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-order-product"] });
      queryClient.invalidateQueries({ queryKey: ["orphaned-assets-check"] });
      queryClient.invalidateQueries({ queryKey: ["bundle-component-assets"] });
      queryClient.invalidateQueries({ queryKey: ["primary-assets"] });
      queryClient.invalidateQueries({ queryKey: ["secondary-assets"] });

      const newlyAllocated = data.length;
      const totalRequested = variables.asset_ids.length;
      const previouslyAllocated = totalRequested - newlyAllocated;
      const productName = data[0]?.product?.name || 'Product';
      const isBackfill = variables.isBackfill;
      const isPurchaseOrder = !!variables.purchase_order_id;

      // Log successful allocation
      logActivity.mutate({
        action: 'created',
        allocation_id: data[0]?.id,
        purchase_order_id: variables.purchase_order_id,
        stock_order_id: variables.stock_order_id,
        product_id: variables.product_id,
        asset_ids: data.map(d => d.asset_id).filter(Boolean),
        asset_tags: data.map(d => d.asset?.asset_tag).filter(Boolean),
        status: previouslyAllocated > 0 ? 'partial' : 'success',
        metadata: {
          isBackfill: variables.isBackfill,
          newlyAllocated,
          previouslyAllocated,
          totalRequested
        }
      });

      if (previouslyAllocated > 0) {
        enhancedToast.success(
          `Assets ${isBackfill ? 'Backfill ' : ''}Allocated`,
          `${newlyAllocated} new asset${newlyAllocated > 1 ? 's' : ''} allocated. ${previouslyAllocated} already allocated${isPurchaseOrder && !isBackfill ? '. Expenses automatically linked.' : '.'}`
        );
      } else {
        enhancedToast.success(
          `Assets ${isBackfill ? 'Backfill ' : ''}Allocated Successfully`,
          `${isBackfill ? 'Backfill allocated' : 'Allocated'} ${newlyAllocated} ${productName} asset${newlyAllocated > 1 ? 's' : ''}${isBackfill ? ' to catch up with sold inventory' : ''}${isPurchaseOrder && !isBackfill ? '. Expenses automatically linked.' : '.'}`
        );
      }
    },
    onError: (error) => {
      console.error("Create allocation error:", error);

      // Provide more specific error messages based on the error
      const errorMessage = error.message || error.toString();

      if (errorMessage.includes('already allocated')) {
        enhancedToast.error("Allocation Failed", errorMessage);
      } else if (errorMessage.includes('not available')) {
        enhancedToast.error("Assets Unavailable", errorMessage);
      } else if (errorMessage.includes('not found')) {
        enhancedToast.error("Assets Not Found", errorMessage);
      } else if (errorMessage.includes('violates')) {
        enhancedToast.error("Database Constraint Error", "The allocation conflicts with existing data. Please refresh and try again.");
      } else {
        enhancedToast.error("Allocation Failed", `Unable to allocate assets: ${errorMessage}`);
      }
    },
  });
};

export const useReleaseAllocation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (allocationIds: string[]) => {
      // Step 1: Get allocation and asset details before releasing
      const { data: allocationsToRelease, error: fetchError } = await supabase
        .from("allocations")
        .select("id, asset_id, status, product_id")
        .in("id", allocationIds)
        .in("status", ["allocated", "pre_allocated"]); // Include pre_allocated

      if (fetchError) throw fetchError;

      if (!allocationsToRelease || allocationsToRelease.length === 0) {
        throw new Error("No active allocations found to release");
      }

      // Step 2: Validate assets are still in expected status
      const assetIds = allocationsToRelease.map(a => a.asset_id).filter(Boolean);
      if (assetIds.length > 0) {
        const { data: assets, error: assetError } = await supabase
          .from("asset_management")
          .select("id, status, asset_tag")
          .in("id", assetIds);

        if (assetError) throw assetError;

        // Log warning if assets have unexpected status (but don't block)
        const unexpectedAssets = assets?.filter(a =>
          !['allocated', 'in_transit', 'available'].includes(a.status)
        );

        if (unexpectedAssets && unexpectedAssets.length > 0) {
          console.warn("⚠️ Some assets have unexpected status:", unexpectedAssets);
        }
      }

      // Step 3: Release the allocations
      const { data, error } = await supabase
        .from("allocations")
        .update({
          status: 'released',
          updated_at: new Date().toISOString()
        })
        .in("id", allocationIds)
        .in("status", ["allocated", "pre_allocated"])
        .select();

      if (error) throw error;

      // Step 4: Explicitly update asset status (with error handling - trigger is backup)
      if (assetIds.length > 0) {
        const { error: assetUpdateError } = await supabase
          .from("asset_management")
          .update({
            status: 'available',
            purchase_order_id: null,
            sold_price: null,
            pricing_notes: 'Allocation released',
            updated_at: new Date().toISOString()
          })
          .in("id", assetIds);

        if (assetUpdateError) {
          console.error("❌ Failed to update asset status:", assetUpdateError);
          console.log("✅ Database trigger will handle asset status reset as fallback");
          // Don't throw - database trigger provides backup
        }
      }

      return data;
    },
    onSuccess: (data) => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ["allocations"] });
      queryClient.invalidateQueries({ queryKey: ["available-assets"] });
      queryClient.invalidateQueries({ queryKey: ["available-assets-preallocation"] });
      queryClient.invalidateQueries({ queryKey: ["available-assets-by-category-preallocation"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-health"] });
      queryClient.invalidateQueries({ queryKey: ["asset-management"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-order-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["allocation-verification"] });
      queryClient.invalidateQueries({ queryKey: ["allocation-stats"] });

      enhancedToast.success(
        "Allocations Released",
        `Released ${data.length} allocation${data.length > 1 ? 's' : ''}. Assets are now available.`
      );
    },
    onError: (error) => {
      console.error("❌ Release allocation error:", error);
      enhancedToast.error("Error", `Failed to release allocations: ${error.message}`);
    },
  });
};