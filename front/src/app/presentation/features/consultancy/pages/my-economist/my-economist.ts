import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EconomistRepository } from '../../../../../core/interfaces/economist.repository';
import { EconomistClient } from '../../../../../core/models/economist.model';
import { AvailableEconomist } from '../../../../../core/models/available-economist.model';

type ActiveTab = 'overview' | 'tasks';

@Component({
  selector: 'app-my-economist',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-economist.html',
  styleUrl: './my-economist.scss',
})
export class MyEconomist implements OnInit {
  private readonly economistRepo = inject(EconomistRepository);

  // ── State ────────────────────────────────────────────────────────────────────
  readonly isLoading       = signal(true);
  readonly isAssigning     = signal(false);
  readonly myAssignment    = signal<EconomistClient | null>(null);
  readonly available       = signal<AvailableEconomist[]>([]);
  readonly activeTab       = signal<ActiveTab>('overview');
  readonly errorMessage    = signal<string | null>(null);

  // ── Computed ─────────────────────────────────────────────────────────────────
  readonly hasEconomist = computed(() => this.myAssignment() !== null);

  readonly avatarInitials = computed(() => {
    const name = this.myAssignment()?.economistName ?? '';
    return name
      .split(' ')
      .slice(0, 2)
      .map(w => w[0] ?? '')
      .join('')
      .toUpperCase();
  });

  readonly assignedSinceLabel = computed(() => {
    const date = this.myAssignment()?.assignedAtUtc;
    if (!date) return '';
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit', month: 'long', year: 'numeric',
    }).format(new Date(date));
  });

  readonly tabs: { id: ActiveTab; label: string }[] = [
    { id: 'overview', label: 'Genel Bakış' },
    { id: 'tasks',    label: 'Talepler' },
  ];

  // ── Lifecycle ────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadMyEconomist();
  }

  // ── Data Loading ─────────────────────────────────────────────────────────────
  private loadMyEconomist(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.economistRepo.getMyEconomists().subscribe({
      next: (assignments) => {
        const active = assignments.find(a => a.isActive) ?? null;
        this.myAssignment.set(active);

        if (!active) {
          this.loadAvailableEconomists();
        } else {
          this.isLoading.set(false);
        }
      },
      error: () => {
        this.errorMessage.set('Ekonomist bilgileri yüklenemedi.');
        this.isLoading.set(false);
      },
    });
  }

  private loadAvailableEconomists(): void {
    this.economistRepo.getAvailableEconomists().subscribe({
      next: (list) => {
        this.available.set(list);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Ekonomist listesi yüklenemedi.');
        this.isLoading.set(false);
      },
    });
  }

  // ── Actions ──────────────────────────────────────────────────────────────────
  assignEconomist(economistId: string): void {
    this.isAssigning.set(true);
    this.errorMessage.set(null);

    this.economistRepo.assignEconomist(economistId).subscribe({
      next: () => {
        this.isAssigning.set(false);
        this.loadMyEconomist();
      },
      error: (err: Error) => {
        this.isAssigning.set(false);
        this.errorMessage.set(err.message ?? 'Ekonomist ataması başarısız oldu.');
      },
    });
  }

  removeEconomist(): void {
    const assignment = this.myAssignment();
    if (!assignment) return;
    if (!confirm('Ekonomistinizle bağlantınızı kesmek istediğinize emin misiniz?')) return;

    this.economistRepo.removeEconomist(assignment.id).subscribe({
      next: () => {
        this.myAssignment.set(null);
        this.loadAvailableEconomists();
      },
      error: (err: Error) => {
        this.errorMessage.set(err.message ?? 'İşlem başarısız.');
      },
    });
  }

  setTab(tab: ActiveTab): void {
    this.activeTab.set(tab);
  }

  getInitials(economist: AvailableEconomist): string {
    return `${economist.firstName[0] ?? ''}${economist.lastName[0] ?? ''}`.toUpperCase();
  }
}
