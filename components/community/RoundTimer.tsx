"use client";

import { useEffect, useState } from "react";

type RoundTimerProps = {
  endsAt: string;
};

export default function RoundTimer({ endsAt }: RoundTimerProps) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    function update() {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining("Ending soon…");
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setRemaining(`${hours}h ${mins}m remaining`);
      } else if (mins > 0) {
        setRemaining(`${mins}m ${secs}s remaining`);
      } else {
        setRemaining(`${secs}s remaining`);
      }
    }

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  return (
    <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
      ⏱ {remaining}
    </div>
  );
}
