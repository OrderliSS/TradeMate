import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { enhancedToast } from "@/components/ui/enhanced-toast";
import { AssetManagement } from "@/hooks/useAssetManagement";
import { detectAssetCategory } from "@/lib/asset-categories";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useDataEnvironment } from "@/hooks/useSandbox";

interface BulkAssetData {
  productId: string;
  quantity: number;
  serialNumberPrefix?: string;
  warrantyStartDate?: string;
  warrantyEndDate?: string;
  location?: string;
  assignedTo?: string;
  notes?: string;
}

interface AssetCreationResult {
  success: boolean;
  created: number;
  failed: number;
  errors: string[];
  assetTags: string[];
}

export const useBulkCreateAssets = () => {
  const queryClient = useQueryClient();
  const { isAdmin, isSecurity } = useUserRoles();
  const dataEnvironment = useDataEnvironment();

  return useMutation({
    mutationFn: async (data: BulkAssetData): Promise<AssetCreationResult> => {
      const { productId, quantity, serialNumberPrefix, warrantyStartDate, warrantyEndDate, location, assignedTo, notes } = data;
      
      // Check user permissions using user_roles table
      if (!isAdmin && !isSecurity) {
        console.error('useBulkCreateAssets: Insufficient permissions', { isAdmin, isSecurity });
        throw new Error('You need admin or security role to create assets');
      }
      
      
      
      const result: AssetCreationResult = {
        success: false,
        created: 0,
        failed: 0,
        errors: [],
        assetTags: []
      };

      try {
        // Get product details first - including requires_configuration flag
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('*')
          .eq('id', productId)
          .single();

        if (productError) {
          console.error('useBulkCreateAssets: Failed to fetch product details', productError);
          throw new Error(`Failed to fetch product details: ${productError.message}`);
        }

        // Check if product requires configuration (streaming devices, etc.)
        const requiresConfig = product.requires_configuration === true;

        console.log('useBulkCreateAssets: Product details fetched', { 
          product: product.name,
          requiresConfig
        });

        // Simplified asset creation - always create individual units
        const assetTagPrefix = 'AST';
        const assetCategory = detectAssetCategory(product);
        
        console.log('useBulkCreateAssets: Asset creation strategy', {
          assetTagPrefix,
          assetCategory,
          quantityToCreate: quantity
        });

        // Create assets sequentially to avoid race conditions
        // Each asset creation generates its own tag and inserts immediately
        for (let i = 0; i < quantity; i++) {
          let attempts = 0;
          const maxAttempts = 5;
          let assetCreated = false;

          while (attempts < maxAttempts && !assetCreated) {
            attempts++;
            
            try {
              // Add exponential backoff delay between attempts
              if (attempts > 1) {
                const delay = Math.min(200 * Math.pow(2, attempts - 1), 2000); // Max 2 second delay
                await new Promise(resolve => setTimeout(resolve, delay));
              }
              
              
              
              // Generate tag with appropriate prefix for product type
              const { data: tag, error: tagError } = await supabase.rpc('generate_asset_tag', { prefix: assetTagPrefix });
              
              if (tagError) {
                console.error(`useBulkCreateAssets: Failed to generate asset tag ${i + 1}, attempt ${attempts}`, tagError);
                continue;
              }

              
              
                // Prepare asset data
                // For config-required products (streaming devices): use 'instock' status (needs config before ready)
                // For other products: use 'available' status (ready for allocation)
                const supplierInfo = product.supplier_info as any;
                const initialStatus = requiresConfig ? 'instock' : 'available';
                
                const assetData: Record<string, unknown> = {
                  product_id: productId,
                  asset_tag: tag,
                  category: assetCategory, // Use pre-determined category for product type
                  serial_number: serialNumberPrefix 
                    ? `${serialNumberPrefix}-${String(i + 1).padStart(3, '0')}`
                    : null,
                  manufacturer: supplierInfo?.manufacturer || null,
                  model_number: product.sku || null,
                  location: location || 'Warehouse',
                  // Config-required products start as 'instock' (needs config), others as 'available'
                  status: initialStatus,
                  asset_type: 'unit',
                  parent_asset_id: null,
                  warranty_start_date: warrantyStartDate || null,
                  warranty_end_date: warrantyEndDate || null,
                  assigned_to: assignedTo || null,
                  notes: notes || `Asset created for stock backfill${requiresConfig ? ' (config pending)' : ''}${notes ? ` - ${notes}` : ''}`,
                  data_environment: dataEnvironment,
                };
                
                // Only set transit_status for non-config products (config products don't have transit status until configured)
                if (!requiresConfig) {
                  assetData.transit_status = 'available';
                }

              // Create asset immediately
              const { data: createdAsset, error: insertError } = await supabase
                .from('asset_management')
                .insert(assetData)
                .select()
                .single();

              if (insertError) {
                console.error(`useBulkCreateAssets: Failed to create asset ${tag}`, insertError);
                
                // If duplicate key error and we have more attempts, retry
                if (insertError.code === '23505' && attempts < maxAttempts) {
                  
                  continue;
                }
                
                result.errors.push(`Failed to create asset ${tag}: ${insertError.message}`);
                result.failed++;
                break;
              } else {
                console.log(`useBulkCreateAssets: Successfully created asset`, { 
                  id: createdAsset.id, 
                  asset_tag: createdAsset.asset_tag 
                });
                result.created++;
                result.assetTags.push(tag);
                assetCreated = true;
              }
              
            } catch (error) {
              console.error(`useBulkCreateAssets: Exception creating asset ${i + 1}, attempt ${attempts}`, error);
              if (attempts === maxAttempts) {
                result.errors.push(`Exception creating asset ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                result.failed++;
              }
            }
          }
          
          // Add small delay between each asset creation to prevent overwhelming the DB
          if (i < quantity - 1) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }

        result.success = result.created > 0;
        console.log('useBulkCreateAssets: Bulk creation completed', { 
          created: result.created, 
          failed: result.failed, 
          success: result.success 
        });
        
        return result;

      } catch (error) {
        console.error('useBulkCreateAssets: Fatal error during bulk creation', error);
        result.errors.push(error instanceof Error ? error.message : 'Unknown error occurred');
        result.failed = quantity;
        return result;
      }
    },
    onSuccess: async (result) => {
      
      
      // Force refresh all asset-related data with aggressive cache clearing
      
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["asset-management"] }),
        queryClient.invalidateQueries({ queryKey: ["all-assets"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["unified-inventory-balance"] }),
        queryClient.invalidateQueries({ queryKey: ["unified-inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["asset-metrics"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory-availability"] }),
        queryClient.invalidateQueries({ queryKey: ["unified-asset-metrics"] }),
        queryClient.invalidateQueries({ queryKey: ["purchase-asset-status"] }),
      ]);
      
      // Force immediate refetch of critical queries
      queryClient.refetchQueries({ queryKey: ["all-assets"] });
      queryClient.refetchQueries({ queryKey: ["asset-management"] });
      
      
      
      if (result.success) {
        if (result.failed === 0) {
          enhancedToast.success("Assets created successfully", `Created ${result.created} asset records with tags: ${result.assetTags.join(', ')}`);
        } else {
          enhancedToast.error("Partial success", `Created ${result.created} assets. ${result.failed} failed. Check console for details.`);
          console.warn('useBulkCreateAssets: Partial success errors:', result.errors);
        }
      } else {
        enhancedToast.error("Failed to create assets", `${result.errors[0] || "Unknown error occurred"}. Check console for details.`);
        console.error('useBulkCreateAssets: All asset creation failed:', result.errors);
      }
    },
    onError: (error) => {
      console.error('useBulkCreateAssets: Mutation error', error);
      enhancedToast.error("Error creating assets", `${error.message}. Check console for details.`);
    },
  });
};

// Hook to backfill missing asset records for existing stock
export const useBackfillAssets = () => {
  const queryClient = useQueryClient();
  const dataEnvironment = useDataEnvironment();

  return useMutation({
    mutationFn: async (productId: string) => {
      console.log('useBackfillAssets: Starting backfill for product', productId);
      
      // Get product and existing active assets - count instock, available, and allocated
      const [productResult, assetsResult] = await Promise.all([
        supabase.from('products').select('*').eq('id', productId).single(),
        supabase.from('asset_management')
          .select('id')
          .eq('product_id', productId)
          .in('status', ['instock', 'available', 'ready', 'allocated']) // Count all physical on-hand assets
      ]);

      if (productResult.error) throw productResult.error;
      if (assetsResult.error) throw assetsResult.error;

      const product = productResult.data;
      const requiresConfig = product.requires_configuration === true;
      const existingActiveAssetCount = assetsResult.data?.length || 0;
      const expectedAssets = product.stock_quantity; // Always use stock_quantity as individual units
      const missingAssets = expectedAssets - existingActiveAssetCount;

      console.log('useBackfillAssets: Asset analysis', { 
        existing: existingActiveAssetCount, 
        expected: expectedAssets, 
        missing: missingAssets,
        requiresConfig
      });

      if (missingAssets <= 0) {
        return { created: 0, message: 'No missing assets to create' };
      }

      // Create assets one by one with proper sequencing and retry logic
      let createdCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < missingAssets; i++) {
        let attempts = 0;
        const maxAttempts = 3;
        let assetCreated = false;

        while (attempts < maxAttempts && !assetCreated) {
          attempts++;
          
          try {
            console.log(`useBackfillAssets: Creating asset ${i + 1}/${missingAssets}, attempt ${attempts}`);
            
            // Generate asset tag with delay to prevent race conditions
            if (attempts > 1) {
              await new Promise(resolve => setTimeout(resolve, 100 * attempts)); // Exponential backoff
            }
            
            const { data: tag, error: tagError } = await supabase.rpc('generate_asset_tag', { prefix: 'AST' });
            
            if (tagError) {
              console.error(`useBackfillAssets: Tag generation failed, attempt ${attempts}`, tagError);
              if (attempts === maxAttempts) {
                errors.push(`Failed to generate tag for asset ${i + 1}: ${tagError.message}`);
              }
              continue;
            }

            console.log(`useBackfillAssets: Generated tag ${tag} for asset ${i + 1}`);

            // Create the asset record
            // Config-required products start as 'instock' (needs config), others as 'available'
            const initialStatus = requiresConfig ? 'instock' : 'available';
            
            const insertData: Record<string, unknown> = {
              product_id: productId,
              asset_tag: tag,
              location: 'Warehouse',
              status: initialStatus,
              notes: `Backfilled missing asset record${requiresConfig ? ' (config pending)' : ''}`,
              data_environment: dataEnvironment,
            };
            
            if (!requiresConfig) {
              insertData.transit_status = 'available';
            }
            
            const { error: insertError } = await supabase
              .from('asset_management')
              .insert(insertData);

            if (insertError) {
              console.error(`useBackfillAssets: Asset creation failed, attempt ${attempts}`, insertError);
              
              // If it's a duplicate key error, retry with a new tag
              if (insertError.code === '23505' && attempts < maxAttempts) {
                console.log('useBackfillAssets: Duplicate key detected, retrying with new tag');
                continue;
              } else {
                errors.push(`Failed to create asset ${i + 1}: ${insertError.message}`);
                break;
              }
            } else {
              console.log(`useBackfillAssets: Successfully created asset with tag ${tag}`);
              createdCount++;
              assetCreated = true;
            }
            
          } catch (error) {
            console.error(`useBackfillAssets: Exception during asset creation, attempt ${attempts}`, error);
            if (attempts === maxAttempts) {
              errors.push(`Exception creating asset ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }
        }
      }

      const result = { 
        created: createdCount, 
        message: createdCount > 0 
          ? `Successfully created ${createdCount} of ${missingAssets} missing asset records${errors.length > 0 ? ` (${errors.length} failed)` : ''}` 
          : 'No assets could be created',
        errors
      };

      console.log('useBackfillAssets: Backfill completed', result);
      
      if (createdCount === 0 && errors.length > 0) {
        throw new Error(`Failed to create any assets: ${errors.join(', ')}`);
      }

      return result;
    },
    onSuccess: async (result) => {
      console.log('useBackfillAssets: Success callback triggered', result);
      
      // Aggressively invalidate all asset-related queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["asset-management"] }),
        queryClient.invalidateQueries({ queryKey: ["all-assets"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["unified-inventory-balance"] }),
        queryClient.invalidateQueries({ queryKey: ["unified-inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["asset-metrics"] })
      ]);
      
      // Force immediate refetch
      queryClient.refetchQueries({ queryKey: ["all-assets"] });
      console.log('useBackfillAssets: Forced asset queries to refetch');
      
      enhancedToast.success("Assets backfilled successfully", `${result.message}. The asset list should refresh momentarily.`);
    },
    onError: (error) => {
      enhancedToast.error("Error backfilling assets", error.message);
    },
  });
};