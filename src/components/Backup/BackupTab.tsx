import type { FC } from 'react';

interface BackupTabContentProps {
  hasDevConsoleAccess: boolean;
}

const BackupTabContent: FC<BackupTabContentProps> = ({ hasDevConsoleAccess }) => {
  if (!hasDevConsoleAccess) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/70">
        სარეზერვო პანელზე წვდომა შეზღუდულია.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">სარეზერვო მართვის პანელი</h2>
      <p className="text-sm text-white/70">
        რეალური სარეზერვო სისტემები ამ გარემოში მიუწვდომელია. გამოიყენეთ ეს ინტერფეისი როგორც მაკეტი კონცეფციისა და დიზაინისთვის.
      </p>
    </div>
  );
};

export default BackupTabContent;
