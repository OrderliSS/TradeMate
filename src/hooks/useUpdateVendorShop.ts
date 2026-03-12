import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCurrentOrganizationId } from "./useOrganization";

interface UpdateVendorShopData {
  id: string;
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
const sanitizeShopData = (data: Omit<UpdateVendorShopData, 'id'>) => {
  return {
    ...data,
    opened_since: data.opened_since === '' ? null : data.opened_since,
  };
};

export const useUpdateVendorShop = () => {
  const queryClient = useQueryClient();
  const organizationId = useCurrentOrganizationId();

  return useMutation({
    mutationFn: async (shopData: UpdateVendorShopData) => {
      const { id, ...updateData } = shopData;
      const sanitizedData = sanitizeShopData(updateData);

      console.log("Updating vendor shop:", { id, sanitizedData });

      const { data, error } = await supabase
        .from("vendor_shops")
        .update(sanitizedData)
        .eq("id", id)
        .eq("organization_id", organizationId)
        .select()
        .single();

      if (error) {
        console.error("Supabase error details:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      console.log("Shop updated successfully:", data);
      return data;
    },
    onSuccess: (data) => {
      console.log("Update mutation succeeded:", data);
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["vendor-stores"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-shops"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-stats"] });
      queryClient.invalidateQueries({ queryKey: ["shop-detail"] });
      // Also invalidate the shop info query used by ShopDetail page
      queryClient.invalidateQueries({ queryKey: ["vendor-shop-info"] });

      toast.success("Shop updated successfully");
    },
    onError: (error: any) => {
      console.error("Update mutation failed:", error);

      let errorMessage = "Failed to update shop";
      if (error?.message) {
        errorMessage = `Update failed: ${error.message}`;
      }

      toast.error(errorMessage);
    },
  });
};