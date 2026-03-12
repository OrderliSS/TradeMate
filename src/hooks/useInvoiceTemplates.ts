import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useDataEnvironment } from './useSandbox';
import { Json } from '@/integrations/supabase/types';

export interface InvoiceTemplateSettings {
  showLogo: boolean;
  showCompanyAddress: boolean;
  showCompanyPhone: boolean;
  showCompanyEmail: boolean;
  showABN: boolean;
  showSKU: boolean;
  showQuantity: boolean;
  showUnitPrice: boolean;
  showDiscount: boolean;
  showTax: boolean;
  showTerms: boolean;
  showNotes: boolean;
  defaultTerms: string;
  defaultNotes: string;
  footerText: string;
  showPaymentDetails: boolean;
  showSavingsHighlight: boolean;
  showDueDateRelative: boolean;
  showStatusWatermark: boolean;
}

export const defaultTemplateSettings: InvoiceTemplateSettings = {
  showLogo: true,
  showCompanyAddress: true,
  showCompanyPhone: true,
  showCompanyEmail: true,
  showABN: true,
  showSKU: true,
  showQuantity: true,
  showUnitPrice: true,
  showDiscount: true,
  showTax: true,
  showTerms: true,
  showNotes: true,
  defaultTerms: "Payment due within 30 days of invoice date.",
  defaultNotes: "",
  footerText: "Thank you for your business!",
  showPaymentDetails: true,
  showSavingsHighlight: true,
  showDueDateRelative: true,
  showStatusWatermark: true,
};

export interface InvoiceTemplate {
  id: string;
  organization_id: string | null;
  name: string;
  is_default: boolean;
  settings: InvoiceTemplateSettings;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  data_environment: string;
}

/**
 * Parse settings from JSON to typed object
 */
function parseSettings(settings: Json | null): InvoiceTemplateSettings {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return defaultTemplateSettings;
  }
  
  return {
    showLogo: Boolean(settings.showLogo ?? defaultTemplateSettings.showLogo),
    showCompanyAddress: Boolean(settings.showCompanyAddress ?? defaultTemplateSettings.showCompanyAddress),
    showCompanyPhone: Boolean(settings.showCompanyPhone ?? defaultTemplateSettings.showCompanyPhone),
    showCompanyEmail: Boolean(settings.showCompanyEmail ?? defaultTemplateSettings.showCompanyEmail),
    showABN: Boolean(settings.showABN ?? defaultTemplateSettings.showABN),
    showSKU: Boolean(settings.showSKU ?? defaultTemplateSettings.showSKU),
    showQuantity: Boolean(settings.showQuantity ?? defaultTemplateSettings.showQuantity),
    showUnitPrice: Boolean(settings.showUnitPrice ?? defaultTemplateSettings.showUnitPrice),
    showDiscount: Boolean(settings.showDiscount ?? defaultTemplateSettings.showDiscount),
    showTax: Boolean(settings.showTax ?? defaultTemplateSettings.showTax),
    showTerms: Boolean(settings.showTerms ?? defaultTemplateSettings.showTerms),
    showNotes: Boolean(settings.showNotes ?? defaultTemplateSettings.showNotes),
    defaultTerms: String(settings.defaultTerms ?? defaultTemplateSettings.defaultTerms),
    defaultNotes: String(settings.defaultNotes ?? defaultTemplateSettings.defaultNotes),
    footerText: String(settings.footerText ?? defaultTemplateSettings.footerText),
    showPaymentDetails: Boolean(settings.showPaymentDetails ?? defaultTemplateSettings.showPaymentDetails),
    showSavingsHighlight: Boolean(settings.showSavingsHighlight ?? defaultTemplateSettings.showSavingsHighlight),
    showDueDateRelative: Boolean(settings.showDueDateRelative ?? defaultTemplateSettings.showDueDateRelative),
    showStatusWatermark: Boolean(settings.showStatusWatermark ?? defaultTemplateSettings.showStatusWatermark),
  };
}

/**
 * Hook to fetch the default invoice template for the current organization
 */
export function useInvoiceTemplate() {
  const { currentOrganization } = useOrganization();
  const currentEnvironment = useDataEnvironment();

  return useQuery({
    queryKey: ['invoice-template', currentOrganization?.id, currentEnvironment],
    queryFn: async (): Promise<InvoiceTemplate | null> => {
      if (!currentOrganization?.id) return null;

      const { data, error } = await supabase
        .from('invoice_templates')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .eq('data_environment', currentEnvironment)
        .eq('is_default', true)
        .maybeSingle();

      if (error) {
        console.error('Error fetching invoice template:', error);
        throw error;
      }

      if (data) {
        return {
          ...data,
          settings: parseSettings(data.settings),
        };
      }

      return null;
    },
    enabled: !!currentOrganization?.id,
  });
}

/**
 * Hook to upsert invoice template settings
 */
export function useUpdateInvoiceTemplate() {
  const queryClient = useQueryClient();
  const { currentOrganization } = useOrganization();
  const currentEnvironment = useDataEnvironment();

  return useMutation({
    mutationFn: async (settings: InvoiceTemplateSettings): Promise<InvoiceTemplate> => {
      if (!currentOrganization?.id) {
        throw new Error('Organization not found');
      }

      // First check if a default template exists
      const { data: existing } = await supabase
        .from('invoice_templates')
        .select('id')
        .eq('organization_id', currentOrganization.id)
        .eq('data_environment', currentEnvironment)
        .eq('is_default', true)
        .maybeSingle();

      // Cast settings to Json type for Supabase
      const settingsJson = settings as unknown as Json;

      if (existing) {
        // Update existing template
        const { data, error } = await supabase
          .from('invoice_templates')
          .update({ settings: settingsJson })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return {
          ...data,
          settings: parseSettings(data.settings),
        };
      } else {
        // Create new default template
        const { data: userData } = await supabase.auth.getUser();
        
        const { data, error } = await supabase
          .from('invoice_templates')
          .insert({
            organization_id: currentOrganization.id,
            name: 'Default Template',
            is_default: true,
            settings: settingsJson,
            data_environment: currentEnvironment,
            created_by: userData?.user?.id,
          })
          .select()
          .single();

        if (error) throw error;
        return {
          ...data,
          settings: parseSettings(data.settings),
        };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['invoice-template', currentOrganization?.id, currentEnvironment] 
      });
    },
  });
}
