import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { EnvironmentConfigService } from '../../../../../core/services/environment-config.service';

interface McpDemoRequest {
  cash_try: number;
  stock_try: number;
  crypto_try: number;
  gold_try: number;
  symbol: string;
}

interface McpProcessStep {
  name: string;
  status: string;
  detail: string;
}

interface McpTool {
  name: string;
  description: string;
  input_schema?: unknown;
}

interface McpDemoResponse {
  status: string;
  generated_at_utc: string;
  input_context: McpDemoRequest;
  handshake: {
    protocol_version: string | null;
    server_name: string;
    server_version: string | null;
  };
  process: McpProcessStep[];
  discovered_tools: McpTool[];
  resource: {
    uri: string;
    mime_type?: string | null;
    content: string | null;
  };
  tool_results: {
    portfolio_risk: {
      total_try: number;
      allocation_percent: Record<string, number>;
      risk_score: number;
      risk_level: string;
      largest_asset: string | null;
      concentration_warning: string;
    };
    market_context: {
      symbol: string;
      trend: string;
      daily_change_percent: number;
      volatility: string;
      source: string;
    };
  };
}

@Component({
  selector: 'app-mcp-demo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mcp-demo.page.html',
  styleUrl: './mcp-demo.page.scss',
})
export class McpDemoPage {
  private readonly http = inject(HttpClient);
  private readonly envConfig = inject(EnvironmentConfigService);
  private readonly destroyRef = inject(DestroyRef);

  protected cashTry = 65000;
  protected stockTry = 215000;
  protected cryptoTry = 45000;
  protected goldTry = 85000;
  protected symbol = 'BIST100';

  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly demo = signal<McpDemoResponse | null>(null);

  protected readonly allocationEntries = computed(() => {
    const allocation = this.demo()?.tool_results.portfolio_risk.allocation_percent;
    return allocation ? Object.entries(allocation) : [];
  });

  protected readonly apiUrl = computed(() => `${this.envConfig.get('aiServiceUrl')}/mcp/run`);

  ngOnInit(): void {
    this.runDemo();
  }

  protected runDemo(): void {
    const payload: McpDemoRequest = {
      cash_try: this.toPositiveNumber(this.cashTry),
      stock_try: this.toPositiveNumber(this.stockTry),
      crypto_try: this.toPositiveNumber(this.cryptoTry),
      gold_try: this.toPositiveNumber(this.goldTry),
      symbol: this.symbol.trim() || 'BIST100',
    };

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.http
      .post<McpDemoResponse>(this.apiUrl(), payload)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        next: (response) => this.demo.set(response),
        error: (err: unknown) => {
          const message = err instanceof Error ? err.message : 'MCP calistirilamadi.';
          this.errorMessage.set(message);
        },
      });
  }

  protected formatTry(value: number): string {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      maximumFractionDigits: 0,
    }).format(value);
  }

  protected formatPercent(value: number): string {
    return new Intl.NumberFormat('tr-TR', {
      maximumFractionDigits: 2,
    }).format(value);
  }

  private toPositiveNumber(value: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }
    return parsed;
  }
}
