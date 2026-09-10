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
}
