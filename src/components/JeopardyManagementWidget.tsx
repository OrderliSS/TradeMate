import React, { useState, useEffect } from 'react';
import { AlertOctagon, Phone, FileText, CheckSquare, ExternalLink, RefreshCw, ArrowRight, Settings, Check } from 'lucide-react';
import { useJeopardyRecords, getUrgencyColorClasses } from '@/hooks/useJeopardyRecords';
import { useEnvNavigate } from '@/hooks/useEnvNavigate';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function getRecordTypeIcon(taskType: string) {
  switch (taskType) {
    case 'call':
      return Phone;
    case 'general':
      return FileText;
    default:
      return CheckSquare;
  }
}

function getRecordTypeLabel(taskType: string): string {
  switch (taskType) {
    case 'call':
      return 'Call';
    case 'general':
      return 'Case';
    case 'site_visit':
      return 'Visit';
    case 'meeting':
      return 'Meeting';
    default:
      return 'Task';
  }
}

function getJeopardyReasonBadge(reason: string) {
  switch (reason) {
    case 'overdue':
      return <Badge variant="destructive" className="text-[10px] px-1 py-0 h-[18px]">Overdue</Badge>;
    case 'no_due_date':
      return <Badge variant="warning" className="text-[10px] px-1 py-0 h-[18px]">No Due Date</Badge>;
    default:
      return <Badge variant="secondary" className="text-[10px] px-1 py-0 h-[18px]">Stale</Badge>;
  }
}

const SORT_STORAGE_KEY = 'ui:widget:jeopardy:sort';
type JeopardySort = 'most_stale' | 'most_recent' | 'priority';

const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export function JeopardyManagementWidget() {
  const { data: records, isLoading, error, refetch, isFetching } = useJeopardyRecords(5);
  const navigate = useEnvNavigate();
  const [sort, setSort] = useState<JeopardySort>(() => {
    try { return (localStorage.getItem(SORT_STORAGE_KEY) as JeopardySort) || 'most_stale'; } catch { return 'most_stale'; }
  });

  useEffect(() => {
    try { localStorage.setItem(SORT_STORAGE_KEY, sort); } catch { }
  }, [sort]);

  const sortedRecords = React.useMemo(() => {
    if (!records) return [];
    return [...records].sort((a, b) => {
      if (sort === 'most_recent') return a.daysSinceActivity - b.daysSinceActivity;
      if (sort === 'priority') return (priorityOrder[a.priority ?? 'low'] ?? 3) - (priorityOrder[b.priority ?? 'low'] ?? 3);
      return b.daysSinceActivity - a.daysSinceActivity; // most_stale default
    });
  }, [records, sort]);

  const handleRecordClick = (recordId: string) => {
    navigate(`/tasks/${recordId}`);
  };

  return (
    <Card className="h-full flex flex-col border-t-2 border-t-amber-500/50">
      <CardHeader className="bg-gradient-to-r from-amber-500/5 to-transparent pb-2">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm">
            <AlertOctagon className="h-4 w-4 flex-shrink-0" />
            <span>Jeopardy Management</span>
            {records && records.length > 0 && (
              <Badge variant="outline" className="ml-1 text-[9px] px-1.5 py-0 border-amber-500/30 text-amber-600 bg-amber-500/10">
                {records.length}
              </Badge>
            )}
          </span>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-amber-600">
                  <Settings className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="text-xs flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
                  Refresh Data
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">Sort By</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setSort('most_stale')} className="text-xs flex items-center justify-between cursor-pointer">
                  Most Stale First
                  {sort === 'most_stale' && <Check className="h-3 w-3" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSort('most_recent')} className="text-xs flex items-center justify-between cursor-pointer">
                  Most Recent First
                  {sort === 'most_recent' && <Check className="h-3 w-3" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSort('priority')} className="text-xs flex items-center justify-between cursor-pointer">
                  By Priority
                  {sort === 'priority' && <Check className="h-3 w-3" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              size="sm"
              variant="ghost"
              className="text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950 h-7 px-2 text-xs"
              onClick={() => navigate('/workspace-operations/jeopardy')}
            >
              View All
            </Button>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col overflow-auto pt-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-md" />
            ))}
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Failed to load records
          </div>
        ) : records && records.length > 0 ? (
          <div className="space-y-1">
            {sortedRecords.map((record) => {
              const urgencyColors = getUrgencyColorClasses(record.daysSinceActivity);
              const TypeIcon = getRecordTypeIcon(record.task_type);

              // Map urgency colors to border colors for consistency
              const indicatorColor = urgencyColors.border.includes('red') ? 'bg-red-500' :
                urgencyColors.border.includes('orange') ? 'bg-orange-500' :
                  'bg-amber-500';

              return (
                <div
                  key={record.id}
                  onClick={() => handleRecordClick(record.id)}
                  className="group flex items-center gap-2.5 px-2.5 py-1.5 rounded transition-colors cursor-pointer hover:bg-muted/30"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleRecordClick(record.id);
                    }
                  }}
                >
                  <div className={cn("w-1 h-4 rounded-full shrink-0", indicatorColor)} />
                  <p className="text-xs font-medium truncate min-w-0 w-[110px]">{record.title}</p>
                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-[18px] gap-1 w-[70px]">
                    <TypeIcon className="h-2.5 w-2.5" />
                    {getRecordTypeLabel(record.task_type)}
                  </Badge>
                  {getJeopardyReasonBadge(record.jeopardyReason)}
                  <span className="text-[11px] font-mono text-muted-foreground/70 w-[45px]">
                    {record.task_number ? `#${record.task_number}` : '-'}
                  </span>
                  <span className="flex-1" />
                  <span className={cn("text-[10px] whitespace-nowrap w-[55px] text-right font-medium", urgencyColors.text)}>
                    {record.daysSinceActivity}d ago
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-emerald-500/10 blur-xl scale-150" />
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center mb-4 ring-2 ring-emerald-500/20">
                <AlertOctagon className="h-7 w-7 text-emerald-500" />
              </div>
            </div>
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              All caught up!
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              No forgotten records found
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
