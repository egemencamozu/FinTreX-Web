import {
  Component, ElementRef, OnDestroy, AfterViewInit,
  input, effect, viewChild,
} from '@angular/core';
import * as echarts from 'echarts/core';
import { BarChart as EBarChart, LineChart as ELineChart } from 'echarts/charts';
import {
  GridComponent, TooltipComponent, LegendComponent, DataZoomComponent,
} from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import { buildBarChartOption } from './bar-chart.option-builder';
import {
  BarChartInput,
  BarChartOptions,
  BarSize,
  BarOrientation,
  BarTooltipFormatter,
  TooltipAxisPointerType,
  TooltipAxisPointerLineStyle,
} from './bar-chart.types';

export type {
  BarChartInput,
  BarChartOptions,
  BarSize,
  BarOrientation,
  BarTooltipFormatter,
  EChartsAxisParam,
  BarValueAxis,
  BarSeriesItem,
  AxisLabelMode,
  BarSeriesType,
  TooltipAxisPointerType,
  TooltipAxisPointerLineStyle,
} from './bar-chart.types';

echarts.use([
  EBarChart,
  ELineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  SVGRenderer,
]);

const DEFAULT_HEIGHT_PX = 280;
const DEFAULT_GRID_SECTIONS = 4;
const DEFAULT_ZOOM_ENABLED = false;
const DEFAULT_SHOW_AXIS_POINTER = false;
const DEFAULT_AXIS_POINTER_TYPE: TooltipAxisPointerType = 'shadow';
const DEFAULT_AXIS_POINTER_LINE_STYLE: TooltipAxisPointerLineStyle = 'solid';
const DEFAULT_SHOW_TOOLTIP = true;
const DEFAULT_SHOW_LEGEND = true;
const DEFAULT_BAR_SIZE: BarSize = 'lg';
const DEFAULT_BAR_GAP = '60%';

@Component({
  selector: 'app-bar-chart',
  standalone: true,
  imports: [],
  templateUrl: './bar-chart.component.html',
  styleUrl:    './bar-chart.component.scss',
})
export class BarChartComponent implements AfterViewInit, OnDestroy {
  readonly data        = input.required<BarChartInput>();
  readonly height      = input(DEFAULT_HEIGHT_PX);

  /** Highlight bars on hover. */
  readonly highlight    = input(true);
  /** Show dotted grid lines on the value axis. */
  readonly gridLines    = input(true);
  /** Number of value-axis grid sections. 4 => 5 lines. */
  readonly gridSections = input(DEFAULT_GRID_SECTIONS);
  /** Enable mouse-wheel / drag zoom on the category axis. */
  readonly zoomEnabled  = input(DEFAULT_ZOOM_ENABLED);
  /** Show/hide tooltip axis pointer line/shadow/cross guide. */
  readonly showAxisPointer = input(DEFAULT_SHOW_AXIS_POINTER);
  /** Axis pointer guide type. */
  readonly axisPointerType = input<TooltipAxisPointerType>(DEFAULT_AXIS_POINTER_TYPE);
  /** Axis pointer line style for line/cross: solid | dashed | dotted. */
  readonly axisPointerLineStyle = input<TooltipAxisPointerLineStyle>(DEFAULT_AXIS_POINTER_LINE_STYLE);
  /** Show tooltip. */
  readonly showTooltip  = input(DEFAULT_SHOW_TOOLTIP);
  /** Show legend when there are multiple series. */
  readonly showLegend   = input(DEFAULT_SHOW_LEGEND);
  /** Bar width: sm=14px md=24px lg=36px xl=52px. */
  readonly barSize      = input<BarSize>(DEFAULT_BAR_SIZE);
  /** Gap ratio between bars. */
  readonly barGap       = input(DEFAULT_BAR_GAP);
  /** Vertical or horizontal bars. */
  readonly orientation  = input<BarOrientation>('vertical');
  /** Dim inactive series on hover. */
  readonly blurInactive = input(false);
  /** Custom tooltip formatter; falls back to ECharts default if omitted. */
  readonly tooltipFormatter = input<BarTooltipFormatter | undefined>(undefined);

  readonly chartEl = viewChild.required<ElementRef<HTMLDivElement>>('chart');

  private chart:          echarts.ECharts | null = null;
  private resizeObserver: ResizeObserver  | null = null;

  constructor() {
    effect(() => {
      if (this.chart) {
        this.updateChart(this.data(), this.resolveOptions());
      }
    });
  }

  ngAfterViewInit(): void {
    const el = this.chartEl().nativeElement;
    this.chart = echarts.init(el, null, { renderer: 'svg' });

    this.updateChart(this.data(), this.resolveOptions());

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

  private resolveOptions(): BarChartOptions {
    return {
      highlight: this.highlight(),
      gridLines: this.gridLines(),
      gridSections: this.gridSections(),
      zoomEnabled: this.zoomEnabled(),
      showAxisPointer: this.showAxisPointer(),
      axisPointerType: this.axisPointerType(),
      axisPointerLineStyle: this.axisPointerLineStyle(),
      showTooltip: this.showTooltip(),
      showLegend: this.showLegend(),
      barSize: this.barSize(),
      barGap: this.barGap(),
      orientation: this.orientation(),
      blurInactive: this.blurInactive(),
      tooltipFormatter: this.tooltipFormatter(),
    };
  }

  private updateChart(d: BarChartInput, opts: BarChartOptions): void {
    const textColor = this.cssVar('--text-secondary', '#808A9D');
    const gridColor = this.cssVar('--chart-label', '#94a3b8');
    const option = buildBarChartOption(d, opts, textColor, gridColor);
    this.chart?.setOption(option, true);
  }
}
