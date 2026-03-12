import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UnifiedRecord, RecordType, RegistryFilters, RegistryStats } from "@/types/registry";
import { Customer } from "@/types/database";
import { useDataEnvironment } from "@/hooks/useSandbox";
import { useCurrentOrganizationId } from "@/hooks/useOrganization";

const convertToUnifiedRecord = (record: any, type: RecordType): UnifiedRecord => {
  const baseRecord = {
    id: record.id,
    type,
    created_at: record.created_at,
    updated_at: record.updated_at,
    originalRecord: record,
    tags: [],
  };

  switch (type) {
    case 'customer':
      return {
        ...baseRecord,
        name: record.name,
        status: record.status,
        description: record.email,
        searchableText: `${record.name} ${record.email || ''} ${record.phone || ''}`.toLowerCase(),
        customerId: record.id,
        customerName: record.name,
        assignedTo: record.assigned_to,
        tags: record.relationship_type ? [record.relationship_type] : [],
      };

    case 'task':
      return {
        ...baseRecord,
        name: record.title,
        status: record.status,
        description: record.description,
        searchableText: `${record.title} ${record.description || ''}`.toLowerCase(),
        priority: record.priority,
        customerId: record.customer_id,
        customerName: record.customer?.name,
        assignedTo: record.assigned_to,
      };

    case 'call':
      return {
        ...baseRecord,
        name: record.task_number ? `Call ${record.task_number}` : record.title,
        status: record.status === 'completed' ? 'actioned' : record.status,
        description: record.title,
        searchableText: `${record.task_number || ''} ${record.title} ${record.description || ''} ${record.customer?.name || ''}`.toLowerCase(),
        priority: record.priority,
        customerId: record.customer_id,
        customerName: record.customer?.name,
        assignedTo: record.assigned_to,
      };

    case 'purchase':
      return {
        ...baseRecord,
        name: `Purchase ${record.receipt_number || record.ticket_number || record.id.slice(-8)}`,
        status: record.order_status || record.status,
        description: `${record.quantity}x ${record.product?.name || 'Product'}`,
        searchableText: `${record.receipt_number || ''} ${record.ticket_number || ''} ${record.product?.name || ''}`.toLowerCase(),
        amount: record.total_amount,
        customerId: record.customer_id,
        customerName: record.customer?.name,
      };

    case 'stock_order':
      return {
        ...baseRecord,
        name: record.name,
        status: record.delivery_status || 'ordered',
        description: record.vendor,
        searchableText: `${record.name} ${record.vendor || ''} ${record.order_number || ''}`.toLowerCase(),
        amount: record.amount,
        tags: record.category ? [record.category] : [],
      };

    case 'product':
      return {
        ...baseRecord,
        name: record.name,
        status: record.status || 'active',
        description: record.brand,
        searchableText: `${record.name} ${record.sku || ''} ${record.brand || ''}`.toLowerCase(),
        amount: record.price,
        tags: record.category ? [record.category] : [],
      };

    case 'shipment_record':
      return {
        ...baseRecord,
        name: `Shipment ${record.record_id}`,
        status: record.delivery_status || 'pending',
        description: record.carrier,
        searchableText: `${record.record_id} ${record.tracking_number || ''} ${record.carrier || ''}`.toLowerCase(),
        tags: record.record_type ? [record.record_type] : [],
      };

    case 'asset':
      return {
        ...baseRecord,
        name: record.asset_tag || `Asset ${record.id.slice(-8)}`,
        status: record.status || 'active',
        description: `${record.manufacturer || ''} ${record.model_number || ''}`.trim(),
        searchableText: `${record.asset_tag || ''} ${record.serial_number || ''} ${record.model_number || ''}`.toLowerCase(),
        assignedTo: record.assigned_to,
        tags: record.category ? [record.category] : [],
      };

    case 'quote':
      return {
        ...baseRecord,
        name: `Quote ${record.quote_number}`,
        status: record.status,
        description: record.title,
        searchableText: `${record.quote_number} ${record.title || ''}`.toLowerCase(),
        amount: record.final_amount,
        customerId: record.customer_id,
      };

    case 'appointment':
      return {
        ...baseRecord,
        name: record.title,
        status: record.status,
        description: record.description,
        searchableText: `${record.title} ${record.description || ''}`.toLowerCase(),
        customerId: record.customer_id,
        assignedTo: record.assigned_to,
        tags: record.appointment_type ? [record.appointment_type] : [],
      };

    default:
      return {
        ...baseRecord,
        name: record.name || record.title || record.id.slice(-8),
        status: record.status || 'active',
        description: record.description || '',
        searchableText: `${record.name || record.title || ''} ${record.description || ''}`.toLowerCase(),
      };
  }
};

