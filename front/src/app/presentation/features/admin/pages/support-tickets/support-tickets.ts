import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, of, switchMap } from 'rxjs';

import {
  SupportTicketRepository,
  UpdateSupportTicketRequest,
} from '../../../../../core/interfaces/support-ticket.repository';
import { SupportTicket } from '../../../../../core/models/support-ticket.model';
import { SupportTicketMessage } from '../../../../../core/models/support-ticket-message.model';
import { SupportTicketStatus } from '../../../../../core/enums/support-ticket-status.enum';
import { SupportTicketType } from '../../../../../core/enums/support-ticket-type.enum';
import { AlertService } from '../../../../../core/services/alert.service';
import { AlertsSignalRService } from '../../../../../core/services/alerts-signalr.service';
import { EconomistRepository } from '../../../../../core/interfaces/economist.repository';
import { UserManagementRepository } from '../../../../../core/interfaces/user-management.repository';
import { AvailableEconomist } from '../../../../../core/models/available-economist.model';
import { EconomistClient } from '../../../../../core/models/economist.model';
import { UserRole } from '../../../../../core/enums/user-role.enum';

type StatusAllFilter = 'all' | SupportTicketStatus;
type TypeAllFilter = 'all' | SupportTicketType;
type RoleAllFilter = 'all' | 'USER' | 'ECONOMIST';
type AssignmentAction = 'none' | 'change' | 'remove';
type EconomistChangeTarget = {
  name: string;
  economistId: string;
  assignmentId: string;
  reason: string;
};

const STATUS_ORDER: SupportTicketStatus[] = [
  SupportTicketStatus.Open,
  SupportTicketStatus.InReview,
  SupportTicketStatus.Resolved,
  SupportTicketStatus.Closed,
];

