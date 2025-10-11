declare module 'chart.js' {
  export type ChartType = string;

  export interface ChartOptions<TType extends ChartType = ChartType> {
    responsive?: boolean;
    plugins?: Record<string, unknown>;
    scales?: Record<string, unknown>;
    [key: string]: unknown;
  }

  export class Chart<TType extends ChartType = ChartType> {
    static register(...items: unknown[]): void;
  }

  export const LineElement: unknown;
  export const PointElement: unknown;
  export const LinearScale: unknown;
  export const CategoryScale: unknown;
  export const Tooltip: unknown;
  export const Legend: unknown;
  export const BarElement: unknown;
  export const Filler: unknown;
}
