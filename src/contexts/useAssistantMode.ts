import { useState } from 'react';

type AssistantMode = 'assistant' | 'developer';

export const useAssistantMode = () => {
  const [mode, setMode] = useState<AssistantMode>('assistant');
  return { mode, setMode };
};

export default useAssistantMode;
