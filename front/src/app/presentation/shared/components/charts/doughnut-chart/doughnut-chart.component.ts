import {
  Component, ElementRef, OnDestroy, AfterViewInit,
  input, computed, effect, viewChild,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import * as echarts from 'echarts/core';
import { PieChart } from 'echarts/charts';
import { TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([PieChart, TooltipComponent, LegendComponent, CanvasRenderer]);

export interface DoughnutItem {
  label: string;
  value: number;
}

const CHART_COLOR_TOKENS = [
  '--chart-1', '--chart-2', '--chart-3', '--chart-4',
  '--chart-5', '--chart-6', '--chart-7', '--chart-8',
  '--chart-9', '--chart-10', '--chart-11', '--chart-12',
  '--chart-13', '--chart-14', '--chart-15',
];

function resolveToken(token: string): string {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
}

@Component({
  selector: 'app-doughnut-chart',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './doughnut-chart.component.html',
  styleUrl: './doughnut-chart.component.scss',
})
export class DoughnutChartComponent implements AfterViewInit, OnDestroy {
  readonly items = input.required<DoughnutItem[]>();
  readonly height = input(200);

  readonly chartEl = viewChild.required<ElementRef<HTMLDivElement>>('chart');

  private chart: echarts.ECharts | null = null;
  private resizeObserver: ResizeObserver | null = null;

  readonly legendItems = computed(() => {
    const list = this.items();
    const total = list.reduce((sum, i) => sum + i.value, 0);
    const colors = this.resolvePalette(list.length);
    return list.map((item, idx) => ({
      label: item.label,
      pct: total > 0 ? (item.value / total) * 100 : 0,
      color: colors[idx],
    }));
  });

  constructor() {
    effect(() => {
      const list = this.items();
      if (this.chart) this.updateChart(list);
    });
  }

  ngAfterViewInit(): void {
    const el = this.chartEl().nativeElement;
    this.chart = echarts.init(el);
    this.updateChart(this.items());

    this.resizeObserver = new ResizeObserver(() => this.chart?.resize());
    this.resizeObserver.observe(el);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.chart?.dispose();
  }

  private resolvePalette(count: number): string[] {
    return Array.from({ length: count }, (_, i) =>
      resolveToken(CHART_COLOR_TOKENS[i % CHART_COLOR_TOKENS.length]),
    );
  }

  private updateChart(list: DoughnutItem[]): void {
    const tooltipBg = resolveToken('--chart-tooltip-bg');
    const tooltipText = resolveToken('--chart-tooltip-text');

    this.chart?.setOption({
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {d}%',
        backgroundColor: tooltipBg,
        textStyle: { color: tooltipText, fontSize: 13 },
        borderWidth: 0,
        borderRadius: 8,
        padding: [8, 12],
      },
      legend: { show: false },
      color: this.resolvePalette(list.length),
      animationType: 'scale',
      animationEasing: 'cubicOut',
      animationDuration: 600,
      series: [{
        type: 'pie',
        radius: ['54%', '80%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: false,
        padAngle: 3,
        itemStyle: { borderRadius: 6 },
        label: { show: false },
        emphasis: {
          scaleSize: 6,
          label: { show: false },
          itemStyle: {
            shadowBlur: 16,
            shadowColor: 'rgba(0, 0, 0, 0.12)',
          },
        },
        data: list.map(i => ({ name: i.label, value: i.value })),
      }],
    }, true);
  }
}
