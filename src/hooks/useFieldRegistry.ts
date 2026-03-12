import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FieldRegistry, FieldCategory, FieldOption, FIELD_CATEGORIES, FieldCategoryId, BulkOperationResult } from "@/types/field-registry";
import { toast } from "sonner";

// Generate mock analytics data for field options
const enhanceOptionsWithAnalytics = (options: FieldOption[]): FieldOption[] => {
  return options.map(option => ({
    ...option,
    usageCount: Math.floor(Math.random() * 100) + 1,
    lastUsed: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    usageLocations: [
      'Customer Form',
      'Product Dialog', 
      'Task Manager',
      'Order Processing'
    ].slice(0, Math.floor(Math.random() * 4) + 1),
    trendData: Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      count: Math.floor(Math.random() * 20)
    })),
    createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString()
  }));
};

// In-memory store for field registry data (could be replaced with Supabase later)
const fieldRegistryStore: FieldRegistry = {
  categories: Object.values(FIELD_CATEGORIES).map(category => ({
    ...category,
    options: enhanceOptionsWithAnalytics(category.options)
  })),
  totalOptions: Object.values(FIELD_CATEGORIES).reduce((sum, cat) => sum + cat.options.length, 0),
  lastUpdated: new Date().toISOString(),
};

// Simulate API delay for realistic UX
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const useFieldRegistry = () => {
  return useQuery({
    queryKey: ["field-registry"],
    queryFn: async (): Promise<FieldRegistry> => {
      await delay(300);
      return { ...fieldRegistryStore };
    },
  });
};

export const useFieldCategory = (categoryId: FieldCategoryId) => {
  return useQuery({
    queryKey: ["field-category", categoryId],
    queryFn: async (): Promise<FieldCategory | undefined> => {
      await delay(100);
      return fieldRegistryStore.categories.find(cat => cat.id === categoryId);
    },
  });
};

export const useUpdateFieldOption = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ categoryId, optionId, updates }: {
      categoryId: string;
      optionId: string;
      updates: Partial<FieldOption>;
    }) => {
      await delay(300);
      
      const categoryIndex = fieldRegistryStore.categories.findIndex(cat => cat.id === categoryId);
      if (categoryIndex === -1) throw new Error("Category not found");
      
      const optionIndex = fieldRegistryStore.categories[categoryIndex].options.findIndex(opt => opt.id === optionId);
      if (optionIndex === -1) throw new Error("Option not found");
      
      fieldRegistryStore.categories[categoryIndex].options[optionIndex] = {
        ...fieldRegistryStore.categories[categoryIndex].options[optionIndex],
        ...updates,
      };
      
      fieldRegistryStore.lastUpdated = new Date().toISOString();
      
      return fieldRegistryStore.categories[categoryIndex].options[optionIndex];
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["field-registry"] });
      queryClient.invalidateQueries({ queryKey: ["field-category", variables.categoryId] });
      toast.success("Field option updated successfully");
    },
    onError: () => {
      toast.error("Failed to update field option");
    },
  });
};

