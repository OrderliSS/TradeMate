import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, format } from "date-fns";
import { useDataEnvironment } from "@/hooks/useSandbox";

export interface RecentActivity {
  id: string;
  type: 'order_created' | 'task_completed' | 'inventory_change' | 'customer_created';
  description: string;
  title?: string;
  subtitle?: string;
  timestamp: string;
  icon: 'ShoppingCart' | 'CheckSquare' | 'Package' | 'Users';
  link?: string;
}

export interface LowStockAlert {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
  reorderLevel: number;
  category: string;
  severity: 'critical' | 'warning' | 'watch' | 'healthy';
  onOrder: number;
}

export interface UpcomingDeadline {
  id: string;
  title: string;
  type: 'task' | 'appointment';
  dueDate: string;
  isOverdue: boolean;
  customer?: string;
  link: string;
}

export interface TopCustomer {
  id: string;
  name: string;
  revenue: number;
  orderCount: number;
  email?: string;
}

export interface TopVendor {
  id: string;
  name: string;
  spend: number;
  orderCount: number;
}

export const useRecentActivity = () => {
  const dataEnvironment = useDataEnvironment();

  return useQuery({
    queryKey: ["recent-activity", dataEnvironment],
    queryFn: async (): Promise<RecentActivity[]> => {
      const activities: RecentActivity[] = [];

      // Fetch recent purchases (last 10)
      const { data: purchases } = await supabase
        .from("purchases")
        .select(`
          id,
          receipt_number,
          created_at,
          customer:customers!purchases_customer_id_fkey(name),
          product:products(name)
        `)
        .eq("data_environment", dataEnvironment)
        .order("created_at", { ascending: false })
        .limit(5);

      purchases?.forEach(p => {
        activities.push({
          id: p.id,
          type: 'order_created',
          description: `Order #${p.receipt_number || 'N/A'} created for ${p.customer?.name || 'Unknown'}`,
          title: `Order #${p.receipt_number || 'N/A'}`,
          subtitle: p.customer?.name || 'Unknown',
          timestamp: p.created_at,
          icon: 'ShoppingCart',
          link: `/purchases/${p.id}`
        });
      });

      // Fetch recently completed tasks (last 10)
      const { data: tasks } = await supabase
        .from("tasks")
        .select(`
          id,
          title,
          updated_at,
          customer:customers!customer_id(name)
        `)
        .eq("status", "completed")
        .eq("data_environment", dataEnvironment)
        .order("updated_at", { ascending: false })
        .limit(5);

      tasks?.forEach(t => {
        const customerName = t.customer && typeof t.customer === 'object' && 'name' in t.customer ? t.customer.name : null;
        activities.push({
          id: t.id,
          type: 'task_completed',
          description: `Task "${t.title}" completed${customerName ? ` for ${customerName}` : ''}`,
          title: t.title,
          subtitle: customerName || 'Internal',
          timestamp: t.updated_at,
          icon: 'CheckSquare',
          link: `/tasks`
        });
      });

      // Fetch recent customers (last 3)
      const { data: customers } = await supabase
        .from("customers")
        .select("id, name, created_at")
        .eq("data_environment", dataEnvironment)
        .order("created_at", { ascending: false })
        .limit(3);

      customers?.forEach(c => {
        activities.push({
          id: c.id,
          type: 'customer_created',
          description: `New customer "${c.name}" added`,
          title: "New customer",
          subtitle: c.name,
          timestamp: c.created_at,
          icon: 'Users',
          link: `/contacts/${c.id}`
        });
      });

      // Sort all activities by timestamp and take the 10 most recent
      return activities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10);
    },
    refetchInterval: 60000, // Refresh every minute
  });
};

