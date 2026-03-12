import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCurrentOrganizationId } from "./useOrganization";

interface CreateVendorShopData {
  shop_name: string;
  platforms?: string[];
  primary_category?: string;
  notes?: string;
  business_license_path?: string;
  store_id?: string;
  location_city?: string;
  location_state?: string;
  location_country?: string;
  opened_since?: string;
  website_url?: string;
  distribution_centre?: string;
}

// Helper function to sanitize form data
const sanitizeShopData = (data: CreateVendorShopData) => {
  return {
    ...data,
    opened_since: data.opened_since === '' ? null : data.opened_since,
  };
};

export const useCreateVendorShop = () => {
  const queryClient = useQueryClient();
  const organizationId = useCurrentOrganizationId();

  return useMutation({
    mutationFn: async (shopData: CreateVendorShopData) => {
      if (!organizationId) throw new Error("Organization ID is required to create a shop");
      const sanitizedData = {
        ...sanitizeShopData(shopData),
        organization_id: organizationId
      };

      const { data, error } = await supabase
        .from("vendor_shops")
        .insert([sanitizedData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["vendor-stores"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-shops"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-stats"] });

      toast.success("Shop created successfully");
    },
    onError: (error) => {
      console.error("Error creating shop:", error);
      toast.error("Failed to create shop");
    },
  });
};