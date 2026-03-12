import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentEnvironment } from "@/lib/environment-utils";
import { useCurrentOrganizationId } from "./useOrganization";

export const useVendorStores = () => {
  const organizationId = useCurrentOrganizationId();
  return useQuery({
    queryKey: ["vendor-stores", getCurrentEnvironment(), organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("vendor_shops")
        .select("*")
        .eq("organization_id", organizationId)
        .order("shop_name");

      if (error) throw error;
      return data || [];
    }
  });
};