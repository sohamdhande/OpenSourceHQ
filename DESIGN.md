# OpenSourceHQ design contract

OpenSourceHQ is a professional multi-tenant open-source mentorship workspace. The interface should feel like a focused engineering product: calm, precise, data-led, and accessible. Navigation recedes; member work and decisions remain prominent.

## Stack

- Next.js 14 App Router and React 18
- TypeScript
- Tailwind CSS 3.4 with CSS custom properties
- Local UI primitives under `src/components/ui/`
- Lucide icons

## Visual direction

Use a restrained neutral canvas, crisp cards, hairline borders, controlled indigo emphasis, and semantic status colors. Avoid full-screen neon gradients, excessive glow, nested glass effects, or gamification that distracts from the actual program workflow. Light and dark modes must preserve contrast and the same information hierarchy.

## Interaction contract

- Use meaningful verbs for actions and distinguish primary from secondary actions.
- Every form must include labels, validation, loading/disabled states, and an explicit success or failure result.
- Every data view must provide loading, empty, and error states.
- Keyboard navigation and visible focus are required; dialogs must manage focus.
- Status must not be communicated by color alone.
- Do not display fixture data as live or verified GitHub activity.
- Respect organization, cohort, and role scopes on both server and client.

## Product-specific patterns

- Role-based workspaces have different navigation and capabilities for administrators, mentors, mentees, and observers.
- Mentors and mentees can independently choose public GitHub repositories from any GitHub owner/organization. Mentors can also assign a repository to a mentee within an active assigned cohort.
- Repository selections are organization-scoped and member-scoped. Each member has at most one primary selection in an organization.
- Public repository tracking uses the public GitHub API and periodic polling. Private repository tracking requires an authorized GitHub App installation.
- Observers see only approved organization-level aggregates and updates.

## Detailed reference

See [`docs/UI_UX_REFERENCE_AND_SYSTEM.md`](docs/UI_UX_REFERENCE_AND_SYSTEM.md) for design inspirations, component rules, role-specific layouts, and the repository discovery journey.

## Components (Self-Tracking Glassy-Black System)

- `SelfTrackingOnboardingModal` (`src/components/self-tracking/self-tracking-onboarding-modal.tsx`) — Full-screen glassy-black opt-in modal (`bg-black/80 backdrop-blur-xl`, `bg-zinc-950/90`, `border-white/10`).
- `SelfTrackingLayout` (`src/app/org/[orgSlug]/self/layout.tsx`) & `.self-glass-theme` / `.self-glass-surface` (`src/app/globals.css`) — Scoped obsidian glassy-black token system (`#050507` canvas, `rgba(255,255,255,0.03)` translucent cards, `backdrop-filter: blur(20px)`, layered inset+ambient shadows, and `prefers-reduced-motion` guard).
- `SelfTrackingLoading` (`src/app/org/[orgSlug]/self/loading.tsx`) — Skeleton loader matching the self-tracking dashboard geometry.

## Decisions

- 2026-11-27 — Added scoped `.self-glass-theme` CSS custom properties in `src/app/globals.css` so the `/org/[orgSlug]/self/*` personal workspace renders in full glassy-black obsidian across both new and reused components (`GitHubCommandCenter`, `MemberRepositoriesClient`, `ActivityTimeline`) without altering admin, mentor, or mentee workspace themes.
- 2026-11-27 — Extended glassmorphism (`AppShellFrame` in `src/components/layout/app-shell-frame.tsx`, `Sidebar`, `Topbar`, `blur(24px) saturate(160%)`, specular top highlights, and ambient depth orbs) across the entire `/self/*` shell.