export const useAddFieldOption = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ categoryId, option }: {
      categoryId: string;
      option: Omit<FieldOption, 'id'>;
    }) => {
      await delay(300);
      
      const categoryIndex = fieldRegistryStore.categories.findIndex(cat => cat.id === categoryId);
      if (categoryIndex === -1) throw new Error("Category not found");
      
      const newOption: FieldOption = {
        ...option,
        id: `${categoryId}_${option.value.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
      };
      
      fieldRegistryStore.categories[categoryIndex].options.push(newOption);
      fieldRegistryStore.totalOptions++;
      fieldRegistryStore.lastUpdated = new Date().toISOString();
      
      return newOption;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["field-registry"] });
      queryClient.invalidateQueries({ queryKey: ["field-category", variables.categoryId] });
      toast.success("Field option added successfully");
    },
    onError: () => {
      toast.error("Failed to add field option");
    },
  });
};

export const useDeleteFieldOption = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ categoryId, optionId }: {
      categoryId: string;
      optionId: string;
    }) => {
      await delay(300);
      
      const categoryIndex = fieldRegistryStore.categories.findIndex(cat => cat.id === categoryId);
      if (categoryIndex === -1) throw new Error("Category not found");
      
      const optionIndex = fieldRegistryStore.categories[categoryIndex].options.findIndex(opt => opt.id === optionId);
      if (optionIndex === -1) throw new Error("Option not found");
      
      const deletedOption = fieldRegistryStore.categories[categoryIndex].options[optionIndex];
      
      // Check if option is used in system (simulation)
      if (deletedOption.usageCount && deletedOption.usageCount > 0) {
        throw new Error("Cannot delete field option that is currently in use");
      }
      
      fieldRegistryStore.categories[categoryIndex].options.splice(optionIndex, 1);
      fieldRegistryStore.totalOptions--;
      fieldRegistryStore.lastUpdated = new Date().toISOString();
      
      return deletedOption;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["field-registry"] });
      queryClient.invalidateQueries({ queryKey: ["field-category", variables.categoryId] });
      toast.success("Field option deleted successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete field option");
    },
  });
};

export const useMarkAsLegacy = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ categoryId, optionId, isLegacy }: {
      categoryId: string;
      optionId: string;
      isLegacy: boolean;
    }) => {
      await delay(300);
      
      const categoryIndex = fieldRegistryStore.categories.findIndex(cat => cat.id === categoryId);
      if (categoryIndex === -1) throw new Error("Category not found");
      
      const optionIndex = fieldRegistryStore.categories[categoryIndex].options.findIndex(opt => opt.id === optionId);
      if (optionIndex === -1) throw new Error("Option not found");
      
      fieldRegistryStore.categories[categoryIndex].options[optionIndex].isLegacy = isLegacy;
      fieldRegistryStore.lastUpdated = new Date().toISOString();
      
      return fieldRegistryStore.categories[categoryIndex].options[optionIndex];
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["field-registry"] });
      queryClient.invalidateQueries({ queryKey: ["field-category", variables.categoryId] });
      toast.success(variables.isLegacy ? "Marked as legacy" : "Removed legacy status");
    },
    onError: () => {
      toast.error("Failed to update legacy status");
    },
  });
};

// Utility functions
export const getFieldOptionsByCategory = (categoryId: FieldCategoryId): FieldOption[] => {
  const category = fieldRegistryStore.categories.find(cat => cat.id === categoryId);
  return category?.options.sort((a, b) => (a.sortOrder || 999) - (b.sortOrder || 999)) || [];
};

export const searchFieldOptions = (query: string, categoryId?: FieldCategoryId): FieldOption[] => {
  const categories = categoryId 
    ? fieldRegistryStore.categories.filter(cat => cat.id === categoryId)
    : fieldRegistryStore.categories;
    
  const allOptions = categories.flatMap(cat => cat.options);
  
  if (!query.trim()) return allOptions;
  
  const searchTerm = query.toLowerCase();
  return allOptions.filter(option => 
    option.label.toLowerCase().includes(searchTerm) ||
    option.value.toLowerCase().includes(searchTerm) ||
    option.description?.toLowerCase().includes(searchTerm) ||
    option.category.toLowerCase().includes(searchTerm)
  );
};

export const getFieldUsageStats = () => {
  const totalOptions = fieldRegistryStore.totalOptions;
  const legacyCount = fieldRegistryStore.categories.reduce(
    (sum, cat) => sum + cat.options.filter(opt => opt.isLegacy).length, 0
  );
  const deprecatedCount = fieldRegistryStore.categories.reduce(
    (sum, cat) => sum + cat.options.filter(opt => opt.isDeprecated).length, 0
  );
  
  return {
    total: totalOptions,
    legacy: legacyCount,
    deprecated: deprecatedCount,
    active: totalOptions - legacyCount - deprecatedCount,
  };
};

// Advanced Analytics Hooks
export const useFieldAnalytics = () => {
  return useQuery({
    queryKey: ["field-analytics"],
    queryFn: async () => {
      await delay(200);
      
      const allOptions = fieldRegistryStore.categories.flatMap(cat => cat.options);
      const totalUsage = allOptions.reduce((sum, opt) => sum + (opt.usageCount || 0), 0);
      
      const sortedByUsage = [...allOptions].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
      const unusedFields = allOptions.filter(opt => !opt.usageCount || opt.usageCount === 0);
      
      const categoryUsage = fieldRegistryStore.categories.map(cat => ({
        categoryId: cat.id,
        categoryName: cat.name,
        usage: cat.options.reduce((sum, opt) => sum + (opt.usageCount || 0), 0)
      }));

      return {
        totalUsage,
        mostUsedFields: sortedByUsage.slice(0, 10),
        leastUsedFields: sortedByUsage.slice(-10).reverse(),
        unusedFields,
        categoryUsage,
        trendData: Array.from({ length: 30 }, (_, i) => ({
          date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          usage: Math.floor(Math.random() * 100) + 50
        }))
      };
    },
  });
};

export const useUnusedFieldDetector = (unusedDays: number = 30) => {
  return useQuery({
    queryKey: ["unused-fields", unusedDays],
    queryFn: async () => {
      await delay(100);
      
      const cutoffDate = new Date(Date.now() - unusedDays * 24 * 60 * 60 * 1000);
      const allOptions = fieldRegistryStore.categories.flatMap(cat => cat.options);
      
      return allOptions.filter(opt => {
        if (!opt.lastUsed) return true;
        return new Date(opt.lastUsed) < cutoffDate;
      });
    },
  });
};

// Bulk Operations Hooks
export const useBulkMarkLegacy = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ optionIds, isLegacy }: { optionIds: string[]; isLegacy: boolean }): Promise<BulkOperationResult> => {
      await delay(500);
      
      let processedCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      for (const optionId of optionIds) {
        try {
          for (const category of fieldRegistryStore.categories) {
            const optionIndex = category.options.findIndex(opt => opt.id === optionId);
            if (optionIndex !== -1) {
              category.options[optionIndex].isLegacy = isLegacy;
              processedCount++;
              break;
            }
          }
        } catch (error) {
          failedCount++;
          errors.push(`Failed to update option ${optionId}`);
        }
      }

      fieldRegistryStore.lastUpdated = new Date().toISOString();
      
      return {
        success: failedCount === 0,
        processedCount,
        failedCount,
        errors
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["field-registry"] });
      queryClient.invalidateQueries({ queryKey: ["field-analytics"] });
      
      if (result.success) {
        toast.success(`Successfully updated ${result.processedCount} options`);
      } else {
        toast.error(`Updated ${result.processedCount} options, ${result.failedCount} failed`);
      }
    },
    onError: () => {
      toast.error("Bulk operation failed");
    },
  });
};

export const useBulkDelete = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ optionIds }: { optionIds: string[] }): Promise<BulkOperationResult> => {
      await delay(500);
      
      let processedCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      for (const optionId of optionIds) {
        try {
          for (const category of fieldRegistryStore.categories) {
            const optionIndex = category.options.findIndex(opt => opt.id === optionId);
            if (optionIndex !== -1) {
              const option = category.options[optionIndex];
              // Check if option is in use
              if (option.usageCount && option.usageCount > 0) {
                failedCount++;
                errors.push(`Cannot delete ${option.label} - currently in use`);
                continue;
              }
              
              category.options.splice(optionIndex, 1);
              fieldRegistryStore.totalOptions--;
              processedCount++;
              break;
            }
          }
        } catch (error) {
          failedCount++;
          errors.push(`Failed to delete option ${optionId}`);
        }
      }

      fieldRegistryStore.lastUpdated = new Date().toISOString();
      
      return {
        success: failedCount === 0,
        processedCount,
        failedCount,
        errors
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["field-registry"] });
      queryClient.invalidateQueries({ queryKey: ["field-analytics"] });
      
      if (result.success) {
        toast.success(`Successfully deleted ${result.processedCount} options`);
      } else {
        toast.error(`Deleted ${result.processedCount} options, ${result.failedCount} failed`);
      }
    },
    onError: () => {
      toast.error("Bulk delete failed");
    },
  });
};

export const useBulkEdit = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      optionIds, 
      updates 
    }: { 
      optionIds: string[]; 
      updates: Partial<FieldOption> 
    }): Promise<BulkOperationResult> => {
      await delay(500);
      
      let processedCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      for (const optionId of optionIds) {
        try {
          for (const category of fieldRegistryStore.categories) {
            const optionIndex = category.options.findIndex(opt => opt.id === optionId);
            if (optionIndex !== -1) {
              category.options[optionIndex] = {
                ...category.options[optionIndex],
                ...updates,
                updatedAt: new Date().toISOString()
              };
              processedCount++;
              break;
            }
          }
        } catch (error) {
          failedCount++;
          errors.push(`Failed to update option ${optionId}`);
        }
      }

      fieldRegistryStore.lastUpdated = new Date().toISOString();
      
      return {
        success: failedCount === 0,
        processedCount,
        failedCount,
        errors
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["field-registry"] });
      queryClient.invalidateQueries({ queryKey: ["field-analytics"] });
      
      if (result.success) {
        toast.success(`Successfully updated ${result.processedCount} options`);
      } else {
        toast.error(`Updated ${result.processedCount} options, ${result.failedCount} failed`);
      }
    },
    onError: () => {
      toast.error("Bulk edit failed");
    },
  });
};