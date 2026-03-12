// Backward compatibility layer - re-exports from useContacts with legacy names
export {
  useContacts as useCustomers,
  useContact as useCustomer,
  useCreateContact as useCreateCustomer,
  useBlacklistContact as useBlacklistCustomer,
  useRestoreContact as useRestoreCustomer,
  useUpdateContact as useUpdateCustomer,
  useDeleteContact as useDeleteCustomer,
} from './useContacts';