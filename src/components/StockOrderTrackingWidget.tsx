import React from 'react';
import { Truck, Package, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useCanonicalStockOrders, CanonicalStockOrder } from '@/hooks/useCanonicalStockOrders';
import { usePackageRecords } from '@/hooks/usePackageRecords';
import { useEnvNavigate } from '@/hooks/useEnvNavigate';
import { cn } from '@/lib/utils';
import { getStatusLabel } from '@/lib/tracking-status-labels';

interface StockOrderTrackingWidgetProps {
  filter: 'all' | 'processing' | 'inTransit' | 'pending' | 'delivered';
  onFilterChange: (value: string) => void;
  viewMode?: 'orders' | 'tracking';
  sort?: string;
}

export const StockOrderTrackingWidget: React.FC<StockOrderTrackingWidgetProps> = ({ filter, onFilterChange, viewMode = 'orders', sort = 'newest' }) => {
  const navigate = useEnvNavigate();

  const { data: stockData, isLoading } = useCanonicalStockOrders();
  const { data: packageRecords, isLoading: packagesLoading } = usePackageRecords();

  const stats = React.useMemo(() => {
    if (!stockData?.counts) return { processing: 0, inTransit: 0, pending: 0, delivered: 0 };
    return {
      processing: stockData.counts.pending,
      inTransit: stockData.counts.inTransit,
      pending: 0, // Canonical hook groups these into pending/inTransit
      delivered: stockData.counts.delivered,
    };
  }, [stockData?.counts]);

  const displayOrders = React.useMemo(() => {
    if (!stockData?.items) return [];
    let filtered = stockData.items;

    if (filter === 'processing') filtered = stockData.items.filter(so => !so.isTransit && !so.isDelivered);
    else if (filter === 'inTransit') filtered = stockData.items.filter(so => so.isTransit);
    else if (filter === 'delivered') filtered = stockData.items.filter(so => so.isDelivered);

    return [...filtered].sort((a, b) => {
      if (sort === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sort === 'amount_desc') return Number(b.amount || 0) - Number(a.amount || 0);
      if (sort === 'amount_asc') return Number(a.amount || 0) - Number(b.amount || 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }).slice(0, 30);
  }, [stockData?.items, filter, sort]);

  // --- TRACKING VIEW logic ---
  const displayPackages = React.useMemo(() => {
    if (!packageRecords) return [];
    let filtered = packageRecords;
    const transitStatuses = ['in_transit', 'dispatched', 'shipped', 'out_for_delivery'];
    const delayStatuses = ['delayed', 'exception', 'stale'];
    const doneStatuses = ['delivered', 'completed', 'resolved'];
    const procStatuses = ['ordered', 'processing', 'pending', 'info_received'];

    if (filter === 'processing') filtered = packageRecords.filter(p => procStatuses.includes(p.consolidated_status));
    else if (filter === 'inTransit') filtered = packageRecords.filter(p => transitStatuses.includes(p.consolidated_status));
    else if (filter === 'pending') filtered = packageRecords.filter(p => delayStatuses.includes(p.consolidated_status));
    else if (filter === 'delivered') filtered = packageRecords.filter(p => doneStatuses.includes(p.consolidated_status));

    return filtered.sort((a, b) => {
      if (sort === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }).slice(0, 30);
  }, [packageRecords, filter, sort]);

  const currentLoading = viewMode === 'tracking' ? packagesLoading : isLoading;

  if (currentLoading) {
    return (
      <div className="flex-1 flex flex-col p-4 pt-10 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Truck className="h-3.5 w-3.5 text-primary/40 animate-pulse" />
          <div className="h-3 w-24 bg-muted rounded animate-pulse" />
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    );
  }

  // --- TRACKING VIEW ---
  if (viewMode === 'tracking') {
    return (
      <div className="flex-1 flex flex-col p-4 pt-2">
        <div className="flex-grow overflow-auto scrollbar-none">
          <div className="space-y-1">
            {displayPackages.length > 0 ? (
              displayPackages.map((pkg) => {
                const status = pkg.consolidated_status;
                const borderColor =
                  ['ordered', 'processing', 'pending', 'info_received'].includes(status) ? 'bg-amber-500' :
                    ['delivered', 'completed', 'resolved'].includes(status) ? 'bg-emerald-500' :
                      ['delayed', 'exception', 'stale'].includes(status) ? 'bg-orange-500' : 'bg-purple-500';

                const soName = pkg.source_stock_order?.name || '—';
                const soNumber = pkg.source_stock_order?.stock_record_number || '';
                const carrierLabel = pkg.carriers_used?.length ? pkg.carriers_used.join(', ') : '—';

                return (
                  <div
                    key={pkg.id}
                    className="group flex items-center gap-3 px-3 h-10 rounded-lg border border-transparent hover:border-muted hover:bg-muted/30 transition-all cursor-pointer overflow-hidden"
                    onClick={() => navigate(`/stock-orders/${pkg.source_stock_order_id}`)}
                  >
                    <div className={cn("w-1 h-4 rounded-full shrink-0", borderColor)} />

                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-[12px] font-bold text-foreground truncate leading-tight group-hover:text-primary transition-colors">
                        {pkg.package_record_number}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold font-mono text-muted-foreground uppercase tracking-widest leading-none">
                          {soNumber}
                        </span>
                        <span className="text-[10px] font-medium text-muted-foreground truncate leading-none">
                          • {soName}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-[11px] font-black font-mono tabular-nums text-foreground leading-none">
                        {pkg.total_shipments} pkg{pkg.total_shipments !== 1 ? 's' : ''}
                      </span>
                      <span className="text-[9px] font-black text-muted-foreground uppercase tracking-tighter leading-none mt-0.5">
                        {getStatusLabel(status)}
                      </span>
                    </div>
                    <ArrowRight className="h-3 w-3 text-primary opacity-0 group-hover:opacity-100 transition-all" />
                  </div>
                );
              })
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-10 opacity-40">
                <Package className="h-10 w-10 mb-2" />
                <span className="text-[10px] font-black uppercase tracking-widest">No Package Records</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- ORDERS VIEW (default, unchanged) ---
  return (
    <div className="flex-1 flex flex-col p-4 pt-2">

      <div className="flex-grow overflow-auto scrollbar-none">
        <div className="space-y-1">
          {displayOrders.length > 0 ? (
            displayOrders.slice(0, 30).map((order) => {
              const borderColor = ['ordered', 'vendor_processing'].includes(order.delivery_status) ? 'bg-amber-500' :
                ['delivered', 'delivered_to_customer', 'picked_up_by_customer', 'delivered_backlog', 'resolved'].includes(order.delivery_status) ? 'bg-emerald-500' :
                  ['delayed', 'exception'].includes(order.delivery_status) ? 'bg-orange-500' : 'bg-purple-500';

              return (
                <div
                  key={order.id}
                  className="group flex items-center gap-3 px-3 h-10 rounded-lg border border-transparent hover:border-muted hover:bg-muted/30 transition-all cursor-pointer overflow-hidden"
                  onClick={() => navigate(`/stock-orders/${order.id}`)}
                >
                  <div className={cn("w-1 h-4 rounded-full shrink-0", borderColor)} />

                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[12px] font-bold text-foreground truncate leading-tight group-hover:text-primary transition-colors">
                      {order.vendor_store_name || order.vendor || 'No Vendor'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold font-mono text-muted-foreground uppercase tracking-widest leading-none">
                        {order.stock_record_number || 'No ID'}
                      </span>
                      <span className="text-[10px] font-medium text-muted-foreground truncate leading-none">
                        • {order.name || '—'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-[11px] font-black font-mono tabular-nums text-foreground leading-none">
                      ${order.amount?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? '0'}
                    </span>
                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-tighter leading-none mt-0.5">
                      {order.hasTracking ? order.delivery_status.replace(/_/g, ' ') : 'tracking pending'}
                    </span>
                  </div>
                  <ArrowRight className="h-3 w-3 text-primary opacity-0 group-hover:opacity-100 transition-all" />
                </div>
              );
            })
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-10 opacity-40">
              <Package className="h-10 w-10 mb-2" />
              <span className="text-[10px] font-black uppercase tracking-widest">
                {stockData?.items && stockData.items.length > 0 ? 'No orders match filter' : 'No stock orders'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
