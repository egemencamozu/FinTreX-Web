import {
  BarSize,
  BarChartInput,
  BarChartOptions,
  BarValueAxis,
} from './bar-chart.types';

const BAR_SIZE_PX: Record<BarSize, number> = {
  sm: 14,
  md: 24,
  lg: 36,
  xl: 52,
};

const AXIS_LABEL_FONT_SIZE_PX = 12;
const AXIS_LABEL_MARGIN_PX = 16;
const TOOLTIP_PADDING_PX: [number, number] = [10, 14];
const LEGEND_ITEM_SIZE_PX = 8;
const LEGEND_GRID_TOP_PX = 28;
const GRID_DEFAULT_TOP_PX = 8;
const BLUR_INACTIVE_OPACITY = 0.35;
const DEFAULT_LINE_WIDTH_PX = 2.5;
const DEFAULT_LINE_SMOOTH = 0.35;
const ZOOM_START_PERCENT = 0;
const ZOOM_END_PERCENT = 100;

function formatAxisValue(value: number, axis: BarValueAxis): string {
  if (axis.formatter) return axis.formatter(value);
  return value.toLocaleString();
}

function defaultAxisPosition(index: number, isHorizontal: boolean): 'left' | 'right' | 'top' | 'bottom' {
  if (isHorizontal) return index % 2 === 0 ? 'bottom' : 'top';
  return index % 2 === 0 ? 'right' : 'left';
}

function buildValueAxis(
  values: number[],
  axis: BarValueAxis | undefined,
  axisIndex: number,
  isHorizontal: boolean,
  opts: BarChartOptions,
  textColor: string,
  gridColor: string,
) {
  const axisConfig = axis ?? {};
  const hasValues = values.length > 0;
  const hasNegativeValues = values.some(v => v < 0);
  const absMax = hasValues ? Math.max(...values.map(v => Math.abs(v))) : 0;
  const scaleMax = absMax || 1;
  const requestedSections = Number.isFinite(axisConfig.gridSections)
    ? Math.max(1, Math.floor(axisConfig.gridSections!))
    : Math.max(1, Math.floor(opts.gridSections));

  const autoMin = hasNegativeValues ? -scaleMax : 0;
  const autoMax = scaleMax;
  const axisMin = axisConfig.min ?? autoMin;
  const axisMax = axisConfig.max ?? autoMax;
  const valueRange = axisMax - axisMin || 1;
  const gridSections = hasNegativeValues && axisConfig.min == null && axisConfig.max == null
    ? Math.max(2, Math.ceil(requestedSections / 2) * 2)
    : requestedSections;
  const interval = valueRange / gridSections;
  const crossesZero = axisMin < 0 && axisMax > 0;
  const labelMode = axisConfig.labelMode ?? (axisIndex === 0 ? 'extremes' : 'none');
  const showGrid = axisConfig.showGridLines ?? (axisIndex === 0 ? opts.gridLines : false);

  return {
    type: 'value' as const,
    position: axisConfig.position ?? defaultAxisPosition(axisIndex, isHorizontal),
    min: axisMin,
    max: axisMax,
    interval,
    axisLabel: {
      color: textColor,
      fontSize: AXIS_LABEL_FONT_SIZE_PX,
      formatter: (val: number) => {
        if (labelMode === 'none') return '';
        if (labelMode === 'all') return formatAxisValue(val, axisConfig);

        const epsilon = Math.max(Math.abs(interval) / 1000, Number.EPSILON);

        if (Math.abs(val - axisMin) < epsilon) return formatAxisValue(axisMin, axisConfig);
        if (crossesZero && Math.abs(val) < epsilon) return formatAxisValue(0, axisConfig);
        if (Math.abs(val - axisMax) < epsilon) return formatAxisValue(axisMax, axisConfig);

        return '';
      },
    },
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: {
      show: showGrid,
      lineStyle: { color: gridColor, type: [1, 3] as [number, number], width: 1 },
    },
  };
}

function buildSeries(
  d: BarChartInput,
  opts: BarChartOptions,
  isHorizontal: boolean,
  barMaxWidth: number,
) {
  return d.series.map(s => {
    const type = s.type ?? 'bar';
    const valueAxisIndex = s.valueAxisIndex ?? 0;
    const axisBinding = isHorizontal
      ? { xAxisIndex: valueAxisIndex }
      : { yAxisIndex: valueAxisIndex };

    if (type === 'line') {
      const lineSymbol = s.showSymbol ? 'circle' : 'none';

      return {
        name: s.name ?? '',
        type: 'line' as const,
        data: s.data,
        ...axisBinding,
        symbol: lineSymbol,
        showSymbol: s.showSymbol ?? false,
        showAllSymbol: false,
        smooth: s.smooth ?? DEFAULT_LINE_SMOOTH,
        connectNulls: true,
        z: 3,
        lineStyle: { color: s.color, width: s.lineWidth ?? DEFAULT_LINE_WIDTH_PX },
        areaStyle: s.areaColor ? { color: s.areaColor } : undefined,
        itemStyle: { color: s.color },
        emphasis: opts.highlight
          ? { focus: 'series' as const }
          : { disabled: true },
        blur: opts.blurInactive
          ? {
              lineStyle: { opacity: BLUR_INACTIVE_OPACITY },
              itemStyle: { opacity: BLUR_INACTIVE_OPACITY },
              areaStyle: s.areaColor ? { opacity: BLUR_INACTIVE_OPACITY } : undefined,
            }
          : undefined,
      };
    }

    return {
      name: s.name ?? '',
      type: 'bar' as const,
      stack: s.stack,
      data: s.data,
      ...axisBinding,
      barMaxWidth,
      barCategoryGap: opts.barGap,
      z: 2,
      itemStyle: { color: s.color, borderRadius: 0, borderWidth: 0 },
      emphasis: opts.highlight
        ? { focus: opts.blurInactive ? 'series' as const : 'none' as const, itemStyle: { opacity: 1 } }
        : { disabled: true },
      blur: opts.blurInactive
        ? { itemStyle: { opacity: BLUR_INACTIVE_OPACITY } }
        : { itemStyle: { opacity: 1 } },
    };
  });
}

