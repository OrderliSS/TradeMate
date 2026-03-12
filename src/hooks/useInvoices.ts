import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, rawSupabase } from "@/integrations/supabase/client";
import { Invoice, InvoiceWithDetails } from "@/types/invoices";
import { enhancedToast } from "@/components/ui/enhanced-toast";
import { getCurrentEnvironment } from "@/lib/environment-utils";
import { useDataEnvironment } from "@/hooks/useSandbox";
import { useCurrentOrganizationId } from "./useOrganization";

export const useInvoices = () => {
  const dataEnvironment = useDataEnvironment();
  const orgId = useCurrentOrganizationId();

  return useQuery({
    queryKey: ["invoices", dataEnvironment, orgId],
    queryFn: async (): Promise<Invoice[]> => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("data_environment", dataEnvironment)
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as Invoice[];
    },
    enabled: !!orgId,
  });
};

export const useInvoicesByPurchase = (purchaseId?: string) => {
  const orgId = useCurrentOrganizationId();
  return useQuery({
    queryKey: ["invoices", "purchase", purchaseId, orgId],
    queryFn: async (): Promise<Invoice[]> => {
      if (!purchaseId) return [];

      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("purchase_id", purchaseId)
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as Invoice[];
    },
    enabled: !!purchaseId && !!orgId,
  });
};

export const useInvoiceDetails = (invoiceId?: string, environment?: string) => {
  // Use provided environment or fall back to getCurrentEnvironment()
  const env = environment || getCurrentEnvironment();
  const orgId = useCurrentOrganizationId();

  return useQuery({
    queryKey: ["invoice-details", invoiceId, env, "v2", orgId],
    queryFn: async (): Promise<InvoiceWithDetails | null> => {
      if (!invoiceId) return null;

      // Use a simpler query approach to avoid nested join issues
      const { data: invoiceData, error: invoiceError } = await rawSupabase
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .maybeSingle();

      if (invoiceError) throw invoiceError;
      if (!invoiceData) return null;

      // Fetch customer data
      const { data: customerData, error: customerError } = await rawSupabase
        .from("customers")
        .select("id, name, email, phone, address")
        .eq("id", invoiceData.customer_id)
        .maybeSingle();

      if (customerError) throw customerError;

      // Fetch purchase data
      const { data: purchaseData, error: purchaseError } = await rawSupabase
        .from("purchases")
        .select("id, quantity, unit_price, total_amount, items_free, discount_amount, shipping_cost, product_id, secondary_items")
        .eq("id", invoiceData.purchase_id)
        .maybeSingle();

      if (purchaseError) throw purchaseError;

      // Fetch product data if purchase exists
      let productData = null;
      let bundleComponents: any[] = [];
      if (purchaseData?.product_id) {
        const { data: product, error: productError } = await rawSupabase
          .from("products")
          .select("id, name, sku, is_bundle, bundle_components")
          .eq("id", purchaseData.product_id)
          .maybeSingle();

        if (productError) throw productError;
        productData = product;

        // Fetch bundle component details if this is a bundle
        if (product?.is_bundle && product?.bundle_components && Array.isArray(product.bundle_components)) {
          const componentIds = product.bundle_components.map((c: any) => c.product_id).filter(Boolean);
          if (componentIds.length > 0) {
            const { data: componentProducts } = await rawSupabase
              .from("products")
              .select("id, name, sku, price")
              .in("id", componentIds);

            if (componentProducts) {
              bundleComponents = product.bundle_components.map((comp: any) => {
                const compProduct = componentProducts.find(p => p.id === comp.product_id);
                return {
                  product_id: comp.product_id,
                  quantity: comp.quantity || 1,
                  product: compProduct || { id: comp.product_id, name: "Unknown", sku: "N/A" }
                };
              });
            }
          }
        }
      }

      // Fetch secondary item products if they exist
      let secondaryProducts = [];
      if (purchaseData?.secondary_items && Array.isArray(purchaseData.secondary_items)) {
        const secondaryProductIds = purchaseData.secondary_items
          .map((item: any) => item.product_id)
          .filter(Boolean);

        if (secondaryProductIds.length > 0) {
          const { data: products, error: productsError } = await rawSupabase
            .from("products")
            .select("id, name, sku, price")
            .in("id", secondaryProductIds);

          if (!productsError && products) {
            secondaryProducts = purchaseData.secondary_items.map((item: any) => {
              const product = products.find(p => p.id === item.product_id);
              return {
                product_id: item.product_id,
                quantity: item.quantity,
                unit_quantity: item.unit_quantity || 1,
                product: product || { id: item.product_id, name: "Unknown", sku: "N/A", price: 0 }
              };
            });
          }
        }
      }

      // Construct the response in the expected format
      const result: InvoiceWithDetails = {
        ...invoiceData,
        status: invoiceData.status as Invoice['status'],
        customer: customerData || {
          id: invoiceData.customer_id,
          name: "Unknown Customer",
          email: null,
          phone: null,
          address: null
        },
        purchase: purchaseData ? {
          ...purchaseData,
          secondary_items: secondaryProducts,
          bundleComponents: bundleComponents.length > 0 ? bundleComponents : undefined,
          product: productData || {
            id: purchaseData.product_id,
            name: "Unknown Product",
            sku: "N/A"
          }
        } : {
          id: invoiceData.purchase_id,
          quantity: 0,
          unit_price: 0,
          total_amount: 0,
          items_free: 0,
          discount_amount: 0,
          shipping_cost: 0,
          product: {
            id: "",
            name: "Unknown Product",
            sku: "N/A"
          }
        }
      };

      return result;
    },
    enabled: !!invoiceId && !!orgId,
  });
};

