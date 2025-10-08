import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import AIDeveloperManagementPanel, { GuruloSectionKey } from '@aispace/components/admin/AIDeveloperManagementPanel';

const GURULO_SECTIONS: readonly GuruloSectionKey[] = [
  'overview',
  'chatConfig',
  'userManagement',
  'uiCustomization',
  'analytics',
  'integrations',
];

const isValidSection = (value: string | null): value is GuruloSectionKey =>
  !!value && (GURULO_SECTIONS as readonly string[]).includes(value);

const GurulaRoute = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionParam = searchParams.get('section');
  const serializedParams = searchParams.toString();
  const focusSection = isValidSection(sectionParam) ? sectionParam : null;

  const handleFocusHandled = useCallback(() => {
    if (!focusSection) {
      return;
    }

    const nextParams = new URLSearchParams(serializedParams);
    nextParams.delete('section');
    setSearchParams(nextParams, { replace: true });
  }, [focusSection, serializedParams, setSearchParams]);

  return (
    <AIDeveloperManagementPanel
      focusSection={focusSection}
      onSectionFocusHandled={focusSection ? handleFocusHandled : undefined}
    />
  );
};

export default GurulaRoute;
