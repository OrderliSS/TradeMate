import { useState, useCallback, memo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { Button } from "./button";
import { Edit3, Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineEditSelectProps {
  value: string | null | undefined;
  onSave: (value: string) => Promise<void>;
  canEdit: boolean;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  className?: string;
  displayClassName?: string;
}

export const InlineEditSelect = memo(({
  value,
  onSave,
  canEdit,
  options,
  placeholder = "Select option",
  className,
  displayClassName
}: InlineEditSelectProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const selectedOption = options.find(option => option.value === value);
  const displayValue = selectedOption?.label || placeholder;

  const handleEdit = useCallback(() => {
    setEditValue(value || '');
    setIsEditing(true);
  }, [value]);

  const handleSave = useCallback(async () => {
    if (editValue === (value || '')) {
      setIsEditing(false);
      return;
    }

    setIsLoading(true);
    try {
      await onSave(editValue);
      setIsEditing(false);
    } catch (error) {
      // Error is handled by the parent component
    } finally {
      setIsLoading(false);
    }
  }, [editValue, value, onSave]);

  const handleCancel = useCallback(() => {
    setEditValue('');
    setIsEditing(false);
  }, []);

  if (!canEdit) {
    return (
      <span className={cn("text-muted-foreground", displayClassName)}>
        {displayValue}
      </span>
    );
  }

  if (isEditing) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <Select
          value={editValue}
          onValueChange={setEditValue}
          disabled={isLoading}
        >
          <SelectTrigger className="h-8 min-w-32">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        {displayValue}
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

InlineEditSelect.displayName = 'InlineEditSelect';