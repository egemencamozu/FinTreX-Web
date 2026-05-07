import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EconomistRepository } from '../../../../../core/interfaces/economist.repository';
import { SupportTicketRepository } from '../../../../../core/interfaces/support-ticket.repository';
import { SubscriptionRepository } from '../../../../../core/interfaces/subscription.repository';
import { AlertsSignalRService } from '../../../../../core/services/alerts-signalr.service';
import { EconomistClient } from '../../../../../core/models/economist.model';
import { AvailableEconomist } from '../../../../../core/models/available-economist.model';
import { SupportTicket } from '../../../../../core/models/support-ticket.model';
import { SubscriptionTier } from '../../../../../core/enums/subscription-tier.enum';
import { SupportTicketType } from '../../../../../core/enums/support-ticket-type.enum';
import { SupportTicketStatus } from '../../../../../core/enums/support-ticket-status.enum';
import { KpiCardComponent } from '../../../../shared/components/kpi-card/kpi-card.component';

type ActiveTab = 'overview' | 'tickets';

type ChangeRequestTarget = {
  name: string;
  economistId: string;
  assignmentId: number | null;
  reason: string;
};

@Component({
  selector: 'app-my-economist',
  standalone: true,
  imports: [CommonModule, FormsModule, KpiCardComponent],
  templateUrl: './my-economist.html',
  styleUrl: './my-economist.scss',
})
export class MyEconomist implements OnInit {
  private readonly economistRepo     = inject(EconomistRepository);
  private readonly subscriptionRepo  = inject(SubscriptionRepository);
  private readonly supportTicketRepo = inject(SupportTicketRepository);
  private readonly alertsSignalR     = inject(AlertsSignalRService);
  private readonly destroyRef        = inject(DestroyRef);

  // ── State ────────────────────────────────────────────────────────────────────
  readonly isLoading         = signal(true);
  readonly isAssigning       = signal(false);
  readonly assigningEconomistId = signal<string | null>(null);
  readonly isSubmittingReq   = signal(false);
  readonly isLoadingTickets  = signal(false);
  readonly isDeletingTicket  = signal<number | null>(null);

  readonly myAssignments     = signal<EconomistClient[]>([]);
  readonly available         = signal<AvailableEconomist[]>([]);
  readonly myTickets         = signal<SupportTicket[]>([]);

  readonly activeTab         = signal<ActiveTab>('overview');
  readonly errorMessage      = signal<string | null>(null);
  readonly successMessage    = signal<string | null>(null);

  readonly isDefaultPlan      = signal(true);
  readonly maxEconomists      = signal(1);
  readonly showAddModal       = signal(false);
  readonly showChangeReqModal = signal(false);
  readonly changeReqMessage   = signal('');
  readonly selectedChangeAssignmentId = signal<number | null>(null);
  readonly isChangeDropdownOpen = signal(false);

  // ── Computed ─────────────────────────────────────────────────────────────────
  readonly activeAssignments = computed(() => this.myAssignments().filter(a => a.isActive));
  readonly hasEconomist      = computed(() => this.activeAssignments().length > 0);
  readonly canAddMore        = computed(() => this.activeAssignments().length < this.maxEconomists());
  readonly selectedChangeAssignment = computed(() => {
    const id = this.selectedChangeAssignmentId();
    if (id == null) return null;
    return this.activeAssignments().find(a => a.id === id) ?? null;
  });
  readonly openTicketsCount = computed(() =>
    this.myTickets().filter(t => t.status === SupportTicketStatus.Open).length
  );
  readonly inReviewTicketsCount = computed(() =>
    this.myTickets().filter(t => t.status === SupportTicketStatus.InReview).length
  );
  readonly answeredTicketsCount = computed(() =>
    this.myTickets().filter(t => t.status !== SupportTicketStatus.Open).length
  );

  readonly availableToAdd = computed(() => {
    const assignedIds = new Set(this.activeAssignments().map(a => this.normalizeId(a.economistId)));
    return this.available().filter(e => !assignedIds.has(this.normalizeId(e.id)));
  });

  readonly tabs: { id: ActiveTab; label: string }[] = [
    { id: 'overview', label: 'Genel Bakış' },
    { id: 'tickets',  label: 'Taleplerim' },
  ];

  readonly SupportTicketStatus = SupportTicketStatus;

