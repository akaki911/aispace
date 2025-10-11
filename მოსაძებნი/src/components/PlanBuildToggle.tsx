import { type FC } from 'react';
import { Switch } from './Switch';
import { BadgeCheck } from 'lucide-react';
import { useAssistantMode } from '../contexts/useAssistantMode';

const ToggleLabel: FC<{ title: string; description: string }> = ({ title, description }) => (
  <div className="flex flex-col text-left">
    <span className="text-sm font-semibold text-gray-800">{title}</span>
    <span className="text-xs text-gray-500">{description}</span>
  </div>
);

export const PlanBuildToggle: FC = () => {
  const { mode, setMode, isReadOnly } = useAssistantMode();

  const handleChange = (checked: boolean) => {
    setMode(checked ? 'build' : 'plan', { source: 'legacy-toggle' });
  };

  return (
    <div className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center space-x-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${isReadOnly ? 'bg-amber-100' : 'bg-emerald-100'}`}>
          <BadgeCheck className={`h-5 w-5 ${isReadOnly ? 'text-amber-600' : 'text-emerald-600'}`} />
        </div>
        {isReadOnly ? (
          <ToggleLabel title="Plan Mode" description="Read-only guard is active for write operations" />
        ) : (
          <ToggleLabel title="Build Mode" description="Write operations enabled for automation flows" />
        )}
      </div>
      <Switch
        checked={mode === 'build'}
        onCheckedChange={handleChange}
        aria-label="Toggle assistant plan/build mode"
        className="data-[state=checked]:bg-emerald-500"
      />
    </div>
  );
};

export default PlanBuildToggle;
