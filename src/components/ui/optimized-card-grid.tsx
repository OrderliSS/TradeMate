import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { LoadingSpinner, CardSkeleton } from "@/components/ui/enhanced-loading";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface OptimizedCardGridProps<T> {
  data: T[];
  renderCard: (item: T, index: number) => React.ReactNode;
  isLoading?: boolean;
  pageSize?: number;
  columns?: {
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  className?: string;
  emptyMessage?: string;
  loadingSkeletons?: number;
}

export function OptimizedCardGrid<T extends { id: string | number }>({
  data,
  renderCard,
  isLoading = false,
  pageSize = 12,
  columns = { sm: 1, md: 2, lg: 3, xl: 4 },
  className,
  emptyMessage = "No items to display",
  loadingSkeletons = 6
}: OptimizedCardGridProps<T>) {
  const [currentPage, setCurrentPage] = React.useState(1);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return data.slice(startIndex, endIndex);
  }, [data, currentPage, pageSize]);

  const totalPages = Math.ceil(data.length / pageSize);

  const gridClasses = cn(
    "grid gap-6",
    columns.sm && `grid-cols-${columns.sm}`,
    columns.md && `md:grid-cols-${columns.md}`,
    columns.lg && `lg:grid-cols-${columns.lg}`,
    columns.xl && `xl:grid-cols-${columns.xl}`,
    className
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className={gridClasses}>
          {Array.from({ length: loadingSkeletons }).map((_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-lg">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className={gridClasses}>
        {paginatedData.map((item, index) => (
          <div key={item.id} className="animate-fade-in">
            {renderCard(item, index)}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, data.length)} of {data.length} items
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            
            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let page;
                if (totalPages <= 5) {
                  page = i + 1;
                } else if (currentPage <= 3) {
                  page = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  page = totalPages - 4 + i;
                } else {
                  page = currentPage - 2 + i;
                }

                return (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className="w-10"
                  >
                    {page}
                  </Button>
                );
              })}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Hook for managing card grid state
export const useCardGrid = <T extends { id: string | number }>(
  data: T[],
  initialPageSize: number = 12
) => {
  const [pageSize, setPageSize] = React.useState(initialPageSize);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [sortConfig, setSortConfig] = React.useState<{
    key: keyof T;
    direction: 'asc' | 'desc';
  } | null>(null);

  const sortedData = useMemo(() => {
    if (!sortConfig) return data;
    
    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortConfig]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return sortedData.slice(startIndex, endIndex);
  }, [sortedData, currentPage, pageSize]);

  const totalPages = Math.ceil(data.length / pageSize);

  const handleSort = (key: keyof T) => {
    setSortConfig(current => ({
      key,
      direction: current?.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
    setCurrentPage(1); // Reset to first page when sorting
  };

  return {
    paginatedData,
    currentPage,
    totalPages,
    pageSize,
    sortConfig,
    setCurrentPage,
    setPageSize,
    handleSort
  };
};