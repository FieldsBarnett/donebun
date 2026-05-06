# Donebun Design System (Things 3 Inspired)

## Overview

The application strictly adopts the clean, elegant, and highly structured aesthetic of **Things 3**. It eschews heavily stylized SaaS "cards" in favor of edge-to-edge lists, subtle hairlines, and generous whitespace. It uses Apple's system typography to feel deeply native.

**Key Characteristics:**
- **MOBILE FIRST**: Mobile layout drives the core experience, scaling seamlessly to desktop.
- **Canvas & Sidebar**: Pure white (`#ffffff`) main content area. Light gray (`#f5f5f7` or similar) sidebar.
- **Typography**: System fonts exclusively (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`). Clean typographic hierarchy with bold display headers and standard weight lists.
- **Checkboxes**: Distinctive Things-style open circles that become solid when checked or highlighted.
- **Hairlines**: Extremely subtle dividers between task rows (`#ebebeb` or similar).

## Colors

### Brand & Accent
- **Primary Action** (`{colors.primary}`): A vibrant, native-feeling blue (`#007aff` on iOS/macOS) for "Today" badges, active sidebar items, and primary buttons.
- **Yellow** (`{colors.yellow}`): `#ffcc00` (Used for Upcoming/Timeline).
- **Green** (`{colors.green}`): `#34c759` (Used for Logbook/Completed).
- **Family Pastels**: `{colors.badge-orange}`, `{colors.badge-pink}`, `{colors.badge-violet}`, etc., used for identifying family members subtly via small tags or avatars.

### Surface
- **Canvas** (`{colors.canvas}`): `#ffffff` (Pure white for all main task views).
- **Sidebar** (`{colors.surface-sidebar}`): `#f5f5f7` (Very light gray for the navigation sidebar).
- **Hairline** (`{colors.hairline}`): `#ebebeb` (Subtle 1px border for row dividers).
- **Selection** (`{colors.selection}`): `#e3f2fd` or a light blue for selected task rows.

### Text
- **Ink** (`{colors.ink}`): `#000000` or very dark gray for task titles and headers.
- **Muted** (`{colors.muted}`): `#8e8e93` for metadata, tags, and placeholder text.

## Typography
- Entirely system fonts.
- Headers are bold, large, and left-aligned.
- Task rows use standard body text size.

## Layout & Components

### Sidebar (Navigation)
- Distinct icons (Inbox tray, Star for Today, Calendar for Timeline, etc.).
- Active state is typically highlighted in a vibrant blue with a blue icon.

### Task Lists
- Tasks sit directly on the Canvas.
- A subtle hairline separates each task. No borders on the left or right.
- Left side: Checkbox.
- Middle: Title and optional tags.
- Right side: Due date or family assignee avatar.
- Swipe gestures or a long press/3-dot menu reveal quick actions.
