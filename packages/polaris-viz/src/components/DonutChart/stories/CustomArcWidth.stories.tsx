import React from 'react';
import type {Story, StoryFn} from '@storybook/react';

export {META as default} from './meta';

import {PolarisVizProvider} from '../../PolarisVizProvider';
import {DonutChart} from '../DonutChart';
import type {DonutChartProps} from '../DonutChart';

import {DEFAULT_DATA, DEFAULT_PROPS} from './data';

const CustomArcWidthTemplate: StoryFn<DonutChartProps> = (args: DonutChartProps) => {
  return (
    <PolarisVizProvider
      themes={{
        Default: {
          arc: {
            thickness: 50,
          }
        },
      }}
    >
      <DonutChart {...args} />
    </PolarisVizProvider>
  );
};

export const CustomArcWidth: Story<DonutChartProps> = CustomArcWidthTemplate.bind({});

CustomArcWidth.args = {
  ...DEFAULT_PROPS,
  data: DEFAULT_DATA,
};