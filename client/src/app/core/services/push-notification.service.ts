import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

// VAPID public keys are base64url-encoded but the Push API wants a raw byte
// array — this is the standard conversion (same one every Web Push guide
// uses), not anything specific to this app.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  constructor(private http: HttpClient) {}

  isSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  permission(): NotificationPermission | 'unsupported' {
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission;
  }

  // Asks for permission (if not already decided), registers the service
  // worker, subscribes with the backend's VAPID public key, and saves the
  // subscription server-side. Returns false at any step that didn't
  // succeed — the caller just re-reads permission() to show why.
  async subscribe(): Promise<boolean> {
    if (!this.isSupported()) return false;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    const { publicKey } = await firstValueFrom(
      this.http.get<{ publicKey: string }>(`${environment.apiUrl}/push/vapid-public-key`),
    );
    if (!publicKey) return false;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    const json = subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    await firstValueFrom(
      this.http.post(`${environment.apiUrl}/push/subscribe`, { endpoint: json.endpoint, keys: json.keys }),
    );
    return true;
  }
}
