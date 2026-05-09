# DoneBun - Master Specification

**App Name:** DoneBun
**URL:** donebun.app

## 1. Overview
A robust, beautifully designed task management application inspired by **Things 3**, but supercharged with **multi-user family collaboration**. The app allows individuals to manage their personal tasks with the same elegance as Things 3, while seamlessly collaborating with family members on shared responsibilities.

## 2. Technology Stack
*   **Frontend**: React, Tailwind CSS, TanStack Query (for local state and non-Convex APIs). The UI will utilize a **customizable Tailwind theme** driven by **design tokens** (CSS variables) to ensure easy global customization, consistent theming, and simple layout adjustments. The entire architecture and design must be **MOBILE FIRST**.
*   **Native Apps (macOS & iOS)**: Tauri 2.0 (Targeting iOS as the primary platform first, scaling up to macOS).
*   **Backend & Real-time Database**: Convex
*   **Authentication**: Better Auth (with Convex integration)
*   **Email**: Resend

## 3. Core Features (Things 3 Parity)
The application will replicate the core organizational structure and elegant UX of Things 3:

*   **Dashboard (Default View)**: A centralized daily hub showing:
    *   A quick input field for entering new tasks.
    *   Items due today.
    *   Unscheduled items.
*   **Core Views**:
    *   **Timeline**: A Google Calendar-style **Agenda View** that displays tasks and calendar events together in a single chronological, scrollable list. Key behaviors:
        *   Starts at **today** on load (always visible, even if empty).
        *   Only days that have at least one scheduled task or calendar event are shown — no empty day noise.
        *   Users can scroll **up** to see past days (yesterday and earlier) and **down** into future days.
        *   **All-day / no-time task items** appear at the **top** of their day section.
        *   **Timed task items** (tasks with a specific time component in their due date) appear inline at their specific time, sorted chronologically alongside calendar events.
        *   **Calendar events** are visually distinct from tasks (calendar icon instead of a checkbox, color-coded by assignee).
        *   Supports **deep linking** to a specific date via the `?date=YYYY-MM-DD` query parameter, which scrolls the view to that day and highlights it.
    *   **Calendar View**: A dedicated, full-screen calendar interface (**Week and Month views only** — no Day view) similar to Google Calendar, plotting both tasks and synced events. Clicking any day in the calendar navigates to that day in the **Timeline** (deep link via `?date=YYYY-MM-DD`).
        *   **Month View**: Features a **continuous vertical scroll** (spanning 3 months past to 6 months future) instead of traditional pagination. The start of each month is visually indicated with a stronger left border on the 1st day.
        *   **Week View**: Features a **continuous horizontal scroll** across the same date range. Day headers (`sticky` at the top) and the time indicator column (`sticky` on the left) remain locked in view while scrolling the main grid.
        *   **Dynamic Navigation**: The header dynamically updates to display the month/year currently in view as the user scrolls. Loading the view or clicking the "Today" button instantly snaps the scroll position to the current day.
    *   **Unscheduled**: The master list of tasks that can be done whenever, without a specific date.
    *   **Logbook**: A history of completed tasks.
*   **Organization**:
    *   **Categories**: A single organizational unit instead of Areas, Projects, and Headings. When assigned a category, tasks are automatically grouped under a heading for that category in the list views. 
        *   **Family-Wide**: All categories are shared across the entire family workspace.
        *   **On-the-fly Creation**: Users can create new categories instantly through a "New Category" modal integrated into the category selector, which then automatically selects the new category for the current task.
*   **Task Interactions**:
    *   **Quick Actions Menu**: A 3-dot context menu on tasks for fast management (Move to tomorrow, Change time, Delete, Repeat options).
