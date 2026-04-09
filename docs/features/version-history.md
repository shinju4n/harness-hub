# Version History

## Role

Captures every edit to Skills and Agents — whether from harness-hub, Claude Code, or any external tool — as browsable, diffable, restorable snapshots.

## Capabilities

- **Automatic snapshots** on every save through harness-hub
- **Real-time capture** of Claude Code edits via PostToolUse HTTP hook (opt-in)
- **External edit detection** via launch and window-focus rescan
- **Diff comparison** between any two versions (split view, multi-file support)
- **Restore** any version with pre-restore safety snapshot
- **Pin** important versions for easy access
- **Soft delete / Trash** with restore capability
- **Per-profile isolation** — each profile has independent history

## Data Sources

- Skills: `{homePath}/skills/{name}/**` (custom skills only)
- Agents: `{homePath}/agents/{name}.md` (user scope only)
- Version store: `{userData}/versions/{profileId}/`

## API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/version-history` | GET | List/get snapshots, item state |
| `/api/version-history` | POST | Restore, pin/unpin |
| `/api/version-history` | DELETE | Archive profile history |
| `/api/rescan` | POST | Trigger external edit detection |
| `/api/claude-hook` | GET/POST/DELETE | Manage Claude Code hook |

## Key Files

| File | Responsibility |
|---|---|
| `lib/version-store.ts` | Object store, snapshots, state persistence |
| `lib/versioned-write.ts` | Write flow with mutex and drift detection |
| `lib/external-rescan.ts` | External edit detection walker |
| `lib/claude-hook-installer.ts` | Claude Code PostToolUse hook management |
| `stores/version-history-store.ts` | UI state (Zustand) |
| `components/version-history-panel.tsx` | History panel UI |
| `components/version-diff-view.tsx` | Diff viewer |
| `components/external-edit-banner.tsx` | External edit notification |
| `components/trash-section.tsx` | Deleted items section |
