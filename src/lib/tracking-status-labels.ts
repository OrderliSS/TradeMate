export const trackingStatusLabels: Record<string, string> = {
  'pending': 'Pending',
  'shipped': 'Shipped',
  'delivered': 'Delivered',
  'cancelled': 'Cancelled',
  'in_transit': 'In Transit',
  'returned': 'Returned',
};

export const getStatusLabel = (status: string): string => {
  return trackingStatusLabels[status] || status;
};
