import type { FC } from 'react';

import BackupTabContent from '@/components/Backup/BackupTab';

interface BackupTabProps {
  hasDevConsoleAccess: boolean;
}

const BackupTab: FC<BackupTabProps> = ({ hasDevConsoleAccess }) => (
  <BackupTabContent hasDevConsoleAccess={hasDevConsoleAccess} />
);

export default BackupTab;
