import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EconomistApplicationRepository } from '../../../../../core/interfaces/economist-application.repository';
import { EconomistApplication } from '../../../../../core/models/economist-application.model';
import { EconomistStatus } from '../../../../../core/enums/economist-status.enum';
import { ExpertiseArea, EXPERTISE_AREA_LABELS } from '../../../../../core/enums/expertise-area.enum';
import { KpiCardComponent } from '../../../../shared/components/kpi-card/kpi-card.component';

@Component({
  selector: 'app-economist-application-detail-page',
  standalone: true,
  imports: [CommonModule, FormsModule, KpiCardComponent],
  templateUrl: './economist-application-detail.page.html',
  styleUrl: './economist-application-detail.page.scss',
})
export class EconomistApplicationDetailPage implements OnInit {
  private readonly repo = inject(EconomistApplicationRepository);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly EconomistStatus = EconomistStatus;

  protected readonly application = signal<EconomistApplication | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly showRejectModal = signal(false);
  protected rejectionNote = '';

  private applicationId = 0;

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.applicationId = id;
    this.repo.adminGetDetail(id).subscribe({
      next: (app) => {
        this.application.set(app);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  protected approve(): void {
    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.repo.adminReview(this.applicationId, { decision: 'Approve', note: '' }).subscribe({
      next: (updated) => {
        this.application.set(updated);
        this.isSubmitting.set(false);
        this.successMessage.set('Başvuru onaylandı.');
      },
      error: (err: { error?: { message?: string } }) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Onaylama işlemi başarısız.');
      },
    });
  }

  protected openRejectModal(): void {
    this.rejectionNote = '';
    this.showRejectModal.set(true);
  }

  protected cancelReject(): void {
    this.showRejectModal.set(false);
  }

  protected confirmReject(): void {
    if (!this.rejectionNote.trim()) return;
    this.showRejectModal.set(false);
    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.repo.adminReview(this.applicationId, { decision: 'Reject', note: this.rejectionNote }).subscribe({
      next: (updated) => {
        this.application.set(updated);
        this.isSubmitting.set(false);
        this.successMessage.set('Başvuru reddedildi.');
      },
      error: (err: { error?: { message?: string } }) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Red işlemi başarısız.');
      },
    });
  }

  /** Resolves an ExpertiseArea value (string or numeric index) to its Turkish label. */
  protected getExpertiseLabel(area: ExpertiseArea): string {
    // If it's already a valid key in the labels map, use it directly
    if (EXPERTISE_AREA_LABELS[area]) {
      return EXPERTISE_AREA_LABELS[area];
    }
    // If API returned a numeric index, map it to the enum key
    const enumValues = Object.values(ExpertiseArea);
    const idx = Number(area);
    if (!isNaN(idx) && idx >= 0 && idx < enumValues.length) {
      return EXPERTISE_AREA_LABELS[enumValues[idx]] ?? String(area);
    }
    return String(area);
  }

  protected goBack(): void {
    void this.router.navigate(['/app/admin/economist-applications']);
  }
}

