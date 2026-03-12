import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface MobileTableProps {
  children: ReactNode;
  className?: string;
  data?: any[];
  renderCard?: (item: any, index: number) => ReactNode;
  emptyMessage?: string;
}

interface MobileTableRowProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  href?: string;
}

interface MobileTableCellProps {
  children: ReactNode;
  label?: string;
  className?: string;
  variant?: "default" | "badge" | "currency" | "date";
}

export const MobileTable = ({ 
  children, 
  className, 
  data, 
  renderCard, 
  emptyMessage = "No data available" 
}: MobileTableProps) => {
  const layout = useResponsiveLayout();

  if (!layout.shouldUseCardList) {
    // Desktop: render as normal table
    return (
      <div className={cn("overflow-x-auto max-w-full", className)}>
        <table className="w-full table-fixed">
          {children}
        </table>
      </div>
    );
  }

  // Mobile: render as card list
  if (data && renderCard) {
    return (
      <div className={cn("space-y-3", className)}>
        {data.length > 0 ? (
          data.map((item, index) => renderCard(item, index))
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            {emptyMessage}
          </div>
        )}
      </div>
    );
  }

  // Fallback: render children as cards
  return (
    <div className={cn("space-y-3", className)}>
      {children}
    </div>
  );
};

export const MobileTableRow = ({ children, className, onClick, href }: MobileTableRowProps) => {
  const layout = useResponsiveLayout();

  if (!layout.shouldUseCardList) {
    // Desktop: render as table row
    return <tr className={className} onClick={onClick}>{children}</tr>;
  }

  // Mobile: render as card
  const CardWrapper = href ? "a" : "div";
  
  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all hover:shadow-md mobile-touch-target",
        className
      )}
      onClick={onClick}
      {...(href && { as: CardWrapper, href })}
    >
      <CardContent className="p-4">
        <div className="space-y-2">
          {children}
        </div>
      </CardContent>
    </Card>
  );
};

export const MobileTableCell = ({ 
  children, 
  label, 
  className, 
  variant = "default" 
}: MobileTableCellProps) => {
  const layout = useResponsiveLayout();

  if (!layout.shouldUseCardList) {
    // Desktop: render as table cell
    return <td className={className}>{children}</td>;
  }

  // Mobile: render as labeled field
  const renderValue = () => {
    switch (variant) {
      case "badge":
        return typeof children === "string" ? (
          <Badge variant="secondary" className="text-xs">
            {children}
          </Badge>
        ) : children;
      case "currency":
        return (
          <span className="font-medium text-primary">
            {children}
          </span>
        );
      case "date":
        return (
          <span className="text-sm text-muted-foreground">
            {children}
          </span>
        );
      default:
        return children;
    }
  };

  return (
    <div className={cn("flex justify-between items-center", className)}>
      {label && (
        <span className="text-sm font-medium text-muted-foreground">
          {label}:
        </span>
      )}
      <div className="text-sm font-medium">
        {renderValue()}
      </div>
    </div>
  );
};

// Helper components for common mobile table patterns
export const MobileTableHeader = ({ children }: { children: ReactNode }) => {
  const layout = useResponsiveLayout();
  
  if (!layout.shouldUseCardList) {
    return <thead>{children}</thead>;
  }
  
  // Mobile: hide header
  return null;
};

export const MobileTableBody = ({ children }: { children: ReactNode }) => {
  const layout = useResponsiveLayout();
  
  if (!layout.shouldUseCardList) {
    return <tbody>{children}</tbody>;
  }
  
  // Mobile: render as div container
  return <div className="space-y-3">{children}</div>;
};