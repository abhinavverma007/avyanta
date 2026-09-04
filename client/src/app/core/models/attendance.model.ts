// No weekends/holidays — every day is a working day until it's in the future.
// 'pending' is a leave request awaiting superadmin approval — it isn't
// counted as present, absent or leave until reviewed.
export type AttendanceStatus = 'present' | 'absent' | 'leave' | 'pending' | 'future';

export interface DayAttendance {
  date: string;        // YYYY-MM-DD
  status: AttendanceStatus;
  checkIn?: string;    // HH:MM, first punch-in of the day
  checkOut?: string;   // HH:MM, last punch-out of the day
  workHours?: number;  // total hours across all punch-in/out sessions that day
  lateBy?: number;     // minutes
  reason?: string;     // leave reason, present when status is 'leave' or 'pending'
}

export interface MonthlyAttendance {
  month: number;
  year: number;
  days: DayAttendance[];
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  pendingLeaveDays: number;
  totalWorkingDays: number;
}

export interface AdminMonthlyAttendance extends MonthlyAttendance {
  employee: {
    id: string;
    name: string;
    employeeId: string;
    department: string;
  };
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