*   **Quick Entry (Global)**: A powerful, high-speed task creation interface accessible from anywhere in the app via a Floating Action Button (FAB) or the `n` keyboard shortcut. (See Section 8 for details).
*   **Task Details & Interaction**:
    *   **Detail View Interface**: The expanded view mirrors the **Quick Entry** design, providing a consistent experience. It includes:
        *   **Title & Description Editing**: Large typography for the title and a multi-line field for descriptions/notes.
        *   **Inline Controllers**: High-level selectors for **When** (Date/Time), **Who** (Assignee), **Category** (Shared component with on-the-fly creation), and **Privacy** (Lock toggle).
        *   **Auto-Save**: Changes to the title and description are automatically saved to the backend via a 500ms debounced update, ensuring data persistence without manual "Save" actions.
    *   **Information Density & Indicators**:
        *   **Details Indicator**: Tasks with an existing description feature a subtle, colored vertical bar on the left side of the row in the collapsed view, signaling that additional information is available inside.
        *   **Privacy Indicator**: Private tasks are marked with a small lock icon 🔒 next to their title in the collapsed view.
        *   **Attachment Indicator**: Tasks with associated files feature a small paperclip icon in the collapsed view.
    *   **Task Attachments & Storage**:
        *   **Functionality**: Users can attach images and documents to any task via a paperclip icon in the metadata bar. 
        *   **Visual Previews**: Images are displayed as clean, square thumbnails without filenames or inline metadata in the list views. Clicking an image thumbnail opens a dedicated **Image Preview Modal**, which displays the full-sized image and provides centralized controls for **downloading** and **permanently deleting** the file. Non-image attachments (documents, etc.) continue to display their filename and a direct delete button in the list.
        *   **Backend Architecture**: Uses Convex Storage. The database stores a `storageId`, original `name`, and MIME `type`.
        *   **Persistence in Recurrence**: Attachments are automatically copied to new instances when a recurring series materializes a virtual task or spawns a completion-based child task.
    *   **Hard Deletion & Storage Cleanup**:
        *   **Hard Delete Policy**: The app uses a hard-delete model. Deleting a task permanently removes it from the database (`ctx.db.delete`) to keep the workspace lean.
        *   **Automated Storage Cleanup**: To save costs and space, deleting a task also triggers the permanent removal of all its associated files from Convex storage. 
        *   **Deduplication Safeguard**: In recurring series, the system only deletes a file from storage if it is not used by other tasks in the series (e.g., the root task), ensuring shared resources are preserved.
        *   **Update-Time Cleanup**: When a user removes an individual attachment from an existing task and saves, the system automatically identifies the removed file and deletes it from Convex storage.
    *   **Repeating Tasks**: Robust, backend-driven recurring schedules using two distinct architectures to ensure data integrity and prevent "ghosting":
        *   **Scheduled (iCal / RFC-5545 Inspired)**: Repeats on a set cadence regardless of completion (e.g., pay bills every month).
            *   *Input Settings*: Supports Frequency (Daily, Weekly, Monthly, Yearly), Interval (e.g., every 2 weeks), specific Days of Week (for Weekly), Day of Month (for Monthly), and an optional End Date.
            *   *Architecture*: Uses a "Virtual Expansion" model. The database holds a single "Root" task. The `getTasks` query dynamically calculates and injects future virtual occurrences into the result set for a 3-month lookahead window.
            *   *Edge Cases & Mutations*: To prevent moved tasks from reappearing in their original slots ("ghosting"), materialized exceptions store an `originalDueDate` field. Deleting a virtual occurrence adds that date to an `excludedDates` array on the root task, keeping the database free of tombstone records.
            *   *Series Splitting*: Editing "This and following occurrences" sets an `endDate` on the old root and spawns a new root from that date forward, preserving history.
        *   **After Completion (The "Chain" Model)**: Next instance triggers only based on when the previous one was actually marked completed.
            *   *Input Settings*: Supports Frequency (Daily, Weekly, Monthly, Yearly) and Interval (e.g., 3 days after completion). Complex rules like specific days of the week are omitted to ensure the chain remains purely relative to completion time.
            *   *Architecture*: Uses a "Materialized Chain" model. Only one active task exists in the database for the series at a time. When marked completed, the backend instantly calculates the next date and spawns a new task pointing to the parent.
            *   *Edge Cases & UX*: Editing an active completion-based task applies the edits to the active task directly; when completed, those edits naturally carry forward to the next link. To prevent duplicates, if a user un-completes a task, the backend automatically hunts down and removes the previously spawned child task. Deleting a completion-based task offers a "Skip to next" option, which deletes the active task but spawns the next one to keep the chain alive.
            *   *Centralization*: All complex recurrence logic, date calculations, and chain-spawning rules are strictly centralized on the backend (`convex/recurrence.ts`) to ensure atomic, transactional data integrity regardless of frontend state or connection drops.

## 4. Family & Multi-User Collaboration
Expanding beyond single-player mode, the app introduces family dynamics:

