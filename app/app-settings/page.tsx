"use client";

import { useAppSettingsStore } from "@/stores/app-settings-store";
import packageJson from "@/package.json";
import { UpdateSection } from "./_sections/update-section";
import { HotkeySection } from "./_sections/hotkey-section";
import { ProfileSection } from "./_sections/profile-section";
import { HookSection } from "./_sections/hook-section";

const INTERVAL_OPTIONS = [
  { value: 3, label: "3s" },
  { value: 5, label: "5s" },
  { value: 10, label: "10s" },
  { value: 30, label: "30s" },
  { value: 60, label: "1m" },
];

export default function AppSettingsPage() {
  return (
    <div>
      <div className="mb-6 pl-10 lg:pl-0">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">App Settings</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Harness Hub application preferences</p>
      </div>

      <div className="space-y-4">
        <UpdateSection />
        <PollingCard />
        <ThemeCard />
        <SidebarCard />
        <HotkeySection />
        <MenuOrderCard />
        <ProfileSection />
        <HookSection />
        <ArchivedHistoriesCard />
        <StorageCard />
        <AboutCard />
      </div>
    </div>
  );
}

function PollingCard() {
  const pollingEnabled = useAppSettingsStore((s) => s.pollingEnabled);
  const pollingInterval = useAppSettingsStore((s) => s.pollingInterval);
  const setPollingEnabled = useAppSettingsStore((s) => s.setPollingEnabled);
  const setPollingInterval = useAppSettingsStore((s) => s.setPollingInterval);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900 dark:text-gray-100">Auto Refresh</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Automatically poll ~/.claude/ for changes</p>
        </div>
        <button
          onClick={() => setPollingEnabled(!pollingEnabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            pollingEnabled ? "bg-amber-500" : "bg-gray-200 dark:bg-gray-700"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
              pollingEnabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
      {pollingEnabled && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Polling interval</label>
          <div className="flex gap-2 flex-wrap">
            {INTERVAL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPollingInterval(opt.value)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                  pollingInterval === opt.value
                    ? "border-amber-300 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-medium"
                    : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ThemeCard() {
  const theme = useAppSettingsStore((s) => s.theme);
  const setTheme = useAppSettingsStore((s) => s.setTheme);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
      <div>
        <h3 className="font-medium text-gray-900 dark:text-gray-100">Theme</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Choose your preferred color scheme</p>
      </div>
      <div className="mt-4 flex gap-2 flex-wrap">
        {(["system", "light", "dark"] as const).map((option) => (
          <button
            key={option}
            onClick={() => setTheme(option)}
            className={`px-4 py-1.5 text-sm rounded-lg border transition-colors capitalize ${
              theme === option
                ? "border-amber-300 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-medium"
                : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
            }`}
          >
            {option === "system" ? "System default" : option.charAt(0).toUpperCase() + option.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}

function SidebarCard() {
  const sidebarCollapsed = useAppSettingsStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useAppSettingsStore((s) => s.setSidebarCollapsed);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900 dark:text-gray-100">Sidebar</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {sidebarCollapsed ? "Sidebar hidden — use the hamburger menu to navigate" : "Sidebar always visible on desktop"}
          </p>
        </div>
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            !sidebarCollapsed ? "bg-amber-500" : "bg-gray-200 dark:bg-gray-700"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
              !sidebarCollapsed ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
}

function MenuOrderCard() {
  const navOrder = useAppSettingsStore((s) => s.navOrder);
  const resetNavOrder = useAppSettingsStore((s) => s.resetNavOrder);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900 dark:text-gray-100">Menu Order</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {navOrder ? "Custom order saved" : "Default order"} · Drag items in the sidebar to reorder
          </p>
        </div>
        {navOrder && (
          <button
            onClick={resetNavOrder}
            className="px-4 py-1.5 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Reset to default
          </button>
        )}
      </div>
    </div>
  );
}

function ArchivedHistoriesCard() {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
      <div>
        <h3 className="font-medium text-gray-900 dark:text-gray-100">Archived Histories</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Profiles whose version histories have been archived
        </p>
      </div>
      <div className="mt-4 flex flex-col items-center justify-center py-6 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-gray-300 dark:text-gray-600 mb-2"
        >
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="m3.3 7 8.7 5 8.7-5" />
          <path d="M12 22V12" />
        </svg>
        <p className="text-sm text-gray-400 dark:text-gray-500">No archived histories</p>
        <p className="text-xs text-gray-300 dark:text-gray-600 mt-0.5">
          Archived profile histories will appear here
        </p>
      </div>
    </div>
  );
}

function StorageCard() {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900 dark:text-gray-100">Storage</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Remove orphaned objects not referenced by any snapshot
          </p>
        </div>
        <button
          disabled
          className="px-4 py-1.5 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50"
        >
          Clean up (coming soon)
        </button>
      </div>
    </div>
  );
}

function AboutCard() {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
      <h3 className="font-medium text-gray-900 dark:text-gray-100">About</h3>
      <div className="mt-3 space-y-2 text-sm text-gray-500 dark:text-gray-400">
        <div className="flex justify-between">
          <span>Version</span>
          <span className="font-mono text-gray-700 dark:text-gray-300">{packageJson.version}</span>
        </div>
        <div className="flex justify-between">
          <span>Data source</span>
          <span className="font-mono text-gray-700 dark:text-gray-300">~/.claude/</span>
        </div>
      </div>
    </div>
  );
}
