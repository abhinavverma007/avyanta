export interface Coworker {
  id: string;
  name: string;
  employeeId: string;
}

export interface TodayTask {
  id: string;
  title: string;
  description: string;
  site: string;
  date: string; // YYYY-MM-DD
  coworkers: Coworker[]; // everyone else assigned to the same task today
}
