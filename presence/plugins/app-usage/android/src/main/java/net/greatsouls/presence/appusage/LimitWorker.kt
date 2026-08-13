package net.greatsouls.presence.appusage

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit
import kotlin.math.roundToInt

/**
 * Periodic "have you blown your budget?" check.
 *
 * Runs without the app open, which is the whole point — a limit you only find
 * out about when you open the tracker is not a limit. WorkManager's floor is
 * 15 minutes, so an alert can lag a limit by up to that long; the in-app view
 * is always live because it re-queries on every refresh.
 */
class LimitWorker(
    context: Context,
    params: WorkerParameters,
) : Worker(context, params) {

    override fun doWork(): Result {
        val context = applicationContext
        if (!LimitStore.alertsEnabled(context)) return Result.success()
        if (!UsageReader.hasPermission(context)) return Result.success()

        val limits = LimitStore.limits(context)
        if (limits.isEmpty()) return Result.success()

        val dayStart = UsageReader.startOfDay()
        val now = System.currentTimeMillis()
        val totals = UsageReader.rawTotals(context, dayStart, now)

        for ((pkg, minutes) in limits) {
            val usedMs = totals[pkg] ?: 0L
            val budgetMs = minutes * 60_000L
            if (usedMs < budgetMs) continue
            if (LimitStore.alreadyNotified(context, pkg, dayStart)) continue

            notifyOverLimit(context, pkg, usedMs, budgetMs)
            LimitStore.markNotified(context, pkg, dayStart)
        }
        return Result.success()
    }

    private fun notifyOverLimit(context: Context, pkg: String, usedMs: Long, budgetMs: Long) {
        ensureChannel(context)

        val label = try {
            val pm = context.packageManager
            pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
        } catch (_: PackageManager.NameNotFoundException) {
            pkg
        }

        val over = ((usedMs - budgetMs) / 60_000.0).roundToInt()
        val body = if (over <= 0) {
            "You've hit your ${formatMinutes(budgetMs / 60_000L)} budget for today."
        } else {
            "You're ${formatMinutes(over.toLong())} past your ${formatMinutes(budgetMs / 60_000L)} budget for today."
        }

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("$label — limit reached")
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .build()

        try {
            // On API 33+ this silently no-ops without POST_NOTIFICATIONS, which
            // is the correct outcome — the user declined the alerts.
            NotificationManagerCompat.from(context).notify(pkg.hashCode(), notification)
        } catch (_: SecurityException) {
            // Permission revoked between the check and the post. Nothing to do.
        }
    }

    private fun formatMinutes(minutes: Long): String {
        if (minutes < 60) return "${minutes}m"
        val h = minutes / 60
        val m = minutes % 60
        return if (m == 0L) "${h}h" else "${h}h ${m}m"
    }

    private fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Daily limits",
            NotificationManager.IMPORTANCE_DEFAULT,
        ).apply {
            description = "Tells you when an app passes its daily time budget."
        }
        manager.createNotificationChannel(channel)
    }

    companion object {
        private const val CHANNEL_ID = "presence.limits"
        private const val WORK_NAME = "presence.limit-check"

        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<LimitWorker>(15, TimeUnit.MINUTES)
                .setConstraints(Constraints.Builder().build())
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.UPDATE,
                request,
            )
        }

        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        }
    }
}
