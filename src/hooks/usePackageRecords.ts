export interface PackageRecord {
  id: string;
  package_record_number: string;
  consolidated_status: string;
  source_stock_order_id?: string;
  source_stock_order?: { name: string; stock_record_number?: string };
  carriers_used?: string[];
  total_shipments: number;
  created_at: string;
}

export const usePackageRecords = () => ({
  data: [] as PackageRecord[],
  isLoading: false
});
