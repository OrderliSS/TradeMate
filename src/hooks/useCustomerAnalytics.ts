import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Customer } from "@/types/database";
import { useUserProfile } from "./useUserProfile";
import { useUserRoles } from "./useUserRoles";
import { useDataEnvironment } from "@/hooks/useSandbox";

export interface PurchaseAnalytics {
  id: string;
  purchase_date: string;
  pickup_date: string | null;
  total_amount: number;
  quantity: number;
  order_status: string;
  customer: {
    id: string;
    name: string;
    email: string | null;
  };
  product: {
    id: string;
    name: string;
    sku: string | null;
    category: string | null;
  };
}

export interface CustomerStats {
  totalPurchases: number;
  totalSpent: number;
  averageOrderValue: number;
  firstPurchaseDate: string | null;
  lastPurchaseDate: string | null;
  favoriteProducts: Array<{
    product_name: string;
    purchase_count: number;
    total_quantity: number;
  }>;
  purchaseFrequency: {
    monthly: number;
    quarterly: number;
  };
}

export interface CustomerWithStats extends Customer {
  stats: CustomerStats;
}

export const useCustomerWithStats = (customerId: string) => {
  const { profile } = useUserProfile();
  const { isAdmin, isSales, isMarketing } = useUserRoles();
  const dataEnvironment = useDataEnvironment();
  
  return useQuery<CustomerWithStats | null>({
    queryKey: ["customer-with-stats", customerId, dataEnvironment, isAdmin ? "admin" : isSales ? "sales" : "guest"],
    queryFn: async (): Promise<CustomerWithStats | null> => {
      if (!profile || !customerId) return null;

      // First get the basic customer data (with role-based access control)
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
        .eq("id", customerId)
        .eq("data_environment", dataEnvironment);

      // Apply role-specific filters
      if (isAdmin) {
        // Admin users can access all customers
      } else if (isSales) {
        // Sales users can access assigned customers or unassigned customers
        customerQuery = customerQuery.or(`assigned_to.eq.${profile.id},assigned_to.is.null`);
      } else if (isMarketing) {
        // Marketing users don't have access to individual customer analytics
        return null;
      } else {
        return null;
      }

      const { data: customer, error: customerError } = await customerQuery.maybeSingle();
      
      if (customerError) throw customerError;
      if (!customer) return null;

      // Get purchase statistics
      const { data: purchaseStats, error: statsError } = await supabase
        .from("purchases")
        .select(`
          total_amount,
          purchase_date,
          pickup_date,
          quantity,
          products (
            name
          )
        `)
        .eq("customer_id", customerId)
        .eq("data_environment", dataEnvironment)
        .not("pickup_date", "is", null); // Only completed purchases

      if (statsError) throw statsError;

      const purchases = purchaseStats || [];
      
      // Calculate statistics
      const totalPurchases = purchases.length;
      const totalSpent = purchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
      const averageOrderValue = totalPurchases > 0 ? totalSpent / totalPurchases : 0;
      
      const purchaseDates = purchases
        .map(p => p.pickup_date)
        .filter(Boolean)
        .sort();
      
      const firstPurchaseDate = purchaseDates[0] || null;
      const lastPurchaseDate = purchaseDates[purchaseDates.length - 1] || null;

      // Calculate favorite products
      const productCounts = purchases.reduce((acc, purchase) => {
        const productName = purchase.products?.name || 'Unknown Product';
        if (!acc[productName]) {
          acc[productName] = { count: 0, quantity: 0 };
        }
        acc[productName].count += 1;
        acc[productName].quantity += purchase.quantity || 0;
        return acc;
      }, {} as Record<string, { count: number; quantity: number }>);

      const favoriteProducts = Object.entries(productCounts)
        .map(([name, data]) => ({
          product_name: name,
          purchase_count: data.count,
          total_quantity: data.quantity,
        }))
        .sort((a, b) => b.purchase_count - a.purchase_count)
        .slice(0, 5);

      // Calculate purchase frequency
      const now = new Date();
      const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());

      const monthlyPurchases = purchases.filter(p => 
        p.pickup_date && new Date(p.pickup_date) >= oneMonthAgo
      ).length;

      const quarterlyPurchases = purchases.filter(p => 
        p.pickup_date && new Date(p.pickup_date) >= threeMonthsAgo
      ).length;

      const stats: CustomerStats = {
        totalPurchases,
        totalSpent,
        averageOrderValue,
        firstPurchaseDate,
        lastPurchaseDate,
        favoriteProducts,
        purchaseFrequency: {
          monthly: monthlyPurchases,
          quarterly: quarterlyPurchases,
        },
      };

      return {
        ...customer,
        relationship_type: customer.relationship_type as any,
        status: customer.status as any,
        referred_by_customer: customer.referred_by_customer ? (() => {
          // Handle both array and object formats from Supabase
          const refCustomer = Array.isArray(customer.referred_by_customer) 
            ? customer.referred_by_customer[0] 
            : customer.referred_by_customer;
          
          if (!refCustomer?.id) return undefined;
          
          return {
            id: refCustomer.id,
            name: refCustomer.name || '',
            email: refCustomer.email || '',
            relationship_type: 'customer' as const,
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
            tier_assigned_by: null,
            tier_assigned_at: null,
            tier_notes: null,
            assigned_to: null,
          };
        })() : undefined,
        stats,
      };
    },
    enabled: !!customerId && !!profile && (isAdmin || isSales),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useCustomerPurchases = (customerId: string) => {
  const { profile } = useUserProfile();
  const { isAdmin, isSales, isMarketing } = useUserRoles();
  const dataEnvironment = useDataEnvironment();
  
  return useQuery<any[]>({
    queryKey: ["customer-purchases", customerId, dataEnvironment, isAdmin ? "admin" : isSales ? "sales" : "guest"],
    queryFn: async (): Promise<any[]> => {
      if (!profile || !customerId) return [];

      // Admin users can see all purchase data
      if (isAdmin) {
        const { data: purchases, error } = await supabase
          .from("purchases")
          .select(`
            *,
            customer:customers!purchases_customer_id_fkey (
              id,
              name,
              email
            ),
            product:products (
              id,
              name,
              sku,
              category
            )
          `)
          .eq("customer_id", customerId)
          .eq("data_environment", dataEnvironment)
          .order("purchase_date", { ascending: false });

        if (error) throw error;
        return purchases || [];
      }

      // Sales users can see purchases for assigned customers or unassigned customers
      if (isSales) {
        const { data: customer } = await supabase
          .from("customers")
          .select("assigned_to")
          .eq("id", customerId)
          .eq("data_environment", dataEnvironment)
          .maybeSingle();
        
        // Allow access if customer is assigned to this user OR unassigned (null)
        if (customer && (customer.assigned_to === profile.id || customer.assigned_to === null)) {
          const { data: purchases, error } = await supabase
            .from("purchases")
            .select(`
              *,
              customer:customers!purchases_customer_id_fkey (
                id,
                name,
                email
              ),
              product:products (
                id,
                name,
                sku,
                category
              )
            `)
            .eq("customer_id", customerId)
            .eq("data_environment", dataEnvironment)
            .order("purchase_date", { ascending: false });

          if (error) throw error;
          return purchases || [];
        }
        return [];
      }

      // Marketing users don't get purchase access
      if (isMarketing) {
        return [];
      }

      // Other roles don't get access
      return [];
    },
    enabled: !!customerId && !!profile && (isAdmin || isSales),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useCustomersWithStats = () => {
  const { profile } = useUserProfile();
  const { isAdmin, isSales, isMarketing } = useUserRoles();
  const dataEnvironment = useDataEnvironment();
  
  return useQuery<CustomerWithStats[]>({
    queryKey: ["customers-with-stats", dataEnvironment, isAdmin ? "admin" : isSales ? "sales" : "guest"],
    queryFn: async (): Promise<CustomerWithStats[]> => {
      if (!profile) return [];

      // Get customers based on role
      let customerQuery = supabase.from("customers").select("*").eq("data_environment", dataEnvironment);
      
      if (isSales) {
        customerQuery = customerQuery.eq("assigned_to", profile.id);
      } else if (isMarketing) {
        return []; // Marketing users don't get individual analytics
      } else if (!isAdmin) {
        return [];
      }

      const { data: customers, error: customerError } = await customerQuery.order("name");
      
      if (customerError) throw customerError;
      if (!customers) return [];

      // Get purchase stats for all customers
      const { data: allPurchases, error: purchaseError } = await supabase
        .from("purchases")
        .select(`
          customer_id,
          total_amount,
          purchase_date,
          pickup_date,
          quantity
        `)
        .eq("data_environment", dataEnvironment)
        .not("pickup_date", "is", null)
        .in("customer_id", customers.map(c => c.id));

      if (purchaseError) throw purchaseError;

      // Group purchases by customer
      const purchasesByCustomer = (allPurchases || []).reduce((acc, purchase) => {
        if (!acc[purchase.customer_id]) {
          acc[purchase.customer_id] = [];
        }
        acc[purchase.customer_id].push(purchase);
        return acc;
      }, {} as Record<string, any[]>);

      // Calculate stats for each customer
      return customers.map(customer => {
        const customerPurchases = purchasesByCustomer[customer.id] || [];
        
        const totalPurchases = customerPurchases.length;
        const totalSpent = customerPurchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
        const averageOrderValue = totalPurchases > 0 ? totalSpent / totalPurchases : 0;
        
        const purchaseDates = customerPurchases
          .map(p => p.pickup_date)
          .filter(Boolean)
          .sort();
        
        const firstPurchaseDate = purchaseDates[0] || null;
        const lastPurchaseDate = purchaseDates[purchaseDates.length - 1] || null;

        const now = new Date();
        const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());

        const monthlyPurchases = customerPurchases.filter(p => 
          p.pickup_date && new Date(p.pickup_date) >= oneMonthAgo
        ).length;

        const quarterlyPurchases = customerPurchases.filter(p => 
          p.pickup_date && new Date(p.pickup_date) >= threeMonthsAgo
        ).length;

        const stats: CustomerStats = {
          totalPurchases,
          totalSpent,
          averageOrderValue,
          firstPurchaseDate,
          lastPurchaseDate,
          favoriteProducts: [],
          purchaseFrequency: {
            monthly: monthlyPurchases,
            quarterly: quarterlyPurchases,
          },
        };

        return {
          ...customer,
          relationship_type: customer.relationship_type as any,
          status: customer.status as any,
          stats,
        };
      });
    },
    enabled: !!profile && (isAdmin || isSales),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};