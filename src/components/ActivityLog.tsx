import React from 'react';

interface ActivityLogProps {
  entries?: Array<{ id: string; message: string; timestamp: string }>;
  className?: string;
  openFile?: (path: string) => void;
}

const fallbackEntries: ActivityLogProps['entries'] = [
  { id: 'log-1', message: 'AI მოდულმა შეასრულა ავტომატური რეფაქტორინგი', timestamp: new Date().toISOString() },
  { id: 'log-2', message: 'მეხსიერების სინქი წარმატებით დასრულდა', timestamp: new Date(Date.now() - 600000).toISOString() },
];

const ActivityLog: React.FC<ActivityLogProps> = ({ entries = fallbackEntries, className }) => (
  <section className={`rounded-3xl border border-white/10 bg-[#0F172A]/85 p-6 text-sm text-[#C8CBE0] ${className ?? ''}`.trim()}>
    <h3 className="text-lg font-semibold text-white">Activity Log</h3>
    <p className="mt-2 text-xs text-[#9AA0B5]">
      წარმოდგენილია სადემონსტრაციო აქტივობები. ინტეგრაციისას გამოჩნდება რეალური სისტემური მოვლენები.
    </p>
    <ul className="mt-4 space-y-2 text-xs">
      {entries?.map((entry) => (
        <li key={entry.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          <p className="font-semibold text-white">{entry.message}</p>
          <p className="text-[#9AA0B5]">{new Date(entry.timestamp).toLocaleString('ka-GE')}</p>
        </li>
      ))}
    </ul>
  </section>
);

export default ActivityLog;
