export type AppointmentStatus = 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'tentative' | 'unconfirmed' | 'rescheduled';

export interface Appointment {
  id: string;
  start_time: string;
  status: AppointmentStatus;
  title: string;
}

export interface AppointmentFormData {
  title: string;
  start_time: Date;
  end_time: Date;
  status?: AppointmentStatus;
}