*   **Family Workspaces**: Users can create a family unit with a single click. The backend automatically generates a random UUID-based **Invite Code** and a default family name.
*   **The "Solo Family" Architecture**: To simplify data handling and ensure the UI never deals with an empty family state, a user is **always** in a family. When a user first signs up, or if they leave an existing family, they are automatically placed into a newly generated "Solo Family" where they are the sole member. 
*   **Leaving a Family & Task Re-assignment**: When a user leaves a family, to prevent data loss for the household, intelligent re-assignment logic triggers:
    *   **Personal / Private Tasks**: Any task that has `isPrivate === true` or is explicitly assigned to the leaving user (`assigneeId === leavingUser`) goes with the user to their new Solo Family.
    *   **Delegated Tasks**: If the leaving user created a task but assigned it to a *different* family member, the task **stays** in the old family. Its ownership (`ownerId`) is transferred to the owner of the family, so the assignee can still complete it.
    *   **Family Pool Tasks**: If the leaving user created a task for the general family pool (`assigneeId === undefined`), the task **stays** in the old family. Its ownership is also transferred to the owner of the family.
*   **Invite Links**: Families are joined via unique, shareable invite links based on the family's UUID. 
*   **Membership Policy**: A user can belong to only one family workspace at a time. To join a new family, a user must explicitly **leave** their current one, which requires a confirmation step.
*   **Family Management & Colors**: A dedicated settings view to manage family members and access the invite link. Each person can customize their identifying color and set their initials (max 2 characters) to easily distinguish their tasks and events visually across the app via circular markers. Tasks assigned to the "Family" generally (unclaimed) are identified by a family icon instead of a member's marker.
*   **Task Assignment**: Tasks can be assigned to:
    *   A specific family member.
    *   The "Family" generally (e.g., "Take out the trash" as a shared pool task).
*   **Privacy Model**: All tasks are fully public to the family workspace by default. However, any task can be explicitly toggled as **"Private"** via a dedicated lock icon button in the task entry or detail views. Private tasks are only visible to their creator AND the person assigned to the task. They are marked with a lock icon 🔒 in all list views. There are no special "private" categories; the privacy status is an independent boolean flag.

## 5. Google Calendar Integration
A powerful, family-aware calendar sync feature allows users to view their schedule alongside tasks.

*   **Calendar Syncing View**: A dedicated settings view where users can authenticate with Google, manage their synced calendars, and configure visibility.
*   **Ownership & Assignment**:
    *   **Owner**: The specific user who authenticated and synced the Google Calendar account.
    *   **Assignee**: The family member the calendar "belongs to" within the app. For example, a parent could sync their child's school calendar and assign it to the child.
    *   **Permissions**: Only the *Owner* of a synced calendar can change its *Assignee*, ensuring control remains with the person who linked the account.
*   **Sync Architecture**:
    *   **Persistence**: Google events are mirrored into a local `calendarEvents` table in Convex for instant UI responsiveness.
    *   **Incremental Sync**: Uses Google API `syncToken` logic to only download changed events after the initial import.
    *   **Sync Window**: The initial sync imports events from 1 month in the past to 1 year in the future.
    *   **Background Updates**: Syncs are triggered automatically when a user views their calendar and via scheduled Convex Crons (every 15 minutes).
    *   **Windowed Queries**: Frontend views request events only within a specific temporal window (e.g., -2 months to +1 year) to optimize network transfer and UI performance.
*   **Filter-Aware Visibility**: Calendar events seamlessly respect the app's global persistent filtering (detailed below).
*   **Sync Toggles**: Instead of deleting a calendar import to remove it from view, users can uncheck a "Sync" toggle in the settings.
    *   **Behavior**: Disabling sync immediately removes all cached events for that calendar from the local database and prevents background syncs for it. 
    *   **Re-activation**: Re-enabling sync triggers a fresh full import to restore the calendar's events.

## 6. Settings & Navigation
The settings interface is designed for ultra-minimalist intentionality and a premium "native" feel, inspired by the Things 3 iOS application.

*   **Sliding Stack Navigation**: Settings uses a hierarchical "stack" model instead of traditional tabs. 
    *   **Interaction**: Clicking a settings group (e.g., "Account & Family") causes the main list to slide out to the left while the specific settings sub-page slides in from the right.
    *   **Back Navigation**: A dedicated back button (`<`) in the top-left of each sub-page reverses the animation, sliding the sub-page out to the right and bringing the main list back to center.
    *   **Animations**: Transitions are powered by **Framer Motion** using a physical-feeling spring animation (`spring`, `damping: 25`, `stiffness: 200`).
*   **Main View Layout**: The main settings page is stripped of all non-essential elements for maximum focus.
    *   **Vertical Centering**: The settings groups are vertically centered on the page to create a balanced, symmetric aesthetic.
    *   **Ultra-Minimalism**: All headers, subheaders, line separators, and version numbers have been removed from the main view.
    *   **Single-Line Options**: Settings options are presented as single-line items. Subheadings (descriptions) are omitted to maintain a clean list.
    *   **Icon Alignment**: Icons are sized and aligned to match the height of the text exactly, creating a harmonious visual rhythm.
