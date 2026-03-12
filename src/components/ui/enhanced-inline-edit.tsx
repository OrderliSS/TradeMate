import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { 
  Copy, 
  Check, 
  X, 
  Edit2,
  Loader2
} from 'lucide-react';

interface EnhancedInlineEditProps {
  value: string;
  onSave: (value: string) => Promise<void> | void;
  canEdit?: boolean;
  placeholder?: string;
  className?: string;
  showCopy?: boolean;
  validation?: (value: string) => string | null;
}

export const EnhancedInlineEdit: React.FC<EnhancedInlineEditProps> = ({
  value,
  onSave,
  canEdit = true,
  placeholder = "Click to edit",
  className = "",
  showCopy = true,
  validation,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedRecently, setCopiedRecently] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const validateInput = (inputValue: string): boolean => {
    if (validation) {
      const error = validation(inputValue);
      setValidationError(error);
      return error === null;
    }
    
    setValidationError(null);
    return true;
  };

  const handleSave = async () => {
    if (!validateInput(editValue)) {
      return;
    }

    setIsLoading(true);
    try {
      await onSave(editValue);
      setIsEditing(false);
      
      toast({
        title: "Updated successfully",
        description: "Changes have been saved",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save changes",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
    setValidationError(null);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedRecently(true);
      toast({
        title: "Copied to clipboard",
        description: "Value copied successfully",
      });
      setTimeout(() => setCopiedRecently(false), 2000);
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="flex items-center gap-2">
          <Input
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value);
              validateInput(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={`flex-1 ${validationError ? 'border-destructive' : ''}`}
            autoFocus
            disabled={isLoading}
          />
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isLoading || !!validationError}
            className="shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCancel}
            disabled={isLoading}
            className="shrink-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
        
        {validationError && (
          <p className="text-xs text-destructive">{validationError}</p>
        )}
        
        <p className="text-xs text-muted-foreground">
          Press Enter to save, Escape to cancel
        </p>
      </div>
    );
  }

  return (
    <div className={`group flex items-center gap-2 ${className}`}>
      <div className="flex-1 min-w-0">
        {value ? (
          <span className="block truncate font-mono text-sm">{value}</span>
        ) : (
          <span className="text-muted-foreground text-sm italic">{placeholder}</span>
        )}
      </div>
      
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {value && showCopy && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopy}
            className="h-6 w-6 p-0"
            title="Copy to clipboard"
          >
            {copiedRecently ? (
              <Check className="h-3 w-3 text-green-600" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        )}
        
        {canEdit && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsEditing(true)}
            className="h-6 w-6 p-0"
            title="Edit value"
          >
            <Edit2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
};