  // ── Lifecycle ────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadSubscriptionTier();
    this.loadMyEconomists();
    this.bindRealtimeTicketUpdates();
  }

  // ── Data Loading ─────────────────────────────────────────────────────────────
  private loadSubscriptionTier(): void {
    this.subscriptionRepo.getMySubscription().subscribe({
      next: (sub) => {
        const tier = sub?.plan?.tier;
        this.isDefaultPlan.set(tier === SubscriptionTier.Default || tier == null);
        this.maxEconomists.set(sub?.plan?.maxEconomists ?? 1);
      },
      error: () => { this.isDefaultPlan.set(true); this.maxEconomists.set(1); },
    });
  }

  private loadMyEconomists(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.economistRepo.getMyEconomists().subscribe({
      next: (assignments) => {
        this.myAssignments.set(assignments);
        this.loadAvailableEconomists();
      },
      error: () => {
        this.errorMessage.set('Ekonomist bilgileri yüklenemedi.');
        this.isLoading.set(false);
      },
    });
  }

  private loadAvailableEconomists(): void {
    this.economistRepo.getAvailableEconomists().subscribe({
      next: (list) => { this.available.set(list); this.isLoading.set(false); },
      error: () => { this.errorMessage.set('Ekonomist listesi yüklenemedi.'); this.isLoading.set(false); },
    });
  }

  loadMyTickets(): void {
    this.isLoadingTickets.set(true);
    this.supportTicketRepo.getMyTickets().subscribe({
      next: (tickets) => {
        this.myTickets.set(tickets.sort((a, b) =>
          new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime()
        ));
        this.isLoadingTickets.set(false);
      },
      error: () => { this.isLoadingTickets.set(false); },
    });
  }

  private bindRealtimeTicketUpdates(): void {
    void this.alertsSignalR.connect();

    this.alertsSignalR.supportTicketUpdated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.refreshTicket(event.ticketId));

    this.alertsSignalR.economistClientChanged$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadMyEconomists());

    this.alertsSignalR.taskRated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.applyRatingEvent(event.economistId, event.rating));
  }

  private applyRatingEvent(economistId: string, rating: number): void {
    const targetId = this.normalizeId(economistId);
    this.available.update(list =>
      list.map(e => {
        if (this.normalizeId(e.id) !== targetId) return e;
        const newTotal = e.totalRatings + 1;
        const newAverage = Math.round(((e.averageRating ?? 0) * e.totalRatings + rating) / newTotal * 10) / 10;
        return { ...e, averageRating: newAverage, totalRatings: newTotal };
      })
    );
  }

  private refreshTicket(ticketId: number): void {
    this.supportTicketRepo.getTicketById(ticketId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (ticket) => this.upsertTicket(ticket),
        error: () => {
          if (this.activeTab() === 'tickets') this.loadMyTickets();
        },
      });
  }

  private upsertTicket(updated: SupportTicket): void {
    this.myTickets.update((tickets) => {
      const exists = tickets.some(t => t.id === updated.id);
      const next = exists
        ? tickets.map(t => t.id === updated.id ? updated : t)
        : [updated, ...tickets];

      return next.sort((a, b) =>
        new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime()
      );
    });
  }

  // ── Actions ──────────────────────────────────────────────────────────────────
  assignEconomist(economistId: string): void {
    this.isAssigning.set(true);
    this.assigningEconomistId.set(economistId);
    this.errorMessage.set(null);
    this.economistRepo.assignEconomist(economistId).subscribe({
      next: () => {
        this.isAssigning.set(false);
        this.assigningEconomistId.set(null);
        this.showAddModal.set(false);
        this.loadMyEconomists();
      },
      error: (err: Error) => {
        this.isAssigning.set(false);
        this.assigningEconomistId.set(null);
        this.errorMessage.set(err.message ?? 'Ekonomist ataması başarısız oldu.');
      },
    });
  }

  openChangeRequestModal(assignment?: EconomistClient): void {
    const target = assignment ?? this.activeAssignments()[0] ?? null;
    this.selectedChangeAssignmentId.set(target?.id ?? null);
    this.isChangeDropdownOpen.set(false);
    this.changeReqMessage.set('');
    this.showChangeReqModal.set(true);
  }

  closeChangeRequestModal(): void {
    this.showChangeReqModal.set(false);
    this.selectedChangeAssignmentId.set(null);
    this.isChangeDropdownOpen.set(false);
    this.changeReqMessage.set('');
  }

  toggleChangeDropdown(): void {
    this.isChangeDropdownOpen.update(isOpen => !isOpen);
  }

  selectChangeAssignment(assignmentId: number): void {
    this.selectedChangeAssignmentId.set(assignmentId);
    this.isChangeDropdownOpen.set(false);
  }

  submitChangeRequest(): void {
    const message = this.changeReqMessage().trim();
    const target = this.selectedChangeAssignment();
    if (!message || !target) return;
    this.isSubmittingReq.set(true);
    this.errorMessage.set(null);
    this.supportTicketRepo.createTicket({
      type: SupportTicketType.Request,
      subject: `Ekonomist Değişiklik Talebi - ${target.economistName ?? 'Ekonomist'}`,
      message: this.buildChangeRequestMessage(target, message),
    }).subscribe({
      next: () => {
        this.isSubmittingReq.set(false);
        this.closeChangeRequestModal();
        this.successMessage.set('Talebiniz alındı. Admin inceleyecek ve size bilgi verecek.');
        setTimeout(() => this.successMessage.set(null), 5000);
        if (this.activeTab() === 'tickets') this.loadMyTickets();
      },
      error: () => { this.isSubmittingReq.set(false); this.errorMessage.set('Talep gönderilemedi.'); },
    });
  }

  deleteTicket(ticketId: number): void {
    this.isDeletingTicket.set(ticketId);
    this.supportTicketRepo.deleteTicket(ticketId).subscribe({
      next: () => { this.isDeletingTicket.set(null); this.myTickets.update(list => list.filter(t => t.id !== ticketId)); },
      error: () => { this.isDeletingTicket.set(null); this.errorMessage.set('Talep silinemedi.'); },
    });
  }

  setTab(tab: ActiveTab): void {
    this.activeTab.set(tab);
    if (tab === 'tickets') this.loadMyTickets();
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  getInitials(economist: AvailableEconomist): string {
    return `${economist.firstName[0] ?? ''}${economist.lastName[0] ?? ''}`.toUpperCase();
  }

  getAvailableEconomistDisplayName(economist: AvailableEconomist): string {
    const fullName = `${economist.firstName ?? ''} ${economist.lastName ?? ''}`.trim();
    return fullName || economist.userName || economist.email || economist.id;
  }

  getAssignmentInitials(a: EconomistClient): string {
    return (a.economistName ?? '').split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase();
  }

  getChangeRequestTarget(_ticket: SupportTicket): ChangeRequestTarget | null {
    return null;
  }

  getTicketDisplayMessage(_ticket: SupportTicket): string {
    return '';
  }

  getStatusLabel(status: SupportTicketStatus): string {
    const map: Record<SupportTicketStatus, string> = {
      [SupportTicketStatus.Open]:     'Açık',
      [SupportTicketStatus.InReview]: 'İnceleniyor',
      [SupportTicketStatus.Resolved]: 'Çözüldü',
      [SupportTicketStatus.Closed]:   'Kapatıldı',
    };
    return map[status] ?? status;
  }

  getStatusClass(status: SupportTicketStatus): string {
    const map: Record<SupportTicketStatus, string> = {
      [SupportTicketStatus.Open]:     'open',
      [SupportTicketStatus.InReview]: 'in-review',
      [SupportTicketStatus.Resolved]: 'resolved',
      [SupportTicketStatus.Closed]:   'closed',
    };
    return map[status] ?? '';
  }

  formatDate(d: string): string {
    return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(d));
  }

  formatDateTime(d: string): string {
    return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d));
  }

  private buildChangeRequestMessage(assignment: EconomistClient, reason: string): string {
    return [
      `Ekonomist: ${assignment.economistName ?? 'Bilinmeyen ekonomist'}`,
      `Ekonomist ID: ${assignment.economistId}`,
      `Atama ID: ${assignment.id}`,
      '',
      'Gerekçe:',
      reason,
    ].join('\n');
  }

  private parseChangeRequestMessage(message: string): ChangeRequestTarget | null {
    const lines = message.split(/\r?\n/);
    const name = this.readPrefixedLine(lines, 'Ekonomist:');
    const economistId = this.readPrefixedLine(lines, 'Ekonomist ID:');
    const assignmentIdText = this.readPrefixedLine(lines, 'Atama ID:');
    const reasonIndex = lines.findIndex(line => line.trim() === 'Gerekçe:');

    if (!name || !economistId || reasonIndex < 0) return null;

    return {
      name,
      economistId,
      assignmentId: assignmentIdText ? Number(assignmentIdText) : null,
      reason: lines.slice(reasonIndex + 1).join('\n').trim(),
    };
  }

  private readPrefixedLine(lines: string[], prefix: string): string | null {
    const line = lines.find(item => item.startsWith(prefix));
    return line ? line.slice(prefix.length).trim() : null;
  }

  getEconomistRating(economistId: string): { average: number | null; total: number } {
    const found = this.available().find(e => this.normalizeId(e.id) === this.normalizeId(economistId));
    return { average: found?.averageRating ?? null, total: found?.totalRatings ?? 0 };
  }

  getRatingStars(average: number | null): { filled: boolean }[] {
    return [1, 2, 3, 4, 5].map(i => ({ filled: average != null && i <= Math.round(average) }));
  }

  private normalizeId(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
  }
}
