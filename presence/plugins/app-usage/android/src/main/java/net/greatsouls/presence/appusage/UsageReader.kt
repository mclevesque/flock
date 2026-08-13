package net.greatsouls.presence.appusage

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Process
import java.util.Calendar

/**
 * Reads real foreground time out of Android's usage-event stream.
 *
 * We deliberately do NOT use queryUsageStats(): its daily buckets are rounded,
 * are merged across the whole day by the framework, and drift badly for a
 * partial day. queryEvents() gives raw resume/pause transitions, which is what
 * a screen-time budget has to be built on.
 */
object UsageReader {

    // Event type ints. Some of these were added after our minSdk, so they are
    // written as literals — they are compile-time constants either way, and
    // referencing the newer fields directly would break older builds.
    private const val ACTIVITY_RESUMED = 1          // MOVE_TO_FOREGROUND
    private const val ACTIVITY_PAUSED = 2           // MOVE_TO_BACKGROUND
    private const val SCREEN_NON_INTERACTIVE = 16   // API 28
    private const val KEYGUARD_SHOWN = 17           // API 28
    private const val ACTIVITY_STOPPED = 23         // API 29
    private const val DEVICE_SHUTDOWN = 26          // API 30

    data class Entry(
        val packageName: String,
        val appName: String,
        val totalMs: Long,
        val lastUsedAt: Long,
    )

    /** True once the user has flipped on "Usage access" for us. */
    fun hasPermission(context: Context): Boolean {
        val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as? AppOpsManager
            ?: return false
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                context.packageName,
            )
        } else {
            @Suppress("DEPRECATION")
            appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                context.packageName,
            )
        }
        // MODE_DEFAULT means "fall back to the manifest permission", which for a
        // special access permission means it is effectively still off unless the
        // permission check itself passes.
        return if (mode == AppOpsManager.MODE_DEFAULT) {
            context.checkCallingOrSelfPermission(
                android.Manifest.permission.PACKAGE_USAGE_STATS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            mode == AppOpsManager.MODE_ALLOWED
        }
    }

    /** Local midnight for the day containing [at]. */
    fun startOfDay(at: Long = System.currentTimeMillis()): Long {
        val cal = Calendar.getInstance()
        cal.timeInMillis = at
        cal.set(Calendar.HOUR_OF_DAY, 0)
        cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        return cal.timeInMillis
    }

    /**
     * Raw foreground milliseconds per package for [start, end).
     * No filtering — callers decide what is worth showing.
     */
    fun rawTotals(context: Context, start: Long, end: Long): Map<String, Long> {
        val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
            ?: return emptyMap()

        val totals = HashMap<String, Long>()
        // Packages currently in the foreground, mapped to when they got there.
        val open = HashMap<String, Long>()
        val now = System.currentTimeMillis()
        val ceiling = minOf(end, now)

        fun close(pkg: String, at: Long) {
            val from = open.remove(pkg) ?: return
            if (at > from) totals[pkg] = (totals[pkg] ?: 0L) + (at - from)
        }

        fun closeAll(at: Long) {
            for (pkg in open.keys.toList()) close(pkg, at)
        }

        val events = usm.queryEvents(start, end)
        val event = UsageEvents.Event()
        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            val pkg = event.packageName ?: continue
            when (event.eventType) {
                ACTIVITY_RESUMED -> {
                    // Two activities inside one app can resume back to back; keep
                    // the earliest open timestamp so the session is not restarted.
                    if (!open.containsKey(pkg)) open[pkg] = event.timeStamp
                }
                ACTIVITY_PAUSED, ACTIVITY_STOPPED -> close(pkg, event.timeStamp)
                // The screen going off does not pause every activity, so without
                // this a phone left on a lock screen would bill hours to whatever
                // was last open.
                SCREEN_NON_INTERACTIVE, KEYGUARD_SHOWN, DEVICE_SHUTDOWN ->
                    closeAll(event.timeStamp)
            }
        }
        // Whatever is still in the foreground counts up to the end of the window.
        closeAll(ceiling)

        return totals
    }

    /**
     * Usage for [start, end) as display-ready entries: launchable third-party
     * apps only, our own package removed, sorted by time descending.
     */
    fun entries(context: Context, start: Long, end: Long): List<Entry> {
        val pm = context.packageManager
        val totals = rawTotals(context, start, end)
        val lastUsed = lastUsedAt(context, start, end)
        val self = context.packageName

        return totals.entries
            .asSequence()
            .filter { it.key != self && it.value > 0L }
            .filter { isLaunchable(pm, it.key) }
            .map { (pkg, ms) ->
                Entry(
                    packageName = pkg,
                    appName = labelOf(pm, pkg),
                    totalMs = ms,
                    lastUsedAt = lastUsed[pkg] ?: 0L,
                )
            }
            .sortedByDescending { it.totalMs }
            .toList()
    }

    /** Every launchable app on the device, whether or not it was used today. */
    fun installedApps(context: Context): List<Pair<String, String>> {
        val pm = context.packageManager
        val self = context.packageName
        return pm.getInstalledApplications(0)
            .asSequence()
            .map { it.packageName }
            .filter { it != self && isLaunchable(pm, it) }
            .map { it to labelOf(pm, it) }
            .sortedBy { it.second.lowercase() }
            .toList()
    }

    private fun lastUsedAt(context: Context, start: Long, end: Long): Map<String, Long> {
        val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
            ?: return emptyMap()
        val out = HashMap<String, Long>()
        val events = usm.queryEvents(start, end)
        val event = UsageEvents.Event()
        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            if (event.eventType == ACTIVITY_RESUMED) {
                val pkg = event.packageName ?: continue
                out[pkg] = event.timeStamp
            }
        }
        return out
    }

    /**
     * "Has a home-screen icon" is the closest proxy for "an app the user thinks
     * of as an app". It drops framework services and background providers while
     * keeping first-party apps the user genuinely spends time in.
     */
    private fun isLaunchable(pm: PackageManager, pkg: String): Boolean = try {
        pm.getLaunchIntentForPackage(pkg) != null
    } catch (_: Exception) {
        false
    }

    private fun labelOf(pm: PackageManager, pkg: String): String = try {
        pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
    } catch (_: PackageManager.NameNotFoundException) {
        pkg
    } catch (_: Exception) {
        pkg
    }
}
