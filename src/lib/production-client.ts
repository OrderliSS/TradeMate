export const productionClient = {
  from: () => ({
    select: () => Promise.resolve({ data: [], error: null }),
  }),
};
