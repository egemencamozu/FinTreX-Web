import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EconomistRepository } from '../../../../../core/interfaces/economist.repository';
import { EconomistClient } from '../../../../../core/models/economist.model';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './customers.html',
  styleUrl: './customers.scss'
})
export class Customers implements OnInit {
  customers = signal<EconomistClient[]>([]);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  searchTerm = signal('');

  filteredCustomers = computed(() => {
    const search = this.searchTerm().toLowerCase();
    return this.customers().filter(c =>
      (c.clientName?.toLowerCase().includes(search)) ||
      (c.clientId?.toLowerCase().includes(search))
    );
  });

  constructor(private economistRepository: EconomistRepository) {}

  ngOnInit() {
    this.loadCustomers();
  }

  loadCustomers() {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.economistRepository.getMyClients().subscribe({
      next: (data) => {
        this.customers.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load customers:', err);
        this.errorMessage.set('Müşteriler yüklenemedi. Lütfen daha sonra tekrar deneyin.');
        this.isLoading.set(false);
      }
    });
  }

  getInitials(name: string | undefined): string {
    if (!name) return '?';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
}
