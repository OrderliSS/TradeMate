import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { useClipboard } from '@/hooks/useClipboard';
import { cn } from '@/lib/utils';

interface CopyButtonProps {
  value: string;
  successMessage?: string;
  className?: string;
  size?: 'sm' | 'default' | 'lg' | 'icon';
}

export const CopyButton = ({ value, successMessage, className, size = 'sm' }: CopyButtonProps) => {
  const { copyToClipboard, copied } = useClipboard();

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={(e) => {
        e.stopPropagation();
        copyToClipboard(value, successMessage);
      }}
      className={cn("h-8 w-8 p-0", className)}
      aria-label="Copy to clipboard"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-600" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </Button>
  );
};
