declare module 'react-chartjs-2' {
  import type { ChartOptions, ChartType } from 'chart.js';
  import type { ComponentType } from 'react';

  export interface ChartComponentProps<TType extends ChartType = ChartType> {
    data: unknown;
    options?: ChartOptions<TType>;
    [key: string]: unknown;
  }

  export const Line: ComponentType<ChartComponentProps<'line'>>;
  export const Bar: ComponentType<ChartComponentProps<'bar'>>;
}
