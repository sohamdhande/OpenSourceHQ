# OpenSourceHQ UI/UX system

This design system is informed by established developer-product patterns. It is an original OpenSourceHQ system, not a visual copy of another product.

## Reference products and principles

- [GitHub Primer](https://primer.style/) is the reference for clear repository-oriented information architecture, semantic components, predictable controls, and accessible status treatments.
- [Primer accessibility guidance](https://primer.style/accessibility/) informs keyboard operation, visible focus, contrast, labeling, and layouts that remain usable when color or pointer input is unavailable.
- [Vercel Geist](https://vercel.com/geist) informs the restrained developer-tool visual language: precise typography, disciplined spacing, quiet surfaces, readable data density, and strong contrast.
- [Vercel Web Interface Guidelines](https://vercel.com/design/guidelines) informs interaction details: loading, empty and error states, focus order, touch targets, and consistent behavior.
- [Linear](https://linear.app/) informs the calm workspace hierarchy: the work surface receives attention while navigation and chrome recede; efficient density should not become visual noise.

## Product principles

1. Make the next action obvious. Each view has one primary action; secondary actions are visually quieter and destructive actions are separated.
2. Show real state, not decorative metrics. Numbers, charts, repository activity, and status labels must come from the current organization and the active member's permitted scope. Demo fixtures must be visibly identified and never mixed into verified activity.
3. Design every state. Every data-driven view needs loading, empty, populated, stale, permission-denied, validation, success, and recoverable-error states where relevant.
4. Preserve context. A member should see which organization, cohort, repository, task, or report an action affects before submitting it.
5. Keep navigation predictable. Role-specific navigation should expose only routes for that role; active location, labels, and keyboard focus must remain clear at every breakpoint.
6. Prefer progressive disclosure. Put the essential summary first; reveal evidence, audit details, advanced filters, and secondary metadata when needed.
7. Never make color carry meaning alone. Use a text label and, where useful, an icon with the color.
8. Keep forms recoverable. Preserve input when a request fails, show field-level validation, prevent duplicate submissions, and confirm whether the primary record or a related side-effect was saved.

## Visual system

- Canvas: a soft neutral background, not a full-screen gradient. Cards use a clear surface and a subtle border; shadows are reserved for floating or elevated elements.
- Accent: indigo is reserved for primary actions, selected states, and focus. Success uses green, warnings use amber, and destructive states use red with explicit labels.
- Typography: system UI/Inter-style sans serif; one page title, clear section titles, quiet metadata, and tabular numerals for counts and durations.
- Spacing: use a consistent 4-point rhythm. Prefer 16–24 px internal card padding and 24–36 px between major sections.
- Shape: 8–12 px control/card radius; large rounded corners only for distinct feature panels, not every nested element.
- Motion: short, low-amplitude transitions for hover and expansion. Never animate status-critical information continuously.
- Density: dashboards may be information-dense, but keep metric tiles short, tables scan-friendly, and secondary metadata subdued.
- Responsive behavior: preserve task completion on narrow screens. Tables may become stacked rows or horizontal scrollers; controls remain touchable; input text is at least 16 px on touch devices.

## Shared interaction requirements

- Buttons have clear verbs (`Save draft`, `Submit report`, `Request changes`, `Approve`, `Remove repository`). Avoid ambiguous `OK` or icon-only controls without accessible names.
- Every link and button has a visible keyboard-focus treatment. Dialogs move focus in, trap it while open, close on Escape when appropriate, and restore focus to the opener.
- Form controls have a programmatic label. Validation text is associated with the field and announced as an error.
- Search supports keyboard submission, loading, no results, rate-limit errors, and an explicit clear/retry path.
- Destructive actions explain what will be removed and preserve unrelated work.
- Timestamps are shown consistently with the active product timezone or clearly labeled UTC. Calendar dates must not shift because a browser parses a date-only string as a local instant.

## Role workspaces

### Mentee

The dashboard prioritizes today's report, assigned tasks, review feedback, upcoming events, and blockers. Repository discovery is available from the repository workspace and the profile repository tab. A mentee may select any public GitHub repository, including repositories owned by OpenMRS, Sugar Labs, or another public GitHub organization; they are not restricted to an administrator-preloaded list. Each choice has a primary-focus state, sync status, and clear removal action.

### Mentor

The mentor workspace prioritizes assigned mentees, pending report/task/milestone reviews, open blockers, assigned cohorts, and upcoming cohort sessions. Mentors can select repositories for their own workspace and can select/assign repositories for a mentee only when they share an active cohort assignment. The same repository search and selection interaction is used in both locations.

### Organization administrator

The admin workspace prioritizes program health, access management, cohort setup, assignment, repository policy, events, integration health, and audit history. Administrative pages should provide filters and bulk operations without exposing unnecessary authentication data.

### Observer

Observer pages are read-only and aggregate-only. They should not surface individual daily reports, evidence submissions, blocker descriptions, private feedback, or member credentials.

## Repository discovery experience

1. Start with a search field that accepts `owner/repository`, a GitHub URL, a project/organization query, or GitHub search syntax.
2. Keep useful shortcuts visible: OpenMRS (`org:openmrs`), Sugar Labs (`org:sugarlabs`), and good-first-issue discovery.
3. Result cards show the owner, repository name, concise description, visibility, language, stars, forks, and default branch. The repository link opens GitHub in a new tab.
4. The primary action adds the repository to the current member's organization-scoped list. The list is independent for each member; a mentor's choice does not silently become a mentee's choice.
5. Let the member select one primary repository. There must be no more than one primary repository per member per organization.
6. Explain access honestly: public metadata/activity can be polled without a personal access token; private repository access requires a GitHub App installation on the repository owner's account with the repository granted.
7. Explain polling limits and the time of last successful sync. Do not imply real-time webhook coverage for public repositories whose owners have not installed the app.

## Components already updated

- `src/app/globals.css`: neutral light/dark surfaces, consistent focus, mobile text-size behavior, skip-link styling, and reusable repository/dashboard surfaces.
- `src/components/layout/sidebar.tsx`: accessible primary-navigation labels and current-page state.
- `src/components/layout/topbar.tsx`: semantic quick-action link and keyboard-managed workspace search dialog.
- `src/components/ui/input.tsx`: generated stable IDs, labels, and linked validation text.
- `src/components/repositories/member-repositories-client.tsx`: shared repository search/selection for mentee, mentor, and mentor-managed mentee views.

## Review checklist

Before accepting a UI change, verify keyboard-only completion, visible focus, screen-reader names, 320 px reflow, dark and light themes, empty/loading/error/success states, correct organization scope, and no placeholder/demo data in live views.
