import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface VendorHistory {
  vendor: string;
  vendor_store_name: string | null;
  count: number;
}

interface ProductAutoFillData {
  suggestedVendor: string | null;
  suggestedStoreName: string | null;
  averageQuantity: number | null;
  recentStores: Array<{ name: string; platform: string; usageCount: number }>;
  supplierInfo: Record<string, any> | null;
}

// Product category to stock order category/subcategory mapping
export const PRODUCT_TO_STOCK_CATEGORY_MAPPING: Record<string, { category: string; subcategory: string }> = {
  "Streaming Device": { category: "Hardware", subcategory: "TV Streaming Hardware" },
  "Media Player": { category: "Hardware", subcategory: "TV Streaming Hardware" },
  "Battery": { category: "Accessories", subcategory: "Power Supplies" },
  "Cables": { category: "Hardware", subcategory: "Cables" },
  "Adapters": { category: "Hardware", subcategory: "Adapters" },
  "IT Equipment": { category: "Hardware", subcategory: "Equipment" },
  "Remote Controls": { category: "Accessories", subcategory: "Remotes" },
};

/**
 * Hook to get smart auto-fill suggestions for stock order fields
 * Based on product history and previous orders
 */
export const useSmartAutoFill = (productId: string | null) => {
  // Get vendor history for this product
  const vendorHistoryQuery = useQuery({
    queryKey: ["vendor-history", productId],
    queryFn: async (): Promise<VendorHistory[]> => {
      if (!productId) return [];
      
      const { data, error } = await supabase
        .from("stock_orders")
        .select("vendor, vendor_store_name")
        .eq("product_id", productId)
        .not("vendor", "is", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Group and count vendors/stores
      const vendorMap = new Map<string, VendorHistory>();
      data?.forEach(order => {
        const key = `${order.vendor}-${order.vendor_store_name || ''}`;
        const existing = vendorMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          vendorMap.set(key, {
            vendor: order.vendor!,
            vendor_store_name: order.vendor_store_name,
            count: 1
          });
        }
      });

      return Array.from(vendorMap.values()).sort((a, b) => b.count - a.count);
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Get product supplier info
  const productInfoQuery = useQuery({
    queryKey: ["product-supplier-info", productId],
    queryFn: async () => {
      if (!productId) return null;
      
      const { data, error } = await supabase
        .from("products")
        .select("supplier_info, category")
        .eq("id", productId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!productId,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });

  // Get average quantity for this product
  const quantityHistoryQuery = useQuery({
    queryKey: ["quantity-history", productId],
    queryFn: async () => {
      if (!productId) return null;
      
      const { data, error } = await supabase
        .from("stock_orders")
        .select("quantity_needed")
        .eq("product_id", productId)
        .not("quantity_needed", "is", null)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      if (!data || data.length === 0) return null;

      const total = data.reduce((sum, order) => sum + (order.quantity_needed || 0), 0);
      return Math.round(total / data.length);
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
  });

  // Compute auto-fill data
  const autoFillData: ProductAutoFillData = {
    suggestedVendor: null,
    suggestedStoreName: null,
    averageQuantity: quantityHistoryQuery.data || null,
    recentStores: [],
    supplierInfo: null,
  };

  // Get most used vendor/store combination
  if (vendorHistoryQuery.data && vendorHistoryQuery.data.length > 0) {
    const topVendor = vendorHistoryQuery.data[0];
    autoFillData.suggestedVendor = topVendor.vendor;
    autoFillData.suggestedStoreName = topVendor.vendor_store_name;
    
    // Get recent stores with usage count
    autoFillData.recentStores = vendorHistoryQuery.data
      .filter(v => v.vendor_store_name)
      .slice(0, 5)
      .map(v => ({
        name: v.vendor_store_name!,
        platform: v.vendor,
        usageCount: v.count
      }));
  }

  // Extract supplier info from product
  if (productInfoQuery.data?.supplier_info) {
    const supplierInfo = productInfoQuery.data.supplier_info as Record<string, any>;
    autoFillData.supplierInfo = supplierInfo;
    
    // If no vendor history, try to get from supplier info
    if (!autoFillData.suggestedVendor && supplierInfo.preferred_vendor) {
      autoFillData.suggestedVendor = supplierInfo.preferred_vendor;
    }
    if (!autoFillData.suggestedStoreName && supplierInfo.preferred_store) {
      autoFillData.suggestedStoreName = supplierInfo.preferred_store;
    }
  }

  // Get category mapping for auto-fill
  const getCategoryMapping = (productCategory: string | null) => {
    if (!productCategory) return null;
    return PRODUCT_TO_STOCK_CATEGORY_MAPPING[productCategory] || null;
  };

  // Get store suggestions for a specific vendor/platform
  const getStoresForVendor = (vendor: string): string[] => {
    if (!vendorHistoryQuery.data) return [];
    
    return vendorHistoryQuery.data
      .filter(v => v.vendor.toLowerCase() === vendor.toLowerCase() && v.vendor_store_name)
      .map(v => v.vendor_store_name!)
      .slice(0, 10);
  };

  return {
    autoFillData,
    isLoading: vendorHistoryQuery.isLoading || productInfoQuery.isLoading || quantityHistoryQuery.isLoading,
    getCategoryMapping,
    getStoresForVendor,
    productCategory: productInfoQuery.data?.category || null,
  };
};

/**
 * Hook to get store name suggestions based on vendor/platform
 */
export const useStoreNameSuggestions = (vendor: string | null, productId: string | null) => {
  return useQuery({
    queryKey: ["store-suggestions", vendor, productId],
    queryFn: async () => {
      if (!vendor) return [];
      
      // Build query
      let query = supabase
        .from("stock_orders")
        .select("vendor_store_name")
        .eq("vendor", vendor)
        .not("vendor_store_name", "is", null);
      
      // Optionally filter by product
      if (productId) {
        query = query.eq("product_id", productId);
      }
      
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      // Deduplicate store names
      const storeNames = [...new Set(data?.map(d => d.vendor_store_name).filter(Boolean))];
      return storeNames.slice(0, 10) as string[];
    },
    enabled: !!vendor,
    staleTime: 5 * 60 * 1000,
  });
};
