import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { UserRole } from '../../../core/enums/user-role.enum';
import { AuthService } from '../../../core/services/auth.service';

interface SidebarItem {
  label: string;
  icon: string;
  route: string;
}

const SIDEBAR_MAP: Record<UserRole, SidebarItem[]> = {
  [UserRole.USER]: [
    { label: 'Kullanici Paneli', icon: '📊', route: '/app/user' },
  ],
  [UserRole.ECONOMIST]: [
    { label: 'Ekonomist Paneli', icon: '📈', route: '/app/economist' },
  ],
  [UserRole.ADMIN]: [
    { label: 'Kullanicilar', icon: '👥', route: '/app/admin/users' },
    { label: 'Basvurular', icon: '📝', route: '/app/admin/applications' },
    { label: 'Yapilandirma', icon: '⚙️', route: '/app/admin/settings' },
  ],
};

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
})
export class MainLayoutComponent {
  protected readonly sidebarCollapsed = signal(false);
  protected readonly currentRole = signal<UserRole>(UserRole.USER);
  protected readonly currentUserName = signal('Kullanici');

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {
    const currentUser = this.authService.getCurrentUser();

    if (currentUser) {
      this.currentRole.set(currentUser.role);
      this.currentUserName.set(
        [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ') || currentUser.userName,
      );
    }
  }

  protected get sidebarItems(): SidebarItem[] {
    return SIDEBAR_MAP[this.currentRole()];
  }

  protected toggleSidebar(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  protected get avatarInitial(): string {
    return this.currentUserName().trim().charAt(0).toUpperCase() || 'U';
  }

  protected logout(): void {
    this.authService.logout();
    void this.router.navigate(['/auth/login']);
  }
}
