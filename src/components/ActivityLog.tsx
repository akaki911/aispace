interface ActivityLogProps {
  openFile?: (path: string) => void;
}

const ActivityLog = ({ openFile }: ActivityLogProps): JSX.Element => {
  return (
    <div>
      Activity log is unavailable.
      {openFile ? (
        <div className="mt-2 text-xs text-slate-400">Open file callbacks are not supported in this build.</div>
      ) : null}
    </div>
  );
};

export default ActivityLog;
