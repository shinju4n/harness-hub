"use client";

import { useState } from "react";
import { useAppSettingsStore } from "@/stores/app-settings-store";
import type { Profile } from "@/stores/app-settings-store";
import packageJson from "@/package.json";

const INTERVAL_OPTIONS = [
  { value: 3, label: "3s" },
  { value: 5, label: "5s" },
  { value: 10, label: "10s" },
  { value: 30, label: "30s" },
  { value: 60, label: "1m" },
];

interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseUrl?: string;
  publishedAt?: string;
  error?: string;
}

export default function AppSettingsPage() {
  const { pollingEnabled, pollingInterval, navOrder, setPollingEnabled, setPollingInterval, resetNavOrder, profiles, activeProfileId, addProfile, removeProfile } = useAppSettingsStore();
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [editName, setEditName] = useState("");
  const [editPath, setEditPath] = useState("");
  const [addingProfile, setAddingProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfilePath, setNewProfilePath] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const checkForUpdates = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/update-check");
      const data = await res.json();
      setUpdateInfo(data);
    } catch {
      setUpdateInfo({ currentVersion: "?", latestVersion: "?", updateAvailable: false, error: "Failed to check" });
    }
    setChecking(false);
  };

  return (
    <div>
      <div className="mb-6 pl-10 lg:pl-0">
        <h2 className="text-xl font-semibold text-gray-900">App Settings</h2>
        <p className="mt-1 text-sm text-gray-500">Harness Hub application preferences</p>
      </div>

      <div className="space-y-4">
        {/* Update Check */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900">Updates</h3>
              <p className="text-sm text-gray-500 mt-0.5">Check for new versions on GitHub</p>
            </div>
            <button
              onClick={checkForUpdates}
              disabled={checking}
              className="px-4 py-1.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {checking ? "Checking..." : "Check now"}
            </button>
          </div>
          {updateInfo && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              {updateInfo.error ? (
                <p className="text-sm text-red-500">{updateInfo.error}</p>
              ) : updateInfo.updateAvailable ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-amber-700">
                      New version available: v{updateInfo.latestVersion}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Current: v{updateInfo.currentVersion}
                      {updateInfo.publishedAt && ` · Released ${new Date(updateInfo.publishedAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  {updateInfo.releaseUrl && (
                    <a
                      href={updateInfo.releaseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-1.5 text-sm font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                    >
                      Download
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-sm text-green-600 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5"/></svg>
                  You're up to date (v{updateInfo.currentVersion})
                </p>
              )}
            </div>
          )}
        </div>

        {/* Polling */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900">Auto Refresh</h3>
              <p className="text-sm text-gray-500 mt-0.5">Automatically poll ~/.claude/ for changes</p>
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
              <div className="flex gap-2 flex-wrap">
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

        {/* Menu Order */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900">Menu Order</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {navOrder ? "Custom order saved" : "Default order"} · Drag items in the sidebar to reorder
              </p>
            </div>
            {navOrder && (
              <button
                onClick={resetNavOrder}
                className="px-4 py-1.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Reset to default
              </button>
            )}
          </div>
        </div>

        {/* Profiles */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-medium text-gray-900">Profiles</h3>
              <p className="text-sm text-gray-500 mt-0.5">Manage multiple ~/.claude paths</p>
            </div>
            {!addingProfile && (
              <button
                onClick={() => setAddingProfile(true)}
                className="px-4 py-1.5 text-sm font-medium rounded-lg border border-dashed border-amber-300 text-amber-600 hover:bg-amber-50 transition-colors"
              >
                + Add
              </button>
            )}
          </div>

          <div className="space-y-2">
            {profiles.map((profile) => (
              <div key={profile.id} className="rounded-lg border border-gray-100 bg-gray-50/50">
                {editingProfile?.id === profile.id ? (
                  <div className="p-3 space-y-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Profile name"
                      className="w-full text-[13px] px-2.5 py-1.5 rounded-md border border-gray-200 bg-white focus:outline-none focus:border-amber-400"
                    />
                    <input
                      type="text"
                      value={editPath}
                      onChange={(e) => setEditPath(e.target.value)}
                      placeholder="/absolute/path/.claude"
                      className="w-full text-[13px] font-mono px-2.5 py-1.5 rounded-md border border-gray-200 bg-white focus:outline-none focus:border-amber-400"
                    />
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => {
                          if (!editName.trim()) return;
                          removeProfile(profile.id);
                          addProfile(editName.trim(), editPath.trim() || "auto");
                          setEditingProfile(null);
                        }}
                        className="px-3 py-1 text-xs font-medium rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingProfile(null)}
                        className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-gray-800">{profile.name}</span>
                        {profile.id === activeProfileId && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">Active</span>
                        )}
                        {profile.id === "default" && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">Default</span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 font-mono mt-0.5 truncate">
                        {profile.homePath === "auto" ? "~/.claude (auto)" : profile.homePath}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => { setEditingProfile(profile); setEditName(profile.name); setEditPath(profile.homePath === "auto" ? "" : profile.homePath); }}
                        className="px-2 py-1 text-xs text-gray-400 hover:text-amber-600 transition-colors rounded hover:bg-amber-50"
                      >
                        Edit
                      </button>
                      {profile.id !== "default" && (
                        confirmDeleteId === profile.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => { removeProfile(profile.id); setConfirmDeleteId(null); }}
                              className="px-2 py-1 text-xs font-medium text-red-600 hover:text-red-700 transition-colors rounded hover:bg-red-50"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(profile.id)}
                            className="px-2 py-1 text-xs text-gray-400 hover:text-red-500 transition-colors rounded hover:bg-red-50"
                          >
                            Delete
                          </button>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {addingProfile && (
            <div className="mt-3 p-3 border border-amber-200 rounded-lg bg-amber-50/50 space-y-2">
              <input
                type="text"
                placeholder="Profile name"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                className="w-full text-[13px] px-2.5 py-1.5 rounded-md border border-gray-200 bg-white focus:outline-none focus:border-amber-400"
                autoFocus
              />
              <input
                type="text"
                placeholder="/absolute/path/.claude"
                value={newProfilePath}
                onChange={(e) => setNewProfilePath(e.target.value)}
                className="w-full text-[13px] font-mono px-2.5 py-1.5 rounded-md border border-gray-200 bg-white focus:outline-none focus:border-amber-400"
              />
              <div className="flex gap-1.5">
                <button
                  onClick={() => {
                    if (!newProfileName.trim() || !newProfilePath.trim()) return;
                    addProfile(newProfileName.trim(), newProfilePath.trim());
                    setNewProfileName("");
                    setNewProfilePath("");
                    setAddingProfile(false);
                  }}
                  className="px-3 py-1 text-xs font-medium rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => { setAddingProfile(false); setNewProfileName(""); setNewProfilePath(""); }}
                  className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* About */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="font-medium text-gray-900">About</h3>
          <div className="mt-3 space-y-2 text-sm text-gray-500">
            <div className="flex justify-between">
              <span>Version</span>
              <span className="font-mono text-gray-700">{packageJson.version}</span>
            </div>
            <div className="flex justify-between">
              <span>Data source</span>
              <span className="font-mono text-gray-700">~/.claude/</span>
            </div>
            <div className="flex justify-between">
              <span>Repository</span>
              <a href="https://github.com/shinju4n/harness-hub" target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:underline">
                shinju4n/harness-hub
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
