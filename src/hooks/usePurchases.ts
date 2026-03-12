import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Purchase, PurchaseWithDetails, PurchaseEvent } from "@/types/database";
import { toast } from "@/hooks/use-toast";
import { SecureEnvironment } from "@/lib/secure-environment";
import { useNavigate } from "react-router-dom";
import { getCurrentEnvironment } from "@/lib/environment-utils";
import { useDataEnvironment } from "@/hooks/useSandbox";
import { useCurrentOrganizationId } from "./useOrganization";
import { useScopedSupabase } from "./useScopedSupabase";

export const usePurchases = (limit?: number) => {
  const dataEnvironment = useDataEnvironment();
  const orgId = useCurrentOrganizationId();

  return useQuery({
    queryKey: ["purchases", limit, dataEnvironment, orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<PurchaseWithDetails[]> => {
      let query = supabase
        .from("purchases")
        .select(`
          *,
           customer:customers!purchases_customer_id_fkey(*),
          product:products(*)
        `)
        .eq("data_environment", dataEnvironment)
        .eq("organization_id", orgId)
        .order("purchase_date", { ascending: false });

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []).map(purchase => {
        const memberData = (purchase as any).member ? (Array.isArray((purchase as any).member) ? (purchase as any).member[0] : (purchase as any).member) : null;
        return {
          ...purchase,
          completion_method: purchase.completion_method as 'manual' | 'auto' | 'legacy' | 'backdated',
          allocation_status: purchase.allocation_status as 'pending_allocation' | 'pending_assets' | 'approved' | 'allocated',
          linked_stock_order_ids: Array.isArray(purchase.linked_stock_order_ids) ? purchase.linked_stock_order_ids.filter((id): id is string => typeof id === 'string') : null,
          customer: {
            ...purchase.customer,
            relationship_type: purchase.customer.relationship_type,
            status: purchase.customer.status as 'active' | 'blacklisted' | 'suspended'
          },
          member: memberData ? {
            id: memberData.id,
            full_name: memberData.full_name,
            email: memberData.email,
            employment_id: memberData.employee_id,
          } : undefined,
        };
      });
    },
  });
};

export const usePurchase = (id: string) => {
  const orgId = useCurrentOrganizationId();
  return useQuery({
    queryKey: ["purchase", id, orgId],
    queryFn: async (): Promise<PurchaseWithDetails> => {
      const { data, error } = await supabase
        .from("purchases")
        .select(`
          *,
           customer:customers!purchases_customer_id_fkey(*),
          product:products(*)
        `)
        .eq("id", id)
        .eq("organization_id", orgId)
        .single();

      if (error) throw error;
      const memberData = (data as any).member ? (Array.isArray((data as any).member) ? (data as any).member[0] : (data as any).member) : null;
      return {
        ...data,
        completion_method: data.completion_method as 'manual' | 'auto' | 'legacy' | 'backdated',
        allocation_status: data.allocation_status as 'pending_allocation' | 'pending_assets' | 'approved' | 'allocated',
        linked_stock_order_ids: Array.isArray(data.linked_stock_order_ids) ? data.linked_stock_order_ids.filter((id): id is string => typeof id === 'string') : null,
        customer: {
          ...data.customer,
          relationship_type: data.customer.relationship_type,
          status: data.customer.status as 'active' | 'blacklisted' | 'suspended'
        },
        member: memberData ? {
          id: memberData.id,
          full_name: memberData.full_name,
          email: memberData.email,
          employment_id: memberData.employee_id,
        } : undefined,
      };
    },
    enabled: !!id && !!orgId && orgId !== 'null',
  });
};