@Component({
  selector: 'app-admin-support-tickets',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './support-tickets.html',
  styleUrl: './support-tickets.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportTickets implements OnInit {
  private readonly repo = inject(SupportTicketRepository);
  private readonly economistRepo = inject(EconomistRepository);
  private readonly userManagementRepo = inject(UserManagementRepository);
  private readonly alerts = inject(AlertService);
  private readonly alertsSignalR = inject(AlertsSignalRService);
  private readonly destroyRef = inject(DestroyRef);

  readonly tickets = signal<SupportTicket[]>([]);
  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly isChangingAssignment = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly selected = signal<SupportTicket | null>(null);
  readonly draftStatus = signal<SupportTicketStatus | null>(null);
  readonly availableEconomists = signal<AvailableEconomist[]>([]);

  readonly messages = signal<SupportTicketMessage[]>([]);
  readonly messagesLoading = signal(false);
  readonly newMessage = signal('');
  readonly isSendingMessage = signal(false);
  readonly clientAssignments = signal<EconomistClient[]>([]);
  readonly selectedNewEconomistId = signal<string>('');
  readonly assignmentAction = signal<AssignmentAction>('none');

  readonly search = signal<string>('');
  readonly statusFilter = signal<StatusAllFilter>('all');
  readonly typeFilter = signal<TypeAllFilter>('all');
  readonly roleFilter = signal<RoleAllFilter>('all');
  readonly dateFrom = signal<string>('');
  readonly dateTo = signal<string>('');
  readonly unansweredOnly = signal<boolean>(false);

  readonly typeOptions: Array<{ value: TypeAllFilter; label: string }> = [
    { value: 'all', label: 'Tüm tipler' },
    { value: SupportTicketType.Complaint, label: 'Şikayet' },
    { value: SupportTicketType.Support, label: 'Destek' },
    { value: SupportTicketType.Suggestion, label: 'Öneri' },
    { value: SupportTicketType.Request, label: 'Talep' },
    { value: SupportTicketType.Other, label: 'Diğer' },
  ];

  readonly statusOptions: Array<{ value: StatusAllFilter; label: string }> = [
    { value: 'all', label: 'Tüm durumlar' },
    { value: SupportTicketStatus.Open, label: 'Açık' },
    { value: SupportTicketStatus.InReview, label: 'İnceleniyor' },
    { value: SupportTicketStatus.Resolved, label: 'Çözüldü' },
    { value: SupportTicketStatus.Closed, label: 'Kapalı' },
  ];

  readonly roleOptions: Array<{ value: RoleAllFilter; label: string }> = [
    { value: 'all', label: 'Tüm roller' },
    { value: 'USER', label: 'Kullanıcı' },
    { value: 'ECONOMIST', label: 'Ekonomist' },
  ];

  readonly openCount = computed(
    () => this.tickets().filter((t) => t.status === SupportTicketStatus.Open).length,
  );

  readonly filtered = computed<SupportTicket[]>(() => {
    const q = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    const type = this.typeFilter();
    const role = this.roleFilter();
    const from = this.dateFrom() ? new Date(this.dateFrom()).getTime() : null;
    const to = this.dateTo() ? new Date(this.dateTo()).getTime() + 86400000 : null;
    const onlyUnanswered = this.unansweredOnly();

    return this.tickets().filter((t) => {
      if (onlyUnanswered && t.status !== SupportTicketStatus.Open) return false;
      if (status !== 'all' && t.status !== status) return false;
      if (type !== 'all' && t.type !== type) return false;
      if (role !== 'all') {
        const r = (t.userRole ?? '').toUpperCase();
        if (r !== role) return false;
      }
      if (q) {
        const hay = `${t.subject} ${t.userName ?? ''} ${t.userEmail ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (from !== null || to !== null) {
        const created = new Date(t.createdAtUtc).getTime();
        if (from !== null && created < from) return false;
        if (to !== null && created >= to) return false;
      }
      return true;
    });
  });

  readonly nextAllowedStatus = computed<SupportTicketStatus | null>(() => {
    const current = this.selected()?.status;
    if (!current) return null;
    const idx = STATUS_ORDER.indexOf(current);
    if (idx < 0 || idx >= STATUS_ORDER.length - 1) return null;
    return STATUS_ORDER[idx + 1];
  });

  readonly canSave = computed(() => {
    const sel = this.selected();
    if (!sel) return false;
    return this.canUpdateDraftStatus() || this.hasValidPendingAssignmentAction();
  });

  ngOnInit(): void {
    this.load();
    this.loadAvailableEconomists();
    this.bindRealtimeTicketUpdates();

    this.alertsSignalR.supportTicketMessageAdded$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ev) => {
        if (this.selected()?.id === ev.ticketId) {
          this.loadMessages(ev.ticketId);
        }
      });
  }

  load(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.repo
      .getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.tickets.set([...list].sort(
            (a, b) => new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime(),
          ));
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('Ticketlar yüklenemedi.');
          this.isLoading.set(false);
        },
      });
  }

  openDetail(ticket: SupportTicket): void {
    this.selected.set(ticket);
    this.draftStatus.set(ticket.status);
    this.selectedNewEconomistId.set('');
    this.assignmentAction.set('none');
    this.messages.set([]);
    this.newMessage.set('');
    this.loadClientAssignments(ticket.userId);
    this.loadMessages(ticket.id);
  }

  closeDetail(): void {
    this.selected.set(null);
    this.draftStatus.set(null);
    this.selectedNewEconomistId.set('');
    this.assignmentAction.set('none');
    this.clientAssignments.set([]);
    this.messages.set([]);
    this.newMessage.set('');
  }

  onStatusDraftChange(value: SupportTicketStatus): void {
    this.draftStatus.set(value);
  }

  onNewEconomistChange(value: string): void {
    this.selectedNewEconomistId.set(value);
    if (!value && this.assignmentAction() === 'change') {
      this.assignmentAction.set('none');
    }
    if (value && this.assignmentAction() === 'remove') {
      this.assignmentAction.set('none');
    }
  }

  onRemoveAssignmentChange(checked: boolean): void {
    this.assignmentAction.set(checked ? 'remove' : 'none');
    if (checked) {
      this.selectedNewEconomistId.set('');
    }
  }

  save(): void {
    const sel = this.selected();
    if (!sel || !this.canSave()) return;

    this.isSaving.set(true);
    this.isChangingAssignment.set(this.hasValidPendingAssignmentAction());
    const payload: UpdateSupportTicketRequest = {
      status: this.canUpdateDraftStatus() ? this.draftStatus()! : sel.status,
    };

    this.executePendingAssignmentAction(sel)
      .pipe(
        switchMap(() => this.repo.updateTicket(sel.id, payload)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (updated) => {
          this.tickets.update((list) => list.map((t) => (t.id === updated.id ? updated : t)));
          this.selected.set(updated);
          this.draftStatus.set(updated.status);
          this.selectedNewEconomistId.set('');
          this.assignmentAction.set('none');
          this.loadClientAssignments(updated.userId);
          this.isSaving.set(false);
          this.isChangingAssignment.set(false);
          this.alerts.show('success', 'Ticket durumu güncellendi.');
        },
        error: () => {
          this.isSaving.set(false);
          this.isChangingAssignment.set(false);
          this.alerts.show('error', 'Güncelleme başarısız. Tekrar deneyin.');
        },
      });
  }

  private bindRealtimeTicketUpdates(): void {
    void this.alertsSignalR.connect();

    this.alertsSignalR.supportTicketCreated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (event.action === 'Deleted') {
          this.removeTicket(event.ticketId);
          return;
        }

        this.refreshTicket(event.ticketId);
      });

    this.alertsSignalR.economistClientChanged$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        const selected = this.selected();
        if (selected?.userId === event.clientId) {
          this.loadClientAssignments(event.clientId);
        }
      });
  }

  private refreshTicket(ticketId: number): void {
    this.repo
      .getTicketById(ticketId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (ticket) => this.upsertTicket(ticket),
        error: () => this.load(),
      });
  }

  private upsertTicket(updated: SupportTicket): void {
    this.tickets.update((tickets) => {
      const exists = tickets.some((ticket) => ticket.id === updated.id);
      const next = exists
        ? tickets.map((ticket) => (ticket.id === updated.id ? updated : ticket))
        : [updated, ...tickets];

      return next.sort(
        (a, b) => new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime(),
      );
    });

    if (this.selected()?.id === updated.id) {
      this.selected.set(updated);
      this.draftStatus.set(updated.status);
    }
  }

  private removeTicket(ticketId: number): void {
    this.tickets.update((tickets) => tickets.filter((ticket) => ticket.id !== ticketId));
    if (this.selected()?.id === ticketId) {
      this.closeDetail();
    }
  }


  changeTargetAssignment(): void {
    if (this.assignmentAction() === 'change') {
      this.assignmentAction.set('none');
      return;
    }

    this.assignmentAction.set(this.selectedNewEconomistId() ? 'change' : 'none');
  }

  loadMessages(ticketId: number): void {
    this.messagesLoading.set(true);
    this.repo
      .getMessages(ticketId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.messages.set(list);
          this.messagesLoading.set(false);
        },
        error: () => this.messagesLoading.set(false),
      });
  }

  sendMessage(): void {
    const body = this.newMessage().trim();
    const ticket = this.selected();
    if (!body || !ticket || this.isSendingMessage()) return;
    if (ticket.status === SupportTicketStatus.Closed) return;

    this.isSendingMessage.set(true);
    this.repo
      .sendMessage(ticket.id, body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (msg) => {
          this.messages.update((list) => [...list, msg]);
          this.newMessage.set('');
          this.isSendingMessage.set(false);
        },
        error: () => {
          this.alerts.show('error', 'Mesaj gönderilemedi.');
          this.isSendingMessage.set(false);
        },
      });
  }

  onMessageKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  removeTargetAssignment(): void {
    if (this.assignmentAction() === 'remove') {
      this.assignmentAction.set('none');
      return;
    }

    this.selectedNewEconomistId.set('');
    this.assignmentAction.set('remove');
  }

  resetFilters(): void {
    this.search.set('');
    this.statusFilter.set('all');
    this.typeFilter.set('all');
    this.roleFilter.set('all');
    this.dateFrom.set('');
    this.dateTo.set('');
    this.unansweredOnly.set(false);
  }

  toggleUnanswered(): void {
    this.unansweredOnly.update((v) => !v);
  }

  getTypeLabel(t: string): string {
    return this.typeOptions.find((o) => o.value === t)?.label ?? t;
  }

  getStatusLabel(s: string): string {
    return this.statusOptions.find((o) => o.value === s)?.label ?? s;
  }

  getStatusTone(s: string): string {
    const map: Record<string, string> = {
      [SupportTicketStatus.Open]: 'warning',
      [SupportTicketStatus.InReview]: 'info',
      [SupportTicketStatus.Resolved]: 'success',
      [SupportTicketStatus.Closed]: 'default',
    };
    return map[s] ?? 'default';
  }

  getTypeTone(t: string): string {
    const map: Record<string, string> = {
      [SupportTicketType.Complaint]: 'danger',
      [SupportTicketType.Support]: 'info',
      [SupportTicketType.Suggestion]: 'accent',
      [SupportTicketType.Request]: 'warning',
      [SupportTicketType.Other]: 'default',
    };
    return map[t] ?? 'default';
  }

  getRoleLabel(role?: string | null): string {
    const r = (role ?? '').toUpperCase();
    if (r === 'USER') return 'Kullanıcı';
    if (r === 'ECONOMIST') return 'Ekonomist';
    return '—';
  }

  getRoleTone(role?: string | null): string {
    const r = (role ?? '').toUpperCase();
    if (r === 'ECONOMIST') return 'accent';
    if (r === 'USER') return 'info';
    return 'default';
  }

  getReplacementEconomists(target: EconomistChangeTarget): AvailableEconomist[] {
    return this.availableEconomists();
  }

  isCurrentEconomist(economist: AvailableEconomist, target: EconomistChangeTarget): boolean {
    return this.normalizeId(economist.id) === this.normalizeId(target.economistId);
  }

  isClientAssignedEconomist(economist: AvailableEconomist): boolean {
    const economistId = this.normalizeId(economist.id);
    return this.clientAssignments().some((assignment) => this.normalizeId(assignment.economistId) === economistId);
  }

  getEconomistAssignmentLabel(economist: AvailableEconomist, target: EconomistChangeTarget): string {
    const name = this.getAvailableEconomistName(economist);
    if (this.isCurrentEconomist(economist, target)) return `${name} (bu talepteki mevcut)`;
    if (this.isClientAssignedEconomist(economist)) return `${name} (kullanıcıda mevcut)`;
    return name;
  }

  getAvailableEconomistName(economist: AvailableEconomist): string {
    const fullName = `${economist.firstName ?? ''} ${economist.lastName ?? ''}`.trim();
    return fullName || economist.userName || economist.email || economist.id;
  }

  /** Listedeki ticket kartları için — messages yüklü olmadığından null döner. */
  getEconomistChangeTarget(_ticket: SupportTicket): EconomistChangeTarget | null {
    return null;
  }

  /** Detail panelinde açık ticket'ın ilk mesajından ekonomist hedef bilgisini okur. */
  readonly economistChangeTargetFromMessages = computed<EconomistChangeTarget | null>(() => {
    const first = this.messages()[0];
    if (!first || first.senderRole !== 'User') return null;
    return this.parseEconomistChangeTarget(first.body);
  });

  getTicketDisplayMessage(_ticket: SupportTicket): string {
    return '';
  }

  private readonly CHANGE_REQ_PREFIX = 'Ekonomist Değişiklik Talebi - ';

  getEconomistNameFromSubject(ticket: SupportTicket): string | null {
    if (ticket.subject.startsWith(this.CHANGE_REQ_PREFIX)) {
      return ticket.subject.slice(this.CHANGE_REQ_PREFIX.length).trim() || null;
    }
    return null;
  }

  formatDate(iso: string | null | undefined): string {
    if (!iso) return '';
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  }

  isStatusDisabledInDraft(s: SupportTicketStatus): boolean {
    const sel = this.selected();
    if (!sel) return true;
    if (s === sel.status) return false;
    return s !== this.nextAllowedStatus();
  }

  isStatusDone(s: SupportTicketStatus): boolean {
    const sel = this.selected();
    if (!sel) return false;
    const currentIdx = STATUS_ORDER.indexOf(sel.status);
    const checkIdx = STATUS_ORDER.indexOf(s);
    return checkIdx < currentIdx;
  }

  trackById(_: number, t: SupportTicket): number {
    return t.id;
  }

  private parseEconomistChangeTarget(message: string): EconomistChangeTarget | null {
    const lines = message.split(/\r?\n/);
    const name = this.readPrefixedLine(lines, 'Ekonomist:');
    const economistId = this.readPrefixedLine(lines, 'Ekonomist ID:');
    const assignmentId = this.readPrefixedLine(lines, 'Atama ID:');
    const reasonIndex = lines.findIndex(line => line.trim() === 'Gerekçe:');

    if (!name || !economistId || !assignmentId || reasonIndex < 0) return null;

    return {
      name,
      economistId,
      assignmentId,
      reason: lines.slice(reasonIndex + 1).join('\n').trim(),
    };
  }

  private loadAvailableEconomists(): void {
    this.userManagementRepo
      .getUsers({ role: UserRole.ECONOMIST })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (users) => {
          this.availableEconomists.set(users.map((user) => ({
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            userName: user.userName,
            email: user.email,
            totalRatings: 0,
          })));
        },
        error: () => {
          this.economistRepo
            .getAvailableEconomists()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (list) => this.availableEconomists.set(list),
              error: () => this.availableEconomists.set([]),
            });
        },
      });
  }

  private loadClientAssignments(clientId: string): void {
    if (!clientId) {
      this.clientAssignments.set([]);
      return;
    }

    this.economistRepo
      .adminGetClientEconomists(clientId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (assignments) => this.clientAssignments.set(assignments.filter((item) => item.isActive)),
        error: () => this.clientAssignments.set([]),
      });
  }

  private normalizeId(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
  }

  private executePendingAssignmentAction(_ticket: SupportTicket): Observable<unknown> {
    const target = this.economistChangeTargetFromMessages();
    if (!target || this.assignmentAction() === 'none') {
      return of(null);
    }

    if (this.assignmentAction() === 'remove') {
      return this.economistRepo.adminRemoveAssignment(Number(target.assignmentId));
    }

    const newEconomistId = this.selectedNewEconomistId();
    if (!newEconomistId) {
      return of(null);
    }

    return this.economistRepo.adminChangeAssignment(Number(target.assignmentId), newEconomistId);
  }

  private canUpdateDraftStatus(): boolean {
    const sel = this.selected();
    const status = this.draftStatus();
    return !!sel && !!status && status !== sel.status && status === this.nextAllowedStatus();
  }

  private hasValidPendingAssignmentAction(): boolean {
    const target = this.economistChangeTargetFromMessages();
    if (!target) return false;
    if (this.assignmentAction() === 'remove') return true;
    return this.assignmentAction() === 'change' && !!this.selectedNewEconomistId();
  }

  private readPrefixedLine(lines: string[], prefix: string): string | null {
    const line = lines.find(item => item.startsWith(prefix));
    return line ? line.slice(prefix.length).trim() : null;
  }
}