*   **Settings Areas**:
    *   **Account & Family**: Unified view for profile management, signing out, family workspace creation, member lists, and invite link sharing.
    *   **Calendar Sync**: Focused view for managing Google Calendar integrations and account syncing status.
    *   **Preferences**: User-specific behavior settings.
        *   **Logbook Movement**: Users can choose when completed tasks are moved out of the main view and into the Logbook:
            *   **Immediately**: Tasks disappear from the Dashboard/Unscheduled view as soon as they are checked.
            *   **The Next Day (Default)**: Tasks completed today remain visible in their original place with a checkmark until the end of the day, providing immediate visual feedback of progress.
        *   **Historical Timeline**: Completed tasks from the past are always visible in the Timeline and Calendar views to maintain a continuous record of activity, regardless of the Logbook movement setting.

## 7. Advanced Persistent Filtering
To handle the mix of personal and family tasks (and calendar events) without clutter, the UI will feature an **always-visible, easy-to-toggle filter bar/menu**. This ensures users can instantly pivot their view across all lists (Dashboard, Timeline, specific Categories, etc.).

*   **View Toggles**:
    *   **My Items**: Shows only private tasks, family tasks explicitly assigned to the current user, and events from calendars assigned to the user.
    *   **Everyone's Items (Family)**: Shows all personal tasks, shared family tasks, and events from all family-synced calendars.
    *   **Specific Member**: Select a family member (e.g., "Partner's Name") to see their assigned tasks and their assigned calendar events.
    *   **Unclaimed/Family Pool**: Shows tasks assigned to the "Family" entity but not yet claimed by a specific person.

## 8. Quick Task Entry
The Quick Entry interface is designed for maximum speed and frictionless data entry, following a "mobile-first" philosophy.

*   **Triggers**:
    *   **Floating Action Button (FAB)**: Persistent in the bottom-right corner.
    *   **Keyboard Shortcut**: Global `n` key.