function buildAxisPointer(opts: BarChartOptions, gridColor: string) {
  return opts.showAxisPointer
    ? {
        type: opts.axisPointerType,
        ...(opts.axisPointerType !== 'shadow'
          ? {
              lineStyle: { color: gridColor, width: 1, opacity: 0.95, type: opts.axisPointerLineStyle },
              crossStyle: { color: gridColor, width: 1, opacity: 0.95, type: opts.axisPointerLineStyle },
            }
          : {}),
        ...(opts.axisPointerType === 'cross'
          ? { label: { show: false } }
          : {}),
      }
    : { show: false };
}

function buildDataZoom(isHorizontal: boolean, opts: BarChartOptions) {
  return opts.zoomEnabled
    ? [{
        type: 'inside' as const,
        filterMode: 'filter' as const,
        start: ZOOM_START_PERCENT,
        end: ZOOM_END_PERCENT,
        zoomOnMouseWheel: true,
        moveOnMouseWheel: false,
        moveOnMouseMove: true,
        preventDefaultMouseMove: true,
        ...(isHorizontal ? { yAxisIndex: 0 } : { xAxisIndex: 0 }),
      }]
    : [];
}

export function buildBarChartOption(
  d: BarChartInput,
  opts: BarChartOptions,
  textColor: string,
  gridColor: string,
) {
  const barMaxWidth = BAR_SIZE_PX[opts.barSize];
  const multiSeries = d.series.length > 1;
  const isHorizontal = opts.orientation === 'horizontal';
  const showLegend = opts.showLegend && multiSeries;
  const axisCount = Math.max(
    d.valueAxes?.length ?? 0,
    ...d.series.map(series => (series.valueAxisIndex ?? 0) + 1),
    1,
  );

  const categoryAxis = {
    type: 'category' as const,
    data: d.labels,
    axisLabel: { color: textColor, fontSize: AXIS_LABEL_FONT_SIZE_PX, margin: AXIS_LABEL_MARGIN_PX },
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { show: false },
    boundaryGap: true,
  };

  const valueAxes = Array.from({ length: axisCount }, (_, axisIndex) => {
    const axisValues = d.series
      .filter(series => (series.valueAxisIndex ?? 0) === axisIndex)
      .flatMap(series => series.data);

    return buildValueAxis(
      axisValues,
      d.valueAxes?.[axisIndex],
      axisIndex,
      isHorizontal,
      opts,
      textColor,
      gridColor,
    );
  });

  return {
    backgroundColor: 'transparent',
    tooltip: opts.showTooltip
      ? {
          trigger: 'axis',
          axisPointer: buildAxisPointer(opts, gridColor),
          borderColor: 'transparent',
          padding: TOOLTIP_PADDING_PX,
          extraCssText: 'box-shadow: 0 4px 16px rgba(0,0,0,.12); border-radius: 8px;',
          ...(opts.tooltipFormatter ? { formatter: opts.tooltipFormatter } : {}),
        }
      : { show: false },
    legend: {
      show: showLegend,
      top: 0,
      left: 0,
      textStyle: { color: textColor, fontSize: AXIS_LABEL_FONT_SIZE_PX },
      icon: 'circle',
      itemWidth: LEGEND_ITEM_SIZE_PX,
      itemHeight: LEGEND_ITEM_SIZE_PX,
    },
    grid: {
      left: 12,
      right: 12,
      top: showLegend ? LEGEND_GRID_TOP_PX : GRID_DEFAULT_TOP_PX,
      bottom: 0,
      containLabel: true,
    },
    dataZoom: buildDataZoom(isHorizontal, opts),
    xAxis: isHorizontal
      ? (valueAxes.length === 1 ? valueAxes[0] : valueAxes)
      : categoryAxis,
    yAxis: isHorizontal
      ? categoryAxis
      : (valueAxes.length === 1 ? valueAxes[0] : valueAxes),
    series: buildSeries(d, opts, isHorizontal, barMaxWidth),
  };
}
