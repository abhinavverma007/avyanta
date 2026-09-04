// No weekends/holidays — every day is a working day until it's in the future.
export type AttendanceStatus = 'present' | 'absent' | 'leave' | 'future';

export interface DayAttendance {
  date: string;        // YYYY-MM-DD
  status: AttendanceStatus;
  checkIn?: string;    // HH:MM, first punch-in of the day
  checkOut?: string;   // HH:MM, last punch-out of the day
  workHours?: number;  // total hours across all punch-in/out sessions that day
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

export interface TodayAttendance extends DayAttendance {
  punchState: 'in' | 'out';
  lastPunchAt?: string; // HH:MM of the most recent punch event (in or out)
}

export interface PunchResponse {
  type: 'in' | 'out';
  lastPunchAt: string;
  record: DayAttendance;
}
