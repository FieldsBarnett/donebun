# DoneBun - Master Specification

**App Name:** DoneBun
**URL:** donebun.app

## 1. Overview
A robust, beautifully designed task management application inspired by **Things 3**, but supercharged with **multi-user family collaboration**. The app allows individuals to manage their personal tasks with the same elegance as Things 3, while seamlessly collaborating with family members on shared responsibilities.

## 2. Technology Stack
*   **Frontend**: React, Tailwind CSS, TanStack Query (for data fetching/caching). The UI will utilize a **customizable Tailwind theme** driven by **design tokens** (CSS variables) to ensure easy global customization, consistent theming, and simple layout adjustments. The entire architecture and design must be **MOBILE FIRST**.
*   **Native Apps (macOS & iOS)**: Tauri 2.0 (Targeting iOS as the primary platform first, scaling up to macOS).
*   **Backend & Real-time Database**: Convex
*   **Authentication**: Better Auth (with Convex integration)
*   **Email**: Resend

## 3. Core Features (Things 3 Parity)
The application will replicate the core organizational structure and elegant UX of Things 3:

*   **Dashboard (Default View)**: A centralized daily hub showing:
    *   A quick input field for entering new todos.
    *   Items due today.
    *   Unscheduled items.
*   **Core Views**:
    *   **Timeline**: A chronological list of scheduled tasks and deadlines. Since this view naturally starts with today's items, a separate "Today" list is redundant. Features a togglable option to overlay synced Google Calendar events inline with tasks.
    *   **Calendar View**: A dedicated, full-screen calendar interface (Day, Week, and Month views) similar to Google Calendar, plotting both tasks and synced events.
    *   **Unscheduled**: The master list of tasks that can be done whenever, without a specific date.
    *   **Logbook**: A history of completed tasks.
*   **Organization**:
    *   **Categories**: A single organizational unit instead of Areas, Projects, and Headings. When assigned a category, tasks are automatically grouped under a heading for that category in the list views.
*   **Task Interactions**:
    *   **Quick Actions Menu**: A 3-dot context menu on tasks for fast management (Move to tomorrow, Change time, Delete, Repeat options).
*   **Task Details**:
    *   Notes/Description.
    *   Checklists (sub-tasks within a single task).
    *   Start Dates & Deadlines.
    *   Tags.
    *   **Repeating Tasks**: Robust recurring schedules with two options:
        *   *Fixed Schedule*: Repeats on a set cadence (e.g., pay bills every month), even if a previous cycle was missed or completed late.
        *   *Completion-Based*: Next instance triggers only based on when the previous one was completed (e.g., call brother X days after the last time he was actually called).

## 4. Family & Multi-User Collaboration
Expanding beyond single-player mode, the app introduces family dynamics:

*   **Family Workspaces**: Users can create a family unit and invite members to join via Better Auth authentication.
*   **Family Management & Colors**: A dedicated settings view to manage family members. Each person is assigned a unique identifying color to easily distinguish their tasks and events visually across the app.
*   **Task Assignment**: Tasks can be assigned to:
    *   A specific family member.
    *   The "Family" generally (e.g., "Take out the trash" as a shared pool task).
*   **Privacy Model**: There are no shared or private areas/projects. All categories and tasks are fully public to the family workspace by default, except for one special, hardcoded category called **"Private 🔒"**.

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
*   **Filter-Aware Visibility**: Calendar events seamlessly respect the app's global persistent filtering (detailed below).

## 6. Advanced Persistent Filtering
To handle the mix of personal and family tasks (and calendar events) without clutter, the UI will feature an **always-visible, easy-to-toggle filter bar/menu**. This ensures users can instantly pivot their view across all lists (Dashboard, Timeline, specific Categories, etc.).

*   **View Toggles**:
    *   **My Items**: Shows only private tasks, family tasks explicitly assigned to the current user, and events from calendars assigned to the user.
    *   **Everyone's Items (Family)**: Shows all personal tasks, shared family tasks, and events from all family-synced calendars.
    *   **Specific Member**: Select a family member (e.g., "Partner's Name") to see their assigned tasks and their assigned calendar events.
    *   **Unclaimed/Family Pool**: Shows tasks assigned to the "Family" entity but not yet claimed by a specific person.

## 7. Development Milestones
1.  **Scaffolding**: Initialize Tauri 2.0 with React and Tailwind. Setup Convex backend and Better Auth.
2.  **Data Modeling**: Define Convex schemas for Users, Families, Tasks, Categories, Tags, and Calendars.
3.  **Core UI/UX**: Build the fundamental layout (Sidebar, Main List View, Task Details modal/inline editor) matching Things 3 aesthetics.
4.  **Single Player Logic**: Implement Dashboard, Timeline, Calendar View, Unscheduled, and Logbook logic using Convex real-time queries.
5.  **Multiplayer & Filtering**: Introduce Family sharing, assignments, family color coding, and the persistent filter toggle state.
6.  **Calendar Integration**: Implement Google Calendar OAuth, background syncing, and Calendar management view.
7.  **Polish**: Animations, drag-and-drop, native macOS/iOS feel via Tauri.
