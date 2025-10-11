
import type { ActivityEvent } from '@/types/activity';
import ScanCard from './ScanCard';
import CommandCard from './CommandCard';
import FileChangeCard from './FileChangeCard';

export default function ActivityTimeline({ items }: { items: ActivityEvent[] }) {
  if (!items?.length) return null;
  return (
    <div className="mb-3">
      {items.map((evt, i) => {
        if (evt.type === 'scan') return <ScanCard key={i} evt={evt} />;
        if (evt.type === 'install') return <CommandCard key={i} evt={evt} />;
        if (evt.type === 'file') return <FileChangeCard key={i} evt={evt} />;
        return null;
      })}
    </div>
  );
}
