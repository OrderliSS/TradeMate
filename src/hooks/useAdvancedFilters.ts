import { useState, useMemo } from "react";
import { AdvancedFilters, FilterCriteria } from "@/components/filters/AdvancedFilterPanel";

export const useAdvancedFilters = <T extends Record<string, any>>(
  initialFilters: AdvancedFilters = { criteria: [], matchType: "all" }
) => {
  const [filters, setFilters] = useState<AdvancedFilters>(initialFilters);

  const applyFilters = useMemo(() => {
    return (items: T[]): T[] => {
      if (filters.criteria.length === 0) return items;

      return items.filter((item) => {
        const matches = filters.criteria.map((criterion) =>
          matchCriterion(item, criterion)
        );

        return filters.matchType === "all"
          ? matches.every((m) => m)
          : matches.some((m) => m);
      });
    };
  }, [filters]);

  const matchCriterion = (item: T, criterion: FilterCriteria): boolean => {
    const fieldValue = getNestedValue(item, criterion.field);
    const criterionValue = criterion.value;

    if (fieldValue === null || fieldValue === undefined) return false;
    if (criterionValue === null || criterionValue === undefined) return false;

    const stringValue = String(fieldValue).toLowerCase();
    const stringCriterion = String(criterionValue).toLowerCase();

    switch (criterion.operator) {
      case "contains":
        return stringValue.includes(stringCriterion);
      case "equals":
        return stringValue === stringCriterion;
      case "startsWith":
        return stringValue.startsWith(stringCriterion);
      case "endsWith":
        return stringValue.endsWith(stringCriterion);
      case "notContains":
        return !stringValue.includes(stringCriterion);
      case "notEquals":
        return stringValue !== stringCriterion;
      case "greaterThan":
        return Number(fieldValue) > Number(criterionValue);
      case "lessThan":
        return Number(fieldValue) < Number(criterionValue);
      case "greaterOrEqual":
        return Number(fieldValue) >= Number(criterionValue);
      case "lessOrEqual":
        return Number(fieldValue) <= Number(criterionValue);
      case "before":
        return new Date(fieldValue) < new Date(criterionValue);
      case "after":
        return new Date(fieldValue) > new Date(criterionValue);
      default:
        return false;
    }
  };

  const getNestedValue = (obj: any, path: string): any => {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  };

  const addCriterion = (criterion: FilterCriteria) => {
    setFilters((prev) => ({
      ...prev,
      criteria: [...prev.criteria, criterion],
    }));
  };

  const removeCriterion = (index: number) => {
    setFilters((prev) => ({
      ...prev,
      criteria: prev.criteria.filter((_, i) => i !== index),
    }));
  };

  const updateCriterion = (index: number, updates: Partial<FilterCriteria>) => {
    setFilters((prev) => ({
      ...prev,
      criteria: prev.criteria.map((c, i) => (i === index ? { ...c, ...updates } : c)),
    }));
  };

  const clearFilters = () => {
    setFilters({ criteria: [], matchType: "all" });
  };

  const hasActiveFilters = filters.criteria.length > 0;

  return {
    filters,
    setFilters,
    applyFilters,
    addCriterion,
    removeCriterion,
    updateCriterion,
    clearFilters,
    hasActiveFilters,
  };
};
