export type AttendanceStatus = 'present' | 'absent' | 'leave' | 'holiday' | 'weekend' | 'future';

export interface DayAttendance {
  date: string;        // YYYY-MM-DD
  status: AttendanceStatus;
  checkIn?: string;    // HH:MM
  checkOut?: string;
  workHours?: number;
  lateBy?: number;     // minutes
}

export interface MonthlyAttendance {
  month: number;
  year: number;
  days: DayAttendance[];
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  totalWorkingDays: number;
}

export interface PunchRecord {
  type: 'in' | 'out';
  timestamp: Date;
  location?: string;
}
