import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { enhancedToast } from "@/components/ui/enhanced-toast";

export interface CompanySettings {
  id: string;
  company_name: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  abn_tax_id?: string;
  phone?: string;
  email?: string;
  website?: string;
  logo_url?: string;
  // Payment details
  bank_name?: string;
  bsb?: string;
  account_number?: string;
  account_name?: string;
  payid?: string;
  bpay_biller_code?: string;
  bpay_reference?: string;
  payment_instructions?: string;
  // Social media
  social_facebook?: string;
  social_instagram?: string;
  social_linkedin?: string;
  created_at: string;
  updated_at: string;
}

export const useCompanySettings = () => {
  return useQuery({
    queryKey: ["company-settings"],
    queryFn: async (): Promise<CompanySettings | null> => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });
};

export const useUpdateCompanySettings = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (updates: Partial<CompanySettings>) => {
      // Get current settings to update or insert
      const { data: existing } = await supabase
        .from("company_settings")
        .select("id")
        .maybeSingle();

      if (existing) {
        // Update existing
        const { data, error } = await supabase
          .from("company_settings")
          .update(updates)
          .eq("id", existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from("company_settings")
          .insert([updates])
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
      enhancedToast.success("Company settings updated successfully");
    },
    onError: (error: any) => {
      enhancedToast.error(`Failed to update settings: ${error.message}`);
    },
  });
};