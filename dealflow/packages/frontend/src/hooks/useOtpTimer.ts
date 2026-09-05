import { useState, useEffect, useCallback, useRef } from "react";

// ---------------------------------------------------------------------------
// useOtpTimer — manages the resend countdown and tracks resend count.
// ---------------------------------------------------------------------------

export function useOtpTimer(cooldownSeconds = 60) {
  const [secondsLeft, setSecondsLeft] = useState(cooldownSeconds);
  const [canResend, setCanResend] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback((seconds = cooldownSeconds) => {
    setSecondsLeft(seconds);
    setCanResend(false);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [cooldownSeconds]);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTimer]);

  return { secondsLeft, canResend, startTimer };
}
