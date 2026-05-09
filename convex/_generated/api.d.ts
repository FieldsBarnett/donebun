/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as calendars from "../calendars.js";
import type * as categories from "../categories.js";
import type * as crons from "../crons.js";
import type * as debug from "../debug.js";
import type * as families from "../families.js";
import type * as files from "../files.js";
import type * as google from "../google.js";
import type * as googleActions from "../googleActions.js";
import type * as http from "../http.js";
import type * as import_ from "../import.js";
import type * as recurrence from "../recurrence.js";
import type * as tasks from "../tasks.js";
import type * as users from "../users.js";
import type * as voiceActions from "../voiceActions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  calendars: typeof calendars;
  categories: typeof categories;
  crons: typeof crons;
  debug: typeof debug;
  families: typeof families;
  files: typeof files;
  google: typeof google;
  googleActions: typeof googleActions;
  http: typeof http;
  import: typeof import_;
  recurrence: typeof recurrence;
  tasks: typeof tasks;
  users: typeof users;
  voiceActions: typeof voiceActions;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
