package net.greatsouls.presence.appusage

import android.Manifest
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.os.Build
import android.provider.Settings
import android.util.Base64
import androidx.core.app.NotificationManagerCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.io.ByteArrayOutputStream
import kotlin.math.max

@CapacitorPlugin(
    name = "AppUsage",
    permissions = [
        Permission(alias = AppUsagePlugin.NOTIFICATIONS, strings = [Manifest.permission.POST_NOTIFICATIONS]),
    ],
)
class AppUsagePlugin : Plugin() {

    // ---- Usage access (special permission, no runtime dialog) --------------

    @PluginMethod
    fun hasPermission(call: PluginCall) {
        call.resolve(JSObject().put("granted", UsageReader.hasPermission(context)))
    }

    @PluginMethod
    fun openPermissionSettings(call: PluginCall) {
        try {
            val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            call.resolve()
        } catch (e: Exception) {
            call.reject("Could not open the usage access settings screen.", e)
        }
    }

    // ---- Usage data -------------------------------------------------------

    @PluginMethod
    fun getUsage(call: PluginCall) {
        if (!UsageReader.hasPermission(context)) {
            call.reject(PERMISSION_DENIED)
            return
        }
        val now = System.currentTimeMillis()
        val start = call.getLong("start") ?: UsageReader.startOfDay(now)
        val end = call.getLong("end") ?: now
        if (end <= start) {
            call.reject("`end` must be after `start`.")
            return
        }

        try {
            val entries = UsageReader.entries(context, start, end)
            val apps = JSArray()
            var total = 0L
            for (entry in entries) {
                total += entry.totalMs
                apps.put(
                    JSObject()
                        .put("packageName", entry.packageName)
                        .put("appName", entry.appName)
                        .put("totalMs", entry.totalMs)
                        .put("lastUsedAt", entry.lastUsedAt)
                )
            }
            call.resolve(
                JSObject()
                    .put("totalMs", total)
                    .put("start", start)
                    .put("end", end)
                    .put("apps", apps)
            )
        } catch (e: Exception) {
            call.reject("Failed to read usage stats.", e)
        }
    }

    /** Every launchable app, so limits can be set before an app is ever used. */
    @PluginMethod
    fun getInstalledApps(call: PluginCall) {
        try {
            val apps = JSArray()
            for ((pkg, label) in UsageReader.installedApps(context)) {
                apps.put(JSObject().put("packageName", pkg).put("appName", label))
            }
            call.resolve(JSObject().put("apps", apps))
        } catch (e: Exception) {
            call.reject("Failed to list installed apps.", e)
        }
    }

    @PluginMethod
    fun getIcons(call: PluginCall) {
        val packages = call.getArray("packages")
        if (packages == null) {
            call.reject("`packages` is required.")
            return
        }
        val icons = JSObject()
        val pm = context.packageManager
        for (item in packages.toList<Any>()) {
            val pkg = item as? String ?: continue
            try {
                val drawable = pm.getApplicationIcon(pkg)
                val encoded = encodeIcon(drawable) ?: continue
                icons.put(pkg, encoded)
            } catch (_: Exception) {
                // App uninstalled mid-read, or an icon we cannot rasterise.
                // Skipping it just means the UI falls back to a letter tile.
            }
        }
        call.resolve(JSObject().put("icons", icons))
    }

    // ---- Daily limits -----------------------------------------------------

    @PluginMethod
    fun syncLimits(call: PluginCall) {
        val limitsJson = call.getObject("limits") ?: JSObject()
        val alertsEnabled = call.getBoolean("alertsEnabled", true) ?: true

        val limits = HashMap<String, Int>()
        for (key in limitsJson.keys()) {
            val minutes = limitsJson.optInt(key, 0)
            if (minutes > 0) limits[key] = minutes
        }

        LimitStore.saveLimits(context, limits)
        LimitStore.setAlertsEnabled(context, alertsEnabled)

        if (alertsEnabled && limits.isNotEmpty()) {
            LimitWorker.schedule(context)
        } else {
            LimitWorker.cancel(context)
        }
        call.resolve()
    }

    // ---- Notification permission (Android 13+) ----------------------------

    @PluginMethod
    fun checkNotificationPermission(call: PluginCall) {
        call.resolve(JSObject().put("granted", notificationsAllowed()))
    }

    @PluginMethod
    fun requestNotificationPermission(call: PluginCall) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            // Before Android 13 there is nothing to request; notifications are on
            // unless the user turned them off in system settings.
            call.resolve(JSObject().put("granted", notificationsAllowed()))
            return
        }
        if (notificationsAllowed()) {
            call.resolve(JSObject().put("granted", true))
            return
        }
        requestPermissionForAlias(NOTIFICATIONS, call, "notificationCallback")
    }

    @PermissionCallback
    private fun notificationCallback(call: PluginCall) {
        call.resolve(JSObject().put("granted", notificationsAllowed()))
    }

    private fun notificationsAllowed(): Boolean =
        NotificationManagerCompat.from(context).areNotificationsEnabled()

    // ---- helpers ----------------------------------------------------------

    private fun encodeIcon(drawable: Drawable): String? {
        val bitmap = drawableToBitmap(drawable) ?: return null
        val stream = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)
        val encoded = Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
        return "data:image/png;base64,$encoded"
    }

    private fun drawableToBitmap(drawable: Drawable): Bitmap? {
        if (drawable is BitmapDrawable && drawable.bitmap != null) {
            return Bitmap.createScaledBitmap(drawable.bitmap, ICON_PX, ICON_PX, true)
        }
        // Adaptive and vector icons report their intrinsic size; some report -1,
        // hence the max() floor.
        val width = max(drawable.intrinsicWidth, ICON_PX)
        val height = max(drawable.intrinsicHeight, ICON_PX)
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        drawable.setBounds(0, 0, canvas.width, canvas.height)
        drawable.draw(canvas)
        return if (width == ICON_PX && height == ICON_PX) {
            bitmap
        } else {
            Bitmap.createScaledBitmap(bitmap, ICON_PX, ICON_PX, true)
        }
    }

    companion object {
        const val NOTIFICATIONS = "notifications"
        const val PERMISSION_DENIED = "USAGE_ACCESS_DENIED"
        private const val ICON_PX = 96
    }
}