export const useLowStockAlerts = () => {
  const dataEnvironment = useDataEnvironment();

  return useQuery({
    queryKey: ["low-stock-alerts", dataEnvironment],
    queryFn: async (): Promise<LowStockAlert[]> => {
      // Use SoT metrics for accurate available stock
      const { data: products, error } = await supabase
        .from("products")
        .select("id, name, sku, sot_s3_available, sot_s0_on_order, reorder_level, category, is_bundle")
        .in("status", ["active", "out_of_stock"])
        .eq("is_bundle", false)
        .eq("data_environment", dataEnvironment);

      if (error) throw error;

      // Assign severity to ALL active products based on stock vs reorder level
      const allProducts = products || [];
      const results: LowStockAlert[] = allProducts.map(p => {
        const available = p.sot_s3_available ?? 0;
        const threshold = p.reorder_level ?? 5;
        let severity: 'critical' | 'warning' | 'watch' | 'healthy';
        if (available === 0) severity = 'critical';
        else if (available < threshold) severity = 'warning';
        else if (available <= threshold * 1.2) severity = 'watch';
        else severity = 'healthy';

        return {
          id: p.id,
          name: p.name,
          sku: p.sku || 'N/A',
          currentStock: available,
          reorderLevel: threshold,
          category: p.category || 'Uncategorized',
          severity,
          onOrder: p.sot_s0_on_order ?? 0,
        };
      });

      // Sort: critical first, then warning, then watch, then healthy
      return results.sort((a, b) => {
        const order = { critical: 0, warning: 1, watch: 2, healthy: 3 };
        if (a.severity !== b.severity) return order[a.severity] - order[b.severity];
        return a.currentStock - b.currentStock;
      });
    },
    refetchInterval: 5 * 60 * 1000,
  });
};

export const useUpcomingDeadlines = () => {
  const dataEnvironment = useDataEnvironment();

  return useQuery({
    queryKey: ["upcoming-deadlines", dataEnvironment],
    queryFn: async (): Promise<UpcomingDeadline[]> => {
      const now = new Date().toISOString();
      const deadlines: UpcomingDeadline[] = [];

      // Fetch upcoming and overdue tasks
      const { data: tasks } = await supabase
        .from("tasks")
        .select(`
          id,
          title,
          due_date,
          follow_up_date,
          customer:customers!customer_id(name)
        `)
        .in("status", ['pending', 'on_hold'])
        .eq("data_environment", dataEnvironment)
        .or(`due_date.gte.${now},due_date.lt.${now},follow_up_date.gte.${now},follow_up_date.lt.${now}`)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(5);

      tasks?.forEach(t => {
        const dueDate = t.due_date || t.follow_up_date;
        const customerName = t.customer && typeof t.customer === 'object' && 'name' in t.customer
          ? (t.customer as { name: string }).name
          : undefined;
        if (dueDate) {
          deadlines.push({
            id: t.id,
            title: t.title,
            type: 'task',
            dueDate: dueDate,
            isOverdue: new Date(dueDate) < new Date(),
            customer: customerName,
            link: '/tasks'
          });
        }
      });

      // Fetch upcoming appointments
      const { data: appointments } = await supabase
        .from("appointments")
        .select(`
          id,
          title,
          start_time,
          customer:customers!customer_id(name)
        `)
        .eq("data_environment", dataEnvironment)
        .gte("start_time", now)
        .order("start_time", { ascending: true })
        .limit(5);

      appointments?.forEach(a => {
        const customerName = a.customer && typeof a.customer === 'object' && 'name' in a.customer
          ? (a.customer as { name: string }).name
          : undefined;
        deadlines.push({
          id: a.id,
          title: a.title,
          type: 'appointment',
          dueDate: a.start_time,
          isOverdue: false,
          customer: customerName,
          link: '/calendar'
        });
      });

      // Sort by date and take the 5 most urgent
      return deadlines
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
        .slice(0, 5);
    },
    refetchInterval: 60000, // Refresh every minute
  });
};

