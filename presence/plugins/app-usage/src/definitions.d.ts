export interface AppUsageEntry {
  /** Android package name, e.g. "com.instagram.android". */
  packageName: string;
  /** Human-readable label from the package manager. */
  appName: string;
  /** Foreground milliseconds inside the requested window. */
  totalMs: number;
  /** Epoch ms of the last time the app came to the foreground, or 0. */
  lastUsedAt: number;
}

export interface UsageResult {
  /** Sum of totalMs across every returned app. */
  totalMs: number;
  /** Start of the queried window, epoch ms. */
  start: number;
  /** End of the queried window, epoch ms. */
  end: number;
  apps: AppUsageEntry[];
}

export interface AppUsagePlugin {
  /** Whether the user has granted the PACKAGE_USAGE_STATS special access. */
  hasPermission(): Promise<{ granted: boolean }>;
  /** Opens the system "Usage access" settings screen. */
  openPermissionSettings(): Promise<void>;
  /**
   * Foreground time per app. Defaults to local midnight -> now.
   * Apps with no launcher entry, and this app itself, are excluded.
   */
  getUsage(options?: { start?: number; end?: number }): Promise<UsageResult>;
  /** Every launchable app, so a limit can be set before an app is ever opened. */
  getInstalledApps(): Promise<{ apps: Array<{ packageName: string; appName: string }> }>;
  /** Base64 PNG data URIs keyed by package name. Missing icons are omitted. */
  getIcons(options: { packages: string[] }): Promise<{ icons: Record<string, string> }>;
  /**
   * Persists the daily budgets natively and (re)schedules the background
   * check. `limits` maps package name -> budget in minutes.
   */
  syncLimits(options: { limits: Record<string, number>; alertsEnabled: boolean }): Promise<void>;
  /** Android 13+ runtime notification permission. */
  checkNotificationPermission(): Promise<{ granted: boolean }>;
  requestNotificationPermission(): Promise<{ granted: boolean }>;
}

declare const AppUsage: AppUsagePlugin;
export { AppUsage };
export default AppUsage;
