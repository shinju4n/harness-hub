"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

interface LoadingOverlayProps {
  message?: string;
}

export function LoadingOverlay({ message = "Switching profile..." }: LoadingOverlayProps) {
  const [mounted, setMounted] = useState(false);
  // Hydration guard: portal can only render after mount on the client.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="h-10 w-10 rounded-full border-3 border-gray-200 dark:border-gray-700" />
          <div className="absolute inset-0 h-10 w-10 rounded-full border-3 border-amber-500 border-t-transparent animate-spin" />
        </div>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{message}</p>
      </div>
    </div>,
    document.body
  );
}
