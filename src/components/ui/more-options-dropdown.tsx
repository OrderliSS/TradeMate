import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ReactNode } from "react";

interface MoreOptionsDropdownProps {
  children: ReactNode;
  align?: "start" | "center" | "end";
  variant?: "ghost" | "outline";
  size?: "sm" | "default" | "lg";
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const MoreOptionsDropdown = ({ 
  children, 
  align = "end",
  variant = "ghost",
  size = "sm",
  className = "",
  open,
  onOpenChange
}: MoreOptionsDropdownProps) => {
  return (
    <DropdownMenu modal={false} open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align={align} 
        className="w-48 bg-background border shadow-lg z-[100]"
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export { DropdownMenuItem, DropdownMenuSeparator };