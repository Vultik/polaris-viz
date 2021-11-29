import React from 'react';

import type {DataSeries} from '../../types';
import {ChartContainer} from '../ChartContainer';

import {Chart} from './Chart';

export interface Coordinates {
  x: number;
  y: number | null;
}

export interface SparkLineChartProps {
  data: DataSeries[];
  accessibilityLabel?: string;
  isAnimated?: boolean;
  offsetLeft?: number;
  offsetRight?: number;
  theme?: string;
}

export function SparkLineChart({
  data,
  accessibilityLabel,
  isAnimated = false,
  offsetLeft = 0,
  offsetRight = 0,
  theme,
}: SparkLineChartProps) {
  return (
    <ChartContainer theme={theme}>
      <Chart
        data={data}
        accessibilityLabel={accessibilityLabel}
        isAnimated={isAnimated}
        offsetLeft={offsetLeft}
        offsetRight={offsetRight}
        theme={theme}
      />
    </ChartContainer>
  );
}