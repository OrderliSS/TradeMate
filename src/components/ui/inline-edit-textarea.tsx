import { useState } from "react";
import { Textarea } from "./textarea";
import { Button } from "./button";
import { Edit3, Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineEditTextareaProps {
  value: string | null | undefined;
  onSave: (value: string) => Promise<void>;
  canEdit: boolean;
  placeholder?: string;
  className?: string;
  displayClassName?: string;
  textareaClassName?: string;
  rows?: number;
}

export const InlineEditTextarea = ({
  value,
  onSave,
  canEdit,
  placeholder,
  className,
  displayClassName,
  textareaClassName,
  rows = 3
}: InlineEditTextareaProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const displayValue = value || placeholder || 'N/A';

  const handleEdit = () => {
    setEditValue(value || '');
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (editValue === (value || '')) {
      setIsEditing(false);
      return;
    }

    setIsLoading(true);
    try {
      await onSave(editValue);
      setIsEditing(false);
    } catch (error) {
      console.error('InlineEditTextarea save error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setEditValue('');
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
    }
    // Ctrl/Cmd + Enter to save
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  };

  if (!canEdit) {
    return (
      <p className={cn("text-sm text-muted-foreground whitespace-pre-wrap", displayClassName)}>
        {displayValue}
      </p>
    );
  }

  if (isEditing) {
    return (
      <div className={cn("space-y-3 pb-2", className)}>
        <Textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className={cn("min-h-[80px]", textareaClassName)}
          placeholder={placeholder}
          disabled={isLoading}
          rows={rows}
          autoFocus
        />
        <div className="flex gap-2 flex-wrap print:hidden">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isLoading}
            title="Save changes (Ctrl/Cmd + Enter)"
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin mr-2" />
            ) : (
              <Check className="h-3 w-3 mr-2" />
            )}
            Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
            title="Cancel editing (Escape)"
          >
            <X className="h-3 w-3 mr-2" />
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("group", className)}>
      <div className="flex items-start gap-2">
        <p className={cn("text-sm text-muted-foreground whitespace-pre-wrap flex-1", displayClassName)}>
          {displayValue}
        </p>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleEdit}
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        >
          <Edit3 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};