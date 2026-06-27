import { Injectable } from '@angular/core';
import { DailyTask, Installation } from '../models/task.model';

@Injectable({ providedIn: 'root' })
export class TaskService {

  getTodayTasks(): DailyTask[] {
    return [
      { id: 't1', title: 'Site audit — Ramesh Nagar colony',       status: 'completed' },
      { id: 't2', title: 'Client meeting — Johnson residence',     status: 'completed' },
      { id: 't3', title: 'Inverter install — Greenview Apartments', status: 'in_progress' },
      { id: 't4', title: 'Permit review — Oak Street project',     status: 'pending' },
    ];
  }

  getUpcomingInstallations(): Installation[] {
    return [
      {
        id: 'i001',
        type: 'solar_panel',
        typeName: 'Solar Panel Install',
        clientName: 'Alex Johnson',
        address: '234 Maple Street',
        city: 'San Francisco',
        scheduledDate: '2024-10-26',
        startTime: '10:00 AM',
        endTime: '2:00 PM',
        status: 'in_progress',
      },
      {
        id: 'i002',
        type: 'battery_storage',
        typeName: 'Battery Storage Set-up',
        clientName: 'Maria Gomez',
        address: '567 Oak Avenue',
        city: 'Oakland',
        scheduledDate: '2024-10-27',
        startTime: '9:00 AM',
        status: 'pending',
      },
      {
        id: 'i003',
        type: 'site_inspection',
        typeName: 'Site Inspection',
        clientName: 'David Lee',
        address: '789 Pine Lane',
        city: 'Berkeley',
        scheduledDate: '2024-10-28',
        startTime: '11:30 AM',
        status: 'pending',
      },
      {
        id: 'i004',
        type: 'inverter',
        typeName: 'Inverter Upgrade',
        clientName: 'Sarah Brown',
        address: '101 Cedar Road',
        city: 'Marin',
        scheduledDate: '2024-10-30',
        startTime: '8:00 AM',
        status: 'pending',
      },
    ];
  }
}
