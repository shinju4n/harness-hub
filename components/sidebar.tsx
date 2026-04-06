"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useCallback, useEffect } from "react";
import { useAppSettingsStore } from "@/stores/app-settings-store";
import { FolderPicker } from "@/components/folder-picker";
import { LoadingOverlay } from "@/components/loading-overlay";

const DEFAULT_NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "grid" },
  { href: "/plugins", label: "Plugins", icon: "puzzle" },
  { href: "/skills", label: "Skills", icon: "sparkle" },
  { href: "/commands", label: "Commands", icon: "terminal" },
  { href: "/hooks", label: "Hooks", icon: "hook" },
  { href: "/mcp", label: "MCP", icon: "server" },
  { href: "/agents", label: "Agents", icon: "agent" },
  { href: "/rules", label: "Rules", icon: "shield" },
  { href: "/keybindings", label: "Keybindings", icon: "keyboard" },
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
  keyboard: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.001"/><path d="M10 8h.001"/><path d="M14 8h.001"/><path d="M18 8h.001"/><path d="M6 12h.001"/><path d="M10 12h.001"/><path d="M14 12h.001"/><path d="M18 12h.001"/><path d="M8 16h8"/></svg>,
  agent: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"/><rect x="8" y="8" width="8" height="8" rx="2"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="m17.66 6.34 1.41-1.41"/><path d="m4.93 19.07 1.41-1.41"/></svg>,
  sliders: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>,
  gear: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>,
};

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
  const { profiles, activeProfileId, setActiveProfile, addProfile, removeProfile, getActiveProfile } = useAppSettingsStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPath, setNewPath] = useState("");
  const [showBrowse, setShowBrowse] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const handleProfileSelect = (id: string) => {
    if (id === activeProfileId) { setDropdownOpen(false); return; }
    setActiveProfile(id);
    setDropdownOpen(false);
    setSwitching(true);
    setTimeout(() => window.location.reload(), 300);
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
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="w-full text-left px-5 py-4 border-b border-gray-100 hover:bg-gray-50/50 transition-colors group"
      >
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-gray-900 tracking-tight">Harness Hub</h1>
            <p className="text-xs text-amber-600 font-medium mt-0.5 truncate" suppressHydrationWarning>{mounted ? activeProfile.name : "\u00A0"}</p>
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`shrink-0 ml-2 text-gray-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
          >
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </div>
      </button>

      {dropdownOpen && (
        <div className="absolute left-0 right-0 top-full z-50 bg-white border border-gray-200 rounded-b-xl shadow-lg overflow-hidden">
          <div className="py-1">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className="flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors group/item"
                onClick={() => handleProfileSelect(profile.id)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-gray-800 truncate">{profile.name}</p>
                  <p className="text-[11px] text-gray-400 font-mono truncate">
                    {profile.homePath === "auto" ? "~/.claude (auto)" : profile.homePath}
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
                    className="opacity-0 group-hover/item:opacity-100 shrink-0 text-gray-300 hover:text-red-500 transition-all"
                    title="Remove profile"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100">
            {showAddForm ? (
              <div className="p-3 space-y-2">
                <input
                  type="text"
                  placeholder="Profile name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full text-[12px] px-2.5 py-1.5 rounded-md border border-gray-200 bg-white focus:outline-none focus:border-amber-400"
                  autoFocus
                />
                <div className="flex gap-1">
                  <input
                    type="text"
                    placeholder="/absolute/path/.claude"
                    value={newPath}
                    onChange={(e) => setNewPath(e.target.value)}
                    className="flex-1 text-[12px] font-mono px-2.5 py-1.5 rounded-md border border-gray-200 bg-white focus:outline-none focus:border-amber-400"
                    onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowBrowse(true); }}
                    className="shrink-0 px-2 py-1.5 text-[11px] rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                    title="Browse"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
                  </button>
                </div>
                {showBrowse && (
                  <FolderPicker
                    onSelect={(p) => {
                      // Auto-generate name from folder path
                      const name = newName.trim() || p.split("/").filter(Boolean).pop() || "Profile";
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
                    Save
                  </button>
                  <button
                    onClick={() => { setShowAddForm(false); setNewName(""); setNewPath(""); }}
                    className="flex-1 py-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setShowAddForm(true); }}
                className="w-full px-4 py-2.5 text-[13px] text-amber-600 hover:bg-amber-50 transition-colors text-left"
              >
                + Add Profile
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { navOrder, setNavOrder } = useAppSettingsStore();
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
        className="fixed top-3 left-3 z-50 p-2 rounded-lg bg-white border border-gray-200 shadow-sm lg:hidden"
        aria-label="Open menu"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 border-r border-gray-200 bg-white flex flex-col transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <ProfileDropdown />

        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {items.map((item, index) => {
            const active = pathname === item.href;
            const isOver = overIndex === index && dragIndex !== null && dragIndex !== index;
            return (
              <Link
                key={item.href}
                href={item.href}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, index)}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] transition-all cursor-grab active:cursor-grabbing ${
                  active
                    ? "bg-amber-50 text-amber-800 font-medium"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                } ${isOver ? "border-t-2 border-amber-400" : "border-t-2 border-transparent"}`}
              >
                <span className={active ? "text-amber-600" : "text-gray-400"}>{icons[item.icon]}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-5 py-3 border-t border-gray-100 text-[11px] text-gray-400">
          Claude Code Harness Manager
        </div>
      </aside>
    </>
  );
}
