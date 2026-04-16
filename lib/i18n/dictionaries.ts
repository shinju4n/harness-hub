import "server-only";

import type { Locale } from "./config";

const dictionaries = {
  en: {
    login: {
      title: "Harness Hub",
      subtitle: "Sign in to continue",
      username: "Username",
      password: "Password",
      submit: "Sign in",
      submitting: "Signing in...",
      loginFailed: "Login failed",
      networkError: "Network error",
    },
    dashboard: {
      title: "Dashboard",
      subtitle: "Overview of your Claude Code harness",
      quickShortcutsTitle: "Quick shortcuts",
      quickShortcutsDescription:
        "Pop a terminal anywhere in the app, or jump to anything by name.",
      customize: "Customize",
      toggleTerminal: "Toggle terminal",
      toggleTerminalDescription:
        "Slide-up dock with a real shell. Click the badge or press the shortcut from any page.",
      commandPalette: "Command palette",
      commandPaletteDescription:
        "Search across pages, agents, plans, hook scripts, sessions, and history.",
      configLoadFailed: "Failed to load configuration",
      tryAgain: "Try again",
      live: "Live",
      activeCount: "{count} active",
      claudeMdFound: "Detected",
      claudeMdMissing: "—",
    },
    sidebar: {
      shortcutsSearch: "search",
      shortcutsTerminal: "terminal",
      themeTitle: "Theme: {theme} (click to cycle)",
      themeAriaLabel: "Switch theme (current: {theme})",
      unsavedTitle: "Unsaved changes will be lost",
      unsavedMessage:
        "Switching profiles reloads the app. Save your edits first if you want to keep them.",
      unsavedConfirm: "Switch anyway",
      switchProfile: "Switch profile",
      autoProfileSuffix: "~/.claude (auto)",
      removeProfile: "Remove profile {name}",
      profileNamePlaceholder: "Profile name",
      profileNameAriaLabel: "Profile name",
      profilePathAriaLabel: "Profile path",
      browseFolder: "Browse for folder",
      profileFallbackName: "Profile",
      save: "Save",
      cancel: "Cancel",
      addProfile: "+ Add Profile",
      openNavigationMenu: "Open navigation menu",
      primaryNavigation: "Primary navigation",
      menu: "Menu",
      dragToReorder: "drag to reorder",
      dragToReorderTitle: "Drag to reorder",
      appTagline: "Claude Code Harness Manager",
    },
  },
  ko: {
    login: {
      title: "Harness Hub",
      subtitle: "계속하려면 로그인하세요",
      username: "사용자 이름",
      password: "비밀번호",
      submit: "로그인",
      submitting: "로그인 중...",
      loginFailed: "로그인에 실패했습니다",
      networkError: "네트워크 오류",
    },
    dashboard: {
      title: "Dashboard",
      subtitle: "Claude Code harness 개요",
      quickShortcutsTitle: "빠른 단축키",
      quickShortcutsDescription:
        "앱 어디서든 terminal을 열거나, 이름으로 원하는 항목으로 바로 이동할 수 있습니다.",
      customize: "설정",
      toggleTerminal: "Terminal 열기/닫기",
      toggleTerminalDescription:
        "실제 shell이 연결된 하단 dock입니다. 아무 페이지에서나 배지를 클릭하거나 단축키를 누르세요.",
      commandPalette: "Command palette",
      commandPaletteDescription:
        "페이지, agents, plans, hook scripts, sessions, history를 한 번에 검색합니다.",
      configLoadFailed: "구성을 불러오지 못했습니다",
      tryAgain: "다시 시도",
      live: "실시간",
      activeCount: "{count} active",
      claudeMdFound: "감지됨",
      claudeMdMissing: "—",
    },
    sidebar: {
      shortcutsSearch: "검색",
      shortcutsTerminal: "terminal",
      themeTitle: "테마: {theme} (클릭해서 변경)",
      themeAriaLabel: "테마 전환 (현재: {theme})",
      unsavedTitle: "저장하지 않은 변경 사항이 사라집니다",
      unsavedMessage:
        "프로필을 바꾸면 앱이 다시 로드됩니다. 변경 내용을 유지하려면 먼저 저장하세요.",
      unsavedConfirm: "그래도 전환",
      switchProfile: "프로필 전환",
      autoProfileSuffix: "~/.claude (자동)",
      removeProfile: "프로필 제거: {name}",
      profileNamePlaceholder: "프로필 이름",
      profileNameAriaLabel: "프로필 이름",
      profilePathAriaLabel: "프로필 경로",
      browseFolder: "폴더 찾기",
      profileFallbackName: "프로필",
      save: "저장",
      cancel: "취소",
      addProfile: "+ 프로필 추가",
      openNavigationMenu: "탐색 메뉴 열기",
      primaryNavigation: "기본 탐색",
      menu: "메뉴",
      dragToReorder: "드래그해서 순서 변경",
      dragToReorderTitle: "드래그해서 순서 변경",
      appTagline: "Claude Code Harness Manager",
    },
  },
} as const;

export type Dictionary = (typeof dictionaries)[Locale];

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return dictionaries[locale];
}
