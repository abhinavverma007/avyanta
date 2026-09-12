export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationList {
  notifications: AppNotification[];
  unreadCount: number;
}