export const useCreatePurchase = () => {
  const queryClient = useQueryClient();
  const orgId = useCurrentOrganizationId();

  return useMutation({
    mutationFn: async (purchase: Omit<Purchase, "id" | "created_at">) => {
      // Validate required fields
      if (!purchase.customer_id || purchase.customer_id.trim() === '') {
        throw new Error('Customer selection is required');
      }
      // Skip product validation for placeholder purchases
      if (purchase.product_id !== "00000000-0000-0000-0000-000000000000" && (!purchase.product_id || purchase.product_id.trim() === '')) {
        throw new Error('Product selection is required');
      }
      // Allow $0 unit price for gifts, but require valid price for regular purchases
      if (!purchase.is_gift && (!purchase.unit_price || purchase.unit_price <= 0)) {
        throw new Error('Unit price must be greater than 0');
      }
      if (!purchase.quantity || purchase.quantity <= 0) {
        throw new Error('Quantity must be greater than 0');
      }

      // Sanitize data - convert empty strings to null for optional fields
      const sanitizedPurchase = {
        ...purchase,
        notes: purchase.notes?.trim() || null,
        referred_by_customer_id: purchase.referred_by_customer_id?.trim() || null,
        purchasing_for_customer_id: purchase.purchasing_for_customer_id?.trim() || null,
        pickup_date: purchase.pickup_date || null,
        discount_amount: purchase.discount_amount || 0,
        items_free: purchase.items_free || 0,
        organization_id: orgId,
      };

      // 🐛 DEBUG: Log secondary items in mutation
      console.log('🔍 [MUTATION] Secondary items received:', purchase.secondary_items);
      console.log('🔍 [MUTATION] Full sanitized purchase data:', sanitizedPurchase);

      SecureEnvironment.log('Submitting purchase data');

      const { data, error } = await supabase
        .from("purchases")
        .insert(sanitizedPurchase)
        .select()
        .single();

      if (error) {
        SecureEnvironment.error('Database error:', error);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["unpicked-purchases-with-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["product-stock-summary"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["case-linked-orders"] });
      toast({
        title: "Success",
        description: "Purchase recorded successfully",
      });
    },
    onError: (error: any) => {
      SecureEnvironment.error('Purchase creation error:', error);
      const errorMessage = error?.message || 'Failed to record purchase';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });
};

export const useDashboardStats = (organizationId?: string | null) => {
  const dataEnvironment = useDataEnvironment();

  return useQuery({
    queryKey: ["dashboard-stats", dataEnvironment, organizationId],
    queryFn: async () => {
      const env = getCurrentEnvironment();
      console.log(`📊 [Dashboard Stats] Querying ${env} database for org: ${organizationId || 'all'}...`);

      try {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        // Build all queries upfront
        let customersQuery = supabase
          .from("customers")
          .select("*", { count: "exact", head: true })
          .eq("data_environment", dataEnvironment);
        if (organizationId) customersQuery = customersQuery.eq("organization_id", organizationId);

        let allTimePurchasesQuery = supabase
          .from("purchases")
          .select("total_amount, pickup_date, id", { count: "exact" })
          .eq("data_environment", dataEnvironment);
        if (organizationId) allTimePurchasesQuery = allTimePurchasesQuery.eq("organization_id", organizationId);

        let monthlyPurchasesQuery = supabase
          .from("purchases")
          .select("total_amount, pickup_date")
          .eq("data_environment", dataEnvironment)
          .gte("purchase_date", startOfMonth.toISOString());
        if (organizationId) monthlyPurchasesQuery = monthlyPurchasesQuery.eq("organization_id", organizationId);

        let stockOrdersQuery = supabase
          .from("stock_orders")
          .select("amount")
          .eq("data_environment", dataEnvironment)
          .gte("created_at", startOfMonth.toISOString());
        if (organizationId) stockOrdersQuery = stockOrdersQuery.eq("organization_id", organizationId);

        let recentQuery = supabase
          .from("purchases")
          .select(`*, customer:customers!purchases_customer_id_fkey(name), product:products(name)`)
          .eq("data_environment", dataEnvironment)
          .order("purchase_date", { ascending: false })
          .limit(5);
        if (organizationId) recentQuery = recentQuery.eq("organization_id", organizationId);

        // Execute all 5 queries in parallel
        const [customersResult, allPurchasesResult, monthlyResult, stockOrdersResult, recentResult] = await Promise.all([
          customersQuery,
          allTimePurchasesQuery,
          monthlyPurchasesQuery,
          stockOrdersQuery,
          recentQuery,
        ]);

        if (allPurchasesResult.error) throw allPurchasesResult.error;
        if (monthlyResult.error) throw monthlyResult.error;
        if (stockOrdersResult.error) throw stockOrdersResult.error;
        if (recentResult.error) throw recentResult.error;

        const allPurchases = allPurchasesResult.data || [];
        const totalOrders = allPurchasesResult.count || 0;
        const allTimeGrossRevenue = allPurchases.reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0);

        let monthlyPurchases = monthlyResult.data || [];
        const completedMonthlyPurchases = monthlyPurchases.filter(p => p.pickup_date);
        let finalMonthlyGrossRevenue = completedMonthlyPurchases.reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0);
        let finalMonthlyPurchases = monthlyPurchases;

        // If no current month data, fetch last month (this is the only conditional sequential query)
        if (monthlyPurchases.length === 0) {
          const lastMonth = new Date();
          lastMonth.setMonth(lastMonth.getMonth() - 1);
          lastMonth.setDate(1);
          lastMonth.setHours(0, 0, 0, 0);
          const endOfLastMonth = new Date(startOfMonth);
          endOfLastMonth.setDate(0);
          endOfLastMonth.setHours(23, 59, 59, 999);

          let lastMonthQuery = supabase
            .from("purchases")
            .select("total_amount, pickup_date")
            .eq("data_environment", dataEnvironment)
            .gte("purchase_date", lastMonth.toISOString())
            .lte("purchase_date", endOfLastMonth.toISOString());
          if (organizationId) lastMonthQuery = lastMonthQuery.eq("organization_id", organizationId);

          const { data: lastMonthPurchases } = await lastMonthQuery;
          finalMonthlyPurchases = lastMonthPurchases || [];
          finalMonthlyGrossRevenue = finalMonthlyPurchases.filter(p => p.pickup_date).reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0);
        }

        const totalStockOrderCosts = (stockOrdersResult.data || []).reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
        const netRevenue = allTimeGrossRevenue - totalStockOrderCosts;

        const result = {
          totalCustomers: customersResult.count || 0,
          totalOrders,
          monthlyPurchases: finalMonthlyPurchases?.length || 0,
          grossRevenue: allTimeGrossRevenue,
          monthlyRevenue: finalMonthlyGrossRevenue,
          netRevenue,
          recentPurchases: recentResult.data || [],
        };

        console.log(`✅ [Dashboard Stats] Success on ${env}:`, result);
        return result;

      } catch (error: any) {
        console.error(`❌ [Dashboard Stats] Failed on ${env}:`, error);

        // Distinguish between connection errors and data issues
        if (error.message?.includes('Failed to fetch') ||
          error.message?.includes('timeout') ||
          error.message?.includes('NetworkError')) {
          const connectionError = new Error(`Connection to ${env} database failed`);
          (connectionError as any).isConnectionError = true;
          throw connectionError;
        }

        throw error;
      }
    },
    retry: 1,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

export const usePurchaseOrderMetrics = (organizationId?: string | null) => {
  const dataEnvironment = useDataEnvironment();

  return useQuery({
    queryKey: ["purchase-order-metrics", dataEnvironment, organizationId],
    queryFn: async () => {
      // Query 'purchases' table (sales orders) all-time
      let query = supabase
        .from('purchases')
        .select('status, total_amount, pickup_date, purchase_date, id', { count: 'exact' })
        .eq('data_environment', dataEnvironment);

      if (organizationId) {
        query = query.eq("organization_id", organizationId);
      }

      const { data: orders, count, error } = await query;

      if (error) throw error;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const totalValue = (orders || []).reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

      return {
        totalOrders: count ?? orders?.length ?? 0,
        totalValue: totalValue,
        pendingOrders: orders?.filter(o => o.status === 'open' || !o.pickup_date).length ?? 0,
        completedToday: orders?.filter(o =>
          o.pickup_date && new Date(o.pickup_date) >= today
        ).length ?? 0,
      };
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
};

export const useUpdatePurchase = () => {
  const queryClient = useQueryClient();
  const scopedDb = useScopedSupabase();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
      oldValues
    }: {
      id: string;
      updates: Partial<Purchase>;
      oldValues: Partial<Purchase>;
    }) => {
      // Update the purchase
      const { data, error } = await scopedDb
        .from("purchases")
        .update(updates)
        .eq("id", id)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Update failed: No record found or access denied (RLS).");
      }
      const result = data[0];

      // If order is being completed (completed_at being set), handle allocation and asset status transitions
      if (updates.completed_at && !oldValues.completed_at) {
        // Transition allocations from 'allocated' to 'fulfilled'
        const { data: allocations } = await supabase
          .from("allocations")
          .select("id, asset_id")
          .eq("purchase_order_id", id)
          .eq("status", "allocated");

        if (allocations && allocations.length > 0) {
          const allocationIds = allocations.map(a => a.id);
          const assetIds = allocations.map(a => a.asset_id).filter(Boolean);

          // Update allocations to 'fulfilled'
          await supabase
            .from("allocations")
            .update({ status: "fulfilled", updated_at: new Date().toISOString() })
            .in("id", allocationIds);

          // Update assets to 'sold'
          if (assetIds.length > 0) {
            await supabase
              .from("asset_management")
              .update({ status: "sold", updated_at: new Date().toISOString() })
              .in("id", assetIds);
          }
        }
      }

      // If pickup_date was just set (order completed), handle stock and allocation updates
      if (updates.pickup_date && !oldValues.pickup_date) {
        // Remove stock allocations for this purchase (since it's now picked up)
        await supabase
          .from("stock_allocations")
          .delete()
          .eq("purchase_id", id);

        // Get current product stock and update it (reduce by quantity picked up)
        if (result.product_id && result.quantity) { // Corrected property access from 'data' to 'result'
          // Assuming createSotAdjustment is defined and imported elsewhere
          // await createSotAdjustment.mutateAsync({
          //   product_id: result.product_id, // Corrected 'productId' to 'result.product_id'
          //   adjustmentQty: -result.quantity, // Corrected 'quantity' to 'result.quantity'
          // });

          // Original logic (commented out if createSotAdjustment is used)
          const { data: product } = await supabase
            .from("products")
            .select("stock_quantity")
            .eq("id", result.product_id) // Corrected 'data.product_id' to 'result.product_id'
            .single();

          if (product) {
            await supabase
              .from("products")
              .update({
                stock_quantity: Math.max(0, product.stock_quantity - result.quantity)
              })
              .eq("id", result.product_id);
          }
        }
      }

      // Create event log entry
      const eventDescription = `Purchase updated: ${Object.keys(updates).join(", ")}`;
      await supabase
        .from("purchase_events")
        .insert({
          purchase_id: id,
          event_type: "edit",
          description: eventDescription,
          old_values: oldValues,
          new_values: updates,
        });

      return result;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["purchase", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-events"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stock-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["product-stock-summary"] });
      queryClient.invalidateQueries({ queryKey: ["unpicked-purchases-with-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-order-product"] });
      toast({
        title: "Success",
        description: "Purchase updated successfully",
      });
    },
    onError: (error: any) => {
      SecureEnvironment.error("Purchase update error:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to update purchase",
        variant: "destructive",
      });
    },
  });
};

export const usePurchaseEvents = (purchaseId: string) => {
  return useQuery({
    queryKey: ["purchase-events", purchaseId],
    queryFn: async (): Promise<PurchaseEvent[]> => {
      const { data, error } = await supabase
        .from("purchase_events")
        .select("*")
        .eq("purchase_id", purchaseId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Get unique created_by user IDs
      const userIds = [...new Set((data || []).map(e => e.created_by).filter(Boolean))];

      // Fetch profiles for all authors in one query
      let profilesMap: Record<string, { full_name: string | null; email: string | null; employee_id: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email, employee_id")
          .in("id", userIds);

        if (profiles) {
          profilesMap = profiles.reduce((acc, p) => {
            acc[p.id] = { full_name: p.full_name, email: p.email, employee_id: p.employee_id };
            return acc;
          }, {} as Record<string, { full_name: string | null; email: string | null; employee_id: string | null }>);
        }
      }

      // Map events with author profiles
      return (data || []).map(event => ({
        ...event,
        author: event.created_by ? profilesMap[event.created_by] || null : null,
      })) as PurchaseEvent[];
    },
    enabled: !!purchaseId,
  });
};

export const useAddPurchaseEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (event: Omit<PurchaseEvent, "id" | "created_at" | "created_by" | "author">) => {
      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("purchase_events")
        .insert({
          ...event,
          created_by: user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-events"] });
      toast({
        title: "Success",
        description: "Note added successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add note",
        variant: "destructive",
      });
    },
  });
};

export const useUpdatePurchaseStatus = () => {
  const queryClient = useQueryClient();
  const scopedDb = useScopedSupabase();

  return useMutation({
    mutationFn: async ({
      purchaseId,
      newStatus,
      oldStatus,
      note
    }: {
      purchaseId: string;
      newStatus: string;
      oldStatus: string;
      note?: string;
    }) => {
      // Update the purchase status
      const { data, error } = await scopedDb
        .from("purchases")
        .update({ order_status: newStatus as any })
        .eq("id", purchaseId)
        .select()
        .single();

      if (error) throw error;

      // Build description with optional note
      let description = `Status changed from "${oldStatus}" to "${newStatus}"`;
      if (note && note.trim()) {
        description += `\n\nReason: ${note.trim()}`;
      }

      // Log the status change
      await supabase
        .from("purchase_events")
        .insert({
          purchase_id: purchaseId,
          event_type: "status_change",
          description,
          old_values: { order_status: oldStatus },
          new_values: { order_status: newStatus },
        });

      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["purchase", variables.purchaseId] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-events"] });
      queryClient.invalidateQueries({ queryKey: ["asset-management"] });
      queryClient.invalidateQueries({ queryKey: ["allocations"] });
      toast({
        title: "Status Updated",
        description: "Order status has been updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update status",
        variant: "destructive",
      });
    },
  });
};

export const useDeletePurchase = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (purchaseId: string) => {
      const { data, error } = await supabase.rpc('delete_purchase_completely', {
        p_purchase_id: purchaseId
      });

      if (error) throw error;

      const result = data?.[0];
      if (!result?.success) {
        throw new Error(result?.message || 'Failed to delete purchase');
      }

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-events'] });
      queryClient.invalidateQueries({ queryKey: ['allocations'] });

      toast({
        title: "Purchase Deleted",
        description: result.message,
      });

      // Navigate back to purchases list
      navigate('/purchases');
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
