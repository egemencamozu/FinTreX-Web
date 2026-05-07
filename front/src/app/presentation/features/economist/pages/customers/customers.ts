import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EconomistRepository } from '../../../../../core/interfaces/economist.repository';
import { AlertsSignalRService } from '../../../../../core/services/alerts-signalr.service';
import { EconomistClient } from '../../../../../core/models/economist.model';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './customers.html',
  styleUrl: './customers.scss',
})
export class Customers implements OnInit {
  private readonly alertsSignalR = inject(AlertsSignalRService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly economistRepository = inject(EconomistRepository);
  private readonly router = inject(Router);

  readonly customers = signal<EconomistClient[]>([]);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly searchTerm = signal('');

  readonly filteredCustomers = computed(() => {
    const search = this.searchTerm().trim().toLowerCase();
    if (!search) return this.customers();

    return this.customers().filter(customer =>
      customer.clientName?.toLowerCase().includes(search) ||
      customer.clientId?.toLowerCase().includes(search),
    );
  });

  readonly activeCustomerCount = computed(() =>
    this.customers().filter(customer => customer.isActive).length,
  );

  ngOnInit(): void {
    this.loadCustomers();
    this.bindRealtimeCustomerUpdates();
  }

  loadCustomers(showLoading = true): void {
    if (showLoading) {
      this.isLoading.set(true);
    }
    this.errorMessage.set(null);

    this.economistRepository
      .getMyClients()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: customers => {
          this.customers.set(customers);
          this.isLoading.set(false);
        },
        error: err => {
          console.error('Failed to load customers:', err);
          this.errorMessage.set('Müşteriler yüklenemedi. Lütfen daha sonra tekrar deneyin.');
          this.isLoading.set(false);
        },
      });
  }

  selectCustomer(customer: EconomistClient): void {
    void this.router.navigate(['/app/portfolio/client', customer.clientId]);
  }

  onSearchInput(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  getInitials(name: string | undefined): string {
    if (!name) return '?';
    return name
      .split(' ')
      .filter(Boolean)
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(value));
  }

  private bindRealtimeCustomerUpdates(): void {
    void this.alertsSignalR.connect();

    this.alertsSignalR.economistClientAssigned$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadCustomers(false));

    this.alertsSignalR.economistClientChanged$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadCustomers(false));
  }
}
