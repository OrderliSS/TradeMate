import { useMutation } from "@tanstack/react-query";
import { useAllTrackingData } from "./useAllTrackingData";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface ExportOptions {
  format: 'csv' | 'json';
  includeFields: string[];
  filterOptions?: {
    searchQuery?: string;
    statusFilter?: string;
    carrierFilter?: string;
    typeFilter?: string;
  };
}

export const useTrackingExport = () => {
  const { data: trackingData } = useAllTrackingData();

  return useMutation({
    mutationFn: async (options: ExportOptions) => {
      if (!trackingData?.items) {
        throw new Error("No tracking data available for export");
      }

      let filteredData = trackingData.items;

      // Apply filters if provided
      if (options.filterOptions) {
        const { searchQuery, statusFilter, carrierFilter, typeFilter } = options.filterOptions;
        
        filteredData = trackingData.items.filter((item: any) => {
          const matchesSearch = !searchQuery || 
            item.tracking_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.record_name?.toLowerCase().includes(searchQuery.toLowerCase());
          
          const matchesStatus = !statusFilter || statusFilter === "all" || item.delivery_status === statusFilter;
          const matchesCarrier = !carrierFilter || carrierFilter === "all" || item.carrier?.toLowerCase() === carrierFilter;
          const matchesType = !typeFilter || typeFilter === "all" || item.record_type === typeFilter;

          return matchesSearch && matchesStatus && matchesCarrier && matchesType;
        });
      }

      if (options.format === 'csv') {
        return exportToCsv(filteredData, options.includeFields);
      } else {
        return exportToJson(filteredData, options.includeFields);
      }
    },
    onSuccess: (data, variables) => {
      const blob = new Blob([data.content], { type: data.mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Complete",
        description: `Tracking data exported as ${variables.format.toUpperCase()}`,
      });
    },
    onError: (error: any) => {
      console.error("Export failed:", error);
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export tracking data",
        variant: "destructive",
      });
    },
  });
};

const exportToCsv = (data: any[], includeFields: string[]) => {
  const headers = includeFields.join(',');
  const rows = data.map(item => {
    return includeFields.map(field => {
      let value = item[field] || '';
      
      // Format dates
      if (field.includes('date') && value) {
        try {
          value = format(new Date(value), 'yyyy-MM-dd');
        } catch {
          // Keep original value if date parsing fails
        }
      }
      
      // Escape CSV special characters
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        value = `"${value.replace(/"/g, '""')}"`;
      }
      
      return value;
    }).join(',');
  });

  const csvContent = [headers, ...rows].join('\n');
  
  return {
    content: csvContent,
    filename: `tracking-export-${format(new Date(), 'yyyy-MM-dd')}.csv`,
    mimeType: 'text/csv;charset=utf-8;'
  };
};

const exportToJson = (data: any[], includeFields: string[]) => {
  const filteredData = data.map(item => {
    const filtered: any = {};
    includeFields.forEach(field => {
      filtered[field] = item[field];
    });
    return filtered;
  });

  const jsonContent = JSON.stringify({
    exportDate: new Date().toISOString(),
    totalRecords: filteredData.length,
    data: filteredData
  }, null, 2);

  return {
    content: jsonContent,
    filename: `tracking-export-${format(new Date(), 'yyyy-MM-dd')}.json`,
    mimeType: 'application/json;charset=utf-8;'
  };
};
