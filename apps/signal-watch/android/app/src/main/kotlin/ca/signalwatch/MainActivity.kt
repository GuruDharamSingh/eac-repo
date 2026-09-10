package ca.signalwatch

import android.Manifest
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private lateinit var card: LinearLayout
    private lateinit var statusLabel: TextView
    private lateinit var statusDetail: TextView
    private lateinit var statusSince: TextView
    private lateinit var toggle: Button
    private lateinit var battery: Button
    private lateinit var today: TextView
    private lateinit var log: LinearLayout
    private lateinit var logEmpty: TextView

    private val handler = Handler(Looper.getMainLooper())
    private val refresh = object : Runnable {
        override fun run() { render(); handler.postDelayed(this, 2_000L) }
    }
    private val dayFmt = SimpleDateFormat("EEE, MMM d", Locale.getDefault())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        card = findViewById(R.id.card)
        statusLabel = findViewById(R.id.statusLabel)
        statusDetail = findViewById(R.id.statusDetail)
        statusSince = findViewById(R.id.statusSince)
        toggle = findViewById(R.id.toggle)
        battery = findViewById(R.id.battery)
        today = findViewById(R.id.today)
        log = findViewById(R.id.log)
        logEmpty = findViewById(R.id.logEmpty)

        card.background = (card.background as GradientDrawable).mutate()

        toggle.setOnClickListener { onToggle() }
        battery.setOnClickListener { requestBatteryExemption() }
        findViewById<Button>(R.id.share).setOnClickListener { share() }
        findViewById<Button>(R.id.clear).setOnClickListener { clearLog() }

        // Was watching before the process died (or after a reboot before the receiver fired)? Resume.
        if (Prefs.watching(this) && !MonitorService.running && granted(Manifest.permission.READ_PHONE_STATE)) {
            MonitorService.start(this)
        }
    }

    override fun onResume() { super.onResume(); handler.post(refresh) }
    override fun onPause() { super.onPause(); handler.removeCallbacks(refresh) }

    // ---------------------------------------------------------------- start / stop + permissions

    private fun onToggle() {
        if (MonitorService.running) { MonitorService.stop(this); render(); return }
        val need = mutableListOf<String>()
        if (Build.VERSION.SDK_INT >= 33 && !granted(Manifest.permission.POST_NOTIFICATIONS)) need += Manifest.permission.POST_NOTIFICATIONS
        if (!granted(Manifest.permission.READ_PHONE_STATE)) need += Manifest.permission.READ_PHONE_STATE
        if (!granted(Manifest.permission.ACCESS_FINE_LOCATION) && !Prefs.askedLocation(this)) {
            need += Manifest.permission.ACCESS_FINE_LOCATION
            need += Manifest.permission.ACCESS_COARSE_LOCATION
        }
        if (need.isNotEmpty()) { requestPermissions(need.toTypedArray(), 1); return }
        startWatching()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        Prefs.setAskedLocation(this)
        if (granted(Manifest.permission.READ_PHONE_STATE)) startWatching()
        else Toast.makeText(this, "Phone permission is needed to read the signal", Toast.LENGTH_LONG).show()
    }

    private fun startWatching() {
        MonitorService.start(this)
        render()
        if (!ignoringBattery() && !Prefs.askedBattery(this)) {
            Prefs.setAskedBattery(this)
            AlertDialog.Builder(this)
                .setTitle("Keep it running")
                .setMessage("Android stops background apps to save battery. Allow Signal Watch to keep running so it can still alert you with the screen off.")
                .setPositiveButton("Allow") { _, _ -> requestBatteryExemption() }
                .setNegativeButton("Later", null)
                .show()
        }
    }

    private fun requestBatteryExemption() {
        try {
            startActivity(
                Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$packageName"))
            )
        } catch (_: Exception) {
            try { startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)) } catch (_: Exception) {}
        }
    }

    private fun ignoringBattery(): Boolean =
        getSystemService(PowerManager::class.java).isIgnoringBatteryOptimizations(packageName)

    private fun granted(p: String) = ContextCompat.checkSelfPermission(this, p) == PackageManager.PERMISSION_GRANTED

    // ---------------------------------------------------------------- rendering

    private fun render() {
        val running = MonitorService.running
        val s = if (running) MonitorService.current else Status.UNKNOWN
        val color = when (s) {
            Status.GOOD -> R.color.good
            Status.WEAK -> R.color.weak
            Status.NONE -> R.color.none
            Status.UNKNOWN -> R.color.unknown
        }
        (card.background as GradientDrawable).setColor(ContextCompat.getColor(this, color))
        val fg = ContextCompat.getColor(this, if (s == Status.WEAK) R.color.on_weak else R.color.on_dark)
        statusLabel.setTextColor(fg); statusDetail.setTextColor(fg); statusSince.setTextColor(fg)

        statusLabel.text = if (running) s.label else "Not watching"
        statusDetail.text = if (running) MonitorService.detail.ifEmpty { "Reading the signal…" } else "Tap start. It keeps watching with the screen off."
        statusSince.text = if (running && MonitorService.since > 0)
            "for ${Notes.duration(System.currentTimeMillis() - MonitorService.since)} (since ${Notes.time(MonitorService.since)})"
        else ""

        toggle.text = if (running) "Stop watching" else "Start watching"
        toggle.setBackgroundColor(ContextCompat.getColor(this, if (running) R.color.stop else R.color.accent))
        battery.visibility = if (running && !ignoringBattery()) View.VISIBLE else View.GONE

        renderLog()
    }

    private var lastLogKey = ""

    private fun renderLog() {
        val store = EventStore.get(this)
        val events = store.recent()
        val key = events.size.toString() + ":" + (events.firstOrNull()?.id ?: 0) + ":" + (events.firstOrNull()?.lat ?: 0.0) + ":" + store.mobileBytes(EventStore.dayKey(System.currentTimeMillis()))
        if (key == lastLogKey) return
        lastLogKey = key

        val todayKey = EventStore.dayKey(System.currentTimeMillis())
        val dropsToday = events.count { it.kind == EventStore.KIND_STATUS && it.status == Status.NONE.name && EventStore.dayKey(it.t) == todayKey && it.detail == null }
        val mbToday = store.mobileBytes(todayKey) / 1048576.0
        today.text = "Today: $dropsToday drop${if (dropsToday == 1) "" else "s"} · %.0f MB mobile data".format(mbToday)

        log.removeAllViews()
        logEmpty.visibility = if (events.isEmpty()) View.VISIBLE else View.GONE
        var lastDay = ""
        for (e in events) {
            val day = EventStore.dayKey(e.t)
            if (day != lastDay) {
                lastDay = day
                val drops = events.count { it.kind == EventStore.KIND_STATUS && it.status == Status.NONE.name && EventStore.dayKey(it.t) == day && it.detail == null }
                val mb = store.mobileBytes(day) / 1048576.0
                val h = TextView(this)
                h.text = (if (day == todayKey) "Today" else dayFmt.format(Date(e.t))) +
                    " · $drops drop${if (drops == 1) "" else "s"} · %.0f MB".format(mb)
                h.setTextColor(ContextCompat.getColor(this, R.color.muted))
                h.textSize = 12f
                h.setPadding(0, dp(14), 0, dp(4))
                log.addView(h)
            }
            val row = TextView(this)
            row.text = "${dot(e)}  ${Notes.time(e.t)}   ${describe(e)}"
            row.setTextColor(ContextCompat.getColor(this, R.color.text))
            row.textSize = 15f
            row.setPadding(0, dp(6), 0, dp(6))
            row.setTextIsSelectable(false)
            log.addView(row)
            val extras = extras(e)
            if (extras.isNotEmpty()) {
                val sub = TextView(this)
                sub.text = "       $extras"
                sub.setTextColor(ContextCompat.getColor(this, R.color.muted))
                sub.textSize = 12f
                sub.setPadding(0, 0, 0, dp(4))
                log.addView(sub)
            }
        }
    }

    private fun dot(e: Event): String = when {
        e.kind == EventStore.KIND_STATUS -> when (Status.of(e.status)) {
            Status.GOOD -> "🟢"; Status.WEAK -> "🟠"; Status.NONE -> "🔴"; Status.UNKNOWN -> "⚪"
        }
        e.kind == EventStore.KIND_CALL -> "📞"
        e.kind == EventStore.KIND_DATA -> "📶"
        else -> "▫️"
    }

    private fun describe(e: Event): String = when (e.kind) {
        EventStore.KIND_STATUS -> Status.of(e.status).label + (if (e.detail == "started watching") " (started)" else "")
        else -> e.detail ?: ""
    }

    private fun extras(e: Event): String {
        val bits = mutableListOf<String>()
        if (e.kind == EventStore.KIND_STATUS && e.dbm != null) bits += "${e.dbm} dBm"
        if (e.kind != EventStore.KIND_STATUS && e.status != null && e.status != Status.UNKNOWN.name) bits += "signal: " + Status.of(e.status).label.lowercase().removePrefix("service is ")
        if (e.lat != null && e.lon != null) bits += "%.4f, %.4f".format(e.lat, e.lon)
        return bits.joinToString(" · ")
    }

    private fun dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()

    // ---------------------------------------------------------------- share / clear

    private fun share() {
        val store = EventStore.get(this)
        val events = store.recent().asReversed()
        if (events.isEmpty()) { Toast.makeText(this, "Nothing to share yet", Toast.LENGTH_SHORT).show(); return }
        val sb = StringBuilder("Signal Watch log (last ${EventStore.RETENTION_DAYS} days)\n")
        var lastDay = ""
        for (e in events) {
            val day = EventStore.dayKey(e.t)
            if (day != lastDay) {
                lastDay = day
                sb.append("\n").append(dayFmt.format(Date(e.t)))
                    .append("  (mobile data: %.0f MB)\n".format(store.mobileBytes(day) / 1048576.0))
            }
            sb.append(Notes.time(e.t)).append("  ").append(describe(e))
            val x = extras(e)
            if (x.isNotEmpty()) sb.append("  [").append(x).append("]")
            if (e.lat != null && e.lon != null) sb.append("  https://maps.google.com/?q=").append(e.lat).append(",").append(e.lon)
            sb.append("\n")
        }
        val i = Intent(Intent.ACTION_SEND).setType("text/plain")
            .putExtra(Intent.EXTRA_SUBJECT, "Signal Watch log")
            .putExtra(Intent.EXTRA_TEXT, sb.toString())
        startActivity(Intent.createChooser(i, "Share log"))
    }

    private fun clearLog() {
        AlertDialog.Builder(this)
            .setMessage("Clear the whole log?")
            .setPositiveButton("Clear") { _, _ -> EventStore.get(this).clear(); lastLogKey = ""; render() }
            .setNegativeButton("Cancel", null)
            .show()
    }
}
