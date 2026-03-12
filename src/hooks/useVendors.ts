import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentEnvironment } from "@/lib/environment-utils";
import { useCurrentOrganizationId } from "./useOrganization";

export const useVendorStats = () => {
  const organizationId = useCurrentOrganizationId();
  
  return useQuery({
    queryKey: ["vendor-stats", getCurrentEnvironment(), organizationId],
    queryFn: async () => {
      if (!organizationId) {
        return {
          totalVendors: 0,
          activeVendors: 0,
          totalShops: 0,
          activeShops: 0,
          totalVendorSpending: 0,
          vendors: [],
          hasStockOrderData: false
        };
      }

      const { data: shops, error } = await supabase
        .from("vendor_shops")
        .select("id, shop_name, platforms, primary_category")
        .eq("organization_id", organizationId);

      if (error) throw error;

      const totalShops = shops?.length || 0;
      const activeShops = totalShops;

      return {
        totalVendors: totalShops,
        activeVendors: totalShops,
        totalShops,
        activeShops,
        totalVendorSpending: 0,
        vendors: shops || [],
        hasStockOrderData: false
      };
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useVendors = (withExpenseData?: boolean) => {
  const organizationId = useCurrentOrganizationId();
  
  return useQuery({
    queryKey: ["vendors", withExpenseData, getCurrentEnvironment(), organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      
      const { data: shops, error } = await supabase
        .from("vendor_shops")
        .select("id, shop_name, platforms, primary_category, notes, business_license_path, store_id, location_city, location_state, location_country, opened_since, website_url, distribution_centre, created_at, updated_at")
        .eq("organization_id", organizationId)
        .order("shop_name");

      if (error) throw error;

      // Transform vendor_shops data to the format expected by the Vendors page
      return shops?.map(shop => ({
        id: shop.id,
        shop_name: shop.shop_name,
        platform: shop.platforms?.[0] || "Unknown",
        platforms: shop.platforms || [],
        primary_category: shop.primary_category || "General",
        notes: shop.notes,
        business_license_path: shop.business_license_path,
        store_id: shop.store_id,
        location_city: shop.location_city,
        location_state: shop.location_state,
        location_country: shop.location_country,
        opened_since: shop.opened_since,
        website_url: shop.website_url,
        distribution_centre: shop.distribution_centre,
        created_at: shop.created_at,
        updated_at: shop.updated_at,
        // Expense data placeholders
        total_orders: 0,
        average_order_value: 0,
        total_spent: 0,
        total_amount: 0,
        last_purchase_date: null
      })) || [];
    }
  });
};

export const useVendorCategories = () => {
  const organizationId = useCurrentOrganizationId();
  return useQuery({
    queryKey: ["vendor-categories", getCurrentEnvironment(), organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data: shops, error } = await supabase
        .from("vendor_shops")
        .select("primary_category")
        .eq("organization_id", organizationId)
        .order("primary_category");

      if (error) throw error;

      // Extract unique categories
      const categories = [...new Set(
        shops?.map(shop => shop.primary_category).filter(Boolean) || []
      )];

      return categories;
    }
  });
};