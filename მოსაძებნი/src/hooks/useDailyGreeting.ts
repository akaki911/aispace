import { useEffect, useState } from 'react';

const DAILY_GREETINGS = ['გაუმარჯოს', 'მშვიდობიანი დღე', 'მზიანი დილა', 'გაბედული ნაბიჯი', 'თბილი მოგზაურობა'];
const GREETING_STORAGE_KEY = 'bakhmaro.dailyGreeting';
const GREETING_INTERVAL = 24 * 60 * 60 * 1000;

export const useDailyGreeting = (): string => {
  const [greeting, setGreeting] = useState<string>(DAILY_GREETINGS[0]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const storedValue = window.localStorage.getItem(GREETING_STORAGE_KEY);
      const now = Date.now();
      let parsed: { greeting?: string; timestamp?: number } | null = null;

      if (storedValue) {
        parsed = JSON.parse(storedValue) as { greeting?: string; timestamp?: number };
        if (parsed?.greeting && parsed?.timestamp && now - parsed.timestamp < GREETING_INTERVAL) {
          setGreeting(parsed.greeting);
          return;
        }
      }

      const previousGreeting = parsed?.greeting;
      const availableGreetings = DAILY_GREETINGS.filter(option => option !== previousGreeting);
      const nextGreeting =
        availableGreetings[Math.floor(Math.random() * availableGreetings.length)] ?? DAILY_GREETINGS[0];

      const payload = { greeting: nextGreeting, timestamp: now };
      window.localStorage.setItem(GREETING_STORAGE_KEY, JSON.stringify(payload));
      setGreeting(nextGreeting);
    } catch (error) {
      console.warn('[useDailyGreeting] Failed to resolve greeting', error);
      setGreeting(DAILY_GREETINGS[0]);
    }
  }, []);

  return greeting;
};

