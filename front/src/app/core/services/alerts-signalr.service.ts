import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import * as signalR from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { AuthService } from './auth.service';
import { EnvironmentConfigService } from './environment-config.service';
import { PriceAlertApiService } from './price-alert-api.service';
import { AlertService } from './alert.service';
import { AlertDirection, AlertKind } from '../models/price-alert.model';
import { UserRole } from '../enums/user-role.enum';

export interface AlertTriggerEvent {
  alertId: number;
  symbol: string;
  assetName?: string | null;
  triggeredPrice: number;
  targetValue: number;
  kind: AlertKind;
  direction: AlertDirection;
  triggeredAtUtc: string;
}

export interface TaskCreatedEvent {
  taskId: number;
  taskTitle: string;
  clientName: string;
}

export interface TaskStatusChangedEvent {
  taskId: number;
  taskTitle: string;
  status: string;
  updatedByName: string;
}

export interface TaskCompletedEvent {
  taskId: number;
  taskTitle: string;
  economistName: string;
}

export interface SupportTicketCreatedEvent {
  ticketId: number;
  action: 'Created' | 'Updated' | 'Deleted' | string;
  subject: string;
  type: string;
  userName: string;
}

export interface SupportTicketUpdatedEvent {
  ticketId: number;
  subject: string;
  status: string;
  hasAdminResponse: boolean;
  updatedByName: string;
}

export interface SupportTicketMessageAddedEvent {
  ticketId: number;
  messageId: number;
  senderRole: 'User' | 'Admin';
  senderName: string;
}

export interface EconomistClientAssignedEvent {
  assignmentId: number;
  clientId: string;
  clientName: string;
}

export interface EconomistClientChangedEvent {
  assignmentId: number;
  action: 'Reassigned' | 'Removed' | string;
  clientId: string;
  clientName?: string | null;
  economistId?: string | null;
  economistName?: string | null;
  previousEconomistId?: string | null;
  previousEconomistName?: string | null;
}

export interface TaskRatedEvent {
  taskId: number;
  taskTitle: string;
  economistId: string;
  rating: number;
  feedback?: string | null;
  userName: string;
  ratedAtUtc: string;
}

@Injectable({ providedIn: 'root' })
export class AlertsSignalRService {
  private readonly config = inject(EnvironmentConfigService);
  private readonly auth = inject(AuthService);
  private readonly alertApi = inject(PriceAlertApiService);
  private readonly toast = inject(AlertService);
  private readonly router = inject(Router);

  private hubConnection: signalR.HubConnection | null = null;
  private connectingPromise: Promise<void> | null = null;
  private readonly recentEvents = new Map<string, number>();

  readonly isConnected = signal(false);
  readonly triggered$ = new Subject<AlertTriggerEvent>();
  readonly taskCreated$ = new Subject<TaskCreatedEvent>();
  readonly taskStatusChanged$ = new Subject<TaskStatusChangedEvent>();
  readonly taskCompleted$ = new Subject<TaskCompletedEvent>();
  readonly supportTicketCreated$ = new Subject<SupportTicketCreatedEvent>();
  readonly supportTicketUpdated$ = new Subject<SupportTicketUpdatedEvent>();
  readonly supportTicketMessageAdded$ = new Subject<SupportTicketMessageAddedEvent>();
  readonly economistClientAssigned$ = new Subject<EconomistClientAssignedEvent>();
  readonly economistClientChanged$ = new Subject<EconomistClientChangedEvent>();
  readonly taskRated$ = new Subject<TaskRatedEvent>();

  async connect(): Promise<void> {
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) return;
    if (this.hubConnection?.state === signalR.HubConnectionState.Connecting || this.connectingPromise) {
      await this.connectingPromise;
      return;
    }

    const token = this.auth.getToken();
    if (!token) return;

