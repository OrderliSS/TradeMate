import { useState, useCallback, memo } from "react";
import { Input } from "./input";
import { Button } from "./button";
import { Edit3, Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";

interface InlineEditFieldProps {
  value: string | number | null | undefined;
  onSave: (value: string) => Promise<void>;
  canEdit: boolean;
  type?: 'text' | 'number' | 'email' | 'url';
  placeholder?: string;
  className?: string;
  displayClassName?: string;
  inputClassName?: string;
  prefix?: string;
  suffix?: string;
}

export const InlineEditField = memo(({
  value,
  onSave,
  canEdit,
  type = 'text',
  placeholder,
  className,
  displayClassName,
  inputClassName,
  prefix,
  suffix
}: InlineEditFieldProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const displayValue = value?.toString() || placeholder || 'N/A';

  const handleEdit = useCallback(() => {
    setEditValue(value?.toString() || '');
    setIsEditing(true);
  }, [value]);

  const handleSave = useCallback(async () => {
    if (editValue === (value?.toString() || '')) {
      setIsEditing(false);
      return;
    }

    setIsLoading(true);
    console.log('InlineEditField save attempt:', {
      field: placeholder,
      oldValue: value,
      newValue: editValue,
      canEdit
    });
    
    try {
      await onSave(editValue);
      setIsEditing(false);
      console.log('InlineEditField save success');
    } catch (error) {
      console.error('InlineEditField save error:', error);
      // Error is handled by the parent component
    } finally {
      setIsLoading(false);
    }
  }, [editValue, value, onSave, placeholder, canEdit]);

  const handleCancel = useCallback(() => {
    setEditValue('');
    setIsEditing(false);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  }, [handleSave, handleCancel]);

  if (!canEdit) {
    return (
      <span className={cn("text-muted-foreground", displayClassName)}>
        {prefix}{displayValue}{suffix}
      </span>
    );
  }

  if (isEditing) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <Input
          type={type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className={cn("h-8 min-w-0 flex-1", inputClassName)}
          placeholder={placeholder}
          disabled={isLoading}
          autoFocus
        />
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isLoading}
          className="h-8 w-8 p-0"
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Check className="h-3 w-3" />
          )}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCancel}
          disabled={isLoading}
          className="h-8 w-8 p-0"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2 group", className)}>
      <span className={cn("text-muted-foreground", displayClassName)}>
        {prefix}{displayValue}{suffix}
      </span>
      <Button
        size="sm"
        variant="ghost"
        onClick={handleEdit}
        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Edit3 className="h-3 w-3" />
      </Button>
    </div>
  );
});

InlineEditField.displayName = 'InlineEditField';