export const useRegistryData = (filters: RegistryFilters) => {
  const dataEnvironment = useDataEnvironment();
  const organizationId = useCurrentOrganizationId();

  return useQuery({
    queryKey: ["registry-data", dataEnvironment, organizationId, filters],
    queryFn: async (): Promise<UnifiedRecord[]> => {
      if (!organizationId) return [];
      const allRecords: UnifiedRecord[] = [];

      // Fetch data from each table based on filters
      const recordTypes = filters.recordTypes.length > 0 ? filters.recordTypes : Object.keys({
        customer: true,
        task: true,
        call: true,
        purchase: true,
        stock_order: true,
        product: true,
        shipment_record: true,
        asset: true,
        quote: true,
        appointment: true,
      }) as RecordType[];

      const fetchPromises = recordTypes.map(async (type) => {
        try {
          let query: any;

          switch (type) {
            case 'customer':
              query = supabase.from('customers').select('*').eq('data_environment', dataEnvironment).eq('organization_id', organizationId);
              break;
            case 'task':
              query = supabase.from('tasks').select(`
                *,
                customer:customers!customer_id(id, name)
              `).eq('data_environment', dataEnvironment).eq('organization_id', organizationId).neq('task_type', 'call');
              break;
            case 'call':
              query = supabase.from('tasks').select(`
                *,
                customer:customers!customer_id(id, name)
              `).eq('data_environment', dataEnvironment).eq('organization_id', organizationId).eq('task_type', 'call');
              break;
            case 'purchase':
              query = supabase.from('purchases').select(`
                *,
                customer:customers!customer_id(id, name),
                product:products!product_id(id, name)
              `).eq('data_environment', dataEnvironment).eq('organization_id', organizationId);
              break;
            case 'stock_order':
              query = supabase.from('stock_orders').select('*').eq('data_environment', dataEnvironment).eq('organization_id', organizationId);
              break;
            case 'product':
              query = supabase.from('products').select('*').eq('data_environment', dataEnvironment).eq('organization_id', organizationId);
              break;
            case 'shipment_record':
              query = supabase.from('shipment_records').select('*').eq('data_environment', dataEnvironment).eq('organization_id', organizationId);
              break;
            case 'asset':
              query = supabase.from('asset_management').select('*').eq('data_environment', dataEnvironment).eq('organization_id', organizationId);
              break;
            case 'quote':
              query = supabase.from('quotes').select('*').eq('data_environment', dataEnvironment).eq('organization_id', organizationId);
              break;
            case 'appointment':
              query = supabase.from('appointments').select('*').eq('data_environment', dataEnvironment).eq('organization_id', organizationId);
              break;
            default:
              return [];
          }

          // Apply date filters
          if (filters.dateFrom) {
            query = query.gte('created_at', filters.dateFrom.toISOString());
          }
          if (filters.dateTo) {
            query = query.lte('created_at', filters.dateTo.toISOString());
          }

          // Apply status filters
          if (filters.status.length > 0) {
            query = query.in('status', filters.status);
          }

          const { data, error } = await query;
          if (error) {
            console.error(`Error fetching ${type}:`, error);
            return [];
          }

          return (data || []).map((record: any) => convertToUnifiedRecord(record, type));
        } catch (error) {
          console.error(`Error processing ${type}:`, error);
          return [];
        }
      });

      const results = await Promise.all(fetchPromises);
      results.forEach(records => allRecords.push(...records));

      // Apply search filter
      let filteredRecords = allRecords;
      if (filters.search.trim()) {
        const searchTerm = filters.search.toLowerCase();
        filteredRecords = allRecords.filter(record =>
          record.searchableText.includes(searchTerm) ||
          record.name.toLowerCase().includes(searchTerm) ||
          (record.description && record.description.toLowerCase().includes(searchTerm))
        );
      }

      // Apply amount filters
      if (filters.amountMin !== undefined) {
        filteredRecords = filteredRecords.filter(record =>
          record.amount !== undefined && record.amount >= filters.amountMin!
        );
      }
      if (filters.amountMax !== undefined) {
        filteredRecords = filteredRecords.filter(record =>
          record.amount !== undefined && record.amount <= filters.amountMax!
        );
      }

      // Apply assigned to filter
      if (filters.assignedTo && filters.assignedTo.length > 0) {
        filteredRecords = filteredRecords.filter(record =>
          record.assignedTo && filters.assignedTo!.includes(record.assignedTo)
        );
      }

      // Sort by most recent
      return filteredRecords.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
  });
};

export const useRegistryStats = () => {
  const dataEnvironment = useDataEnvironment();
  const organizationId = useCurrentOrganizationId();

  return useQuery({
    queryKey: ["registry-stats", dataEnvironment, organizationId],
    queryFn: async (): Promise<RegistryStats> => {
      if (!organizationId) {
        return {
          totalRecords: 0,
          recordsByType: {} as Record<RecordType, number>,
          recordsByStatus: {},
          recentActivity: {
            today: 0,
            thisWeek: 0,
            thisMonth: 0,
          },
        };
      }
      const stats: RegistryStats = {
        totalRecords: 0,
        recordsByType: {} as Record<RecordType, number>,
        recordsByStatus: {},
        recentActivity: {
          today: 0,
          thisWeek: 0,
          thisMonth: 0,
        },
      };

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Initialize counters for each record type
      const recordTypes: RecordType[] = ['customer', 'task', 'call', 'purchase', 'stock_order', 'product', 'shipment_record', 'asset', 'quote', 'appointment'];

      for (const type of recordTypes) {
        stats.recordsByType[type] = 0;
      }

      // Count records for each type
      const countPromises = recordTypes.map(async (type) => {
        try {
          let countQuery: any;
          let recentQuery: any;

          switch (type) {
            case 'customer':
              countQuery = supabase.from('customers').select('*', { count: 'exact', head: true }).eq('data_environment', dataEnvironment).eq('organization_id', organizationId);
              recentQuery = supabase.from('customers').select('created_at').eq('data_environment', dataEnvironment).eq('organization_id', organizationId).gte('created_at', thisMonth.toISOString());
              break;
            case 'task':
              countQuery = supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('data_environment', dataEnvironment).eq('organization_id', organizationId).neq('task_type', 'call');
              recentQuery = supabase.from('tasks').select('created_at').eq('data_environment', dataEnvironment).eq('organization_id', organizationId).neq('task_type', 'call').gte('created_at', thisMonth.toISOString());
              break;
            case 'call':
              countQuery = supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('data_environment', dataEnvironment).eq('organization_id', organizationId).eq('task_type', 'call');
              recentQuery = supabase.from('tasks').select('created_at').eq('data_environment', dataEnvironment).eq('organization_id', organizationId).eq('task_type', 'call').gte('created_at', thisMonth.toISOString());
              break;
            case 'purchase':
              countQuery = supabase.from('purchases').select('*', { count: 'exact', head: true }).eq('data_environment', dataEnvironment).eq('organization_id', organizationId);
              recentQuery = supabase.from('purchases').select('created_at').eq('data_environment', dataEnvironment).eq('organization_id', organizationId).gte('created_at', thisMonth.toISOString());
              break;
            case 'stock_order':
              countQuery = supabase.from('stock_orders').select('*', { count: 'exact', head: true }).eq('data_environment', dataEnvironment).eq('organization_id', organizationId);
              recentQuery = supabase.from('stock_orders').select('created_at').eq('data_environment', dataEnvironment).eq('organization_id', organizationId).gte('created_at', thisMonth.toISOString());
              break;
            case 'product':
              countQuery = supabase.from('products').select('*', { count: 'exact', head: true }).eq('data_environment', dataEnvironment).eq('organization_id', organizationId);
              recentQuery = supabase.from('products').select('created_at').eq('data_environment', dataEnvironment).eq('organization_id', organizationId).gte('created_at', thisMonth.toISOString());
              break;
            case 'shipment_record':
              countQuery = supabase.from('shipment_records').select('*', { count: 'exact', head: true }).eq('data_environment', dataEnvironment).eq('organization_id', organizationId);
              recentQuery = supabase.from('shipment_records').select('created_at').eq('data_environment', dataEnvironment).eq('organization_id', organizationId).gte('created_at', thisMonth.toISOString());
              break;
            case 'asset':
              countQuery = supabase.from('asset_management').select('*', { count: 'exact', head: true }).eq('data_environment', dataEnvironment).eq('organization_id', organizationId);
              recentQuery = supabase.from('asset_management').select('created_at').eq('data_environment', dataEnvironment).eq('organization_id', organizationId).gte('created_at', thisMonth.toISOString());
              break;
            case 'quote':
              countQuery = supabase.from('quotes').select('*', { count: 'exact', head: true }).eq('data_environment', dataEnvironment).eq('organization_id', organizationId);
              recentQuery = supabase.from('quotes').select('created_at').eq('data_environment', dataEnvironment).eq('organization_id', organizationId).gte('created_at', thisMonth.toISOString());
              break;
            case 'appointment':
              countQuery = supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('data_environment', dataEnvironment).eq('organization_id', organizationId);
              recentQuery = supabase.from('appointments').select('created_at').eq('data_environment', dataEnvironment).eq('organization_id', organizationId).gte('created_at', thisMonth.toISOString());
              break;
            default:
              return;
          }

          const { count } = await countQuery;

          if (count !== null) {
            stats.recordsByType[type] = count;
            stats.totalRecords += count;
          }

          // Count recent activity
          const { data: recentRecords } = await recentQuery;

          if (recentRecords) {
            recentRecords.forEach(record => {
              const createdAt = new Date(record.created_at);
              if (createdAt >= today) {
                stats.recentActivity.today++;
              }
              if (createdAt >= thisWeek) {
                stats.recentActivity.thisWeek++;
              }
              if (createdAt >= thisMonth) {
                stats.recentActivity.thisMonth++;
              }
            });
          }
        } catch (error) {
          console.error(`Error counting ${type}:`, error);
        }
      });

      await Promise.all(countPromises);

      return stats;
    },
  });
};