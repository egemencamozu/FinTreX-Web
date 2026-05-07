import { Component, DestroyRef, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EconomistRepository } from '../../../../../core/interfaces/economist.repository';
import { AlertsSignalRService } from '../../../../../core/services/alerts-signalr.service';
import { AvailableEconomist } from '../../../../../core/models/available-economist.model';
import { EconomistRating } from '../../../../../core/models/economist-rating.model';
import { KpiCardComponent } from '../../../../shared/components/kpi-card/kpi-card.component';

@Component({
  selector: 'app-economists',
  standalone: true,
  imports: [CommonModule, KpiCardComponent],
  templateUrl: './economists.html',
  styleUrl: './economists.scss',
})
export class Economists implements OnInit {
  private readonly economistRepo = inject(EconomistRepository);
  private readonly alertsSignalR = inject(AlertsSignalRService);
  private readonly destroyRef = inject(DestroyRef);

  readonly economists = signal<AvailableEconomist[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly sortBy = signal<'name' | 'rating' | 'totalRatings'>('rating');

  readonly selectedEconomist = signal<AvailableEconomist | null>(null);
  readonly ratings = signal<EconomistRating[]>([]);
  readonly isLoadingRatings = signal(false);

  readonly sorted = computed(() => {
    const list = [...this.economists()];
    const by = this.sortBy();
    if (by === 'rating') return list.sort((a, b) => (b.averageRating ?? -1) - (a.averageRating ?? -1));
    if (by === 'totalRatings') return list.sort((a, b) => b.totalRatings - a.totalRatings);
    return list.sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
  });

  readonly totalEconomists = computed(() => this.economists().length);
  readonly ratedCount = computed(() => this.economists().filter(e => e.totalRatings > 0).length);
  readonly overallAverage = computed(() => {
    const rated = this.economists().filter(e => e.averageRating != null);
    if (!rated.length) return null;
    const avg = rated.reduce((sum, e) => sum + e.averageRating!, 0) / rated.length;
    return Math.round(avg * 10) / 10;
  });
  readonly topEconomist = computed(() =>
    this.economists().filter(e => e.totalRatings > 0)
      .sort((a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0))[0] ?? null
  );

  ngOnInit(): void {
    this.loadEconomists();
    this.bindRealtime();
  }

  private loadEconomists(): void {
    this.economistRepo.getAvailableEconomists().subscribe({
      next: (list) => { this.economists.set(list); this.isLoading.set(false); },
      error: () => { this.errorMessage.set('Ekonomist listesi yüklenemedi.'); this.isLoading.set(false); },
    });
  }

  private bindRealtime(): void {
    void this.alertsSignalR.connect();

    this.alertsSignalR.taskRated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ev) => {
        this.economists.update(list =>
          list.map(e => {
            if (e.id !== ev.economistId) return e;
            const newTotal = e.totalRatings + 1;
            const newAvg = Math.round(((e.averageRating ?? 0) * e.totalRatings + ev.rating) / newTotal * 10) / 10;
            return { ...e, averageRating: newAvg, totalRatings: newTotal };
          })
        );

        const sel = this.selectedEconomist();
        if (sel?.id === ev.economistId) {
          this.selectedEconomist.update(current => {
            if (!current) return current;
            const newTotal = current.totalRatings + 1;
            const newAvg = Math.round(((current.averageRating ?? 0) * current.totalRatings + ev.rating) / newTotal * 10) / 10;
            return { ...current, averageRating: newAvg, totalRatings: newTotal };
          });

          this.ratings.update(rs => {
            if (rs.some(r => r.taskId === ev.taskId)) return rs;
            return [{
              taskId: ev.taskId,
              taskTitle: ev.taskTitle,
              userName: ev.userName,
              rating: ev.rating,
              feedback: ev.feedback ?? undefined,
              ratedAtUtc: ev.ratedAtUtc,
            }, ...rs];
          });
        }
      });
  }

  openDetail(e: AvailableEconomist): void {
    this.selectedEconomist.set(e);
    this.ratings.set([]);
    this.isLoadingRatings.set(true);
    this.economistRepo.adminGetEconomistRatings(e.id).subscribe({
      next: (rs) => { this.ratings.set(rs); this.isLoadingRatings.set(false); },
      error: () => { this.isLoadingRatings.set(false); },
    });
  }

  closeDetail(): void {
    this.selectedEconomist.set(null);
    this.ratings.set([]);
  }

  getInitials(e: AvailableEconomist): string {
    return `${e.firstName?.[0] ?? ''}${e.lastName?.[0] ?? ''}`.toUpperCase();
  }

  getDisplayName(e: AvailableEconomist): string {
    return `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim() || e.userName;
  }

  getStars(rating: number | null | undefined): { filled: boolean }[] {
    return [1, 2, 3, 4, 5].map(i => ({ filled: rating != null && i <= Math.round(rating) }));
  }

  formatDate(d: string): string {
    return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(d));
  }
}
