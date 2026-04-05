import {
  Component, ElementRef, OnDestroy, AfterViewInit,
  input, effect, viewChild,
} from '@angular/core';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([LineChart, GridComponent, CanvasRenderer]);

@Component({
  selector: 'app-sparkline-chart',
  standalone: true,
  templateUrl: './sparkline-chart.component.html',
  styleUrl: './sparkline-chart.component.scss',
})
export class SparklineChartComponent implements AfterViewInit, OnDestroy {
  readonly values = input.required<number[]>();
  readonly color = input('#2563eb');
  readonly height = input(40);

  readonly chartEl = viewChild.required<ElementRef<HTMLDivElement>>('chart');

  private chart: echarts.ECharts | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    effect(() => {
      const v = this.values();
      if (this.chart) this.updateChart(v);
    });
  }

  ngAfterViewInit(): void {
    const el = this.chartEl().nativeElement;
    this.chart = echarts.init(el);
    this.updateChart(this.values());

    this.resizeObserver = new ResizeObserver(() => this.chart?.resize());
    this.resizeObserver.observe(el);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.chart?.dispose();
  }

  private updateChart(values: number[]): void {
    this.chart?.setOption({
      animation: false,
      grid: { left: 0, right: 0, top: 0, bottom: 0 },
      xAxis: { type: 'category', show: false, data: values.map((_, i) => i) },
      yAxis: { type: 'value', show: false },
      series: [{
        type: 'line',
        data: values,
        smooth: 0.35,
        showSymbol: false,
        lineStyle: { width: 2, color: this.color() },
        itemStyle: { color: this.color() },
      }],
    }, true);
  }
}
