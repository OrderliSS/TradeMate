export const useAppointments = () => ({
  data: [],
  isLoading: false
});

export const useAppointmentStats = () => ({
  data: {
    todayAppointments: 0,
    thisWeekAppointments: 0,
    overdueAppointments: 0,
  },
  isLoading: false
});

export const useUpcomingAppointments = () => ({
  data: [],
  isLoading: false
});

export const useTodaysAppointments = () => ({
  data: [],
  isLoading: false
});

export const useAppointmentsByTask = () => ({
  data: [],
  isLoading: false
});

export const useCreateAppointment = () => ({
  mutate: () => {},
  isLoading: false
});

export const useUpdateAppointment = () => ({
  mutate: () => {},
  isLoading: false
});

export const useUpdateAppointmentStatus = () => ({
  mutate: () => {},
  isLoading: false
});

export const useRescheduleAppointment = () => ({
  mutate: () => {},
  isLoading: false
});

export const useDeleteAppointment = () => ({
  mutate: () => {},
  isLoading: false
});