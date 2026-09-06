import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GlobalNoticeComponent } from './shared/global-notice/global-notice.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, GlobalNoticeComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'sundesh';
}
