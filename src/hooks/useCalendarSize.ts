import { useState, useEffect } from 'react';

export type CalendarSize = 'small' | 'medium' | 'large';

export const useCalendarSize = (defaultSize: CalendarSize = 'medium') => {
  const [size] = useState<CalendarSize>('medium');
  const setSize = () => {}; // No-op since we only support medium

  return { size, setSize };
};