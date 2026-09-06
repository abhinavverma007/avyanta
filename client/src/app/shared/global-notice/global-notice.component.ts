import { Component, inject } from '@angular/core';
import { NoticeService } from '../../core/services/notice.service';

@Component({
  selector: 'app-global-notice',
  standalone: true,
  templateUrl: './global-notice.component.html',
  styleUrl: './global-notice.component.scss',
})
export class GlobalNoticeComponent {
  readonly notice = inject(NoticeService);
}
