export type TaskStatus = 'completed' | 'in_progress' | 'pending' | 'cancelled';
export type InstallationType = 'solar_panel' | 'battery_storage' | 'inverter' | 'site_inspection' | 'site_audit' | 'permit_review' | 'client_meeting';

export interface DailyTask {
  id: string;
  title: string;
  status: TaskStatus;
}

export interface Installation {
  id: string;
  type: InstallationType;
  typeName: string;
  clientName: string;
  address: string;
  city: string;
  scheduledDate: string;   // YYYY-MM-DD
  startTime: string;       // HH:MM AM/PM
  endTime?: string;
  status: TaskStatus;
  notes?: string;
  coordinates?: { lat: number; lng: number };
}
