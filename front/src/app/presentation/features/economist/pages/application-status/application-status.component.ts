import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { EconomistApplicationRepository } from '../../../../../core/interfaces/economist-application.repository';
import { EconomistApplication } from '../../../../../core/models/economist-application.model';
import { EconomistStatus } from '../../../../../core/enums/economist-status.enum';
import { ExpertiseArea, EXPERTISE_AREA_LABELS } from '../../../../../core/enums/expertise-area.enum';
import { KpiCardComponent } from '../../../../shared/components/kpi-card/kpi-card.component';

@Component({
  selector: 'app-application-status',
  standalone: true,
  imports: [CommonModule, KpiCardComponent],
  templateUrl: './application-status.component.html',
  styleUrl: './application-status.component.scss',
})
export class ApplicationStatusComponent implements OnInit {
  private readonly repo = inject(EconomistApplicationRepository);
  private readonly router = inject(Router);

  protected readonly EconomistStatus = EconomistStatus;

  protected readonly application = signal<EconomistApplication | null>(null);
  protected readonly isLoading = signal(true);

  ngOnInit(): void {
    this.repo.getMyLatest().subscribe({
      next: (app) => {
        this.application.set(app);
        this.isLoading.set(false);
        // If approved, redirect to full dashboard
        if (app?.status === EconomistStatus.APPROVED) {
          void this.router.navigate(['/app/economist/customers']);
        }
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  protected reapply(): void {
    void this.router.navigate(['/app/economist/application']);
  }

  /** Resolves an ExpertiseArea value (string or numeric index) to its Turkish label. */
  protected getExpertiseLabel(area: ExpertiseArea): string {
    if (EXPERTISE_AREA_LABELS[area]) {
      return EXPERTISE_AREA_LABELS[area];
    }
    const enumValues = Object.values(ExpertiseArea);
    const idx = Number(area);
    if (!isNaN(idx) && idx >= 0 && idx < enumValues.length) {
      return EXPERTISE_AREA_LABELS[enumValues[idx]] ?? String(area);
    }
    return String(area);
  }
}
