package net.greatsouls.presence.appusage

import android.content.Context
import org.json.JSONObject

/**
 * The daily budgets, mirrored natively.
 *
 * The WebView owns the UI copy in localStorage, but the background worker runs
 * with no WebView alive, so the limits have to exist in SharedPreferences too.
 * syncLimits() from JS is the only writer.
 */
object LimitStore {

    private const val PREFS = "presence.limits"
    private const val KEY_LIMITS = "limits"
    private const val KEY_ALERTS = "alertsEnabled"
    private const val KEY_NOTIFIED = "notified"
    private const val KEY_NOTIFIED_DAY = "notifiedDay"

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** package name -> budget in minutes. Absent means "no limit set". */
    fun limits(context: Context): Map<String, Int> {
        val raw = prefs(context).getString(KEY_LIMITS, null) ?: return emptyMap()
        return try {
            val json = JSONObject(raw)
            buildMap {
                for (key in json.keys()) {
                    val minutes = json.optInt(key, 0)
                    if (minutes > 0) put(key, minutes)
                }
            }
        } catch (_: Exception) {
            emptyMap()
        }
    }

    fun saveLimits(context: Context, limits: Map<String, Int>) {
        val json = JSONObject()
        for ((pkg, minutes) in limits) {
            if (minutes > 0) json.put(pkg, minutes)
        }
        prefs(context).edit().putString(KEY_LIMITS, json.toString()).apply()
    }

    fun alertsEnabled(context: Context): Boolean =
        prefs(context).getBoolean(KEY_ALERTS, true)

    fun setAlertsEnabled(context: Context, enabled: Boolean) {
        prefs(context).edit().putBoolean(KEY_ALERTS, enabled).apply()
    }

    /**
     * One alert per app per day. The day stamp is stored alongside the set so
     * the whole thing self-clears at midnight without needing a scheduled job.
     */
    fun alreadyNotified(context: Context, pkg: String, dayStamp: Long): Boolean {
        val p = prefs(context)
        if (p.getLong(KEY_NOTIFIED_DAY, -1L) != dayStamp) return false
        return p.getStringSet(KEY_NOTIFIED, emptySet())?.contains(pkg) == true
    }

    fun markNotified(context: Context, pkg: String, dayStamp: Long) {
        val p = prefs(context)
        val sameDay = p.getLong(KEY_NOTIFIED_DAY, -1L) == dayStamp
        val current = if (sameDay) {
            HashSet(p.getStringSet(KEY_NOTIFIED, emptySet()) ?: emptySet())
        } else {
            HashSet()
        }
        current.add(pkg)
        p.edit()
            .putLong(KEY_NOTIFIED_DAY, dayStamp)
            .putStringSet(KEY_NOTIFIED, current)
            .apply()
    }
}
