import React, { useState } from "react";
import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useDynamicCategories } from "@/hooks/useDynamicCategories";
import { useAdminCheck } from "@/hooks/useAdminCheck";

interface DynamicCategorySelectProps {
  value: string;
  onValueChange: (value: string) => void;
  tableName: string;
  placeholder?: string;
  className?: string;
  parentOnly?: boolean;
  parentFilter?: string;
}

export const DynamicCategorySelect: React.FC<DynamicCategorySelectProps> = ({
  value,
  onValueChange,
  tableName,
  placeholder = "Select category...",
  className,
  parentOnly = false,
  parentFilter,
}) => {
  const [open, setOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  
  const { categories, isLoading, createCategory, deleteCategory, isCreating } = useDynamicCategories(tableName);
  const { isAdmin } = useAdminCheck();

  // Helper functions for hierarchical categories
  const parseCategory = (name: string) => {
    const parts = name.split(' > ');
    return {
      full: name,
      parent: parts.length > 1 ? parts[0] : null,
      child: parts.length > 1 ? parts[1] : name,
      isSubcategory: parts.length > 1
    };
  };

  const organizeCategories = () => {
    const organized: { [key: string]: any[] } = { _root: [] };
    let filteredCategories = categories;
    
    // Apply filtering based on props
    if (parentOnly) {
      // Show only parent categories (no ">" in name)
      filteredCategories = categories.filter(category => !category.name.includes(' > '));
    } else if (parentFilter) {
      // Show only subcategories of the selected parent
      filteredCategories = categories.filter(category => 
        category.name.includes(' > ') && category.name.startsWith(`${parentFilter} > `)
      );
    }
    
    filteredCategories.forEach(category => {
      const parsed = parseCategory(category.name);
      if (parsed.isSubcategory && !parentFilter) {
        if (!organized[parsed.parent!]) {
          organized[parsed.parent!] = [];
        }
        organized[parsed.parent!].push({ ...category, parsed });
      } else {
        organized._root.push({ ...category, parsed });
      }
    });
    
    return organized;
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    
    try {
      const categoryName = parentFilter 
        ? `${parentFilter} > ${newCategoryName.trim()}`
        : newCategoryName.trim();
        
      await createCategory({ name: categoryName });
      setNewCategoryName("");
      setShowAddForm(false);
      onValueChange(parentFilter ? newCategoryName.trim() : categoryName);
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
    if (window.confirm(`Are you sure you want to delete the category "${categoryName}"?`)) {
      try {
        await deleteCategory(categoryId);
        if (value === categoryName) {
          onValueChange("");
        }
      } catch (error) {
        // Error handling is done in the hook
      }
    }
  };

  const selectedCategory = parentFilter 
    ? categories.find(cat => cat.name === `${parentFilter} > ${value}`)
    : categories.find(cat => cat.name === value);

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          {value ? (parentFilter ? value : (selectedCategory?.name || value)) : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Search categories..." />
          <CommandList>
            <CommandEmpty>
              {isLoading ? "Loading categories..." : "No categories found."}
            </CommandEmpty>
            <CommandGroup>
              {(() => {
                const organizedCategories = organizeCategories();
                const items: JSX.Element[] = [];
                
                if (parentFilter) {
                  // For subcategory selection, only show subcategories
                  organizedCategories._root.forEach(category => {
                    const displayName = category.name.replace(`${parentFilter} > `, '');
                    items.push(
                    <CommandItem
                        key={category.id}
                        value={displayName}
                        onSelect={() => {
                          onValueChange(displayName === value ? "" : displayName);
                          setOpen(false);
                        }}
                        className="group cursor-pointer"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value === displayName ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="flex-1">{displayName}</span>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDeleteCategory(category.id, category.name);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </CommandItem>
                    );
                  });
                } else {
                  // Standard hierarchical view
                  organizedCategories._root.forEach(category => {
                    if (!parentOnly || !category.parsed.isSubcategory) {
                      items.push(
                      <CommandItem
                          key={category.id}
                          value={category.name}
                          onSelect={() => {
                            onValueChange(category.name === value ? "" : category.name);
                            setOpen(false);
                          }}
                          className="group cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              value === category.name ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="font-medium flex-1">{category.name}</span>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDeleteCategory(category.id, category.name);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </CommandItem>
                      );
                      
                      // Render subcategories for this parent if not in parentOnly mode
                      if (!parentOnly && organizedCategories[category.name]) {
                        organizedCategories[category.name].forEach(subcategory => {
                          items.push(
                          <CommandItem
                              key={subcategory.id}
                              value={subcategory.name}
                              onSelect={() => {
                                onValueChange(subcategory.name === value ? "" : subcategory.name);
                                setOpen(false);
                              }}
                              className="ml-4 border-l-2 border-muted group cursor-pointer"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  value === subcategory.name ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <span className="text-sm text-muted-foreground flex-1">
                                {subcategory.parsed.child}
                              </span>
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                  }}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleDeleteCategory(subcategory.id, subcategory.name);
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </CommandItem>
                          );
                        });
                      }
                    }
                  });
                }
                
                return items;
              })()}
            </CommandGroup>
            
            {/* Add new category section */}
            <CommandGroup>
              {!showAddForm ? (
                <CommandItem
                  onSelect={() => setShowAddForm(true)}
                  className="text-primary cursor-pointer"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add new {parentFilter ? 'subcategory' : 'category'}
                </CommandItem>
              ) : (
                  <div className="p-2 border-t">
                    <div className="space-y-2">
                      <Input
                        placeholder={parentFilter 
                          ? `Enter subcategory name...` 
                          : "Category name (e.g., 'Hardware > TV Streaming Device')"
                        }
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleAddCategory();
                          } else if (e.key === "Escape") {
                            setShowAddForm(false);
                            setNewCategoryName("");
                          }
                        }}
                        className="h-8"
                        autoFocus
                      />
                       <p className="text-xs text-muted-foreground">
                         {parentFilter 
                           ? `Will be added as "${parentFilter} > [your input]"`
                           : `Use "Parent > Child" format for subcategories`
                         }
                       </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleAddCategory}
                          disabled={!newCategoryName.trim() || isCreating}
                          className="h-8"
                        >
                          Add
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setShowAddForm(false);
                            setNewCategoryName("");
                          }}
                          className="h-8"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};