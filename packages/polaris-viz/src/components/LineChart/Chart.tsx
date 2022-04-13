import React, {useState, useRef, useMemo, useCallback} from 'react';
import {line} from 'd3-shape';
import {
  LinearGradientWithStops,
  curveStepRounded,
  uniqueId,
  isGradientType,
  DataType,
} from '@shopify/polaris-viz-core';
import type {
  DataPoint,
  Dimensions,
  XAxisOptions,
  YAxisOptions,
} from '@shopify/polaris-viz-core';

import {useXAxisLabels} from '../../hooks/useXAxisLabels';
import {LinearXAxisLabels} from '../LinearXAxisLabels';
import {useLegend, LegendContainer} from '../LegendContainer';
import {
  TooltipHorizontalOffset,
  TooltipVerticalOffset,
  TooltipPosition,
  TooltipPositionParams,
  TooltipWrapper,
  TOOLTIP_POSITION_DEFAULT_RETURN,
} from '../../components/TooltipWrapper';
import {eventPointNative, clamp} from '../../utilities';
import {
  useTheme,
  useLinearChartAnimations,
  useColorVisionEvents,
  useWatchColorVisionEvents,
  useLinearLabelsAndDimensions,
} from '../../hooks';
import {
  LineChartMargin as Margin,
  XMLNS,
  COLOR_VISION_SINGLE_ITEM,
  LABEL_AREA_TOP_SPACING,
} from '../../constants';
import {VisuallyHiddenRows} from '../VisuallyHiddenRows';
import {YAxis} from '../YAxis';
import {Crosshair} from '../Crosshair';
import {HorizontalGridLines} from '../HorizontalGridLines';

import {Points, Line, GradientArea} from './components';
import {MAX_ANIMATED_SERIES_LENGTH} from './constants';
import type {
  RenderTooltipContentData,
  TooltipData,
  DataWithDefaults,
} from './types';
import {useYScale, useFormatData} from './hooks';
import styles from './Chart.scss';

export interface ChartProps {
  isAnimated: boolean;
  renderTooltipContent: (data: RenderTooltipContentData) => React.ReactNode;
  data: DataWithDefaults[];
  showLegend: boolean;
  xAxisOptions: Required<XAxisOptions>;
  yAxisOptions: Required<YAxisOptions>;
  emptyStateText?: string;
  theme?: string;
  dimensions?: Dimensions;
}

const TOOLTIP_POSITION = {
  horizontal: TooltipHorizontalOffset.Left,
  vertical: TooltipVerticalOffset.Center,
};

