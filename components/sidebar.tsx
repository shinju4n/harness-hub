"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppSettingsStore, formatHotkey } from "@/stores/app-settings-store";
import { useUnsavedStore } from "@/stores/unsaved-store";
import { FolderPicker } from "@/components/folder-picker";
import { LoadingOverlay } from "@/components/loading-overlay";
import { useConfirm } from "@/components/confirm-dialog";
import {
  formatI18nText,
  useDictionary,
  useLocale,
} from "@/components/i18n-provider";
import {
  localizePathname,
  stripLocaleFromPathname,
} from "@/lib/i18n/config";

const DEFAULT_NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "grid" },
  { href: "/plugins", label: "Plugins", icon: "puzzle" },
  { href: "/skills", label: "Skills", icon: "sparkle" },
  { href: "/commands", label: "Commands", icon: "terminal" },
  { href: "/hooks", label: "Hooks", icon: "hook" },
  { href: "/mcp", label: "MCP", icon: "server" },
  { href: "/agents", label: "Agents", icon: "agent" },
  { href: "/rules", label: "Rules", icon: "shield" },
  { href: "/memory", label: "Memory", icon: "brain" },
  { href: "/sessions", label: "Sessions", icon: "activity" },
  { href: "/plans", label: "Plans", icon: "clipboard" },
  { href: "/history", label: "History", icon: "history" },
  { href: "/images", label: "Images", icon: "image" },
  { href: "/keybindings", label: "Keybindings", icon: "keyboard" },
  { href: "/claude-md", label: "CLAUDE.md", icon: "fileText" },
  { href: "/settings", label: "Settings", icon: "gear" },
  { href: "/app-settings", label: "App Settings", icon: "sliders" },
];

const icons: Record<string, React.ReactNode> = {
  grid: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  puzzle: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15.5 2H18a2 2 0 0 1 2 2v2.5M9 2H6a2 2 0 0 0-2 2v3a2 2 0 0 1-2 2v2a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2h3a2 2 0 0 1 2 2v0a2 2 0 0 1 2-2h3a2 2 0 0 0 2-2v-3a2 2 0 0 1 2-2v-2a2 2 0 0 1-2-2V4a2 2 0 0 0-2-2h-2.5a2 2 0 0 1-2 2v0a2 2 0 0 1-2-2"/></svg>,
  sparkle: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275z"/></svg>,
  terminal: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>,
  hook: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 1-6 6H4"/><path d="m4 10 4 4-4 4"/></svg>,
  server: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><circle cx="6" cy="6" r="1"/><circle cx="6" cy="18" r="1"/></svg>,
  shield: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>,
  brain: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M19.938 10.5a4 4 0 0 1 .585.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M19.967 17.484A4 4 0 0 1 18 18"/></svg>,
  keyboard: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.001"/><path d="M10 8h.001"/><path d="M14 8h.001"/><path d="M18 8h.001"/><path d="M6 12h.001"/><path d="M10 12h.001"/><path d="M14 12h.001"/><path d="M18 12h.001"/><path d="M8 16h8"/></svg>,
  agent: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"/><rect x="8" y="8" width="8" height="8" rx="2"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="m17.66 6.34 1.41-1.41"/><path d="m4.93 19.07 1.41-1.41"/></svg>,
  sliders: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>,
  activity: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  clipboard: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6"/><path d="M9 16h6"/></svg>,
  history: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l3 2"/></svg>,
  image: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>,
  gear: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>,
  fileText: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>,
};

/**
 * Footer hint that surfaces the two app-wide shortcuts (palette + terminal)
 * so the user discovers them without opening App Settings. The terminal
 * label is rendered live from the persisted hotkey so a rebind is reflected
 * immediately.
 */
