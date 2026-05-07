import {
  Component,
  computed,
  effect,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';
import { EconomistStatus } from '../../../core/enums/economist-status.enum';
import { UserRole } from '../../../core/enums/user-role.enum';
import { AuthService, type AuthenticatedUser } from '../../../core/services/auth.service';
import { ChatSignalRService } from '../../../core/services/chat-signalr.service';
import { AlertsSignalRService } from '../../../core/services/alerts-signalr.service';
import { PriceAlertApiService } from '../../../core/services/price-alert-api.service';
import { WatchlistApiService } from '../../../core/services/watchlist-api.service';
import { SupportTicketRepository } from '../../../core/interfaces/support-ticket.repository';
import { TooltipMenuComponent } from '../../shared/components/tooltip-menu/tooltip-menu.component';
import { ThemeToggleComponent } from '../../shared/components/theme-toggle/theme-toggle';

interface SidebarItem {
  label: string;
  icon: string;
  route?: string;
  children?: SidebarItem[];
}

/** Üst çubukta hızlı erişim: havuzdan en fazla 3 seçilir (kullanıcı tercihi). */
interface TopbarBadgeItem {
  id: string;
  label: string;
  icon: string;
  route: string;
  /** `true` ise yalnızca tam URL eşleşmesinde aktif (ör. dashboard). */
  exact?: boolean;
}

/** Tooltip'teki gruplu görünüm için */
interface TopbarPoolGroup {
  label: string;
  icon: string;
  items: TopbarBadgeItem[];
}

const MAX_TOPBAR_SHORTCUTS = 3;
const TOPBAR_SHORTCUTS_STORAGE_PREFIX = 'fintrex_topbar_shortcuts_v1';

/** Sidebar yapısından flat pool ve gruplu pool üretir. */
function buildPoolsFromSidebar(items: SidebarItem[]): { flat: TopbarBadgeItem[]; groups: TopbarPoolGroup[] } {
  const flat: TopbarBadgeItem[] = [];
  const groups: TopbarPoolGroup[] = [];

  for (const item of items) {
    if (item.children) {
      const children: TopbarBadgeItem[] = item.children
        .filter((c) => c.route)
        .map((c) => ({
          id: c.route!.replace(/^\/app\//, '').replace(/\//g, '-'),
          label: c.label,
          icon: c.icon,
          route: c.route!,
        }));
      flat.push(...children);
      groups.push({ label: item.label, icon: item.icon, items: children });
    } else if (item.route) {
      const badge: TopbarBadgeItem = {
        id: item.route.replace(/^\/app\//, '').replace(/\//g, '-'),
        label: item.label,
        icon: item.icon,
        route: item.route,
        exact: item.route === '/app/dashboard',
      };
      flat.push(badge);
      groups.push({ label: item.label, icon: item.icon, items: [badge] });
    }
  }

  return { flat, groups };
}

function defaultShortcutIdsForRole(sidebarItems: SidebarItem[]): string[] {
  const { flat } = buildPoolsFromSidebar(sidebarItems);
  return flat.slice(0, MAX_TOPBAR_SHORTCUTS).map((b) => b.id);
}

const SIDEBAR_MAP: Record<UserRole, SidebarItem[]> = {
  [UserRole.USER]: [
    { label: 'Gösterge Paneli', icon: 'fa-solid fa-chart-pie', route: '/app/dashboard' },
    {
      label: 'Portföy ve Piyasalar',
      icon: 'fa-solid fa-briefcase',
      children: [
        { label: 'Portföylerim', icon: 'fa-solid fa-folder-open', route: '/app/portfolio' },
        { label: 'İzleme Listesi', icon: 'fa-solid fa-star', route: '/app/portfolio/watchlist' },
        {
          label: 'Piyasa Verileri',
          icon: 'fa-solid fa-arrow-trend-up',
          route: '/app/portfolio/markets',
        },
      ],
    },
    {
      label: 'Danışmanlık ve İletişim',
      icon: 'fa-solid fa-user-tie',
      children: [
        {
          label: 'Ekonomistim',
          icon: 'fa-solid fa-user-check',
          route: '/app/consultancy/my-economist',
        },
        {
          label: 'Analiz Görevleri',
          icon: 'fa-solid fa-list-check',
          route: '/app/consultancy/my-requests',
        },
        { label: 'Mesajlar', icon: 'fa-solid fa-envelope', route: '/app/chat' },
        { label: 'AI Asistan', icon: 'fa-solid fa-robot', route: '/app/ai-assistant' },
        { label: 'MCP', icon: 'fa-solid fa-diagram-project', route: '/app/mcp' },
      ],
    },
    {
      label: 'Abonelik ve Finansal',
      icon: 'fa-solid fa-credit-card',
      children: [
        {
          label: 'Abonelik Yönetimi',
          icon: 'fa-solid fa-crown',
          route: '/app/subscription/manage',
        },
        {
          label: 'Ödeme Bilgileri',
          icon: 'fa-solid fa-file-invoice-dollar',
          route: '/app/subscription/billing',
        },
      ],
    },
    { label: 'Profil Bilgileri', icon: 'fa-solid fa-user', route: '/app/profile/info' },
    { label: 'Yardım ve Destek', icon: 'fa-solid fa-life-ring', route: '/app/support' },
  ],
  [UserRole.ECONOMIST]: [
    { label: 'Müşterilerim', icon: 'fa-solid fa-users', route: '/app/economist/customers' },
    { label: 'Görevlerim', icon: 'fa-solid fa-list-check', route: '/app/economist/assigned-tasks' },
    { label: 'Mesajlar', icon: 'fa-solid fa-envelope', route: '/app/chat' },
    { label: 'MCP', icon: 'fa-solid fa-diagram-project', route: '/app/mcp' },
    { label: 'Profil', icon: 'fa-solid fa-user', route: '/app/profile' },
    { label: 'Yardım ve Destek', icon: 'fa-solid fa-life-ring', route: '/app/support' },
  ],
  [UserRole.ADMIN]: [
    { label: 'Kullanıcılar', icon: 'fa-solid fa-users', route: '/app/admin/users' },
    { label: 'Paket Yönetimi', icon: 'fa-solid fa-crown', route: '/app/admin/subscriptions' },
    { label: 'Gelir Paneli', icon: 'fa-solid fa-chart-line', route: '/app/admin/revenue' },
    {
      label: 'Destek Talepleri',
      icon: 'fa-solid fa-life-ring',
      route: '/app/admin/support-tickets',
    },
    {
      label: 'Ekonomist Performansı',
      icon: 'fa-solid fa-star-half-stroke',
      route: '/app/admin/economists',
    },
    {
      label: 'Ekonomist Başvuruları',
      icon: 'fa-solid fa-file-circle-check',
      route: '/app/admin/economist-applications',
    },
    { label: 'MCP', icon: 'fa-solid fa-diagram-project', route: '/app/mcp' },
  ],
};

const ECONOMIST_PENDING_SIDEBAR: SidebarItem[] = [
  { label: 'Başvurum', icon: 'fa-solid fa-file-pen', route: '/app/economist/application-status' },
];

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, TooltipMenuComponent, ThemeToggleComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
})
export class MainLayoutComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly supportRepo = inject(SupportTicketRepository);

  protected readonly chatSignalR = inject(ChatSignalRService);
  private readonly alertsSignalR = inject(AlertsSignalRService);
  private readonly watchlistApi = inject(WatchlistApiService);
  private readonly priceAlertApi = inject(PriceAlertApiService);
  protected readonly supportOpenCount = signal<number>(0);
  protected readonly sidebarCollapsed = signal(false);
  /** Üst çubukta gösterilecek kısayol id’leri (havuz sırasına göre sıralanır). */
  private readonly shortcutIds = signal<string[]>([]);

  private readonly currentUser = toSignal(this.authService.currentUser$, {
    initialValue: this.authService.getCurrentUser(),
  });

  protected readonly currentRole = computed<UserRole>(() => {
    const user = this.currentUser();
    if (!user) {
      return UserRole.USER;
    }

    return user.role;
  });

  protected readonly currentUserName = computed(() => {
    const user = this.currentUser();
    if (!user) {
      return 'Kullanici';
    }

    return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.userName;
  });
  protected get sidebarItems(): SidebarItem[] {
    const role = this.currentRole();
    if (role === UserRole.ECONOMIST) {
      const status = this.authService.getEconomistStatus();
      if (status !== EconomistStatus.APPROVED) {
        return ECONOMIST_PENDING_SIDEBAR;
      }
    }
    return SIDEBAR_MAP[role];
  }

  private readonly pools = computed(() => buildPoolsFromSidebar(this.sidebarItems));

  /** Tooltip'teki gruplu havuz (parent başlık + children) */
  protected readonly topbarPoolGroups = computed(() => this.pools().groups);

  protected readonly topbarBadges = computed<TopbarBadgeItem[]>(() => {
    const flat = this.pools().flat;
    const selected = new Set(this.shortcutIds());
    return flat.filter((b) => selected.has(b.id));
  });

  constructor() {
    effect(() => {
      const user = this.currentUser();
      if (!user) {
        return;
      }
      this.hydrateShortcuts(user);
    });
  }

  protected readonly openMenus = signal<Record<string, boolean>>({});

  async ngOnInit(): Promise<void> {
    await this.chatSignalR.connect();
    await this.alertsSignalR.connect();

    // Not: Watchlist + PriceAlerts + /hubs/alerts bootstrap'i burada değil
    // ilgili sayfaların (watchlist/markets) ngOnInit'inde tetikleniyor — böylece
    // giriş anında gereksiz istek atılmıyor.

    this.checkActiveAccordion(this.router.url);
    this.refreshSupportOpenCount();

    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.checkActiveAccordion(event.urlAfterRedirects);
        this.refreshSupportOpenCount();
      });

    this.alertsSignalR.supportTicketCreated$.subscribe(() => {
      this.refreshSupportOpenCount();
    });
  }

  private refreshSupportOpenCount(): void {
    if (this.currentRole() !== UserRole.ADMIN) {
      this.supportOpenCount.set(0);
      return;
    }
    this.supportRepo.getOpenCount().subscribe({
      next: (count) => this.supportOpenCount.set(count),
      error: () => {
        // sidebar badge best-effort — hata durumunda mevcut sayıyı koru
      },
    });
  }

  private checkActiveAccordion(url: string): void {
    const items = this.sidebarItems;
    const activeParent = items.find(
      (item) => item.children && item.children.some((child) => child.route && url.includes(child.route)),
    );

    if (activeParent) {
      this.openMenus.set({ [activeParent.label]: true });
      return;
    }

    this.openMenus.set({});
  }

  protected isAccordionActive(item: SidebarItem): boolean {
    if (!item.children) return false;
    const url = this.router.url;
    return item.children.some((child) => child.route && url.startsWith(child.route));
  }

  protected toggleAccordion(label: string): void {
    if (this.sidebarCollapsed()) {
      // Menü kapalıysa tıklandığında menüyü aç
      this.sidebarCollapsed.set(false);
    }
    const isCurrentlyOpen = this.openMenus()[label];
    this.openMenus.set(isCurrentlyOpen ? {} : { [label]: true });
  }

  protected toggleSidebar(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  protected get avatarInitial(): string {
    return this.currentUserName().trim().charAt(0).toUpperCase() || 'U';
  }

  /** Tooltip içindeki geçici seçimler — "Uygula"ya basılana kadar uygulanmaz. */
  protected readonly pendingShortcutIds = signal<string[]>([]);

  /** Tooltip açıldığında mevcut seçimleri pending'e kopyalar. */
  protected initPendingShortcuts(): void {
    this.pendingShortcutIds.set([...this.shortcutIds()]);
  }

  protected isPendingSelected(id: string): boolean {
    return this.pendingShortcutIds().includes(id);
  }

  protected isPendingDisabled(id: string): boolean {
    if (this.isPendingSelected(id)) return false;
    return this.pendingShortcutIds().length >= MAX_TOPBAR_SHORTCUTS;
  }

  protected togglePendingId(id: string): void {
    const valid = new Set(this.pools().flat.map((b) => b.id));
    if (!valid.has(id)) return;

    const next = [...this.pendingShortcutIds()];
    const i = next.indexOf(id);
    if (i >= 0) {
      next.splice(i, 1);
    } else if (next.length < MAX_TOPBAR_SHORTCUTS) {
      next.push(id);
    } else {
      return;
    }
    this.pendingShortcutIds.set(next);
  }

  protected applyPendingShortcuts(): void {
    this.shortcutIds.set([...this.pendingShortcutIds()]);
    this.persistShortcuts();
  }

  protected get hasPendingChanges(): boolean {
    const current = this.shortcutIds();
    const pending = this.pendingShortcutIds();
    if (current.length !== pending.length) return true;
    return current.some((id, i) => id !== pending[i]);
  }

  private hydrateShortcuts(user: AuthenticatedUser): void {
    const role = user.role;
    const sidebarItems = SIDEBAR_MAP[role];
    const { flat } = buildPoolsFromSidebar(sidebarItems);
    const validIds = new Set(flat.map((b) => b.id));
    const key = `${TOPBAR_SHORTCUTS_STORAGE_PREFIX}_${user.id}_${role}`;
    const raw = localStorage.getItem(key);

    if (raw) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          const filtered = parsed
            .filter((x): x is string => typeof x === 'string' && validIds.has(x))
            .slice(0, MAX_TOPBAR_SHORTCUTS);
          this.shortcutIds.set(filtered.length > 0 ? filtered : defaultShortcutIdsForRole(sidebarItems));
          return;
        }
      } catch {
        // yoksay, varsayılanı kullan
      }
    }

    this.shortcutIds.set(defaultShortcutIdsForRole(sidebarItems));
  }

  private persistShortcuts(): void {
    const user = this.currentUser();
    if (!user) {
      return;
    }
    const key = `${TOPBAR_SHORTCUTS_STORAGE_PREFIX}_${user.id}_${user.role}`;
    localStorage.setItem(key, JSON.stringify(this.shortcutIds()));
  }

  protected logout(): void {
    this.authService.logout();
    void this.alertsSignalR.disconnect();
    this.watchlistApi.clear();
    this.priceAlertApi.clear();
    void this.router.navigate(['/auth/login']);
  }

}
