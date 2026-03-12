import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { enhancedToast } from "@/components/ui/enhanced-toast";
import { useDataEnvironment } from "@/hooks/useSandbox";

export const useAvailablePurchaseOrders = (productId: string) => {
  const dataEnvironment = useDataEnvironment();
  
  return useQuery({
    queryKey: ["available-purchase-orders", productId, dataEnvironment],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select(`
          id,
          ticket_number,
          receipt_number,
          quantity,
          order_status,
          pickup_date,
          total_amount,
          purchase_date,
          customer:customers!purchases_customer_id_fkey(name)
        `)
        .eq("product_id", productId)
        .eq("data_environment", dataEnvironment)
        .is("pickup_date", null) // Only orders not picked up yet
        .in("order_status", ["ordered", "processing", "in_transit", "received_units", "configuring", "ready_for_pickup_delivery"])
        .order("purchase_date", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!productId,
  });
};

export const useAllocateAssetToPurchase = () => {
  const queryClient = useQueryClient();
  const dataEnvironment = useDataEnvironment();
  
  return useMutation({
    mutationFn: async ({ 
      assetId, 
      purchaseOrderId, 
      productId,
      notes,
      parentBundleId // Optional: if allocating for a bundle component
    }: { 
      assetId: string; 
      purchaseOrderId: string; 
      productId: string;
      notes?: string;
      parentBundleId?: string;
    }) => {
      // Create allocation with bundle tracking
      const { data: allocation, error: allocError } = await supabase
        .from("allocations")
        .insert({
          asset_id: assetId,
          purchase_order_id: purchaseOrderId,
          product_id: productId,
          parent_bundle_id: parentBundleId || null, // Track bundle attribution
          status: 'allocated',
          notes: notes || `Manual allocation from asset profile`,
          data_environment: dataEnvironment
        })
        .select()
        .single();
      
      if (allocError) {
        if (allocError.code === '23505') {
          throw new Error(`Asset is already allocated to another order`);
        } else if (allocError.code === '23503') {
          throw new Error(`Asset not found or invalid purchase order`);
        }
        throw new Error(`Allocation failed: ${allocError.message}`);
      }
      
      // Get purchase order details for pricing
      const { data: purchaseOrder, error: orderError } = await supabase
        .from("purchases")
        .select("total_amount, quantity")
        .eq("id", purchaseOrderId)
        .single();
      
      if (orderError) throw orderError;
      
      // Update asset status and pricing - handle both 'available' and 'instock' statuses
      const pricePerAsset = purchaseOrder.total_amount / purchaseOrder.quantity;
      
      const { error: assetUpdateError } = await supabase
        .from("asset_management")
        .update({
          status: 'allocated',
          sold_price: pricePerAsset,
          pricing_notes: 'Manually allocated from asset profile',
          purchase_order_id: purchaseOrderId
        })
        .eq("id", assetId)
        .in("status", ["available", "instock"]); // Only update if asset is in these states
      
      if (assetUpdateError) {
        // If asset update fails, we should rollback the allocation
        await supabase
          .from("allocations")
          .delete()
          .eq("id", allocation.id);
        
        throw new Error(`Failed to update asset status: ${assetUpdateError.message}. Asset may already be allocated.`);
      }
      
      return allocation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-management"] });
      queryClient.invalidateQueries({ queryKey: ["all-assets"] });
      queryClient.invalidateQueries({ queryKey: ["allocations"] });
      queryClient.invalidateQueries({ queryKey: ["available-assets"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      
      enhancedToast.success("Asset Allocated", "Asset has been successfully allocated to the purchase order.");
    },
    onError: (error) => {
      console.error("Asset allocation error:", error);
      
      // Provide specific error message based on error type
      const errorMessage = error.message || error.toString();
      
      if (errorMessage.includes('already allocated')) {
        enhancedToast.error("Asset Already Allocated", errorMessage);
      } else if (errorMessage.includes('not found')) {
        enhancedToast.error("Asset Not Found", errorMessage);
      } else if (errorMessage.includes('Failed to update asset status')) {
        enhancedToast.error("Asset Status Error", errorMessage);
      } else {
        enhancedToast.error("Allocation Failed", errorMessage);
      }
    },
  });
};

export const useReleaseAssetAllocation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (assetId: string) => {
      // Get current allocation
      const { data: allocation, error: allocError } = await supabase
        .from("allocations")
        .select("id")
        .eq("asset_id", assetId)
        .eq("status", "allocated")
        .maybeSingle();
      
      if (allocError) throw allocError;
      
      if (allocation) {
        // Release allocation
        const { error: releaseError } = await supabase
          .from("allocations")
          .update({ status: 'released' })
          .eq("id", allocation.id);
        
        if (releaseError) throw releaseError;
      }
      
      // Update asset status back to available
      const { error: assetUpdateError } = await supabase
        .from("asset_management")
        .update({
          status: 'available',
          sold_price: null,
          pricing_notes: null,
          purchase_order_id: null
        })
        .eq("id", assetId);
      
      if (assetUpdateError) throw assetUpdateError;
      
      return { released: !!allocation };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["asset-management"] });
      queryClient.invalidateQueries({ queryKey: ["all-assets"] });
      queryClient.invalidateQueries({ queryKey: ["allocations"] });
      queryClient.invalidateQueries({ queryKey: ["available-assets"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      
      enhancedToast.success("Allocation Released", result.released 
        ? "Asset allocation has been released and asset is now available." 
        : "Asset was not allocated to any purchase order.");
    },
    onError: (error) => {
      enhancedToast.error("Release Failed", error.message || "Failed to release asset allocation.");
    },
  });
};