import React from 'react';
import { useTranslation } from 'react-i18next';
import { InboxArrowDownIcon } from '@heroicons/react/24/outline';

interface AutoImproveEmptyStateProps {
  offline?: boolean;
  pollingDisabled?: boolean;
  onRetry?: () => void;
}

export const AutoImproveEmptyState: React.FC<AutoImproveEmptyStateProps> = ({
  offline = false,
  pollingDisabled = false,
  onRetry,
}) => {
  const { t } = useTranslation();

  const title = offline
    ? t('aiImprove.empty.offlineTitle', 'შეზღუდული რეჟიმი')
    : pollingDisabled
      ? t('aiImprove.empty.pollingDisabledTitle', 'პოლინგი გამორთულია')
      : t('aiImprove.empty.title', 'მონაცემები არ არის');

  const description = offline
    ? t(
        'aiImprove.empty.offlineDescription',
        'დაუბრუნდით ონლაინ რეჟიმს ან სცადეთ მოგვიანებით. არსებული მონაცემები დროებით მიუწვდომელია.',
      )
    : pollingDisabled
      ? t(
          'aiImprove.empty.pollingDisabledDescription',
          'ავტომატური განახლება გამორთულია. ხელით განახლების შემდეგ შედეგები გამოჩნდება.',
        )
      : t(
          'aiImprove.empty.description',
          'სისტემა ჯერ კიდევ აგროვებს მეტრიკებს. სცადეთ განახლება ან შეარჩიეთ სხვა ფილტრები.',
        );

  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-gray-700 bg-gray-900/40 p-10 text-center text-gray-300">
      <InboxArrowDownIcon className="h-12 w-12 text-gray-500" aria-hidden="true" />
      <h4 className="mt-4 text-lg font-semibold text-gray-100">{title}</h4>
      <p className="mt-2 max-w-sm text-sm text-gray-400">{description}</p>
      {onRetry && (
        <button
          type="button"
          className="mt-6 inline-flex items-center rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 transition hover:border-emerald-500/60 hover:text-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          onClick={onRetry}
        >
          {t('aiImprove.empty.retry', 'კვლავ სცადე')}
        </button>
      )}
    </div>
  );
};

export default AutoImproveEmptyState;
