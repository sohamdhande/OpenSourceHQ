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
