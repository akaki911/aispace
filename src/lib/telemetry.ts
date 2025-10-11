type TelemetryEventProps = Record<string, unknown> | undefined;

const isTelemetryEnabled =
  typeof import.meta !== 'undefined' &&
  typeof import.meta.env !== 'undefined' &&
  import.meta.env.VITE_TELEMETRY === '1';

export const track = (event: string, props?: TelemetryEventProps) => {
  if (!isTelemetryEnabled) {
    return;
  }

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug('[telemetry]', event, props ?? {});
  }
};

export default track;
