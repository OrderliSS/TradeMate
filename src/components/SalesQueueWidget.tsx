import { useState, useMemo } from 'react';
import { useCanonicalPurchases, PurchaseStatus } from '@/hooks/useCanonicalPurchases';
import { useEnvNavigate } from '@/hooks/useEnvNavigate';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardList, ShoppingCart, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PurchaseFormPhase1 } from '@/components/PurchaseFormPhase1';
import { QuickCallDialog } from '@/components/QuickCallDialog';

interface SalesQueueWidgetProps {
  statusFilter: 'all' | PurchaseStatus;
  onStatusFilterChange: (value: string) => void;
  sort?: string;
}

export const SalesQueueWidget = ({ statusFilter, sort = 'newest' }: SalesQueueWidgetProps) => {
  const navigate = useEnvNavigate();
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [showQuickCall, setShowQuickCall] = useState(false);

  // Use the Canonical SoT hook
  const { data, isLoading } = useCanonicalPurchases({
    limit: 30,
    statusFilter,
  });

  const filteredQueue = useMemo(() => {
    if (!data?.items) return [];

    // items are already filtered by status in the hook query if statusFilter is provided
    // but we can apply sorting here for UI flexibility
    return [...data.items].sort((a, b) => {
      if (sort === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sort === 'amount_desc') return Number(b.total_amount || 0) - Number(a.total_amount || 0);
      if (sort === 'amount_asc') return Number(a.total_amount || 0) - Number(b.total_amount || 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); // newest
    });
  }, [data?.items, sort]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col p-4 pt-10 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <ShoppingCart className="h-3.5 w-3.5 text-[#2563EB]/40 animate-pulse" />
          <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 pt-2">

      <div className="flex-grow overflow-auto scrollbar-none">
        <div className="space-y-1">
          {filteredQueue.length > 0 ? (
            filteredQueue.slice(0, 30).map((item) => (
              <div
                key={item.id}
                className="group flex items-center gap-3 px-3 h-9 rounded-lg border border-transparent hover:border-muted hover:bg-muted/30 transition-all cursor-pointer overflow-hidden"
                onClick={() => navigate(`/purchases/${item.id}`)}
              >
                <div className={cn(
                  "w-[3px] h-4 rounded-full shrink-0",
                  item.normalized_status === 'ordered' ? "bg-emerald-500" :
                    item.normalized_status === 'configuring' ? "bg-amber-500" :
                      item.normalized_status === 'sold' ? "bg-sky-500" :
                        "bg-blue-500"
                )} />
                <div className="flex flex-col min-w-0 flex-1 leading-tight">
                  <span className="text-[12px] font-bold text-foreground truncate group-hover:text-primary transition-colors">
                    {item.member?.full_name || item.customer?.name || 'No Customer'}
                  </span>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold font-mono text-muted-foreground uppercase tracking-widest leading-none">
                      {item.member?.employment_id || item.ticket_number || 'TICKET-?'}
                    </span>
                    <span className="text-[10px] font-medium text-muted-foreground truncate leading-none">
                      • {item.product?.name || '---'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end shrink-0">
                  <span className="text-[11px] font-black font-mono tabular-nums text-foreground leading-none">
                    ${Number(item.total_amount || 0).toLocaleString()}
                  </span>
                  <div className="flex items-center gap-1 mt-0.5">
                    {statusFilter === 'all' && (
                      <span className="text-[9px] font-black text-muted-foreground uppercase tracking-tighter leading-none">
                        {item.order_status}
                      </span>
                    )}
                  </div>
                </div>
                <ArrowRight className="h-3 w-3 text-primary opacity-0 group-hover:opacity-100 transition-all" />
              </div>
            ))
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-10 opacity-40">
              <ClipboardList className="h-10 w-10 mb-2" />
              <span className="text-[10px] font-black uppercase tracking-widest">Queue Balanced</span>
            </div>
          )}
        </div>
      </div>

      <PurchaseFormPhase1 open={showCreateOrder} onOpenChange={setShowCreateOrder} />
      <QuickCallDialog open={showQuickCall} onOpenChange={setShowQuickCall} />
    </div>
  );
};
