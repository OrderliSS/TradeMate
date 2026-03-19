export const supabase: any = {
  rpc: async () => ({ data: 'mock-id', error: null }),
  from: () => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
            order: () => Promise.resolve({ data: [], error: null }),
        }),
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        order: () => Promise.resolve({ data: [], error: null }),
        lt: () => Promise.resolve({ data: [], error: null }),
        gte: () => Promise.resolve({ data: [], error: null }),
      }),
      gte: () => ({
        lt: () => Promise.resolve({ data: [], error: null }),
      }),
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
    }),
    upsert: () => Promise.resolve({ data: null, error: null }),
    update: () => ({
        eq: () => ({
            eq: () => Promise.resolve({ data: null, error: null }),
        }),
    }),
  }),
};

