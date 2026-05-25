"use client";

import { useEffect, useState } from "react";

function getNextFriday(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sun, 5 = Fri
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntilFriday);
  next.setHours(0, 0, 0, 0);
  return next;
}

export default function FridayCountdown() {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    function update() {
      const target = getNextFriday();
      const diff = target.getTime() - Date.now();
      if (diff <= 0) {
        setRemaining("Today!");
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

      if (days > 0) {
        setRemaining(`${days}d ${hours}h`);
      } else {
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setRemaining(`${hours}h ${mins}m`);
      }
    }

    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
      <p className="font-medium text-gray-700 dark:text-gray-300">🌱 Top 3 seeds every Friday get promoted to Stories</p>
      <p className="mt-1 text-xs font-mono">
        Next promotion: {remaining}
      </p>
    </div>
  );
}
