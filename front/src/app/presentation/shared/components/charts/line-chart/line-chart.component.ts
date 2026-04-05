import {
  Component, ElementRef, OnDestroy, AfterViewInit,
  input, effect, viewChild,
} from '@angular/core';
import * as echarts from 'echarts/core';
import { LineChart as ELineChart } from 'echarts/charts';
import {
  GridComponent, TooltipComponent, LegendComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([ELineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

export interface LineSeriesItem {
  name?: string;
  data: number[];
  color?: string;
  areaColor?: string;
}

export interface LineChartInput {
  labels: string[];
  series: LineSeriesItem[];
}

@Component({
  selector: 'app-line-chart',
  standalone: true,
  templateUrl: './line-chart.component.html',
  styleUrl: './line-chart.component.scss',
})
export class LineChartComponent implements AfterViewInit, OnDestroy {
  readonly data = input.required<LineChartInput>();
  readonly height = input(280);

  readonly chartEl = viewChild.required<ElementRef<HTMLDivElement>>('chart');

  private chart: echarts.ECharts | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    effect(() => {
      const d = this.data();
      if (this.chart) this.updateChart(d);
    });
  }

  ngAfterViewInit(): void {
    const el = this.chartEl().nativeElement;
    this.chart = echarts.init(el);
    this.updateChart(this.data());

    this.resizeObserver = new ResizeObserver(() => this.chart?.resize());
    this.resizeObserver.observe(el);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.chart?.dispose();
  }

  private cssVar(name: string, fallback: string): string {
    if (typeof window === 'undefined') return fallback;
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  }

  private updateChart(d: LineChartInput): void {
    const textColor = this.cssVar('--text-secondary', '#475569');
    const gridColor = this.cssVar('--border-subtle', '#e2e8f0');

    this.chart?.setOption({
      tooltip: {
        trigger: 'axis',
      },
      grid: {
        left: 8, right: 8, top: 8, bottom: 0,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: d.labels,
        axisLabel: { color: textColor },
        axisLine: { lineStyle: { color: gridColor } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: textColor },
        splitLine: { lineStyle: { color: gridColor } },
      },
      series: d.series.map(s => ({
        name: s.name ?? '',
        type: 'line' as const,
        data: s.data,
        smooth: 0.4,
        showSymbol: false,
        lineStyle: { color: s.color },
        areaStyle: s.areaColor ? { color: s.areaColor } : undefined,
        itemStyle: { color: s.color },
      })),
    }, true);
  }
}
