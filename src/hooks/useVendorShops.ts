import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentEnvironment } from "@/lib/environment-utils";
import { useCurrentOrganizationId } from "@/hooks/useOrganization";

export interface VendorShop {
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
  created_at: string;
  updated_at: string;
  organization_id?: string;
}

import { useScopedSupabase } from "@/hooks/useScopedSupabase";

export const useVendorShops = () => {
  const organizationId = useCurrentOrganizationId();
  const scopedSupabase = useScopedSupabase();

  return useQuery({
    queryKey: ["vendor-shops", getCurrentEnvironment(), organizationId],
    queryFn: async (): Promise<VendorShop[]> => {
      if (!organizationId) return [];
      const { data, error } = await scopedSupabase
        .from("vendor_shops")
        .select("*")
        .order("shop_name");

      if (error) throw error;
      return (data || []) as any as VendorShop[];
    },
  });
};