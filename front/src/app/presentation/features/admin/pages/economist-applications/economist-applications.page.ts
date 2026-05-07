import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { EconomistApplicationRepository } from '../../../../../core/interfaces/economist-application.repository';
import {
  EconomistApplication,
  PagedEconomistApplicationsResult,
} from '../../../../../core/models/economist-application.model';
import { EconomistStatus } from '../../../../../core/enums/economist-status.enum';
import { EXPERTISE_AREA_LABELS } from '../../../../../core/enums/expertise-area.enum';

@Component({
  selector: 'app-economist-applications-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './economist-applications.page.html',
  styleUrl: './economist-applications.page.scss',
})
export class EconomistApplicationsPage implements OnInit {
  private readonly repo = inject(EconomistApplicationRepository);
  private readonly router = inject(Router);

  protected readonly EconomistStatus = EconomistStatus;
  protected readonly EXPERTISE_AREA_LABELS = EXPERTISE_AREA_LABELS;
  protected readonly statusOptions: Array<{ label: string; value: EconomistStatus | undefined }> = [
    { label: 'Tümü', value: undefined },
    { label: 'Beklemede', value: EconomistStatus.PENDING },
    { label: 'Onaylandı', value: EconomistStatus.APPROVED },
    { label: 'Reddedildi', value: EconomistStatus.REJECTED },
  ];

  protected readonly result = signal<PagedEconomistApplicationsResult | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly apiError = signal<string | null>(null);
  protected readonly activeFilter = signal<EconomistStatus | undefined>(EconomistStatus.PENDING);
  protected readonly currentPage = signal(1);

  ngOnInit(): void {
    this.load();
  }

  protected setFilter(status: EconomistStatus | undefined): void {
    this.activeFilter.set(status);
    this.currentPage.set(1);
    this.load();
  }

  protected setPage(page: number): void {
    this.currentPage.set(page);
    this.load();
  }

  protected viewDetail(app: EconomistApplication): void {
    void this.router.navigate(['/app/admin/economist-applications', app.id]);
  }

  protected statusLabel(status: EconomistStatus): string {
    const map: Record<EconomistStatus, string> = {
      [EconomistStatus.NONE]: 'Bilinmiyor',
      [EconomistStatus.PENDING]: 'Beklemede',
      [EconomistStatus.APPROVED]: 'Onaylandı',
      [EconomistStatus.REJECTED]: 'Reddedildi',
    };
    return map[status] ?? status;
  }

  private load(): void {
    this.isLoading.set(true);
    this.apiError.set(null);
    this.repo.adminList(this.activeFilter(), this.currentPage(), 20).subscribe({
      next: (r) => {
        this.result.set(r);
        this.isLoading.set(false);
      },
      error: (err: { status?: number; error?: { message?: string } }) => {
        this.isLoading.set(false);
        this.apiError.set(
          err?.error?.message ?? `Başvurular yüklenemedi (HTTP ${err?.status ?? 'bilinmiyor'}).`
        );
      },
    });
  }

  protected get totalPages(): number {
    const r = this.result();
    if (!r) return 1;
    return Math.ceil(r.totalCount / r.pageSize);
  }

  protected pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }
}
