/** No-op stub when building for Tauri (iOS/Android/desktop app). */
export function registerSW(_options?: { immediate?: boolean }) {
  return () => {};
}
