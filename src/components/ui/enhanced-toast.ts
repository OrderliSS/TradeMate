export const enhancedToast = {
  success: (title: string, msg: string) => console.log(`[TOAST SUCCESS] ${title}: ${msg}`),
  error: (title: string, msg: string) => console.error(`[TOAST ERROR] ${title}: ${msg}`),
  info: (title: string, msg: string) => console.log(`[TOAST INFO] ${title}: ${msg}`),
};
