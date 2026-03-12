import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Contact, ContactWithStats } from "@/types/database";
import { enhancedToast } from "@/components/ui/enhanced-toast";
import { useUserProfile } from "./useUserProfile";
import { useUserRoles } from "./useUserRoles";
import { getCurrentEnvironment } from "@/lib/environment-utils";
import { useDataEnvironment } from "@/hooks/useSandbox";
import { useCurrentOrganizationId } from "./useOrganization";

export const useContacts = () => {
  const { profile } = useUserProfile();
  const { isAdmin, isSales } = useUserRoles();
  const dataEnvironment = useDataEnvironment();
  const orgId = useCurrentOrganizationId();

  return useQuery({
    queryKey: ["contacts", isAdmin ? "admin" : isSales ? "sales" : "guest", dataEnvironment, orgId],
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<Contact[]> => {
      // Role-based access control
      if (!profile) return [];

      let customers: any[] = [];

      // Admin users can access all customers
      if (isAdmin) {
        const { data, error } = await supabase
          .from("customers")
          .select("*")
          .eq("data_environment", dataEnvironment)
          .eq("organization_id", orgId)
          .order("name");

        if (error) throw error;
        customers = data || [];
      }
      // Sales users can only access assigned customers
      else if (isSales) {
        const { data, error } = await supabase
          .from("customers")
          .select("*")
          .eq("data_environment", dataEnvironment)
          .eq("organization_id", orgId)
          .eq("assigned_to", profile.id)
          .order("name");

        if (error) throw error;
        customers = data || [];
      }
      // Other roles have no access
      else {
        return [];
      }

      // Get all unique referred_by_customer_ids for referral data
      const referredByIds = [...new Set(
        customers
          .filter(c => c.referred_by_customer_id)
          .map(c => c.referred_by_customer_id)
      )];

      // Fetch referral customers with role-appropriate access
      let referredCustomers: any[] = [];
      if (referredByIds.length > 0) {
        const { data, error: refError } = await supabase
          .from("customers")
          .select("id, name, email")
          .in("id", referredByIds);

        if (refError) throw refError;
        referredCustomers = data || [];
      }

      // Map customers with their referral data
      return customers.map(customer => ({
        ...customer,
        relationship_type: customer.relationship_type,
        status: customer.status as 'active' | 'blacklisted' | 'suspended',
        referred_by_customer: customer.referred_by_customer_id
          ? referredCustomers.find(ref => ref.id === customer.referred_by_customer_id)
          : undefined
      }));
    },
    enabled: !!profile && (isAdmin || isSales) && !!orgId,
  });
};

// Helper function to mask sensitive data
const maskSensitiveData = (data: string | null): string | null => {
  if (!data) return null;

  // Mask email addresses
  if (data.includes('@')) {
    const [username, domain] = data.split('@');
    if (username.length <= 2) return `${username}***@${domain}`;
    return `${username.substring(0, 2)}***@${domain}`;
  }

  // Mask phone numbers
  if (/^\+?[0-9\s\-\(\)]+$/.test(data)) {
    const digits = data.replace(/\D/g, '');
    if (digits.length >= 7) {
      return `${digits.substring(0, 3)}***${digits.substring(digits.length - 4)}`;
    }
    return '***';
  }

  // Default masking for other sensitive data
  if (data.length <= 4) return '***';
  return `${data.substring(0, 2)}***${data.substring(data.length - 2)}`;
};

