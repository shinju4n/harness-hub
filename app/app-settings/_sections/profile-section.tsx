"use client";

import { useState } from "react";
import { useAppSettingsStore } from "@/stores/app-settings-store";
import type { Profile } from "@/stores/app-settings-store";

export function ProfileSection() {
  const profiles = useAppSettingsStore((s) => s.profiles);
  const activeProfileId = useAppSettingsStore((s) => s.activeProfileId);
  const addProfile = useAppSettingsStore((s) => s.addProfile);
  const removeProfile = useAppSettingsStore((s) => s.removeProfile);
  const updateProfile = useAppSettingsStore((s) => s.updateProfile);

  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [addingProfile, setAddingProfile] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-medium text-gray-900 dark:text-gray-100">Profiles</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Manage multiple ~/.claude paths · any absolute path (external drives, NAS, etc.)
          </p>
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
        {profiles.map((profile) =>
          editingProfile?.id === profile.id ? (
            <ProfileEditForm
              key={profile.id}
              profile={profile}
              onSave={(name, path) => {
                updateProfile(profile.id, name, path);
                setEditingProfile(null);
              }}
              onCancel={() => setEditingProfile(null)}
            />
          ) : (
            <ProfileRow
              key={profile.id}
              profile={profile}
              isActive={profile.id === activeProfileId}
              confirmingDelete={confirmDeleteId === profile.id}
              onEdit={() => setEditingProfile(profile)}
              onRequestDelete={() => setConfirmDeleteId(profile.id)}
              onConfirmDelete={() => {
                removeProfile(profile.id);
                setConfirmDeleteId(null);
              }}
              onCancelDelete={() => setConfirmDeleteId(null)}
            />
          ),
        )}
      </div>

      {addingProfile && (
        <ProfileAddForm
          onAdd={(name, path) => {
            addProfile(name, path);
            setAddingProfile(false);
          }}
          onCancel={() => setAddingProfile(false)}
        />
      )}
    </div>
  );
}

function ProfileRow({
  profile,
  isActive,
  confirmingDelete,
  onEdit,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  profile: Profile;
  isActive: boolean;
  confirmingDelete: boolean;
  onEdit: () => void;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}) {
  return (
    <div className="rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-gray-800 dark:text-gray-200">{profile.name}</span>
            {isActive && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">
                Active
              </span>
            )}
            {profile.id === "default" && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                Default
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 font-mono mt-0.5 truncate">
            {profile.homePath === "auto" ? "~/.claude (auto)" : profile.homePath}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="px-2 py-1 text-xs text-gray-400 hover:text-amber-600 transition-colors rounded hover:bg-amber-50 dark:hover:bg-amber-950"
          >
            Edit
          </button>
          {profile.id !== "default" &&
            (confirmingDelete ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={onConfirmDelete}
                  className="px-2 py-1 text-xs font-medium text-red-600 hover:text-red-700 transition-colors rounded hover:bg-red-50 dark:hover:bg-red-950"
                >
                  Confirm
                </button>
                <button
                  onClick={onCancelDelete}
                  className="px-2 py-1 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={onRequestDelete}
                className="px-2 py-1 text-xs text-gray-400 hover:text-red-500 transition-colors rounded hover:bg-red-50 dark:hover:bg-red-950"
              >
                Delete
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

function ProfileEditForm({
  profile,
  onSave,
  onCancel,
}: {
  profile: Profile;
  onSave: (name: string, homePath: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(profile.name);
  const [path, setPath] = useState(profile.homePath === "auto" ? "" : profile.homePath);

  return (
    <div className="rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
      <div className="p-3 space-y-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Profile name"
          className="w-full text-[13px] px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-amber-400"
        />
        <input
          type="text"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="/absolute/path/.claude"
          className="w-full text-[13px] font-mono px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-amber-400"
        />
        <div className="flex gap-1.5">
          <button
            onClick={() => {
              if (!name.trim()) return;
              onSave(name.trim(), path.trim() || "auto");
            }}
            className="px-3 py-1 text-xs font-medium rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-colors"
          >
            Save
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfileAddForm({
  onAdd,
  onCancel,
}: {
  onAdd: (name: string, path: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [path, setPath] = useState("");

  return (
    <div className="mt-3 p-3 border border-amber-200 dark:border-amber-800 rounded-lg bg-amber-50/50 dark:bg-amber-950/50 space-y-2">
      <input
        type="text"
        placeholder="Profile name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full text-[13px] px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-amber-400"
        autoFocus
      />
      <input
        type="text"
        placeholder="/absolute/path/.claude"
        value={path}
        onChange={(e) => setPath(e.target.value)}
        className="w-full text-[13px] font-mono px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-amber-400"
      />
      <div className="flex gap-1.5">
        <button
          onClick={() => {
            if (!name.trim() || !path.trim()) return;
            onAdd(name.trim(), path.trim());
          }}
          className="px-3 py-1 text-xs font-medium rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-colors"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
