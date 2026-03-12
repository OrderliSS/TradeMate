import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, ChevronsUpDown, X, Save, Pencil, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface InlineEditComboboxProps {
  value: string;
  onSave: (value: string) => Promise<void>;
  canEdit: boolean;
  options: Array<{ value: string; label: string; badge?: string }>;
  placeholder?: string;
  className?: string;
  displayClassName?: string;
  allowCustom?: boolean;
  onQuickAdd?: (value: string) => void;
  searchPlaceholder?: string;
  emptyMessage?: string;
}

export const InlineEditCombobox = ({
  value,
  onSave,
  canEdit,
  options,
  placeholder = "Select or enter value",
  className = "",
  displayClassName = "",
  allowCustom = true,
  onQuickAdd,
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
}: InlineEditComboboxProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isLoading, setIsLoading] = useState(false);
  const [comboOpen, setComboOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleEdit = () => {
    setIsEditing(true);
    setEditValue(value);
    setCustomValue(value);
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const finalValue = customValue || editValue;
      await onSave(finalValue);
      setIsEditing(false);
      setComboOpen(false);
    } catch (error) {
      console.error("Save failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value);
    setCustomValue("");
    setIsEditing(false);
    setComboOpen(false);
  };

  const handleSelect = (selectedValue: string) => {
    setEditValue(selectedValue);
    setCustomValue("");
    setComboOpen(false);
  };

  const handleQuickAdd = () => {
    if (onQuickAdd && (customValue || editValue)) {
      onQuickAdd(customValue || editValue);
    }
  };

  // Find the display label for the current value
  const getDisplayLabel = (val: string) => {
    const option = options.find(opt => opt.value.toLowerCase() === val.toLowerCase());
    return option?.label || val;
  };

  // Filter options based on custom input
  const filteredOptions = customValue
    ? options.filter(opt => 
        opt.label.toLowerCase().includes(customValue.toLowerCase()) ||
        opt.value.toLowerCase().includes(customValue.toLowerCase())
      )
    : options;

  if (!isEditing) {
    return (
      <div className={cn("group relative py-1", className)}>
        <div className="flex items-center justify-between">
          <div className={cn("flex-1", displayClassName)}>
            {value ? (
              <div className="flex items-center gap-2">
                <span>{getDisplayLabel(value)}</span>
                {options.find(opt => opt.value === value)?.badge && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {options.find(opt => opt.value === value)?.badge}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground italic">{placeholder}</span>
            )}
          </div>
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleEdit}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2 py-1", className)}>
      <div className="flex-1 flex items-center gap-2">
        <Popover open={comboOpen} onOpenChange={setComboOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={comboOpen}
              className="w-full justify-between"
              disabled={isLoading}
            >
              {editValue || customValue ? (
                <span className="truncate">{getDisplayLabel(customValue || editValue)}</span>
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="start">
            <Command>
              <CommandInput 
                placeholder={searchPlaceholder}
                value={customValue}
                onValueChange={setCustomValue}
              />
              <CommandList>
                {filteredOptions.length === 0 && !allowCustom && (
                  <CommandEmpty>{emptyMessage}</CommandEmpty>
                )}
                {filteredOptions.length === 0 && allowCustom && customValue && (
                  <CommandEmpty>
                    <div className="flex flex-col gap-2 py-2">
                      <p className="text-sm text-muted-foreground">No matches found.</p>
                      <p className="text-xs text-muted-foreground">
                        Press Save to use "{customValue}"
                      </p>
                      {onQuickAdd && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2"
                          onClick={handleQuickAdd}
                        >
                          <Plus className="h-3 w-3 mr-2" />
                          Quick Add as Vendor Shop
                        </Button>
                      )}
                    </div>
                  </CommandEmpty>
                )}
                {filteredOptions.length > 0 && (
                  <CommandGroup>
                    {filteredOptions.map((option) => (
                      <CommandItem
                        key={option.value}
                        value={option.value}
                        onSelect={() => handleSelect(option.value)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            (editValue === option.value && !customValue) ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex items-center justify-between w-full">
                          <span>{option.label}</span>
                          {option.badge && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground ml-2">
                              {option.badge}
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {allowCustom && customValue && filteredOptions.length > 0 && (
                  <CommandGroup>
                    <CommandItem
                      value={customValue}
                      onSelect={() => setComboOpen(false)}
                      className="border-t"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Use custom: "{customValue}"
                    </CommandItem>
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 shrink-0"
        onClick={handleSave}
        disabled={isLoading}
      >
        <Save className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 shrink-0"
        onClick={handleCancel}
        disabled={isLoading}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};
