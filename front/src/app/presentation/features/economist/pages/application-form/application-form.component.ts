import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
  AbstractControl,
} from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { EconomistApplicationRepository } from '../../../../../core/interfaces/economist-application.repository';
import {
  ExpertiseArea,
  EXPERTISE_AREA_LABELS,
} from '../../../../../core/enums/expertise-area.enum';

@Component({
  selector: 'app-application-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './application-form.component.html',
  styleUrl: './application-form.component.scss',
})
export class ApplicationFormComponent implements OnInit {
  private readonly repo = inject(EconomistApplicationRepository);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  protected readonly ExpertiseArea = ExpertiseArea;
  protected readonly EXPERTISE_AREA_LABELS = EXPERTISE_AREA_LABELS;
  protected readonly expertiseOptions = Object.values(ExpertiseArea);
  protected readonly certificateOptions = [
    'Sermaye Piyasası Faaliyetleri Düzey 1 Lisansı',
    'Sermaye Piyasası Faaliyetleri Düzey 2 Lisansı',
    'Sermaye Piyasası Faaliyetleri Düzey 3 Lisansı',
    'Türev Araçlar Lisansı',
    'Kredi Derecelendirme Lisansı',
    'Kurumsal Yönetim Derecelendirme Lisansı',
    'Gayrimenkul Değerleme Lisansı',
    'Konut Değerleme Lisansı',
    'Bilgi Sistemleri Bağımsız Denetim Lisansı',
    'CFA (Chartered Financial Analyst)',
    'CMT (Chartered Market Technician)',
    'FRM (Financial Risk Manager)',
    'CAIA (Chartered Alternative Investment Analyst)',
    'CFP (Certified Financial Planner)',
    'CQF (Certificate in Quantitative Finance)',
    'CMA (Certified Management Accountant)',
    'SMMM / YMM (Serbest Muhasebeci Mali Müşavir / Yeminli Mali Müşavir)'
  ];
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly form: FormGroup = this.fb.group({
    fullName: ['', [Validators.required, Validators.maxLength(200)]],
    phone: ['', [Validators.maxLength(30)]],
    currentTitle: ['', [Validators.maxLength(200)]],
    institution: ['', [Validators.maxLength(200)]],
    biography: ['', [Validators.required, Validators.maxLength(2000)]],
    yearsOfExperience: [0, [Validators.required, Validators.min(0), Validators.max(60)]],
    education: ['', [Validators.maxLength(500)]],
    expertiseAreas: this.fb.array(
      this.expertiseOptions.map(() => this.fb.control(false))
    ),
    licensesAndCertificates: this.fb.array(
      this.certificateOptions.map(() => this.fb.control(false))
    ),
    links: this.fb.array([]),
  });

  ngOnInit(): void {
    this.addLink();
  }

  protected get linksArray(): FormArray {
    return this.form.get('links') as FormArray;
  }

  protected get expertiseArray(): FormArray {
    return this.form.get('expertiseAreas') as FormArray;
  }

  protected get certificatesArray(): FormArray {
    return this.form.get('licensesAndCertificates') as FormArray;
  }

  protected addLink(): void {
    this.linksArray.push(
      this.fb.group({
        platform: ['', [Validators.required]],
        url: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]],
      })
    );
  }

  protected removeLink(index: number): void {
    this.linksArray.removeAt(index);
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.errorMessage.set('Lütfen tüm zorunlu alanları (Ad Soyad, Biyografi, Deneyim, vb.) doğru formatta doldurun.');
      this.form.markAllAsTouched();
      return;
    }

    const selectedAreas = this.expertiseOptions.filter(
      (_, i) => this.expertiseArray.at(i).value
    );

    if (selectedAreas.length === 0) {
      this.errorMessage.set('En az bir uzmanlık alanı seçmelisiniz.');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const rawLinks = (this.linksArray.value as { platform: string; url: string }[])
      .filter(l => l.platform && l.url);

    this.repo
      .submit({
        fullName: this.form.value['fullName'],
        phone: this.form.value['phone'] ?? '',
        currentTitle: this.form.value['currentTitle'] ?? '',
        institution: this.form.value['institution'] ?? '',
        biography: this.form.value['biography'],
        yearsOfExperience: this.form.value['yearsOfExperience'],
        education: this.form.value['education'] ?? '',
        expertiseAreas: selectedAreas,
        licensesAndCertificates: this.certificateOptions.filter((_, i) => this.certificatesArray.at(i).value),
        links: rawLinks,
      })
      .pipe(
        switchMap(() => {
          return of([]);
        })
      )
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.successMessage.set('Başvurunuz başarıyla gönderildi! Yönlendiriliyorsunuz...');
          setTimeout(() => {
            void this.router.navigate(['/app/economist/application-status']);
          }, 2000);
        },
        error: (err: { error?: { message?: string } }) => {
          this.isSubmitting.set(false);
          this.errorMessage.set(err?.error?.message ?? 'Başvuru gönderilemedi. Lütfen tekrar deneyin.');
        },
      });
  }

  protected isInvalid(control: AbstractControl | null): boolean {
    return !!control && control.invalid && control.touched;
  }
}
