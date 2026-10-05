import { Component, inject } from '@angular/core';
import { NoticeService } from '../../core/services/notice.service';
import { TPipe } from '../../core/i18n/t.pipe';

@Component({
  selector: 'app-global-notice',
  standalone: true,
  imports: [TPipe],
  templateUrl: './global-notice.component.html',
  styleUrl: './global-notice.component.scss',
})
export class GlobalNoticeComponent {
  readonly notice = inject(NoticeService);
}
