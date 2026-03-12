import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDataEnvironment } from "@/hooks/useSandbox";
import { useCurrentOrganizationId } from "@/hooks/useOrganization";
import { startOfMonth, subMonths, format, subDays } from "date-fns";

export interface OrderStatusData {
  name: string;
  value: number;
  color: string;
}

export interface CustomerComparisonData {
  currentMonth: number;
  previousMonth: number;
  percentChange: number;
  isPositive: boolean;
}

export interface RevenueTrendData {
  date: string;
  value: number;
}

export interface RevenueProgressData {
  current: number;
  target: number;
  percentage: number;
}

export interface OrderTrendData {
  date: string;
  value: number;
}

export interface StockOverviewData {
  available: number;
  sold: number;
  statusBreakdown: {
    label: string;
    value: number;
    color: string;
  }[];
  categoryBreakdown: {
    label: string;
    sold: number;
    available: number;
  }[];
}

export const useAnalyticsSummary = (enabled: boolean = true) => {
  const dataEnvironment = useDataEnvironment();
  const orgId = useCurrentOrganizationId();

  // Order status breakdown + Product Types + Revenue
  const orderStatusQuery = useQuery({
    queryKey: ["analytics-order-status-extended", dataEnvironment, orgId],
    queryFn: async () => {
      if (!orgId) return { statusData: [], productTypeData: [], totalRevenue: 0 };

      let query = supabase
        .from("purchases")
        .select(`
          id, 
          pickup_date, 
          status, 
          order_status, 
          allocation_status, 
          total_amount,
          product:products(category)
        `)
        .eq("data_environment", dataEnvironment)
        .eq("organization_id", orgId);

      const { data, error } = await query;
      if (error) throw error;

      const purchases = data || [];

      // 1. Order Status Breakdown
      const completed = purchases.filter(p => p.pickup_date !== null).length;

      // Calculate Total Revenue from completed orders
      const totalRevenue = purchases
        .filter(p => p.pickup_date !== null)
        .reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0);

      // Active states
      const ordered = purchases.filter(p => p.pickup_date === null && p.status !== 'cancelled' && p.order_status === 'ordered').length;
      const configuring = purchases.filter(p => p.pickup_date === null && p.status !== 'cancelled' && p.order_status === 'configuring').length;
      const pendingAllocation = purchases.filter(p => p.pickup_date === null && p.status !== 'cancelled' && p.allocation_status === 'pending_allocation').length;
      const otherPending = purchases.filter(p =>
        p.pickup_date === null &&
        p.status !== 'cancelled' &&
        p.order_status !== 'ordered' &&
        p.order_status !== 'configuring' &&
        p.allocation_status !== 'pending_allocation'
      ).length;
      const cancelled = purchases.filter(p => p.status === 'cancelled').length;

      const statusData = [
        { name: "Ordered", value: ordered, color: "hsl(var(--success))" },
        { name: "Configuring", value: configuring, color: "hsl(var(--warning))" },
        { name: "Allocation", value: pendingAllocation, color: "hsl(var(--destructive))" },
        { name: "Ready/Other", value: otherPending, color: "hsl(var(--primary))" },
        { name: "Completed", value: completed, color: "hsl(var(--muted-foreground))" }, // Keep for reference
        { name: "Cancelled", value: cancelled, color: "hsl(var(--border))" },
      ].filter(item => item.value > 0);

      // 2. Product Type Breakdown (from completed orders? or all? Let's use all active+completed for better distribution view)
      const validPurchases = purchases.filter(p => p.status !== 'cancelled');
      const categoryCounts: Record<string, number> = {};

      validPurchases.forEach(p => {
        const cat = (p.product as any)?.category || 'Other';
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });

      // Define standard category colors
      const categoryColors: Record<string, string> = {
        'Electronics': 'hsl(var(--chart-1))',
        'Accessories': 'hsl(var(--chart-2))',
        'Services': 'hsl(var(--chart-3))',
        'Hardware': 'hsl(var(--chart-4))',
        'Software': 'hsl(var(--chart-5))',
        'Other': 'hsl(var(--muted))'
      };

      // Fallback colors array
      const fallbackColors = [
        'hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))',
        'hsl(var(--chart-4))', 'hsl(var(--chart-5))'
      ];

      const productTypeData = Object.entries(categoryCounts)
        .map(([name, value], idx) => ({
          name,
          value,
          color: categoryColors[name] || fallbackColors[idx % fallbackColors.length]
        }))
        .sort((a, b) => b.value - a.value);

      return {
        statusData,
        productTypeData,
        totalRevenue
      };
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
    enabled,
  });

  // Revenue trend (last 7 days)
  const revenueTrendQuery = useQuery({
    queryKey: ["analytics-revenue-trend", dataEnvironment, orgId],
    queryFn: async (): Promise<RevenueTrendData[]> => {
      const now = new Date();
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(now, 6 - i);
        date.setHours(0, 0, 0, 0);
        return date;
      });

      const dailyRevenue = await Promise.all(
        last7Days.map(async (date) => {
          const startOfDay = date.toISOString();
          const endOfDay = new Date(date);
          endOfDay.setHours(23, 59, 59, 999);

          if (!orgId) return { date: format(date, 'MMM dd'), value: 0 };

          const { data } = await supabase
            .from("purchases")
            .select("total_amount")
            .eq("data_environment", dataEnvironment)
            .eq("organization_id", orgId)
            .gte("purchase_date", startOfDay)
            .lte("purchase_date", endOfDay.toISOString())
            .not("pickup_date", "is", null);
          const total = data?.reduce((sum, p) => sum + Number(p.total_amount), 0) || 0;

          return {
            date: format(date, 'MMM dd'),
            value: total
          };
        })
      );

      return dailyRevenue;
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
    enabled,
  });

  // Order trend (last 7 days)
  const orderTrendQuery = useQuery({
    queryKey: ["analytics-order-trend", dataEnvironment, orgId],
    queryFn: async (): Promise<OrderTrendData[]> => {
      const now = new Date();
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(now, 6 - i);
        date.setHours(0, 0, 0, 0);
        return date;
      });

      const dailyOrders = await Promise.all(
        last7Days.map(async (date) => {
          const startOfDay = date.toISOString();
          const endOfDay = new Date(date);
          endOfDay.setHours(23, 59, 59, 999);

          if (!orgId) return { date: format(date, 'MMM dd'), value: 0 };

          const { count } = await supabase
            .from("purchases")
            .select("id", { count: 'exact' })
            .eq("data_environment", dataEnvironment)
            .eq("organization_id", orgId)
            .gte("purchase_date", startOfDay)
            .lte("purchase_date", endOfDay.toISOString());

          return {
            date: format(date, 'MMM dd'),
            value: count || 0
          };
        })
      );

      return dailyOrders;
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
    enabled,
  });

  // Monthly revenue progress (with configurable target)
  const revenueProgressQuery = useQuery({
    queryKey: ["analytics-revenue-progress", dataEnvironment, orgId],
    queryFn: async (): Promise<RevenueProgressData> => {
      const startOfCurrentMonth = startOfMonth(new Date());

      if (!orgId) return { current: 0, target: 10000, percentage: 0 };

      const { data, error } = await supabase
        .from("purchases")
        .select("total_amount")
        .eq("data_environment", dataEnvironment)
        .eq("organization_id", orgId)
        .gte("purchase_date", startOfCurrentMonth.toISOString())
        .not("pickup_date", "is", null);
      if (error) throw error;

      const currentRevenue = data?.reduce((sum, p) => sum + Number(p.total_amount), 0) || 0;

      // Default monthly target - could be made configurable
      const monthlyTarget = 10000;
      const percentage = monthlyTarget > 0 ? Math.min((currentRevenue / monthlyTarget) * 100, 100) : 0;

      return {
        current: currentRevenue,
        target: monthlyTarget,
        percentage: Math.round(percentage),
      };
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
    enabled,
  });

  // Customer comparison (this month vs last month)
  const customerComparisonQuery = useQuery({
    queryKey: ["analytics-customer-comparison", dataEnvironment, orgId],
    queryFn: async (): Promise<CustomerComparisonData> => {
      const startOfCurrentMonth = startOfMonth(new Date());
      const startOfPreviousMonth = startOfMonth(subMonths(new Date(), 1));
      const endOfPreviousMonth = new Date(startOfCurrentMonth);
      endOfPreviousMonth.setDate(0);
      endOfPreviousMonth.setHours(23, 59, 59, 999);

      if (!orgId) return { currentMonth: 0, previousMonth: 0, percentChange: 0, isPositive: true };

      // Current month customers
      const { count: currentCount } = await supabase
        .from("customers")
        .select("id", { count: "exact" })
        .eq("data_environment", dataEnvironment)
        .eq("organization_id", orgId)
        .gte("created_at", startOfCurrentMonth.toISOString());

      // Previous month customers
      const { count: previousCount } = await supabase
        .from("customers")
        .select("id", { count: "exact" })
        .eq("data_environment", dataEnvironment)
        .eq("organization_id", orgId)
        .gte("created_at", startOfPreviousMonth.toISOString())
        .lte("created_at", endOfPreviousMonth.toISOString());

      const current = currentCount || 0;
      const previous = previousCount || 0;

      let percentChange = 0;
      if (previous > 0) {
        percentChange = Math.round(((current - previous) / previous) * 100);
      } else if (current > 0) {
        percentChange = 100;
      }

      return {
        currentMonth: current,
        previousMonth: previous,
        percentChange: Math.abs(percentChange),
        isPositive: percentChange >= 0,
      };
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
    enabled,
  });

  // Total customers count
  const totalCustomersQuery = useQuery({
    queryKey: ["analytics-total-customers", dataEnvironment, orgId],
    queryFn: async (): Promise<number> => {
      if (!orgId) return 0;

      const { count } = await supabase
        .from("customers")
        .select("id", { count: "exact" })
        .eq("data_environment", dataEnvironment)
        .eq("organization_id", orgId);
      return count || 0;
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
    enabled,
  });

  // Stock overview — uses SoT metrics (sot_s3_available, sot_s6_sold)
  const stockOverviewQuery = useQuery({
    queryKey: ["analytics-stock-overview", dataEnvironment, orgId],
    queryFn: async (): Promise<StockOverviewData> => {
      if (!orgId) return { available: 0, sold: 0, statusBreakdown: [], categoryBreakdown: [] };

      // Fetch products with SoT metrics (no legacy stock_quantity)
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id, name, status, category, is_bundle, sot_s3_available, sot_s6_sold")
        .eq("data_environment", dataEnvironment)
        .eq("organization_id", orgId);
      if (productsError) throw productsError;

      // Filter out bundles
      const nonBundleProducts = products?.filter(p => {
        const isBundleCat = p.category?.trim().toLowerCase() === 'bundle' || p.category?.trim().toLowerCase() === 'bundles';
        return !p.is_bundle && !isBundleCat;
      }) || [];

      const statusCounts: Record<string, number> = {};
      const categoryAvailable: Record<string, number> = {};
      const categorySold: Record<string, number> = {};
      let totalAvailable = 0;
      let totalSold = 0;

      nonBundleProducts.forEach(p => {
        const s = p.status || 'unknown';
        statusCounts[s] = (statusCounts[s] || 0) + 1;

        const cat = p.category || 'Other';
        const avail = Number(p.sot_s3_available) || 0;
        const sold = Number(p.sot_s6_sold) || 0;

        categoryAvailable[cat] = (categoryAvailable[cat] || 0) + avail;
        categorySold[cat] = (categorySold[cat] || 0) + sold;
        totalAvailable += avail;
        totalSold += sold;
      });

      // Category breakdown sorted by sold volume (top 5)
      const allCategories = Array.from(new Set([
        ...Object.keys(categoryAvailable),
        ...Object.keys(categorySold)
      ])).filter(cat => {
        const c = cat.trim().toLowerCase();
        return c !== 'bundle' && c !== 'bundles';
      });

      const categoryBreakdown = allCategories
        .map(cat => ({
          label: cat,
          sold: categorySold[cat] || 0,
          available: categoryAvailable[cat] || 0
        }))
        .sort((a, b) => b.sold - a.sold)
        .slice(0, 5);

      return {
        available: totalAvailable,
        sold: totalSold,
        statusBreakdown: [
          { label: "Active", value: statusCounts['active'] || 0, color: "hsl(var(--success))" },
        ].filter(item => item.value > 0),
        categoryBreakdown
      };
    },
    refetchInterval: 10 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
    enabled,
  });

  const isLoading =
    orderStatusQuery.isLoading ||
    revenueTrendQuery.isLoading ||
    revenueProgressQuery.isLoading ||
    customerComparisonQuery.isLoading ||
    totalCustomersQuery.isLoading ||
    orderTrendQuery.isLoading ||
    stockOverviewQuery.isLoading;

  return {
    orderStatusData: orderStatusQuery.data?.statusData || [],
    productTypeData: orderStatusQuery.data?.productTypeData || [],
    totalRevenue: orderStatusQuery.data?.totalRevenue || 0,
    revenueTrend: revenueTrendQuery.data || [],
    orderTrend: orderTrendQuery.data || [],
    revenueProgress: revenueProgressQuery.data || { current: 0, target: 10000, percentage: 0 },
    customerComparison: customerComparisonQuery.data || {
      currentMonth: 0,
      previousMonth: 0,
      percentChange: 0,
      isPositive: true
    },
    totalCustomers: totalCustomersQuery.data || 0,
    stockOverview: stockOverviewQuery.data || {
      available: 0,
      sold: 0,
      statusBreakdown: [],
      categoryBreakdown: []
    },
    isLoading,
  };
};
