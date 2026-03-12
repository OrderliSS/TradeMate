export const supabase = {
  rpc: async () => ({ data: 'mock-id', error: null }),
  from: () => ({
    select: () => ({
      eq: () => ({
        order: () => Promise.resolve({ data: [], error: null }),
        lt: () => Promise.resolve({ data: [], error: null }),
        gte: () => Promise.resolve({ data: [], error: null }),
      }),
      gte: () => ({
        lt: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
  }),
};
