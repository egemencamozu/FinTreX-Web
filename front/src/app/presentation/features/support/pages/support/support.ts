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
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { KpiCardComponent } from '../../../../shared/components/kpi-card/kpi-card.component';
import {
  SegmentedControlComponent,
  SegmentedOption,
} from '../../../../shared/components/segmented-control/segmented-control.component';
import { SupportTicketRepository } from '../../../../../core/interfaces/support-ticket.repository';
import { SupportTicket } from '../../../../../core/models/support-ticket.model';
import { SupportTicketMessage } from '../../../../../core/models/support-ticket-message.model';
import { SupportTicketType } from '../../../../../core/enums/support-ticket-type.enum';
import { SupportTicketStatus } from '../../../../../core/enums/support-ticket-status.enum';
import { AlertService } from '../../../../../core/services/alert.service';
import { AlertsSignalRService } from '../../../../../core/services/alerts-signalr.service';

interface SelectOption {
  value: string;
  label: string;
}

const SUPPORT_EMAIL = 'fintrexsupport@gmail.com';
const SUBJECT_MAX = 200;
const MESSAGE_MAX = 4000;

@Component({
  selector: 'app-support',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, KpiCardComponent, SegmentedControlComponent],
  templateUrl: './support.html',
  styleUrl: './support.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Support implements OnInit {
  private readonly supportRepo = inject(SupportTicketRepository);
  private readonly alertService = inject(AlertService);
  private readonly alertsSignalR = inject(AlertsSignalRService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly SUPPORT_EMAIL = SUPPORT_EMAIL;
  readonly SUBJECT_MAX = SUBJECT_MAX;
  readonly MESSAGE_MAX = MESSAGE_MAX;

  readonly tickets = signal<SupportTicket[]>([]);
  readonly isLoading = signal(true);
  readonly isSubmitting = signal(false);
  readonly showForm = signal(false);
  readonly selectedTicket = signal<SupportTicket | null>(null);
  readonly statusFilter = signal<'all' | SupportTicketStatus>('all');
  readonly emailCopied = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly isDeleting = signal(false);

  readonly messages = signal<SupportTicketMessage[]>([]);
  readonly messagesLoading = signal(false);
  readonly newMessage = signal('');
  readonly isSendingMessage = signal(false);

  readonly typeOptions: SelectOption[] = [
    { value: SupportTicketType.Complaint, label: 'Şikayet' },
    { value: SupportTicketType.Support, label: 'Destek' },
    { value: SupportTicketType.Suggestion, label: 'Öneri' },
    { value: SupportTicketType.Request, label: 'Talep' },
    { value: SupportTicketType.Other, label: 'Diğer' },
  ];

  readonly statusFilterOptions: SegmentedOption[] = [
    { id: 'all', label: 'Tümü' },
    { id: SupportTicketStatus.Open, label: 'Açık' },
    { id: SupportTicketStatus.InReview, label: 'İnceleniyor' },
    { id: SupportTicketStatus.Resolved, label: 'Çözüldü' },
    { id: SupportTicketStatus.Closed, label: 'Kapalı' },
  ];

  readonly ticketForm: FormGroup = this.fb.group({
    type: [SupportTicketType.Support, [Validators.required]],
    subject: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(SUBJECT_MAX)]],
    message: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(MESSAGE_MAX)]],
  });

  readonly filteredTickets = computed(() => {
    const filter = this.statusFilter();
    const all = this.tickets();
    if (filter === 'all') return all;
    return all.filter((t) => t.status === filter);
  });

  readonly openCount = computed(
    () =>
      this.tickets().filter(
        (t) => t.status === SupportTicketStatus.Open || t.status === SupportTicketStatus.InReview,
      ).length,
  );

  readonly resolvedCount = computed(
    () =>
      this.tickets().filter(
        (t) => t.status === SupportTicketStatus.Resolved || t.status === SupportTicketStatus.Closed,
      ).length,
  );

  readonly subjectLength = computed(() => (this.ticketForm.get('subject')?.value as string ?? '').length);
  readonly messageLength = computed(() => (this.ticketForm.get('message')?.value as string ?? '').length);

  ngOnInit(): void {
    this.loadTickets();
    this.bindRealtimeTicketUpdates();
  }

  private loadTickets(): void {
    this.isLoading.set(true);
    this.supportRepo
      .getMyTickets()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.tickets.set(this.sortTickets(list));
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('Ticketlar yüklenemedi. Daha sonra tekrar deneyin.');
          this.isLoading.set(false);
        },
      });
  }

  refresh(): void {
    this.selectedTicket.set(null);
    this.loadTickets();
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

    this.alertsSignalR.supportTicketUpdated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.refreshTicket(event.ticketId));

    this.alertsSignalR.supportTicketMessageAdded$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.refreshTicket(event.ticketId);

        const selected = this.selectedTicket();
        if (selected?.id === event.ticketId) {
          this.loadMessages(event.ticketId);
        }
      });
  }

  private refreshTicket(ticketId: number): void {
    this.supportRepo
      .getTicketById(ticketId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (ticket) => this.upsertTicket(ticket),
        error: () => this.loadTickets(),
      });
  }

  private upsertTicket(updated: SupportTicket): void {
    this.tickets.update((tickets) => {
      const exists = tickets.some((ticket) => ticket.id === updated.id);
      const next = exists
        ? tickets.map((ticket) => (ticket.id === updated.id ? updated : ticket))
        : [updated, ...tickets];

      return this.sortTickets(next);
    });

    if (this.selectedTicket()?.id === updated.id) {
      this.selectedTicket.set(updated);
    }
  }

  private removeTicket(ticketId: number): void {
    this.tickets.update((tickets) => tickets.filter((ticket) => ticket.id !== ticketId));
    if (this.selectedTicket()?.id === ticketId) {
      this.closeDetail();
    }
  }

  private sortTickets(tickets: SupportTicket[]): SupportTicket[] {
    return [...tickets].sort(
      (a, b) => new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime(),
    );
  }

  openForm(): void {
    if (this.showForm()) return;
    this.resetForm();
    this.selectedTicket.set(null);
    this.showForm.set(true);
  }

  toggleForm(): void {
    if (!this.showForm()) {
      this.resetForm();
      this.selectedTicket.set(null);
    }
    this.showForm.update((v) => !v);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.resetForm();
  }

  selectTicket(ticket: SupportTicket): void {
    this.selectedTicket.set(ticket);
    this.showForm.set(false);
    this.messages.set([]);
    this.newMessage.set('');
    this.loadMessages(ticket.id);
  }

  closeDetail(): void {
    this.selectedTicket.set(null);
    this.messages.set([]);
    this.newMessage.set('');
  }

  loadMessages(ticketId: number): void {
    this.messagesLoading.set(true);
    this.supportRepo
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
    const ticket = this.selectedTicket();
    if (!body || !ticket || this.isSendingMessage()) return;
    if (ticket.status === SupportTicketStatus.Closed) return;

    this.isSendingMessage.set(true);
    this.supportRepo
      .sendMessage(ticket.id, body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (msg) => {
          this.messages.update((list) => [...list, msg]);
          this.newMessage.set('');
          this.isSendingMessage.set(false);
        },
        error: () => {
          this.errorMessage.set('Mesaj gönderilemedi. Tekrar deneyin.');
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

  setStatusFilter(value: string): void {
    if (value === 'all' || Object.values(SupportTicketStatus).includes(value as SupportTicketStatus)) {
      this.statusFilter.set(value as 'all' | SupportTicketStatus);
    }
  }

  submit(): void {
    if (this.ticketForm.invalid) {
      this.ticketForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const { type, subject, message } = this.ticketForm.getRawValue();

    this.supportRepo
      .createTicket({ type, subject: subject.trim(), message: message.trim() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (created) => {
          this.upsertTicket(created);
          this.isSubmitting.set(false);
          this.closeForm();
          this.selectTicket(created);
        },
        error: () => {
          this.errorMessage.set('Ticket gönderilemedi. Lütfen tekrar deneyin.');
          this.isSubmitting.set(false);
        },
      });
  }

  async deleteTicket(ticket: SupportTicket): Promise<void> {
    if (this.isDeleting()) return;

    const confirmed = await this.alertService.confirm(
      `"${ticket.subject}" başlıklı talep kalıcı olarak silinecek. Bu işlem geri alınamaz.`,
      { title: 'Talebi Sil', confirmLabel: 'Sil', cancelLabel: 'Vazgeç' },
    );
    if (!confirmed) return;

    this.isDeleting.set(true);
    this.supportRepo
      .deleteTicket(ticket.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.removeTicket(ticket.id);
          this.isDeleting.set(false);
        },
        error: () => {
          this.errorMessage.set('Talep silinemedi. Daha sonra tekrar deneyin.');
          this.isDeleting.set(false);
        },
      });
  }

  copyEmail(): void {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard
      .writeText(SUPPORT_EMAIL)
      .then(() => {
        this.emailCopied.set(true);
        setTimeout(() => this.emailCopied.set(false), 2000);
      })
      .catch(() => {
        // kopyalama başarısız olursa sessiz geç; erişim yetkisi yoksa UX bozulmasın
      });
  }

  private resetForm(): void {
    this.ticketForm.reset({
      type: SupportTicketType.Support,
      subject: '',
      message: '',
    });
  }

  getTypeLabel(type: SupportTicketType | string): string {
    return this.typeOptions.find((o) => o.value === type)?.label ?? String(type);
  }

  getTypeColor(type: SupportTicketType | string): string {
    const map: Record<string, string> = {
      [SupportTicketType.Complaint]: 'danger',
      [SupportTicketType.Support]: 'info',
      [SupportTicketType.Suggestion]: 'accent',
      [SupportTicketType.Request]: 'warning',
      [SupportTicketType.Other]: 'default',
    };
    return map[type] ?? 'default';
  }

  getStatusLabel(status: SupportTicketStatus | string): string {
    const map: Record<string, string> = {
      [SupportTicketStatus.Open]: 'Açık',
      [SupportTicketStatus.InReview]: 'İnceleniyor',
      [SupportTicketStatus.Resolved]: 'Çözüldü',
      [SupportTicketStatus.Closed]: 'Kapalı',
    };
    return map[status] ?? String(status);
  }

  getStatusColor(status: SupportTicketStatus | string): string {
    const map: Record<string, string> = {
      [SupportTicketStatus.Open]: 'warning',
      [SupportTicketStatus.InReview]: 'info',
      [SupportTicketStatus.Resolved]: 'success',
      [SupportTicketStatus.Closed]: 'default',
    };
    return map[status] ?? 'default';
  }

  formatDateTime(iso: string | null | undefined): string {
    if (!iso) return '';
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.ticketForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  getFieldError(fieldName: string): string {
    const field = this.ticketForm.get(fieldName);
    if (!field || !field.errors || !field.touched) return '';

    if (field.errors['required']) {
      const labels: Record<string, string> = {
        type: 'Tip',
        subject: 'Konu',
        message: 'Mesaj',
      };
      return `${labels[fieldName] ?? fieldName} alanı zorunludur.`;
    }
    if (field.errors['minlength']) {
      return `En az ${field.errors['minlength'].requiredLength} karakter girilmelidir.`;
    }
    if (field.errors['maxlength']) {
      return `En fazla ${field.errors['maxlength'].requiredLength} karakter girilebilir.`;
    }
    return '';
  }
}
