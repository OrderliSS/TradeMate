import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserRoles } from "@/hooks/useUserRoles";

interface NuclearResetProgress {
  phase: 'analyzing' | 'deleting' | 'creating' | 'allocating' | 'complete' | 'error';
  message: string;
  progress: number;
  details?: {
    productsAnalyzed?: number;
    assetsDeleted?: number;
    assetsCreated?: number;
    ordersAllocated?: number;
    errors?: string[];
  };
}

interface NuclearResetResult {
  success: boolean;
  productsProcessed: number;
  assetsDeleted: number;
  assetsCreated: number;
  ordersAllocated: number;
  errors: string[];
  duration: number;
}

interface NuclearResetOptions {
  targetProductIds?: string[];
  autoAllocateToOrders?: boolean;
  onProgress?: (progress: NuclearResetProgress) => void;
}

export const useNuclearAssetReset = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAdmin } = useUserRoles();

  return useMutation({
    mutationFn: async (options: NuclearResetOptions = {}): Promise<NuclearResetResult> => {
      const startTime = Date.now();
      const { targetProductIds, autoAllocateToOrders = true, onProgress } = options;
      
      const result: NuclearResetResult = {
        success: false,
        productsProcessed: 0,
        assetsDeleted: 0,
        assetsCreated: 0,
        ordersAllocated: 0,
        errors: [],
        duration: 0
      };

      try {
        // Phase 1: Authorization Check
        onProgress?.({
          phase: 'analyzing',
          message: 'Verifying admin permissions...',
          progress: 5
        });

        if (!isAdmin) {
          throw new Error('Nuclear reset requires admin privileges');
        }

        // Phase 2: Analysis
        onProgress?.({
          phase: 'analyzing',
          message: 'Analyzing system-wide asset discrepancies...',
          progress: 10
        });

        // Get products with discrepancies
        const { data: products, error: productsError } = await supabase
          .from('products')
          .select('id, name, sku, stock_quantity')
          .eq('status', 'active');

        if (productsError) throw productsError;

        const { data: allAssets, error: assetsError } = await supabase
          .from('asset_management')
          .select('id, product_id, status');

        if (assetsError) throw assetsError;

        // Filter products with discrepancies or use targeted products
        const productsToProcess = products.filter(product => {
          if (targetProductIds && !targetProductIds.includes(product.id)) {
            return false;
          }
          
          const productAssets = allAssets.filter(asset => asset.product_id === product.id);
          const activeAssets = productAssets.filter(asset => 
            ['available', 'allocated', 'instock'].includes(asset.status)
          ).length;
          
          return Math.abs((product.stock_quantity || 0) - activeAssets) > 0;
        });

        onProgress?.({
          phase: 'analyzing',
          message: `Found ${productsToProcess.length} products requiring reset`,
          progress: 15,
          details: { productsAnalyzed: productsToProcess.length }
        });

        if (productsToProcess.length === 0) {
          result.success = true;
          result.duration = Date.now() - startTime;
          return result;
        }

        // Phase 3: Deletion
        onProgress?.({
          phase: 'deleting',
          message: 'Nuclear deletion of existing assets...',
          progress: 20
        });

        let totalDeleted = 0;
        for (const product of productsToProcess) {
          // Delete allocations first to maintain referential integrity
          const { error: allocError } = await supabase
            .from('allocations')
            .delete()
            .eq('product_id', product.id);

          if (allocError) {
            result.errors.push(`Failed to delete allocations for ${product.name}: ${allocError.message}`);
            continue;
          }

          // Delete all assets for this product
          const { data: deletedAssets, error: deleteError } = await supabase
            .from('asset_management')
            .delete()
            .eq('product_id', product.id)
            .select('id');

          if (deleteError) {
            result.errors.push(`Failed to delete assets for ${product.name}: ${deleteError.message}`);
            continue;
          }

          totalDeleted += deletedAssets?.length || 0;
          result.productsProcessed++;
          
          onProgress?.({
            phase: 'deleting',
            message: `Deleted ${totalDeleted} assets from ${result.productsProcessed}/${productsToProcess.length} products`,
            progress: 20 + (result.productsProcessed / productsToProcess.length) * 20,
            details: { assetsDeleted: totalDeleted }
          });
        }

        result.assetsDeleted = totalDeleted;

        // Phase 4: Recreation
        onProgress?.({
          phase: 'creating',
          message: 'Recreating assets from stock quantities...',
          progress: 40
        });

        let totalCreated = 0;
        for (let i = 0; i < productsToProcess.length; i++) {
          const product = productsToProcess[i];
          const stockQuantity = product.stock_quantity || 0;
          
          if (stockQuantity <= 0) continue;

          // Create assets in batches of 10 to avoid overwhelming the system
          const batchSize = 10;
          let created = 0;
          
          for (let batch = 0; batch < Math.ceil(stockQuantity / batchSize); batch++) {
            const batchStart = batch * batchSize;
            const batchEnd = Math.min(batchStart + batchSize, stockQuantity);
            const batchAssets = [];

            for (let j = batchStart; j < batchEnd; j++) {
              try {
                const { data: tag, error: tagError } = await supabase.rpc('generate_asset_tag', { prefix: 'AST' });
                if (tagError) throw tagError;

                batchAssets.push({
                  product_id: product.id,
                  asset_tag: tag,
                  status: 'available',
                  transit_status: 'available',
                  location: 'Warehouse',
                  notes: 'Nuclear reset auto-generated'
                });
              } catch (error) {
                result.errors.push(`Failed to generate tag for ${product.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
              }
            }

            if (batchAssets.length > 0) {
              const { data: createdAssets, error: createError } = await supabase
                .from('asset_management')
                .insert(batchAssets)
                .select('id');

              if (createError) {
                result.errors.push(`Failed to create batch for ${product.name}: ${createError.message}`);
              } else {
                created += createdAssets?.length || 0;
              }
            }

            // Small delay between batches
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          totalCreated += created;
          
          onProgress?.({
            phase: 'creating',
            message: `Created ${totalCreated} assets for ${i + 1}/${productsToProcess.length} products`,
            progress: 40 + ((i + 1) / productsToProcess.length) * 30,
            details: { assetsCreated: totalCreated }
          });
        }

        result.assetsCreated = totalCreated;

        // Phase 5: Auto-allocation (if enabled)
        if (autoAllocateToOrders) {
          onProgress?.({
            phase: 'allocating',
            message: 'Auto-allocating to pending orders...',
            progress: 70
          });

          // Get pending purchase orders
          const { data: pendingOrders, error: ordersError } = await supabase
            .from('purchases')
            .select('id, product_id, quantity, customer_id')
            .is('pickup_date', null)
            .in('order_status', ['processing', 'ready_for_pickup_delivery']);

          if (ordersError) {
            result.errors.push(`Failed to fetch pending orders: ${ordersError.message}`);
          } else {
            let allocatedOrders = 0;
            
            for (const order of pendingOrders) {
              try {
                // Get available assets for this product
                const { data: availableAssets, error: assetsError } = await supabase
                  .from('asset_management')
                  .select('id')
                  .eq('product_id', order.product_id)
                  .eq('status', 'available')
                  .limit(order.quantity);

                if (assetsError) throw assetsError;

                if (availableAssets && availableAssets.length >= order.quantity) {
                  // Create allocations
                  const allocations = availableAssets.slice(0, order.quantity).map(asset => ({
                    asset_id: asset.id,
                    product_id: order.product_id,
                    purchase_order_id: order.id,
                    status: 'allocated'
                  }));

                  const { error: allocError } = await supabase
                    .from('allocations')
                    .insert(allocations);

                  if (allocError) throw allocError;

                  // Update asset statuses
                  const { error: updateError } = await supabase
                    .from('asset_management')
                    .update({ status: 'allocated' })
                    .in('id', availableAssets.slice(0, order.quantity).map(a => a.id));

                  if (updateError) throw updateError;

                  allocatedOrders++;
                }
              } catch (error) {
                result.errors.push(`Failed to allocate order ${order.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
              }
            }

            result.ordersAllocated = allocatedOrders;
          }
        }

        // Phase 6: Complete
        onProgress?.({
          phase: 'complete',
          message: 'Nuclear reset completed successfully',
          progress: 100,
          details: {
            productsAnalyzed: productsToProcess.length,
            assetsDeleted: result.assetsDeleted,
            assetsCreated: result.assetsCreated,
            ordersAllocated: result.ordersAllocated,
            errors: result.errors
          }
        });

        result.success = true;
        result.duration = Date.now() - startTime;
        return result;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(errorMessage);
        result.duration = Date.now() - startTime;
        
        onProgress?.({
          phase: 'error',
          message: `Nuclear reset failed: ${errorMessage}`,
          progress: 0,
          details: { errors: result.errors }
        });

        throw error;
      }
    },
    onSuccess: async (result) => {
      // Aggressively invalidate all related queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["asset-management"] }),
        queryClient.invalidateQueries({ queryKey: ["all-assets"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["unified-inventory-balance"] }),
        queryClient.invalidateQueries({ queryKey: ["allocations"] }),
        queryClient.invalidateQueries({ queryKey: ["purchases"] }),
        queryClient.invalidateQueries({ queryKey: ["unified-inventory"] })
      ]);

      // Force immediate refetch
      queryClient.refetchQueries({ queryKey: ["all-assets"] });
      queryClient.refetchQueries({ queryKey: ["asset-management"] });

      toast({
        title: "Nuclear Reset Complete",
        description: `Processed ${result.productsProcessed} products, deleted ${result.assetsDeleted} assets, created ${result.assetsCreated} assets, allocated ${result.ordersAllocated} orders in ${(result.duration / 1000).toFixed(1)}s`,
      });
    },
    onError: (error) => {
      toast({
        title: "Nuclear Reset Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};