export function Chart({
  data,
  dimensions,
  renderTooltipContent,
  showLegend,
  emptyStateText,
  isAnimated,
  xAxisOptions,
  yAxisOptions,
  theme,
}: ChartProps) {
  useColorVisionEvents(data.length > 1);

  const selectedTheme = useTheme(theme);

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [activeLineIndex, setActiveLineIndex] = useState(-1);
  const [labelHeight, setLabelHeight] = useState(0);

  const {legend, setLegendHeight, height, width} = useLegend({
    data,
    dimensions,
    showLegend,
    type: 'line',
  });

  useWatchColorVisionEvents({
    type: COLOR_VISION_SINGLE_ITEM,
    onIndexChange: ({detail}) => setActiveLineIndex(detail.index),
  });

  const formattedLabels = useXAxisLabels({data: [data[0]], xAxisOptions});

  const tooltipId = useRef(uniqueId('lineChart'));
  const gradientId = useRef(uniqueId('lineChartGradient'));
  const [svgRef, setSvgRef] = useState<SVGSVGElement | null>(null);

  const emptyState =
    data.length === 0 || data.every((series) => series.data.length === 0);

  const drawableHeight =
    height - labelHeight - LABEL_AREA_TOP_SPACING - Margin.Top;

  const {yAxisLabelWidth, ticks, yScale} = useYScale({
    drawableHeight,
    data,
    formatYAxisLabel: yAxisOptions.labelFormatter,
    integersOnly: yAxisOptions.integersOnly,
  });

  const {reversedSeries, longestSeriesLength, longestSeriesIndex} =
    useFormatData(data);

  const {chartStartPosition, drawableWidth, xAxisDetails, xScale, labels} =
    useLinearLabelsAndDimensions({
      data,
      longestSeriesLength,
      theme,
      width,
      labels: formattedLabels,
      xAxisOptions,
      yAxisLabelWidth,
    });

  const getTooltipMarkup = useCallback(
    (index: number) => {
      const content = data.reduce<TooltipData[]>(
        (accumulator, {data, name, color, lineStyle}) => {
          const currentDataPoint = data[index];
          if (currentDataPoint != null) {
            accumulator.push({
              point: {
                label: `${currentDataPoint.key}`,
                value: currentDataPoint.value ?? 0,
              },
              name: name ?? '',
              color,
              lineStyle,
            });
          }
          return accumulator;
        },
        [],
      );

      if (data == null) {
        return null;
      }

      return renderTooltipContent({data: content});
    },
    [renderTooltipContent, data],
  );

  const lineGenerator = useMemo(() => {
    const generator = line<DataPoint>()
      .x((_, index) => (xScale == null ? 0 : xScale(index)))
      .y(({value}) => yScale(value ?? 0));

    if (selectedTheme.line.hasSpline) {
      generator.curve(curveStepRounded);
    }
    return generator;
  }, [selectedTheme.line.hasSpline, xScale, yScale]);

  const animatePoints =
    isAnimated && longestSeriesLength <= MAX_ANIMATED_SERIES_LENGTH;

  const {animatedCoordinates} = useLinearChartAnimations({
    data: reversedSeries,
    lineGenerator,
    activeIndex,
    isAnimated: animatePoints,
  });

  const getXPosition = ({isCrosshair} = {isCrosshair: false}) => {
    if (xScale == null) {
      return 0;
    }
    const offset = isCrosshair ? selectedTheme.crossHair.width / 2 : 0;

    if (
      animatedCoordinates != null &&
      animatedCoordinates[longestSeriesIndex] != null &&
      animatePoints
    ) {
      return animatedCoordinates[longestSeriesIndex].to(
        (coord) => coord.x - offset,
      );
    }
    return xScale(activeIndex == null ? 0 : activeIndex) - offset;
  };

  if (xScale == null || drawableWidth == null || yAxisLabelWidth == null) {
    return null;
  }

  function getTooltipPosition({
    event,
    index,
    eventType,
  }: TooltipPositionParams): TooltipPosition {
    if (eventType === 'mouse') {
      const point = eventPointNative(event!);

      if (
        point == null ||
        xScale == null ||
        reversedSeries[longestSeriesIndex] == null
      ) {
        return TOOLTIP_POSITION_DEFAULT_RETURN;
      }

      const {svgX, svgY} = point;

      const closestIndex = Math.round(xScale.invert(svgX - chartStartPosition));

      const activeIndex = clamp({
        amount: closestIndex,
        min: 0,
        max: reversedSeries[longestSeriesIndex].data.length - 1,
      });

      return {
        x: svgX,
        y: svgY,
        position: TOOLTIP_POSITION,
        activeIndex,
      };
    } else {
      const activeIndex = index ?? 0;

      return {
        x: xScale?.(activeIndex) ?? 0,
        y: 0,
        position: TOOLTIP_POSITION,
        activeIndex,
      };
    }
  }

  return (
    <div className={styles.Container} style={{width, height}}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={styles.Chart}
        role={emptyState ? 'img' : 'table'}
        xmlns={XMLNS}
        width={width}
        height={height}
        ref={setSvgRef}
        aria-label={emptyState ? emptyStateText : undefined}
      >
        {xAxisOptions.hide ? null : (
          <LinearXAxisLabels
            chartHeight={height}
            chartX={chartStartPosition - xAxisDetails.labelWidth / 2}
            chartY={
              drawableHeight + LABEL_AREA_TOP_SPACING + (Margin.Top as number)
            }
            labels={labels}
            labelWidth={xAxisDetails.labelWidth}
            onHeightChange={setLabelHeight}
            reducedLabelIndexes={xAxisDetails.reducedLabelIndexes}
            theme={theme}
            xScale={xScale}
          />
        )}

        {selectedTheme.grid.showHorizontalLines ? (
          <HorizontalGridLines
            ticks={ticks}
            theme={theme}
            transform={{
              x: selectedTheme.grid.horizontalOverflow ? 0 : chartStartPosition,
              y: Margin.Top,
            }}
            width={
              selectedTheme.grid.horizontalOverflow ? width : drawableWidth
            }
          />
        ) : null}

        <g transform={`translate(0,${Margin.Top})`}>
          <YAxis
            ticks={ticks}
            width={yAxisLabelWidth}
            textAlign="right"
            theme={theme}
          />
        </g>

        {emptyState ? null : (
          <g transform={`translate(${chartStartPosition},${Margin.Top})`}>
            <Crosshair
              x={getXPosition({isCrosshair: true})}
              height={drawableHeight}
              opacity={activeIndex == null ? 0 : 1}
              theme={theme}
            />
          </g>
        )}

        {emptyState ? null : (
          <VisuallyHiddenRows
            data={data}
            formatYAxisLabel={yAxisOptions.labelFormatter}
            xAxisLabels={labels}
          />
        )}

        <g transform={`translate(${chartStartPosition},${Margin.Top})`}>
          {reversedSeries.map((singleSeries, index) => {
            const {name, color, areaColor} = singleSeries;
            const seriesGradientId = `${gradientId.current}-${index}`;

            const lineColor = isGradientType(color)
              ? `url(#${seriesGradientId})`
              : color;

            return (
              <React.Fragment key={`${name}-${index}`}>
                {isGradientType(color) ? (
                  <defs>
                    <LinearGradientWithStops
                      id={seriesGradientId}
                      gradient={color}
                      gradientUnits="userSpaceOnUse"
                      y1="100%"
                      y2="0%"
                    />
                  </defs>
                ) : null}
                <Line
                  activeLineIndex={activeLineIndex}
                  color={lineColor}
                  index={reversedSeries.length - 1 - index}
                  isAnimated={isAnimated}
                  lineGenerator={lineGenerator}
                  series={singleSeries}
                  theme={theme}
                >
                  {areaColor != null ? (
                    <GradientArea
                      series={singleSeries}
                      yScale={yScale}
                      xScale={xScale}
                      hasSpline={selectedTheme.line.hasSpline}
                    />
                  ) : null}
                </Line>
              </React.Fragment>
            );
          })}

          <Points
            activeIndex={emptyState ? null : activeIndex}
            animatedCoordinates={animatedCoordinates}
            animatePoints={animatePoints}
            data={reversedSeries}
            getXPosition={getXPosition}
            gradientId={gradientId.current}
            longestSeriesIndex={longestSeriesIndex}
            theme={theme}
            tooltipId={tooltipId.current}
            xScale={xScale}
            yScale={yScale}
          />
        </g>
      </svg>

      <TooltipWrapper
        alwaysUpdatePosition
        chartDimensions={{width, height}}
        focusElementDataType={DataType.Point}
        getMarkup={getTooltipMarkup}
        getPosition={getTooltipPosition}
        id={tooltipId.current}
        margin={Margin}
        onIndexChange={(index) => setActiveIndex(index)}
        parentRef={svgRef}
      />

      {showLegend && (
        <LegendContainer
          colorVisionType={COLOR_VISION_SINGLE_ITEM}
          data={legend}
          onHeightChange={setLegendHeight}
          theme={theme}
        />
      )}
    </div>
  );
}