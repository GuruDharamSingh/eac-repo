package ca.signalwatch

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Notification plumbing. Two channels: a quiet always-on status line, and loud drop/back alerts. */
object Notes {
    const val CH_STATUS = "status"
    const val CH_ALERTS = "alerts"
    const val ID_FOREGROUND = 1
    const val ID_DROP = 2
    const val ID_BACK = 3

    private val timeFmt = SimpleDateFormat("h:mm a", Locale.getDefault())
    fun time(t: Long): String = timeFmt.format(Date(t))

    fun duration(ms: Long): String {
        val s = ms / 1000
        if (s < 60) return "${s}s"
        val m = s / 60
        if (m < 60) return "${m} min"
        val h = m / 60
        return "${h}h ${m % 60}m"
    }

    fun ensureChannels(ctx: Context) {
        val nm = ctx.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(CH_STATUS, "Current status", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Always-on status line while watching"
                setShowBadge(false)
            }
        )
        nm.createNotificationChannel(
            NotificationChannel(CH_ALERTS, "Service dropped / came back", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "One alert when service drops, one when it comes back"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 500, 200, 500)
            }
        )
    }

    private fun openApp(ctx: Context): PendingIntent = PendingIntent.getActivity(
        ctx, 0, Intent(ctx, MainActivity::class.java),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )

    fun status(ctx: Context, status: Status, detail: String, since: Long): Notification {
        val text = buildString {
            if (detail.isNotEmpty()) append(detail)
            if (since > 0) { if (isNotEmpty()) append(" · "); append("since ${time(since)}") }
        }
        return Notification.Builder(ctx, CH_STATUS)
            .setSmallIcon(if (status == Status.NONE) R.drawable.ic_stat_none else R.drawable.ic_stat)
            .setContentTitle(status.label)
            .setContentText(text.ifEmpty { "Watching your signal" })
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setContentIntent(openApp(ctx))
            .build()
    }

    /** Stays in the shade until service comes back. Posted once per drop, never re-alerts. */
    fun drop(ctx: Context, since: Long): Notification =
        Notification.Builder(ctx, CH_ALERTS)
            .setSmallIcon(R.drawable.ic_stat_none)
            .setColor(0xFFE5484D.toInt())
            .setContentTitle("No service")
            .setContentText("Dropped at ${time(since)}")
            .setWhen(since)
            .setShowWhen(true)
            .setUsesChronometer(true)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(Notification.CATEGORY_STATUS)
            .setContentIntent(openApp(ctx))
            .build()

    fun back(ctx: Context, outFor: Long, status: Status): Notification =
        Notification.Builder(ctx, CH_ALERTS)
            .setSmallIcon(R.drawable.ic_stat)
            .setColor(0xFF2FBF71.toInt())
            .setContentTitle("Service is back")
            .setContentText(
                (if (status == Status.WEAK) "Weak but working" else "Working well") +
                    (if (outFor > 0) " · was out for ${duration(outFor)}" else "")
            )
            .setAutoCancel(true)
            .setOnlyAlertOnce(true)
            .setTimeoutAfter(60 * 60_000L)
            .setCategory(Notification.CATEGORY_STATUS)
            .setContentIntent(openApp(ctx))
            .build()
}
