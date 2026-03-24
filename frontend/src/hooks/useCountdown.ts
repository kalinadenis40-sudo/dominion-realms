import { useState, useEffect } from 'react';

export function useCountdown(seconds: number | null) {
  const [remaining, setRemaining] = useState(seconds ?? 0);

  useEffect(() => {
    if (seconds === null || seconds <= 0) { setRemaining(0); return; }
    setRemaining(seconds);
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [seconds]);

  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;

  return {
    remaining,
    formatted: `${h > 0 ? h + ':' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
    done: remaining <= 0,
  };
}
