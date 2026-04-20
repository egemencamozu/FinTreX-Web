export type BarSize = 'sm' | 'md' | 'lg' | 'xl';
export type BarOrientation = 'vertical' | 'horizontal';
export type BarSeriesType = 'bar' | 'line';
export type AxisLabelMode = 'extremes' | 'all' | 'none';
export type TooltipAxisPointerType = 'line' | 'shadow' | 'cross';
export type TooltipAxisPointerLineStyle = 'solid' | 'dashed' | 'dotted';

export interface EChartsAxisParam {
  axisValue: string;
  seriesName: string;
  value: number;
  color: string;
}

export type BarTooltipFormatter = (params: EChartsAxisParam[]) => string;

export interface BarValueAxis {
  min?: number;
  max?: number;
  position?: 'left' | 'right' | 'top' | 'bottom';
  labelMode?: AxisLabelMode;
  showGridLines?: boolean;
  gridSections?: number;
  formatter?: (value: number) => string;
}

export interface BarSeriesItem {
  name?: string;
  data: number[];
  color?: string;
  stack?: string;
  type?: BarSeriesType;
  valueAxisIndex?: number;
  smooth?: boolean | number;
  showSymbol?: boolean;
  lineWidth?: number;
  areaColor?: string;
}

export interface BarChartInput {
  labels: string[];
  series: BarSeriesItem[];
  valueAxes?: BarValueAxis[];
}

export interface BarChartOptions {
  highlight: boolean;
  gridLines: boolean;
  gridSections: number;
  zoomEnabled: boolean;
  showAxisPointer: boolean;
  axisPointerType: TooltipAxisPointerType;
  axisPointerLineStyle: TooltipAxisPointerLineStyle;
  showTooltip: boolean;
  showLegend: boolean;
  barSize: BarSize;
  barGap: string;
  orientation: BarOrientation;
  blurInactive: boolean;
  tooltipFormatter: BarTooltipFormatter | undefined;
}
