import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MoreHorizontal } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface CompactHeaderProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  className?: string;
  showBack?: boolean;
  onBack?: () => void;
  actions?: ReactNode;
}

export const CompactHeader = ({
  title,
  subtitle,
  children,
  className,
  showBack = false,
  onBack,
  actions
}: CompactHeaderProps) => {
  const layout = useResponsiveLayout();
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  if (!layout.shouldUseCompactHeader) {
    // Desktop: render children (normal header)
    return <>{children}</>;
  }

  // Mobile: render compact header
  return (
    <header className={cn(
      "sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b",
      layout.mobileHeaderHeight,
      className
    )}>
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          {showBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="mobile-touch-target p-2"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {actions || (
            <Button
              variant="ghost"
              size="sm"
              className="mobile-touch-target p-2"
              aria-label="More options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};