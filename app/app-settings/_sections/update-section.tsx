"use client";

import { useEffect, useState } from "react";
import packageJson from "@/package.json";

interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseUrl?: string;
  releaseNotes?: string;
  publishedAt?: string;
  error?: string;
}

// Max time to wait before we give up on a silent Electron update check —
// otherwise the button gets stuck on "Checking…" if the main process never
// emits an event (dead network, offline GitHub, etc).
const CHECK_TIMEOUT_MS = 20_000;

type ElectronUpdateUiStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "downloaded"
  | "up-to-date"
  | "error";

interface ElectronUpdateUi {
  status: ElectronUpdateUiStatus;
  version?: string;
  percent?: number;
  message?: string;
}

export function UpdateSection() {
  const isElectron = typeof window !== "undefined" && !!window.electronUpdater;
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [electronUpdate, setElectronUpdate] = useState<ElectronUpdateUi>({ status: "idle" });

  // Subscribe to Electron updater events + rehydrate state on mount. The
  // main-process controller runs a check at app startup, so events may have
  // fired BEFORE this component mounted — we ask for the current snapshot
  // once so the UI reflects reality (e.g. "Restart & Install" if an update
  // already downloaded).
  useEffect(() => {
    if (!isElectron) return;
    let cancelled = false;
    window.electronUpdater!.getState().then((snapshot) => {
      if (cancelled) return;
      setElectronUpdate((prev) =>
        prev.status === "idle"
          ? { ...snapshot, status: snapshot.status === "checking" ? "idle" : snapshot.status }
          : prev,
      );
    });
    const unsub = window.electronUpdater!.onEvent((event) => {
      switch (event.type) {
        case "checking":
          setElectronUpdate((prev) => ({ ...prev, status: "checking" }));
          break;
        case "available":
          // autoDownload is true, so this immediately transitions into
          // downloading — we collapse the two so the UI doesn't flash.
          setElectronUpdate({ status: "downloading", version: event.version });
          setChecking(false);
          break;
        case "not-available":
          setElectronUpdate({ status: "up-to-date" });
          setChecking(false);
          break;
        case "progress":
          setElectronUpdate((prev) => ({
            status: "downloading",
            version: prev.version,
            percent: event.percent,
          }));
          break;
        case "downloaded":
          setElectronUpdate({ status: "downloaded", version: event.version });
          setChecking(false);
          break;
        case "error":
          setElectronUpdate({ status: "error", message: event.message });
          setChecking(false);
          break;
      }
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [isElectron]);

  const checkForUpdates = async () => {
    setChecking(true);
    if (isElectron) {
      setElectronUpdate((prev) =>
        prev.status === "downloaded" || prev.status === "available" || prev.status === "downloading"
          ? { ...prev, status: "checking" }
          : { status: "checking" },
      );
      window.electronUpdater!.checkForUpdates();
      window.setTimeout(() => {
        setChecking((wasChecking) => {
          if (!wasChecking) return wasChecking;
          setElectronUpdate((prev) =>
            prev.status === "checking"
              ? { status: "error", message: "Check timed out — try again later" }
              : prev,
          );
          return false;
        });
      }, CHECK_TIMEOUT_MS);
      return;
    }
    setUpdateInfo(null);
    setNotesExpanded(false);
    try {
      const res = await fetch("/api/update-check");
      const data = await res.json();
      setUpdateInfo(data);
    } catch {
      setUpdateInfo({
        currentVersion: "?",
        latestVersion: "?",
        updateAvailable: false,
        error: "Failed to check",
      });
    }
    setChecking(false);
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900 dark:text-gray-100">Updates</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {isElectron ? "Automatically downloads the latest release" : "Check for new versions on GitHub"}
          </p>
        </div>
        <button
          onClick={checkForUpdates}
          disabled={checking}
          className="px-4 py-1.5 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          Check now
        </button>
      </div>

      {isElectron && electronUpdate.status !== "idle" && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          {electronUpdate.status === "checking" && (
            <p className="text-sm text-gray-500 animate-pulse">Checking for updates…</p>
          )}
          {electronUpdate.status === "downloading" && (
            <div>
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                {electronUpdate.version ? `Downloading v${electronUpdate.version}…` : "Downloading update…"}
                {electronUpdate.percent != null && (
                  <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">
                    ({electronUpdate.percent}%)
                  </span>
                )}
              </p>
              <div className="mt-2 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, electronUpdate.percent ?? 0))}%` }}
                />
              </div>
            </div>
          )}
          {electronUpdate.status === "downloaded" && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600 dark:text-green-400">
                  {electronUpdate.version
                    ? `v${electronUpdate.version} ready to install`
                    : "Update ready to install"}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  Current: v{packageJson.version}
                </p>
              </div>
              <button
                onClick={() => window.electronUpdater!.quitAndInstall()}
                className="px-4 py-1.5 text-sm font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
              >
                Restart &amp; Install
              </button>
            </div>
          )}
          {electronUpdate.status === "up-to-date" && (
            <p className="text-sm text-green-600 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              You&apos;re up to date (v{packageJson.version})
            </p>
          )}
          {electronUpdate.status === "error" && (
            <p className="text-sm text-red-500">{electronUpdate.message ?? "Something went wrong"}</p>
          )}
        </div>
      )}

      {!isElectron && (checking || updateInfo) && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          {checking ? (
            <p className="text-sm text-gray-500 animate-pulse">Checking for updates…</p>
          ) : updateInfo?.error ? (
            <p className="text-sm text-red-500">{updateInfo.error}</p>
          ) : updateInfo?.updateAvailable ? (
            <div>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300 truncate">
                    New version available: v{updateInfo.latestVersion}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    Current: v{updateInfo.currentVersion}
                    {updateInfo.publishedAt &&
                      ` · Released ${new Date(updateInfo.publishedAt).toLocaleDateString()}`}
                  </p>
                </div>
                {updateInfo.releaseUrl && (
                  <a
                    href={updateInfo.releaseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 px-4 py-1.5 text-sm font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                  >
                    Download
                  </a>
                )}
              </div>
              {updateInfo.releaseNotes && (
                <div className="mt-3">
                  <button
                    onClick={() => setNotesExpanded((v) => !v)}
                    className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className={`transition-transform ${notesExpanded ? "rotate-90" : ""}`}
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                    {notesExpanded ? "Hide release notes" : "Show release notes"}
                  </button>
                  {notesExpanded && (
                    <pre className="mt-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 text-[11px] font-mono text-gray-600 dark:text-gray-400 overflow-x-auto whitespace-pre-wrap max-h-64">
                      {updateInfo.releaseNotes}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ) : updateInfo ? (
            <p className="text-sm text-green-600 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              You&apos;re up to date (v{updateInfo.currentVersion})
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
