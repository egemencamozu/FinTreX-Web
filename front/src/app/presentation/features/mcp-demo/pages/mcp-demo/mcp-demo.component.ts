import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { environment } from '../../../../../../environments/environment';
import { PublicNavbar } from '../../../landing/components/public-navbar/public-navbar';

interface PortfolioInput {
  cashTry: number;
  stockTry: number;
  cryptoTry: number;
  goldTry: number;
}

interface McpProcessStep {
  stage: string;
  title: string;
  detail: string;
  result: unknown;
}

interface McpTool {
  name: string;
  title?: string | null;
  description?: string | null;
  input_schema?: unknown;
  output_schema?: unknown;
}

interface McpCall {
  tool: string;
  arguments: unknown;
  result: unknown;
}

interface McpDemoResponse {
  status: string;
  server: {
    name: string;
    protocol_version: string;
    capabilities: unknown;
  };
  transport: string;
  elapsed_ms: number;
  process: McpProcessStep[];
  tools: McpTool[];
  resources: Array<{
    uri: string;
    name?: string | null;
    description?: string | null;
    mime_type?: string | null;
  }>;
  resource_preview: unknown;
  calls: McpCall[];
  final_summary: string;
}

@Component({
  selector: 'app-mcp-demo',
  standalone: true,
  imports: [CommonModule, RouterLink, PublicNavbar],
  templateUrl: './mcp-demo.component.html',
  styleUrl: './mcp-demo.component.scss',
})
export class McpDemoComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly endpoint = `${environment.aiServiceUrl.replace(/\/+$/, '')}/mcp/demo`;

  protected readonly portfolio = signal<PortfolioInput>({
    cashTry: 65000,
    stockTry: 215000,
    cryptoTry: 45000,
    goldTry: 85000,
  });
  protected readonly result = signal<McpDemoResponse | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly totalTry = computed(() => {
    const current = this.portfolio();
    return current.cashTry + current.stockTry + current.cryptoTry + current.goldTry;
  });

  ngOnInit(): void {
    this.runDemo();
  }

  protected updatePortfolio(field: keyof PortfolioInput, event: Event): void {
    const target = event.target as HTMLInputElement | null;
    const value = Number(target?.value ?? 0);
    this.portfolio.update((current) => ({
      ...current,
      [field]: Number.isFinite(value) ? value : 0,
    }));
  }

  protected runDemo(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.http
      .post<McpDemoResponse>(this.endpoint, { portfolio: this.portfolio() })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        next: (response) => this.result.set(response),
        error: (error: unknown) => {
          const message = error instanceof Error ? error.message : 'MCP demo request failed.';
          this.errorMessage.set(message);
        },
      });
  }

  protected formatJson(value: unknown): string {
    return JSON.stringify(value, null, 2);
  }

  protected formatTry(value: number): string {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      maximumFractionDigits: 0,
    }).format(value);
  }
}

