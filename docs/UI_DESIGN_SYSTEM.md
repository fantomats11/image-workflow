# Workflow UI Design System

## Direction

Workflow is an operational production tool, not a marketing site. The UI should feel dense, calm, and easy to scan while still having enough craft to build trust.

Reference direction from 21st.dev:

- Use reusable component primitives instead of one-off UI: [21st Components](https://21st.dev/community/components).
- Favor minimal, modern, customizable page patterns: [21st Templates](https://21st.dev/community/templates).
- Treat agent/workflow surfaces as first-class UI, with clear state, action history, and review gates: [21st Agents](https://21st.dev/community/agents).
- Keep the product craft standard high, following the 21st Labs direction of tools for teams who ship fast and care about craft: [21st-dev GitHub](https://github.com/21st-dev).

## Product Principles

- Review pages prioritize image comparison over decoration.
- LINE is a notification surface; web review pages are the decision surface.
- Actions must show where state is recorded.
- Cards are for repeated items or bounded tools, not nested page decoration.
- Operational pages should use compact headings, stable controls, and visible status.

## Tokens

- Radius: 6-10px, default 8px.
- Spacing: 4, 8, 12, 16, 20, 24, 32.
- Primary action: red brand accent for irreversible/approval actions.
- Secondary action: teal/blue for retry or regenerate actions.
- Success/warning/danger/info states must use both background and border changes.
- Avoid single-hue screens; combine neutral surfaces with red, teal, green, and amber states.

## Core Components

- `panel`: bounded workspace area.
- `section-note`: compact contextual status or guidance.
- `status-pill` / `workflow-status`: high-signal state badges.
- `review-image-tile`: reference image card with visible filename.
- `review-hero-frame`: primary candidate image frame.
- `review-decision-dock`: local decision controls; never rendered in LINE.
- `primary-button`: approval/commit action.
- `secondary-button`: retry/regenerate action.
- `ghost-button`: neutral utility action.

## Hero Review Pattern

Hero Review uses a two-column comparison layout on desktop:

- Left: Reference Set, image cards, filename visible.
- Right: Hero Candidate, large image, checklist, action dock.
- The action dock must not overlap the hero image.
- Mobile stacks in this order: brief, reference set, hero candidate, checklist, actions.

## Next UI Phases

- Apply the same component rules to Create Job form.
- Replace long forms with compact grouped sections and clearer upload states.
- Improve Jobs/Assets tables with status-first rows and visible production state.
- Add a Design System preview page only after components stabilize.
