package ca.signalwatch

import android.content.Context

object Prefs {
    private fun p(ctx: Context) = ctx.getSharedPreferences("signalwatch", Context.MODE_PRIVATE)

    fun watching(ctx: Context) = p(ctx).getBoolean("watching", false)
    fun setWatching(ctx: Context, v: Boolean) = p(ctx).edit().putBoolean("watching", v).apply()

    fun askedLocation(ctx: Context) = p(ctx).getBoolean("askedLocation", false)
    fun setAskedLocation(ctx: Context) = p(ctx).edit().putBoolean("askedLocation", true).apply()

    fun askedBattery(ctx: Context) = p(ctx).getBoolean("askedBattery", false)
    fun setAskedBattery(ctx: Context) = p(ctx).edit().putBoolean("askedBattery", true).apply()

    /** Alert when dBm is at or below this; 0 = only when there is no service. */
    fun alertDbm(ctx: Context) = p(ctx).getInt("alertDbm", 0)
    fun setAlertDbm(ctx: Context, v: Int) = p(ctx).edit().putInt("alertDbm", v).apply()

    /** When the current alert started; 0 when no alert is active. Survives service restarts. */
    fun alertSince(ctx: Context) = p(ctx).getLong("alertSince", 0L)
    fun setAlertSince(ctx: Context, v: Long) = p(ctx).edit().putLong("alertSince", v).apply()

    fun graphRange(ctx: Context) = p(ctx).getInt("graphRange", 1)
    fun setGraphRange(ctx: Context, v: Int) = p(ctx).edit().putInt("graphRange", v).apply()
}
