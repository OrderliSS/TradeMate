import { useState } from "react";
import { Button } from "./button";
import { Edit3, Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DynamicCategorySelect } from "./DynamicCategorySelect";

interface InlineEditDynamicCategoryProps {
  value: string | null | undefined;
  onSave: (value: string) => Promise<void>;
  canEdit: boolean;
  tableName: string;
  placeholder?: string;
  className?: string;
  displayClassName?: string;
}

export const InlineEditDynamicCategory = ({
  value,
  onSave,
  canEdit,
  tableName,
  placeholder = "Select category",
  className,
  displayClassName
}: InlineEditDynamicCategoryProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const displayValue = value || placeholder;

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
      // Error is handled by the parent component
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setEditValue('');
    setIsEditing(false);
  };

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
        <DynamicCategorySelect
          tableName={tableName}
          value={editValue}
          onValueChange={setEditValue}
          placeholder={placeholder}
          className="min-w-40"
        />
        <Button size="sm" onClick={handleSave} disabled={isLoading} className="h-8 w-8 p-0">
          {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
        </Button>
        <Button size="sm" variant="outline" onClick={handleCancel} disabled={isLoading} className="h-8 w-8 p-0">
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
      <Button size="sm" variant="ghost" onClick={handleEdit} className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <Edit3 className="h-3 w-3" />
      </Button>
    </div>
  );
};