*   **Structure & Layout**:
    *   **Title**: Primary input with 2xl bold typography.
    *   **Description**: Multi-line textarea for notes and links. Any URLs entered here are **automatically linkified** (rendered as clickable, `target="_blank"` links) in all task list views.
    *   **Metadata Row**: A dedicated row for high-level selectors, right-aligned for easy reach:
        *   **Attachment**: A paperclip icon to trigger file uploads, supporting images and documents.
        *   **When (Date/Time)**: A comprehensive picker including a calendar grid and time entry. 
            *   *Quick Selects*: Large, high-priority buttons at the bottom of the picker for "Today" and "Tomorrow" (each taking half the picker's width).
        *   **Who (Assignee)**: Allows assigning the task to a specific family member or the "Family" pool.
    *   **Footer**:
        *   **Category Picker**: Located in the bottom-left of the modal for easy grouping. This is a **shared component** used throughout the app, enabling users to select existing family categories or create new ones via an integrated "New Category" modal.
        *   **Privacy Toggle**: A dedicated lock icon button in the metadata row to explicitly mark tasks as private.
        *   **Create Button**: Prominent action to save and close.
*   **Responsive Behavior & UX**:
    *   **Mobile Mode**: When opened on a mobile device, sub-pickers (When/Who) are automatically **centered horizontally and vertically** on the screen to maximize usability.
    *   **Sequential Dismissal**: To prevent accidental data loss, the interface uses a layered modal logic. If a sub-picker is open, tapping outside will only close that specific picker. A second tap outside is required to close the main Quick Entry modal.
    *   **Animations**: Uses `animate-modal-in` for smooth entrance and backdrop blurs for focus.

## 9. Voice Input (AI-Powered Task Capture)
A hands-free, high-speed task capture feature that converts spoken words into structured tasks using Gemini 3.1 Flash-Lite.

### Trigger
*   A dedicated **microphone button** is displayed alongside the FAB in the bottom-right corner.
*   **Tap**: Starts recording. Records until tapped again (toggle mode).
*   **Hold (press and hold)**: Starts recording while held. Releases and stops recording when the finger/pointer is lifted.

### Recording & Transcription
*   Uses the browser's native `MediaRecorder` API to capture audio from the microphone.
*   After recording stops, the audio is sent as a base64-encoded payload to a **Convex action** that calls the **Gemini 3.1 Flash-Lite** API (via `GEMINI_API_KEY` env var).
*   Gemini receives the raw audio and a context-aware prompt that includes:
    *   The list of **family members** (name, id) as valid assignee options.
    *   A "Family" pool assignee option.
    *   The **current user's id** as the default assignee if none is spoken.
*   The model returns a **structured JSON array** of tasks extracted from the speech.

### Extracted Task Schema
Each task in the returned array has:
```json
{
  "title": "Concise task title",
  "details": "Any notes, context, or extra details (optional)",
  "checklist": ["String array of checklist items (optional)"],
  "assigneeName": "Spoken assignee name, or null if none mentioned"
}
```

### Review Modal
After parsing, a **review modal** appears displaying all extracted tasks.

*   **Single task**: Automatically expanded by default so the user can immediately see its details.
*   **Multiple tasks**: All shown in a list, collapsed by default; each can be tapped to expand.
*   **Per-task editing**: Expanding a task reveals inline editable fields for title, details, and assignee.
*   **Per-task removal**: Each task has an `×` remove button; removed tasks are hidden immediately.
*   **Dismiss options**:
    *   Tap outside the modal.
    *   Tap the `X` close button in the modal header.
    *   Both discard the entire set of pending tasks with no side effects.
*   **Primary action — Save All**: Creates all remaining (non-removed) tasks in one batch via the `createTask` mutation. The modal then closes.

### AI Quick Actions (within the Review Modal)
Two additional AI-powered buttons appear at the bottom of the modal:
*   **Consolidate**: Sends the current task list back to Gemini and asks it to merge everything into a single, coherent task. The view updates to show the single merged task.
*   **Split Out**: Sends the currently selected/focused task back to Gemini and asks it to break it down into multiple separate tasks. Those tasks replace the original in the list.

### UX & Animation
*   A **pulsing red dot + microphone icon** animates while recording is active to give clear visual feedback.
*   The review modal uses the same `animate-modal-in` entrance animation as Quick Entry.
*   The modal is scrollable if the task list is long.

## 10. Development Milestones
1.  **Scaffolding**: Initialize Tauri 2.0 with React and Tailwind. Setup Convex backend and Better Auth.
2.  **Data Modeling**: Define Convex schemas for Users, Families, Tasks, Categories, Tags, and Calendars.
3.  **Core UI/UX**: Build the fundamental layout (Sidebar, Main List View, Task Details modal/inline editor) matching Things 3 aesthetics.
4.  **Quick Entry Implementation**: Build the global FAB and 'n' shortcut entry with responsive sub-pickers and description linkification.
5.  **Single Player Logic**: Implement Dashboard, Timeline, Calendar View, Unscheduled, and Logbook logic using Convex real-time queries.
6.  **Multiplayer & Filtering**: Introduce Family sharing, assignments, family color coding, and the persistent filter toggle state.
7.  **Calendar Integration**: Implement Google Calendar OAuth, background syncing, and Calendar management view.
8.  **Polish**: Animations, native macOS/iOS feel via Tauri.
ng**: Introduce Family sharing, assignments, family color coding, and the persistent filter toggle state.
7.  **Calendar Integration**: Implement Google Calendar OAuth, background syncing, and Calendar management view.
8.  **Polish**: Animations, native macOS/iOS feel via Tauri.

## 11. Performance Optimization
To maintain the app's "Things 3" snappiness as the dataset grows over months and years, the architecture follows several key performance patterns:

*   **Windowed Fetching**: Primary views (Timeline, Calendar, Dashboard) do not fetch the entire database history. They request data within a specific "window" (e.g., Timeline fetches -2 months to +12 months; Dashboard fetches only Today + Unscheduled). This is enforced by passing optional `start` and `end` ISO strings to the Convex queries.
*   **Optimized Indexing**:
    *   **Tasks**: Uses a compound index `by_family_dueDate` (`familyId`, `dueDate`) to allow for O(log N) range queries within a specific household workspace.
    *   **Calendar Events**: Uses a `by_start` index on the ISO start time for efficient date-range filtering.
*   **Client-Side Memoization**: High-complexity data transformations—such as merging tasks and calendar events into a single "day map" for the Timeline—are wrapped in `useMemo`. This ensures that the UI only re-processes data when the query results actually change, preventing lag during component re-renders or navigation.
*   **Real-time Reactivity**: All views leverage Convex subscriptions, ensuring that background updates (like Google Calendar syncs or task updates from other family members) are pushed to the client and rendered instantly without manual refreshes.
