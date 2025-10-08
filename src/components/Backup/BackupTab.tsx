interface BackupTabProps {
  hasDevConsoleAccess?: boolean;
}

const BackupTab = ({ hasDevConsoleAccess = false }: BackupTabProps): JSX.Element => {
  return (
    <div>
      Backups are unavailable.{hasDevConsoleAccess ? ' (Admin access detected)' : ''}
    </div>
  );
};

export default BackupTab;
