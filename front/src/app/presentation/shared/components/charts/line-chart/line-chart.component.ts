import {
  Component, ElementRef, OnDestroy, AfterViewInit,
  input, effect, viewChild,
} from '@angular/core';
import * as echarts from 'echarts/core';
import { LineChart as ELineChart } from 'echarts/charts';
import {
  GridComponent, TooltipComponent, LegendComponent, DataZoomComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([ELineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer, DataZoomComponent]);

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
  private draggingInitialized = false;
  private isDraggingX = false;
  private isDraggingY = false;
  private startX = 0;
  private startY = 0;
  private startRangeX = [0, 100];
  private startRangeY = [0, 100];

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
    this.initAxisDragging();

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

    const tooltipBg = this.cssVar('--bg-surface', '#ffffff');
    const tooltipText = this.cssVar('--text-primary', '#1e293b');

    this.chart?.setOption({
      tooltip: {
        trigger: 'axis',
        confine: true,
        backgroundColor: tooltipBg,
        borderColor: gridColor,
        borderWidth: 1,
        textStyle: { color: tooltipText },
        axisPointer: {
          type: 'cross',
          label: {
            backgroundColor: textColor
          }
        },
        padding: [10, 15],
        extraCssText: 'box-shadow: var(--shadow-lg); border-radius: 8px;'
      },
      grid: {
        left: 12, right: 24, top: 20, bottom: 12,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: d.labels,
        axisLabel: {
          color: textColor,
          fontSize: 11,
          interval: 'auto', // Otomatik aralık belirle
          hideOverlap: true, // Üst üste binenleri gizle
        },
        axisLine: { lineStyle: { color: gridColor } },
        axisTick: { show: false },
        boundaryGap: false,
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: textColor,
          fontSize: 11,
          formatter: (value: number) => {
            if (value >= 1000000000) return (value / 1000000000).toFixed(1) + 'B';
            if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
            if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
            return value.toLocaleString();
          }
        },
        splitLine: { lineStyle: { color: gridColor, type: 'dashed' } },
        scale: true,
        min: 'dataMin', // Verinin başladığı en küçük değerden başla (0'daki boşlukları azaltır)
      },
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: 0,
          zoomOnMouseWheel: false,
          moveOnMouseMove: true,
          moveOnMouseWheel: false,
        },
        {
          type: 'inside',
          yAxisIndex: 0,
          zoomOnMouseWheel: false,
          moveOnMouseMove: true,
          moveOnMouseWheel: false,
        }
      ],
      series: d.series.map(s => ({
        name: s.name ?? '',
        type: 'line' as const,
        data: s.data,
        smooth: 0.4,
        showSymbol: false,
        connectNulls: true, // Boş verileri birbirine bağla
        lineStyle: { color: s.color, width: 2.5 },
        areaStyle: s.areaColor ? {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: s.areaColor },
              { offset: 1, color: 'transparent' }
            ]
          },
          opacity: 0.3
        } : undefined,
        itemStyle: { color: s.color },
      })),
    }, true);
  }

  private initAxisDragging(): void {
    if (!this.chart || this.draggingInitialized) return;
    this.draggingInitialized = true;

    const zr = this.chart.getZr();

    zr.on('mousedown', (params: any) => {
      const x = params.offsetX;
      const y = params.offsetY;

      // @ts-ignore
      const grid = this.chart.getModel().getComponent('grid').coordinateSystem;
      const rect = grid.getRect();

      const option = this.chart!.getOption();
      const dataZoom = option['dataZoom'] as any[];
      if (!dataZoom) return;

      const dzX = dataZoom.find(z => z.xAxisIndex !== undefined);
      const dzY = dataZoom.find(z => z.yAxisIndex !== undefined);

      if (x < rect.x) {
        this.isDraggingY = true;
        this.startY = y;
        this.startRangeY = [dzY.start, dzY.end];
      } else if (y > rect.y + rect.height) {
        this.isDraggingX = true;
        this.startX = x;
        this.startRangeX = [dzX.start, dzX.end];
      }
    });

    zr.on('mousemove', (params: any) => {
      const x = params.offsetX;
      const y = params.offsetY;

      // @ts-ignore
      const grid = this.chart.getModel().getComponent('grid').coordinateSystem;
      const rect = grid.getRect();

      if (x < rect.x) {
        zr.setCursorStyle('ns-resize');
      } else if (y > rect.y + rect.height) {
        zr.setCursorStyle('ew-resize');
      } else {
        zr.setCursorStyle('default');
      }

      if (this.isDraggingX) {
        const delta = x - this.startX;
        const sensitivity = 0.5;
        const newEnd = Math.max(this.startRangeX[0] + 1, Math.min(100, this.startRangeX[1] - delta * sensitivity));
        this.chart?.dispatchAction({
          type: 'dataZoom',
          batch: [{
            dataZoomIndex: 0,
            start: this.startRangeX[0],
            end: newEnd
          }]
        });
      } else if (this.isDraggingY) {
        const delta = y - this.startY;
        const sensitivity = 0.5;
        const newEnd = Math.max(this.startRangeY[0] + 1, Math.min(100, this.startRangeY[1] + delta * sensitivity));
        this.chart?.dispatchAction({
          type: 'dataZoom',
          batch: [{
            dataZoomIndex: 1,
            start: this.startRangeY[0],
            end: newEnd
          }]
        });
      }
    });

    zr.on('mouseup', () => {
      this.isDraggingX = false;
      this.isDraggingY = false;
    });
  }
}