    const apiBase = this.config.get('apiBaseUrl');
    const hubUrl = apiBase.replace(/\/api\/?$/, '') + '/hubs/alerts';

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, { accessTokenFactory: () => this.auth.getToken() ?? '' })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.hubConnection.on('AlertTriggered', (ev: AlertTriggerEvent) => {
      this.handleTrigger(ev);
    });

    this.hubConnection.on('TaskCreated', (ev: TaskCreatedEvent) => {
      this.handleTaskCreated(ev);
    });

    this.hubConnection.on('TaskStatusChanged', (ev: TaskStatusChangedEvent) => {
      this.handleTaskStatusChanged(ev);
    });

    this.hubConnection.on('TaskCompleted', (ev: TaskCompletedEvent) => {
      this.handleTaskCompleted(ev);
    });

    this.hubConnection.on('SupportTicketCreated', (ev: SupportTicketCreatedEvent) => {
      this.handleSupportTicketCreated(ev);
    });

    this.hubConnection.on('SupportTicketUpdated', (ev: SupportTicketUpdatedEvent) => {
      this.handleSupportTicketUpdated(ev);
    });

    this.hubConnection.on('SupportTicketMessageAdded', (ev: SupportTicketMessageAddedEvent) => {
      this.supportTicketMessageAdded$.next(ev);
    });

    this.hubConnection.on('EconomistClientAssigned', (ev: EconomistClientAssignedEvent) => {
      this.handleEconomistClientAssigned(ev);
    });

    this.hubConnection.on('EconomistClientChanged', (ev: EconomistClientChangedEvent) => {
      this.handleEconomistClientChanged(ev);
    });

    this.hubConnection.on('TaskRated', (ev: TaskRatedEvent) => {
      this.handleTaskRated(ev);
    });

    this.hubConnection.on('SessionRevoked', () => {
      void this.handleSessionRevoked();
    });

    this.hubConnection.onreconnecting(() => this.isConnected.set(false));
    this.hubConnection.onreconnected(() => this.isConnected.set(true));
    this.hubConnection.onclose(() => this.isConnected.set(false));

    this.connectingPromise = this.hubConnection.start()
      .then(() => this.isConnected.set(true))
      .catch((err) => {
        console.error('[AlertsSignalR] Connection failed:', err);
        this.isConnected.set(false);
      })
      .finally(() => {
        this.connectingPromise = null;
      });

    await this.connectingPromise;
  }

  async disconnect(): Promise<void> {
    if (!this.hubConnection) return;
    try {
      await this.hubConnection.stop();
    } finally {
      this.hubConnection = null;
      this.connectingPromise = null;
      this.isConnected.set(false);
    }
  }

  private handleTrigger(ev: AlertTriggerEvent): void {
    if (this.isDuplicateEvent(`alert:${ev.alertId}:${ev.triggeredAtUtc}`)) return;

    this.alertApi.applyTriggerEvent({
      alertId: ev.alertId,
      triggeredPrice: ev.triggeredPrice,
      triggeredAtUtc: ev.triggeredAtUtc,
    });

    const label = ev.assetName ? `${ev.symbol} - ${ev.assetName}` : ev.symbol;
    const arrow = ev.direction === 'ABOVE' ? 'UP' : 'DOWN';
    const priceText = this.formatPrice(ev.triggeredPrice);
    this.toast.info(`${arrow} ${label} alarmi tetiklendi (${priceText})`, 6000);

    this.triggered$.next(ev);
  }

  private handleTaskCreated(ev: TaskCreatedEvent): void {
    if (this.isDuplicateEvent(`task-created:${ev.taskId}`)) return;

    const title = ev.taskTitle?.trim() || 'Yeni danismanlik gorevi';
    const client = ev.clientName?.trim();
    const suffix = client ? ` (${client})` : '';
    this.toast.info(`Yeni gorev atandi: ${title}${suffix}`, 7000);
    this.taskCreated$.next(ev);
  }

  private handleTaskStatusChanged(ev: TaskStatusChangedEvent): void {
    if (this.isDuplicateEvent(`task-status:${ev.taskId}:${ev.status}`)) return;

    const title = ev.taskTitle?.trim() || 'Danismanlik gorevi';
    const status = this.formatTaskStatus(ev.status);
    const updater = ev.updatedByName?.trim();
    const suffix = updater ? ` (${updater})` : '';
    this.toast.info(`${title} durumu ${status} olarak guncellendi${suffix}.`, 7000);
    this.taskStatusChanged$.next(ev);
  }

  private handleTaskCompleted(ev: TaskCompletedEvent): void {
    if (this.isDuplicateEvent(`task-completed:${ev.taskId}`)) return;

    const title = ev.taskTitle?.trim() || 'Danismanlik talebiniz';
    const economist = ev.economistName?.trim();
    const suffix = economist ? ` (${economist})` : '';
    this.toast.success(`${title} tamamlandi${suffix}. Ekonomist raporu hazir.`, 7000);
    this.taskCompleted$.next(ev);
  }

  private handleSupportTicketCreated(ev: SupportTicketCreatedEvent): void {
    if (this.isDuplicateEvent(`support-created:${ev.ticketId}:${ev.action}`)) return;

    const subject = ev.subject?.trim() || 'Yeni destek talebi';
    const user = ev.userName?.trim();
    const suffix = user ? ` (${user})` : '';
    this.toast.info(`${this.formatTicketAction(ev.action)}: ${subject}${suffix}`, 7000);
    this.supportTicketCreated$.next(ev);
  }

  private handleSupportTicketUpdated(ev: SupportTicketUpdatedEvent): void {
    if (this.isDuplicateEvent(`support-updated:${ev.ticketId}:${ev.status}:${ev.hasAdminResponse}`)) return;

    const subject = ev.subject?.trim() || 'Destek talebiniz';
    if (ev.hasAdminResponse) {
      this.toast.success(`${subject} icin admin cevabi geldi.`, 7000);
    } else {
      this.toast.info(`${subject} durumu ${this.formatTicketStatus(ev.status)} olarak guncellendi.`, 7000);
    }
    this.supportTicketUpdated$.next(ev);
  }

  private handleEconomistClientAssigned(ev: EconomistClientAssignedEvent): void {
    if (this.isDuplicateEvent(`economist-client:${ev.assignmentId}`)) return;

    const client = ev.clientName?.trim() || 'Yeni musteri';
    this.toast.info(`${client} size musteri olarak atandi.`, 7000);
    this.economistClientAssigned$.next(ev);
  }

  private handleTaskRated(ev: TaskRatedEvent): void {
    if (this.isDuplicateEvent(`task-rated:${ev.taskId}`)) return;
    if (this.auth.hasRole(UserRole.ECONOMIST)) {
      this.toast.info(`${ev.taskTitle} icin ${ev.rating}/5 puan alindi.`, 6000);
    }
    this.taskRated$.next(ev);
  }

  private handleEconomistClientChanged(ev: EconomistClientChangedEvent): void {
    if (this.isDuplicateEvent(`economist-client-changed:${ev.assignmentId}:${ev.action}:${ev.economistId ?? ''}`)) return;

    if (ev.action === 'Removed') {
      this.toast.info('Ekonomist atamasi admin tarafindan kaldirildi.', 7000);
    } else {
      this.toast.info('Ekonomist atamasi admin tarafindan guncellendi.', 7000);
    }

    this.economistClientChanged$.next(ev);
  }

  private async handleSessionRevoked(): Promise<void> {
    this.auth.logout();
    await this.disconnect();
    void this.router.navigate(['/auth/login']);
  }

  private formatTicketStatus(status: string): string {
    switch (status) {
      case 'Open':
        return 'acik';
      case 'InReview':
        return 'inceleniyor';
      case 'Resolved':
        return 'cozuldu';
      case 'Closed':
        return 'kapali';
      default:
        return status || 'guncellendi';
    }
  }

  private isDuplicateEvent(key: string, windowMs = 2000): boolean {
    const now = Date.now();
    const previous = this.recentEvents.get(key);
    if (previous && now - previous < windowMs) {
      return true;
    }

    this.recentEvents.set(key, now);
    for (const [eventKey, timestamp] of this.recentEvents) {
      if (now - timestamp > windowMs) {
        this.recentEvents.delete(eventKey);
      }
    }
    return false;
  }

  private formatTicketAction(action: string): string {
    switch (action) {
      case 'Created':
        return 'Yeni talep eklendi';
      case 'Updated':
        return 'Talep guncellendi';
      case 'Deleted':
        return 'Talep silindi';
      default:
        return 'Talep degisti';
    }
  }

  private formatTaskStatus(status: string): string {
    switch (status) {
      case 'Pending':
        return 'beklemede';
      case 'InProgress':
        return 'isleniyor';
      case 'Completed':
        return 'tamamlandi';
      case 'Cancelled':
        return 'iptal edildi';
      default:
        return status || 'guncellendi';
    }
  }

  private formatPrice(value: number): string {
    try {
      return new Intl.NumberFormat('tr-TR', {
        maximumFractionDigits: 4,
      }).format(value);
    } catch {
      return String(value);
    }
  }
}