function SidebarShortcutsHint() {
  const dictionary = useDictionary();
  const hotkey = useAppSettingsStore((s) => s.terminalHotkey);
  const terminalLabel = formatHotkey(hotkey);
  return (
    <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500">
      <span className="flex items-center gap-1">
        <kbd className="font-mono bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5">⌘K</kbd>
        <span>{dictionary.sidebar.shortcutsSearch}</span>
      </span>
      <span className="flex items-center gap-1">
        <kbd className="font-mono bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5">{terminalLabel}</kbd>
        <span>{dictionary.sidebar.shortcutsTerminal}</span>
      </span>
    </div>
  );
}

function ThemeToggleButton() {
  const dictionary = useDictionary();
  const { theme, setTheme } = useAppSettingsStore();

  const cycleTheme = () => {
    if (theme === "system") setTheme("light");
    else if (theme === "light") setTheme("dark");
    else setTheme("system");
  };

  return (
    <button
      onClick={cycleTheme}
      title={formatI18nText(dictionary.sidebar.themeTitle, { theme })}
      aria-label={formatI18nText(dictionary.sidebar.themeAriaLabel, { theme })}
      className="p-1.5 rounded-md text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
    >
      {theme === "dark" ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
      ) : theme === "light" ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
      )}
    </button>
  );
}

function getOrderedItems(navOrder: string[] | null) {
  if (!navOrder) return DEFAULT_NAV_ITEMS;
  const itemMap = new Map(DEFAULT_NAV_ITEMS.map((item) => [item.href, item]));
  const ordered = navOrder
    .map((href) => itemMap.get(href))
    .filter((item): item is (typeof DEFAULT_NAV_ITEMS)[0] => !!item);
  // Append any new items not in saved order
  for (const item of DEFAULT_NAV_ITEMS) {
    if (!navOrder.includes(item.href)) ordered.push(item);
  }
  return ordered;
}