export const useTopCustomers = (timeframe: 'month' | 'all' = 'month') => {
  const dataEnvironment = useDataEnvironment();

  return useQuery({
    queryKey: ["top-customers", dataEnvironment, timeframe],
    queryFn: async (): Promise<TopCustomer[]> => {
      // Fetch purchases with customer info
      let query = supabase
        .from("purchases")
        .select(`
          id,
          customer_id,
          total_amount,
          pickup_date,
          customer:customers!purchases_customer_id_fkey(id, name, email)
        `)
        .eq("data_environment", dataEnvironment)
        .not("pickup_date", "is", null); // Only completed orders

      if (timeframe === 'month') {
        const startOfMonthDate = startOfMonth(new Date()).toISOString();
        query = query.gte("purchase_date", startOfMonthDate);
      }

      const { data: purchases, error } = await query;

      if (error) throw error;

      // Group by customer and calculate totals
      const customerMap = new Map<string, TopCustomer>();

      purchases?.forEach(p => {
        if (!p.customer) return;

        const existing = customerMap.get(p.customer_id);
        if (existing) {
          existing.revenue += Number(p.total_amount);
          existing.orderCount += 1;
        } else {
          customerMap.set(p.customer_id, {
            id: p.customer.id,
            name: p.customer.name,
            revenue: Number(p.total_amount),
            orderCount: 1,
            email: p.customer.email || undefined
          });
        }
      });

      // Convert to array, sort by revenue, and take top 5
      return Array.from(customerMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
    },
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });
};

export const useRevenueSparkline = () => {
  const dataEnvironment = useDataEnvironment();

  return useQuery({
    queryKey: ["revenue-sparkline", dataEnvironment],
    queryFn: async () => {
      const now = new Date();
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(now);
        date.setDate(date.getDate() - (6 - i));
        date.setHours(0, 0, 0, 0);
        return date;
      });

      const dailyRevenue = await Promise.all(
        last7Days.map(async (date) => {
          const startOfDay = date.toISOString();
          const endOfDay = new Date(date);
          endOfDay.setHours(23, 59, 59, 999);

          const { data } = await supabase
            .from("purchases")
            .select("total_amount")
            .eq("data_environment", dataEnvironment)
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
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });
};

export const useTopVendors = (timeframe: 'month' | 'all' = 'month') => {
  const dataEnvironment = useDataEnvironment();

  return useQuery({
    queryKey: ["top-vendors", dataEnvironment, timeframe],
    queryFn: async (): Promise<TopVendor[]> => {
      let query = supabase
        .from("stock_orders")
        .select(`
          id,
          vendor_store_name,
          amount,
          created_at
        `)
        .eq("data_environment", dataEnvironment);

      if (timeframe === 'month') {
        const startOfMonthDate = startOfMonth(new Date()).toISOString();
        query = query.gte("created_at", startOfMonthDate);
      }

      const { data: orders, error } = await query;

      if (error) throw error;

      // Group by vendor and calculate totals
      const vendorMap = new Map<string, TopVendor>();

      orders?.forEach(o => {
        const vendorName = o.vendor_store_name || 'Unknown Vendor';
        const existing = vendorMap.get(vendorName);
        if (existing) {
          existing.spend += Number(o.amount || 0);
          existing.orderCount += 1;
        } else {
          vendorMap.set(vendorName, {
            id: vendorName,
            name: vendorName,
            spend: Number(o.amount || 0),
            orderCount: 1
          });
        }
      });

      // Convert to array, sort by spend, and take top 3
      return Array.from(vendorMap.values())
        .sort((a, b) => b.spend - a.spend)
        .slice(0, 3);
    },
    refetchInterval: 5 * 60 * 1000,
  });
};

export const useRecentStockOrders = (limit: number = 3) => {
  const dataEnvironment = useDataEnvironment();

  return useQuery({
    queryKey: ["recent-stock-orders", dataEnvironment, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_orders")
        .select(`
          id,
          vendor_store_name,
          amount,
          created_at,
          order_number
        `)
        .eq("data_environment", dataEnvironment)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000,
  });
};

export const useTopSellerProducts = () => {
  const dataEnvironment = useDataEnvironment();

  return useQuery({
    queryKey: ["top-seller-products", dataEnvironment],
    queryFn: async () => {
      const { data: purchases, error } = await supabase
        .from("purchases")
        .select("id, quantity, product:products(name)")
        .eq("data_environment", dataEnvironment);

      if (error) throw error;

      const productStats = new Map<string, { name: string; count: number }>();
      (purchases || []).forEach((p: any) => {
        const name = p.product?.name || 'Unknown';
        const existing = productStats.get(name);
        if (existing) {
          existing.count += (p.quantity || 1);
        } else {
          productStats.set(name, { name, count: (p.quantity || 1) });
        }
      });

      return Array.from(productStats.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);
    },
    refetchInterval: 5 * 60 * 1000,
  });
};
