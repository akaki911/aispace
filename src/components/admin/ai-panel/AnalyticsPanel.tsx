import type { ComponentProps } from 'react';
import { OverviewSection } from './OverviewSection';
import { AnalyticsSection } from './AnalyticsSection';
import { IntegrationsSection } from './IntegrationsSection';
import { FallbackControlCard } from './FallbackControlCard';

interface AnalyticsPanelProps {
  overviewProps: ComponentProps<typeof OverviewSection>;
  analyticsProps: ComponentProps<typeof AnalyticsSection>;
  integrationsProps: ComponentProps<typeof IntegrationsSection>;
  fallbackProps: {
    enabled: boolean;
    forced: boolean;
    provider: string;
    isUpdating: boolean;
    onToggle: (enabled: boolean) => void;
  };
}

export function AnalyticsPanel({ overviewProps, analyticsProps, integrationsProps, fallbackProps }: AnalyticsPanelProps) {
  return (
    <div className="space-y-12">
      <OverviewSection {...overviewProps} />
      <FallbackControlCard {...fallbackProps} />
      <AnalyticsSection {...analyticsProps} />
      <IntegrationsSection {...integrationsProps} />
    </div>
  );
}