function ProfileDropdown() {
  const dictionary = useDictionary();
  const { profiles, activeProfileId, setActiveProfile, addProfile, removeProfile, getActiveProfile } = useAppSettingsStore();
  const { hasUnsaved } = useUnsavedStore();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPath, setNewPath] = useState("");
  const [showBrowse, setShowBrowse] = useState(false);
  const router = useRouter();
  const [switching, setSwitching] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Hydration guard for SSR/client mismatch on profile display.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);

  const activeProfile = getActiveProfile();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      // Don't close if clicking inside folder picker portal
      const target = e.target as HTMLElement;
      if (target.closest("[data-folder-picker]")) return;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setDropdownOpen(false);
        setShowAddForm(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  const handleProfileSelect = async (id: string) => {
    if (id === activeProfileId) { setDropdownOpen(false); return; }
    if (hasUnsaved()) {
      const ok = await confirm({
        title: dictionary.sidebar.unsavedTitle,
        message: dictionary.sidebar.unsavedMessage,
        confirmLabel: dictionary.sidebar.unsavedConfirm,
        tone: "danger",
      });
      if (!ok) return;
    }
    setActiveProfile(id);
    setDropdownOpen(false);
    setSwitching(true);
    // Dispatch a profile-changed event so polling hooks re-fetch immediately
    window.dispatchEvent(new CustomEvent("profile-changed", { detail: { profileId: id } }));
    // Soft refresh via Next.js router — re-runs server components without full reload
    await router.refresh();
    setSwitching(false);
  };

  const handleAdd = () => {
    if (!newName.trim() || !newPath.trim()) return;
    addProfile(newName.trim(), newPath.trim());
    setNewName("");
    setNewPath("");
    setShowAddForm(false);
  };

  const handleRemove = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    removeProfile(id);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {switching && <LoadingOverlay />}
      {confirmDialog}
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        aria-label={dictionary.sidebar.switchProfile}
        aria-expanded={dropdownOpen}
        aria-haspopup="menu"
        className="w-full text-left px-5 py-4 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors group focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-inset"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 512 512" fill="none">
                <circle cx="256" cy="256" r="120" stroke="white" strokeWidth="28" opacity="0.3"/>
                <circle cx="256" cy="256" r="44" fill="white"/>
                <line x1="256" y1="212" x2="256" y2="120" stroke="white" strokeWidth="22" strokeLinecap="round"/>
                <line x1="256" y1="300" x2="256" y2="392" stroke="white" strokeWidth="22" strokeLinecap="round"/>
                <line x1="212" y1="256" x2="120" y2="256" stroke="white" strokeWidth="22" strokeLinecap="round"/>
                <line x1="300" y1="256" x2="392" y2="256" stroke="white" strokeWidth="22" strokeLinecap="round"/>
                <circle cx="256" cy="108" r="24" fill="white"/>
                <circle cx="256" cy="404" r="24" fill="white"/>
                <circle cx="108" cy="256" r="24" fill="white"/>
                <circle cx="404" cy="256" r="24" fill="white"/>
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100 tracking-tight leading-tight">Harness Hub</h1>
              <p className="text-[11px] text-amber-600 font-medium mt-0.5 truncate leading-tight" suppressHydrationWarning>{mounted ? activeProfile.name : "\u00A0"}</p>
            </div>
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`shrink-0 ml-2 text-gray-400 dark:text-gray-500 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
          >
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </div>
      </button>

      {dropdownOpen && (
        <div className="absolute left-0 right-0 top-full z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-b-xl shadow-lg overflow-hidden">
          <div className="py-1">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className="flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors group/item"
                onClick={() => handleProfileSelect(profile.id)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-gray-800 dark:text-gray-200 truncate">{profile.name}</p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 font-mono truncate">
                    {profile.homePath === "auto"
                      ? dictionary.sidebar.autoProfileSuffix
                      : profile.homePath}
                  </p>
                </div>
                {profile.id === activeProfileId && (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-amber-500 shrink-0">
                    <path d="M20 6 9 17l-5-5"/>
                  </svg>
                )}
                {profile.id !== "default" && (
                  <button
                    onClick={(e) => handleRemove(e, profile.id)}
                    className="opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100 shrink-0 text-gray-300 dark:text-gray-600 hover:text-red-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded"
                    title={formatI18nText(dictionary.sidebar.removeProfile, {
                      name: profile.name,
                    })}
                    aria-label={formatI18nText(dictionary.sidebar.removeProfile, {
                      name: profile.name,
                    })}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800">
            {showAddForm ? (
              <div className="p-3 space-y-2">
                <input
                  type="text"
                  placeholder={dictionary.sidebar.profileNamePlaceholder}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full text-[12px] px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
                  autoFocus
                  aria-label={dictionary.sidebar.profileNameAriaLabel}
                />
                <div className="flex gap-1">
                  <input
                    type="text"
                    placeholder="/absolute/path/.claude"
                    value={newPath}
                    onChange={(e) => setNewPath(e.target.value)}
                    className="flex-1 text-[12px] font-mono px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
                    onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                    aria-label={dictionary.sidebar.profilePathAriaLabel}
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowBrowse(true); }}
                    className="shrink-0 px-2 py-1.5 text-[11px] rounded-md border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                    title={dictionary.sidebar.browseFolder}
                    aria-label={dictionary.sidebar.browseFolder}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
                  </button>
                </div>
                {showBrowse && (
                  <FolderPicker
                    onSelect={(p) => {
                      // Auto-generate name from folder path
                      const name =
                        newName.trim() ||
                        p.split("/").filter(Boolean).pop() ||
                        dictionary.sidebar.profileFallbackName;
                      addProfile(name, p);
                      setShowBrowse(false);
                      setShowAddForm(false);
                      setNewName("");
                      setNewPath("");
                      setDropdownOpen(false);
                    }}
                    onClose={() => setShowBrowse(false)}
                  />
                )}
                <div className="flex gap-1.5">
                  <button
                    onClick={handleAdd}
                    className="flex-1 py-1 text-xs font-medium rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                  >
                    {dictionary.sidebar.save}
                  </button>
                  <button
                    onClick={() => { setShowAddForm(false); setNewName(""); setNewPath(""); }}
                    className="flex-1 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  >
                    {dictionary.sidebar.cancel}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setShowAddForm(true); }}
                className="w-full px-4 py-2.5 text-[13px] text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950 transition-colors text-left"
              >
                {dictionary.sidebar.addProfile}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const dictionary = useDictionary();
  const locale = useLocale();
  const pathname = usePathname();
  const activePathname = stripLocaleFromPathname(pathname);
  const [open, setOpen] = useState(false);
  const { navOrder, setNavOrder, sidebarCollapsed } = useAppSettingsStore();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const dragNodeRef = useRef<HTMLElement | null>(null);

  const items = getOrderedItems(navOrder);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index);
    dragNodeRef.current = e.currentTarget as HTMLElement;
    e.dataTransfer.effectAllowed = "move";
    // Make drag image semi-transparent
    requestAnimationFrame(() => {
      if (dragNodeRef.current) dragNodeRef.current.style.opacity = "0.4";
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragNodeRef.current) dragNodeRef.current.style.opacity = "1";
    if (dragIndex !== null && overIndex !== null && dragIndex !== overIndex) {
      const newItems = [...items];
      const [moved] = newItems.splice(dragIndex, 1);
      newItems.splice(overIndex, 0, moved);
      setNavOrder(newItems.map((item) => item.href));
    }
    setDragIndex(null);
    setOverIndex(null);
    dragNodeRef.current = null;
  }, [dragIndex, overIndex, items, setNavOrder]);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverIndex(index);
  }, []);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setOpen(true)}
        className={`fixed top-3 left-3 z-50 p-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${sidebarCollapsed ? "" : "lg:hidden"}`}
        aria-label={dictionary.sidebar.openNavigationMenu}
        aria-expanded={open}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>

      {/* Overlay */}
      {open && (
        <div
          className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-40 ${sidebarCollapsed ? "" : "lg:hidden"}`}
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        aria-label={dictionary.sidebar.primaryNavigation}
        className={`fixed inset-y-0 left-0 z-40 w-60 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col transition-transform duration-200 ease-in-out ${sidebarCollapsed ? "" : "lg:static lg:translate-x-0"} ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <ProfileDropdown />

        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          <p className="px-3 pb-1 text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 select-none">
            {dictionary.sidebar.menu} <span className="text-gray-300 dark:text-gray-600 normal-case tracking-normal">· {dictionary.sidebar.dragToReorder}</span>
          </p>
          {items.map((item, index) => {
            const active = activePathname === item.href;
            const isOver = overIndex === index && dragIndex !== null && dragIndex !== index;
            const isDragging = dragIndex === index;
            return (
              <Link
                key={item.href}
                href={localizePathname(item.href, locale)}
                draggable
                aria-current={active ? "page" : undefined}
                title={dictionary.sidebar.dragToReorderTitle}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, index)}
                onClick={() => setOpen(false)}
                className={`group relative flex items-center gap-2 pl-1.5 pr-3 py-2.5 rounded-lg text-[13px] transition-colors cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                  active
                    ? "bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-medium"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100"
                } ${isOver ? "border-t-2 border-amber-400" : "border-t-2 border-transparent"} ${isDragging ? "opacity-40" : ""}`}
              >
                <span
                  aria-hidden="true"
                  className="shrink-0 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
                    <circle cx="2" cy="3" r="1.2"/><circle cx="8" cy="3" r="1.2"/>
                    <circle cx="2" cy="8" r="1.2"/><circle cx="8" cy="8" r="1.2"/>
                    <circle cx="2" cy="13" r="1.2"/><circle cx="8" cy="13" r="1.2"/>
                  </svg>
                </span>
                <span className={active ? "text-amber-600 dark:text-amber-400" : "text-gray-400 dark:text-gray-500"} aria-hidden="true">{icons[item.icon]}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
          <SidebarShortcutsHint />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-400 dark:text-gray-500">{dictionary.sidebar.appTagline}</span>
            <ThemeToggleButton />
          </div>
        </div>
      </aside>
    </>
  );
}