export const useCreateInvoice = () => {
  const queryClient = useQueryClient();
  const orgId = useCurrentOrganizationId();

  return useMutation({
    mutationFn: async (purchaseId: string) => {
      // Validate purchaseId
      if (!purchaseId) {
        throw new Error('Purchase ID is required to create an invoice');
      }

      // First get purchase details with validation
      const { data: purchase, error: purchaseError } = await supabase
        .from("purchases")
        .select(`
          *,
          customer:customers!customer_id(*),
          product:products!product_id(*)
        `)
        .eq("id", purchaseId)
        .single();

      if (purchaseError) {
        console.error('[Invoice Creation] Purchase fetch error:', purchaseError);
        throw new Error(`Failed to fetch purchase: ${purchaseError.message}`);
      }

      if (!purchase) {
        throw new Error('Purchase not found');
      }

      // Validate required fields
      if (!purchase.customer_id) {
        throw new Error('Purchase must have a customer assigned before creating an invoice');
      }

      if (!purchase.product_id) {
        throw new Error('Purchase must have a product assigned before creating an invoice');
      }

      if (!purchase.quantity || purchase.quantity <= 0) {
        throw new Error('Purchase must have a valid quantity');
      }

      // Generate invoice number from ticket number (TKT-2025-0005 → INV-2025-0005)
      const invoiceNumber = purchase.ticket_number
        ? purchase.ticket_number.replace('TKT-', 'INV-')
        : `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

      // Calculate invoice amounts
      // When discount exists, original price = unit_price + (discount_amount / quantity)
      // This ensures subtotal reflects pre-discount pricing, then discount is applied once
      const discountAmount = purchase.discount_amount || 0;
      const discountPerUnit = discountAmount > 0 && purchase.quantity > 0
        ? discountAmount / purchase.quantity
        : 0;
      const originalUnitPrice = (purchase.unit_price || 0) + discountPerUnit;
      const subtotal = purchase.quantity * originalUnitPrice;
      const shipping_cost = purchase.shipping_cost || 0;
      const tax_amount = 0; // Can be calculated based on requirements
      const total_amount = subtotal - discountAmount + shipping_cost + tax_amount;

      // Use organization_id from current context
      let organizationId = orgId;

      if (!organizationId) {
        // Auto-assign user's current organization to the purchase
        const { data: userOrgId, error: orgError } = await supabase
          .rpc('get_user_organization_id');

        if (orgError || !userOrgId) {
          console.error('[Invoice Creation] Failed to get user organization:', orgError);
          throw new Error('Unable to determine organization. Please ensure you are part of an organization.');
        }

        // Update the purchase with the organization_id
        const { error: updateError } = await supabase
          .from('purchases')
          .update({ organization_id: userOrgId })
          .eq('id', purchaseId);

        if (updateError) {
          console.error('[Invoice Creation] Failed to update purchase with organization:', updateError);
          throw new Error('Failed to assign organization to purchase. Please try again.');
        }

        organizationId = userOrgId;
        console.log('[Invoice Creation] Auto-assigned organization to purchase:', userOrgId);
      }

      // Create invoice with organization_id
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert([{
          purchase_id: purchaseId,
          customer_id: purchase.customer_id,
          organization_id: organizationId,
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
          subtotal,
          discount_amount: discountAmount,
          shipping_cost,
          tax_amount,
          total_amount,
          status: 'draft',
          invoice_number: invoiceNumber,
        }])
        .select()

      if (invoiceError) {
        console.error('[Invoice Creation] Insert error:', invoiceError);
        throw new Error(`Failed to create invoice: ${invoiceError.message}`);
      }

      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      enhancedToast.success("Invoice created successfully");
    },
    onError: (error: any) => {
      console.error('[Invoice Creation] Error:', error);
      enhancedToast.error(`Failed to create invoice: ${error.message}`);
    },
  });
};

export const useUpdateInvoiceStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ invoiceId, status }: { invoiceId: string; status: Invoice['status'] }) => {
      const { data, error } = await supabase
        .from("invoices")
        .update({ status })
        .eq("id", invoiceId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-details"] });
      enhancedToast.success("Invoice status updated");
    },
    onError: (error: any) => {
      enhancedToast.error(`Failed to update invoice: ${error.message}`);
    },
  });
};

export const useUpdateInvoice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ invoiceId, updates }: {
      invoiceId: string;
      updates: Partial<Invoice>
    }) => {
      const { data, error } = await supabase
        .from("invoices")
        .update(updates)
        .eq("id", invoiceId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-details"] });
      enhancedToast.success("Invoice updated successfully");
    },
    onError: (error: any) => {
      enhancedToast.error(`Failed to update invoice: ${error.message}`);
    },
  });
};

export const useDeleteInvoice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase
        .from("invoices")
        .delete()
        .eq("id", invoiceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-details"] });
      enhancedToast.success("Invoice deleted successfully");
    },
    onError: (error: any) => {
      enhancedToast.error(`Failed to delete invoice: ${error.message}`);
    },
  });
};

/**
 * Hook specifically for invoice print preview with enhanced error handling
 * Uses rawSupabase with public access policies to bypass RLS
 * Includes validation, retry logic, and comprehensive error logging
 */
export const useInvoiceForPrint = (invoiceId?: string, environment?: string) => {
  const env = environment || getCurrentEnvironment();

  return useQuery({
    queryKey: ["invoice-print", invoiceId, env],
    queryFn: async (): Promise<InvoiceWithDetails | null> => {
      if (!invoiceId) {
        throw new Error('Invoice ID is required');
      }

      if (!['development', 'test', 'production'].includes(env)) {
        throw new Error(`Invalid environment: ${env}`);
      }

      // Use rawSupabase to bypass environment filtering and rely on public RLS policies
      const { data: invoiceData, error: invoiceError } = await rawSupabase
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .maybeSingle();

      if (invoiceError) {
        console.error('[InvoiceForPrint] Invoice query error:', {
          code: invoiceError.code,
          message: invoiceError.message,
          details: invoiceError.details,
          hint: invoiceError.hint,
          invoiceId,
          environment: env
        });
        throw new Error(`Failed to load invoice: ${invoiceError.message}`);
      }

      if (!invoiceData) {
        throw new Error(`Invoice ${invoiceId} not found in ${env} environment`);
      }

      // Fetch customer data
      const { data: customerData, error: customerError } = await rawSupabase
        .from("customers")
        .select("id, name, email, phone, address")
        .eq("id", invoiceData.customer_id)
        .maybeSingle();

      if (customerError) {
        console.error('[InvoiceForPrint] Customer query error:', customerError);
        throw new Error(`Failed to load customer: ${customerError.message}`);
      }

      if (!customerData) {
        throw new Error('Invoice has no associated customer');
      }

      // Fetch purchase data
      const { data: purchaseData, error: purchaseError } = await rawSupabase
        .from("purchases")
        .select("id, quantity, unit_price, total_amount, items_free, discount_amount, shipping_cost, product_id, secondary_items")
        .eq("id", invoiceData.purchase_id)
        .maybeSingle();

      if (purchaseError) {
        console.error('[InvoiceForPrint] Purchase query error:', purchaseError);
        throw new Error(`Failed to load purchase: ${purchaseError.message}`);
      }

      if (!purchaseData) {
        throw new Error('Invoice has no associated purchase');
      }

      // Fetch product data
      let productData = null;
      let bundleComponents: any[] = [];
      if (purchaseData?.product_id) {
        const { data: product, error: productError } = await rawSupabase
          .from("products")
          .select("id, name, sku, is_bundle, bundle_components")
          .eq("id", purchaseData.product_id)
          .maybeSingle();

        if (productError) {
          console.error('[InvoiceForPrint] Product query error:', productError);
        } else {
          productData = product;

          // Fetch bundle component details if this is a bundle
          if (product?.is_bundle && product?.bundle_components && Array.isArray(product.bundle_components)) {
            const componentIds = product.bundle_components.map((c: any) => c.product_id).filter(Boolean);
            if (componentIds.length > 0) {
              const { data: componentProducts } = await rawSupabase
                .from("products")
                .select("id, name, sku, price")
                .in("id", componentIds);

              if (componentProducts) {
                bundleComponents = product.bundle_components.map((comp: any) => {
                  const compProduct = componentProducts.find(p => p.id === comp.product_id);
                  return {
                    product_id: comp.product_id,
                    quantity: comp.quantity || 1,
                    product: compProduct || { id: comp.product_id, name: "Unknown", sku: "N/A" }
                  };
                });
              }
            }
          }
        }
      }

      // Fetch secondary item products
      let secondaryProducts = [];
      if (purchaseData?.secondary_items && Array.isArray(purchaseData.secondary_items)) {
        const secondaryProductIds = purchaseData.secondary_items
          .map((item: any) => item.product_id)
          .filter(Boolean);

        if (secondaryProductIds.length > 0) {
          const { data: products, error: productsError } = await rawSupabase
            .from("products")
            .select("id, name, sku, price")
            .in("id", secondaryProductIds);

          if (!productsError && products) {
            secondaryProducts = purchaseData.secondary_items.map((item: any) => {
              const product = products.find(p => p.id === item.product_id);
              return {
                product_id: item.product_id,
                quantity: item.quantity,
                unit_quantity: item.unit_quantity || 1,
                product: product || { id: item.product_id, name: "Unknown", sku: "N/A", price: 0 }
              };
            });
          }
        }
      }

      // Construct the response
      const result: InvoiceWithDetails = {
        ...invoiceData,
        status: invoiceData.status as Invoice['status'],
        customer: customerData,
        purchase: {
          ...purchaseData,
          secondary_items: secondaryProducts,
          bundleComponents: bundleComponents.length > 0 ? bundleComponents : undefined,
          product: productData || {
            id: purchaseData.product_id,
            name: "Unknown Product",
            sku: "N/A"
          }
        }
      };

      return result;
    },
    enabled: !!invoiceId,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });
};