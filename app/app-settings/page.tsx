"use client";

import { useAppSettingsStore } from "@/stores/app-settings-store";

const INTERVAL_OPTIONS = [
  { value: 3, label: "3 seconds" },
  { value: 5, label: "5 seconds" },
  { value: 10, label: "10 seconds" },
  { value: 30, label: "30 seconds" },
  { value: 60, label: "1 minute" },
];

export default function AppSettingsPage() {
  const { pollingEnabled, pollingInterval, setPollingEnabled, setPollingInterval } = useAppSettingsStore();

  return (
    <div>
      <div className="mb-6 pl-10 lg:pl-0">
        <h2 className="text-xl font-semibold text-gray-900">App Settings</h2>
        <p className="mt-1 text-sm text-gray-500">Harness Hub application preferences</p>
      </div>

      <div className="space-y-4">
        {/* Polling */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900">Auto Refresh</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Automatically poll ~/.claude/ for changes
              </p>
            </div>
            <button
              onClick={() => setPollingEnabled(!pollingEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                pollingEnabled ? "bg-amber-500" : "bg-gray-200"
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
            <div className="mt-4 pt-4 border-t border-gray-100">
              <label className="block text-sm text-gray-600 mb-2">Polling interval</label>
              <div className="flex gap-2">
                {INTERVAL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPollingInterval(opt.value)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      pollingInterval === opt.value
                        ? "border-amber-300 bg-amber-50 text-amber-700 font-medium"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="font-medium text-gray-900">About</h3>
          <div className="mt-3 space-y-2 text-sm text-gray-500">
            <div className="flex justify-between">
              <span>Version</span>
              <span className="font-mono text-gray-700">0.2.0</span>
            </div>
            <div className="flex justify-between">
              <span>Data source</span>
              <span className="font-mono text-gray-700">~/.claude/</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
