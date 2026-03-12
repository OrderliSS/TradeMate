import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface CopyableBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  text: string;
  displayText?: string;
  variant?: "default" | "secondary" | "destructive" | "outline";
  size?: "default" | "sm";
  showCopyIcon?: boolean;
  copySuccessMessage?: string;
}

export const CopyableBadge = ({ 
  text, 
  displayText, 
  variant = "outline", 
  size = "default",
  className,
  showCopyIcon = true,
  copySuccessMessage,
  ...props 
}: CopyableBadgeProps) => {
  const [copied, setCopied] = React.useState(false);
  const { toast } = useToast();

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({
        description: copySuccessMessage || `Copied ${text} to clipboard`,
        duration: 2000,
      });
      
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      toast({
        description: "Failed to copy to clipboard",
        variant: "destructive",
        duration: 2000,
      });
    }
  };

  return (
    <Badge
      variant={variant}
      className={cn(
        "group cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors relative",
        size === "sm" && "px-1.5 py-0.5 text-xs h-5",
        showCopyIcon && "pr-6",
        className
      )}
      onClick={handleCopy}
      {...props}
    >
      {displayText || text}
      {showCopyIcon && (
        <span className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          {copied ? (
            <Check className="h-3 w-3 text-green-600" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </span>
      )}
    </Badge>
  );
};