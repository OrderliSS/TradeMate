import { useState, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';

export const useClipboard = () => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = useCallback(async (text: string, successMessage?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({
        title: "Copied!",
        description: successMessage || "Copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
      return true;
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please try again",
        variant: "destructive",
      });
      return false;
    }
  }, []);

  return { copyToClipboard, copied };
};
