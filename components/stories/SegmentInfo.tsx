"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Info } from "lucide-react";

type SegmentInfoProps = {
  username: string | null;
  createdAt: string;
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months > 1 ? "s" : ""} ago`;
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function SegmentInfo({ username, createdAt }: SegmentInfoProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setVisible(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [visible]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        className="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors"
        title="Segment info"
      >
        <Info size={14} />
      </button>

      {visible && (
        <div className="absolute right-0 top-full z-40 mt-1 w-48 rounded-lg bg-gray-900 dark:bg-gray-800 p-3 shadow-lg">
          <p className="text-xs text-gray-300">
            <span className="text-gray-500">Author: </span>
            {username ? (
              <Link
                href={`/profile/${username}`}
                className="text-white hover:underline"
              >
                @{username}
              </Link>
            ) : (
              <span className="text-white">@anonymous</span>
            )}
          </p>
          <p className="mt-1 text-xs text-gray-300">
            <span className="text-gray-500">Submitted: </span>
            <span className="text-white">{formatDate(createdAt)}</span>
          </p>
        </div>
      )}
    </div>
  );
}