export const useContact = (id: string) => {
  const { profile } = useUserProfile();
  const { isAdmin, isSales } = useUserRoles();
  const dataEnvironment = useDataEnvironment();
  const orgId = useCurrentOrganizationId();

  return useQuery({
    queryKey: ["contact", id, isAdmin ? "admin" : isSales ? "sales" : "guest", dataEnvironment, orgId],
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<Contact | null> => {
      if (!profile || !id) return null;

      // Role-based access control for individual customer
      let customerQuery = supabase
        .from("customers")
        .select(`
          *,
          referred_by_customer:customers!referred_by_customer_id (
            id,
            name,
            email
          )
        `)
        .eq("id", id)
        .eq("organization_id", orgId);

      // Apply role-specific filters
      if (isSales) {
        // Sales users can only access their assigned customers
        customerQuery = customerQuery.eq("assigned_to", profile.id);
      } else if (!isAdmin) {
        // Other roles have no access
        return null;
      }

      const { data: customer, error } = await customerQuery.maybeSingle();

      if (error) throw error;
      if (!customer) return null;

      // Log access for audit trail (skip in test environment)
      const currentEnv = getCurrentEnvironment();
      if (currentEnv !== 'test') {
        try {
          await supabase.rpc('log_customer_data_access', {
            p_customer_id: customer.id,
            p_access_type: 'view_individual'
          });
        } catch (error) {
          // Don't fail if logging fails - just continue
          console.debug('Audit logging skipped:', error);
        }
      }

      return {
        ...customer,
        relationship_type: customer.relationship_type,
        status: customer.status as 'active' | 'blacklisted' | 'suspended',
        referred_by_customer: customer.referred_by_customer ? {
          ...customer.referred_by_customer[0],
          relationship_type: 'customer',
          status: 'active' as const,
          created_at: '',
          updated_at: '',
          phone: null,
          address: null,
          notes: null,
          referred_by_customer_id: null,
          blacklist_reason: null,
          blacklisted_at: null,
          blacklisted_by: null,
          customer_tier: 'standard' as const,
          tier_override: false,
          tier_points: 0,
          suggested_tier: 'standard' as const,
        } : undefined,
      };
    },
    enabled: !!id && !!profile && (isAdmin || isSales) && !!orgId,
  });
};

export const useCreateContact = () => {
  const queryClient = useQueryClient();
  const dataEnvironment = useDataEnvironment();
  const orgId = useCurrentOrganizationId();

  return useMutation({
    mutationFn: async (contact: Omit<Contact, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("customers")
        .insert({ ...contact, data_environment: dataEnvironment, organization_id: orgId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      enhancedToast.success("Success", "Contact created successfully");
    },
    onError: (error) => {
      console.error("Create contact error:", error);
      enhancedToast.error("Error", "Failed to create contact");
    },
  });
};

export const useBlacklistContact = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      // Use secure RPC function with server-side validation and audit logging
      const { data, error } = await supabase
        .rpc('secure_blacklist_customer', {
          p_customer_id: id,
          p_reason: reason
        });

      if (error) {
        console.error('Blacklist error:', error);
        throw new Error(error.message || 'Failed to blacklist contact');
      }

      // Type assertion for the JSONB response
      return data as unknown as { id: string; name: string; status: string; blacklisted_at: string } | null;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: ["contact", data.id] });
      }
      enhancedToast.success("Contact Blacklisted", "Contact has been successfully blacklisted with full audit trail");
    },
    onError: (error: Error) => {
      // Display server-side validation errors to user
      const errorMessage = error.message || "Failed to blacklist contact";
      enhancedToast.error("Blacklist Failed", errorMessage);
    },
  });
};

export const useRestoreContact = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("customers")
        .update({
          status: 'active',
          blacklist_reason: null,
          blacklisted_at: null,
          blacklisted_by: null,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contact", data.id] });
      enhancedToast.success("Contact Restored", "Contact has been restored and can now make purchases");
    },
    onError: () => {
      enhancedToast.error("Error", "Failed to restore contact");
    },
  });
};

export const useUpdateContact = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...contact }: Partial<Contact> & { id: string }) => {
      const { data, error } = await supabase
        .from("customers")
        .update(contact)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contact", data.id] });
      enhancedToast.success("Success", "Contact updated successfully");
    },
    onError: () => {
      enhancedToast.error("Error", "Failed to update contact");
    },
  });
};

export const useDeleteContact = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, deletedId) => {
      // Optimistically remove from all contact queries
      queryClient.setQueriesData(
        { queryKey: ["contacts"] },
        (oldData: any) => {
          if (!oldData) return oldData;
          return Array.isArray(oldData)
            ? oldData.filter((contact: any) => contact.id !== deletedId)
            : oldData;
        }
      );

      // Remove the specific contact from cache
      queryClient.removeQueries({ queryKey: ["contact", deletedId] });

      enhancedToast.success("Success", "Contact deleted successfully");
    },
    onError: () => {
      enhancedToast.error("Error", "Failed to delete contact");
    },
  });
};
