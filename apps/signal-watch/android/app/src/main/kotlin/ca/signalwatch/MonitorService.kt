package ca.signalwatch

import android.Manifest
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.TrafficStats
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.telephony.PhoneStateListener
import android.telephony.ServiceState
import android.telephony.SignalStrength
import android.telephony.TelephonyCallback
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat
import java.util.function.Consumer

/**
 * Foreground service that watches cellular signal continuously (screen on or off).
 *
 * Status comes from the modem's signal level and service state, not from pinging anything, so it
 * costs no data. A change has to hold for [STABLE_MS] before it is logged, and only crossing into
 * or out of "No service" raises an alert notification: one persistent "No service since…" that stays
 * until service returns, then one "Service is back". Good <-> Weak wobbles are logged quietly.
 */
class MonitorService : Service() {

    companion object {
        const val ACTION_START = "ca.signalwatch.START"
        const val ACTION_STOP = "ca.signalwatch.STOP"

        /** A change must persist this long before it counts. Stops flapping alerts. */
        const val STABLE_MS = 15_000L
        /** Housekeeping tick: data usage sample + sanity poll of the modem. */
        const val TICK_MS = 60_000L
        /** Mobile data moved in one tick that is worth a log line. */
        const val DATA_BURST_BYTES = 20L * 1024 * 1024

        // Live state for the screen to read. Written only on the main thread.
        @Volatile var running = false
        @Volatile var current = Status.UNKNOWN
        @Volatile var since = 0L
        @Volatile var detail = ""
        @Volatile var dataOk: Boolean? = null

        fun start(ctx: Context) {
            Prefs.setWatching(ctx, true)
            ContextCompat.startForegroundService(ctx, Intent(ctx, MonitorService::class.java).setAction(ACTION_START))
        }

        fun stop(ctx: Context) {
            Prefs.setWatching(ctx, false)
            ctx.startService(Intent(ctx, MonitorService::class.java).setAction(ACTION_STOP))
        }
    }

    private lateinit var tm: TelephonyManager
    private lateinit var cm: ConnectivityManager
    private lateinit var nm: NotificationManager
    private lateinit var store: EventStore
    private val handler = Handler(Looper.getMainLooper())

    // Raw modem inputs
    private var serviceState = -1
    private var level = -1
    private var dbm: Int? = null
    private var netType = ""

    // Committed status + pending change
    private var stable = Status.UNKNOWN
    private var stableSince = 0L
    private var pending = false
    private val commitRunnable = Runnable { commitPending() }

    // Data connectivity (default network, any transport)
    private var liveDataOk: Boolean? = null
    private var loggedDataOk: Boolean? = null
    private var dataTransport = ""
    private val dataRunnable = Runnable { commitData() }

    // Calls
    private var ringing = false
    private var callStart = 0L
    private var callIncoming = false

    // Data usage
    private var lastMobileBytes = -1L

    private var telephonyCallback: TelephonyCallback? = null
    private var phoneStateListener: PhoneStateListener? = null
    private var netCallback: ConnectivityManager.NetworkCallback? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }
        if (!running) begin()
        return START_STICKY
    }

    private fun begin() {
        tm = getSystemService(TelephonyManager::class.java)
        cm = getSystemService(ConnectivityManager::class.java)
        nm = getSystemService(NotificationManager::class.java)
        store = EventStore.get(this)
        Notes.ensureChannels(this)

        val notif = Notes.status(this, Status.UNKNOWN, "Signal Watch is starting", 0)
        if (Build.VERSION.SDK_INT >= 34) {
            var type = ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
            if (hasLocation()) type = type or ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            startForeground(Notes.ID_FOREGROUND, notif, type)
        } else if (Build.VERSION.SDK_INT >= 29) {
            val type = if (hasLocation()) ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION else 0
            startForeground(Notes.ID_FOREGROUND, notif, type)
        } else {
            startForeground(Notes.ID_FOREGROUND, notif)
        }

        running = true
        current = Status.UNKNOWN
        since = 0L

        // If we were restarted while service was out, keep the persistent alert consistent.
        val last = store.lastStatus()
        if (last != null && last.status == Status.NONE.name && System.currentTimeMillis() - last.t < 6 * 3_600_000L) {
            stable = Status.NONE
            stableSince = last.t
            current = stable
            since = stableSince
            nm.notify(Notes.ID_DROP, Notes.drop(this, stableSince))
        }

        store.add(System.currentTimeMillis(), EventStore.KIND_NOTE, null, "Started watching")

        registerTelephony()
        registerNetwork()
        poll()
        handler.postDelayed(tick, TICK_MS)
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        if (running) {
            // begin() ran, so every lateinit is set.
            try {
                if (Build.VERSION.SDK_INT >= 31) telephonyCallback?.let { tm.unregisterTelephonyCallback(it) }
                else phoneStateListener?.let { @Suppress("DEPRECATION") tm.listen(it, PhoneStateListener.LISTEN_NONE) }
            } catch (_: Exception) {}
            try { netCallback?.let { cm.unregisterNetworkCallback(it) } } catch (_: Exception) {}
            store.add(System.currentTimeMillis(), EventStore.KIND_NOTE, null, "Stopped watching")
            nm.cancel(Notes.ID_DROP)
            nm.cancel(Notes.ID_BACK)
        }
        running = false
        current = Status.UNKNOWN
        since = 0L
        super.onDestroy()
    }

    // ---------------------------------------------------------------- telephony

    private fun registerTelephony() {
        if (Build.VERSION.SDK_INT >= 31) {
            val full = object : TelephonyCallback(),
                TelephonyCallback.SignalStrengthsListener,
                TelephonyCallback.ServiceStateListener,
                TelephonyCallback.CallStateListener,
                TelephonyCallback.DataConnectionStateListener {
                override fun onSignalStrengthsChanged(signalStrength: SignalStrength) = onSignal(signalStrength)
                override fun onServiceStateChanged(serviceState: ServiceState) = onService(serviceState)
                override fun onCallStateChanged(state: Int) = onCall(state)
                override fun onDataConnectionStateChanged(state: Int, networkType: Int) { netType = typeName(networkType); refresh() }
            }
            try {
                tm.registerTelephonyCallback(mainExecutor, full)
                telephonyCallback = full
            } catch (_: SecurityException) {
                // Phone permission missing: fall back to what needs no permission at all.
                val minimal = object : TelephonyCallback(), TelephonyCallback.SignalStrengthsListener {
                    override fun onSignalStrengthsChanged(signalStrength: SignalStrength) = onSignal(signalStrength)
                }
                tm.registerTelephonyCallback(mainExecutor, minimal)
                telephonyCallback = minimal
            }
        } else {
            @Suppress("DEPRECATION")
            val l = object : PhoneStateListener() {
                @Deprecated("Deprecated in Java")
                override fun onSignalStrengthsChanged(signalStrength: SignalStrength) = onSignal(signalStrength)
                @Deprecated("Deprecated in Java")
                override fun onServiceStateChanged(serviceState: ServiceState) = onService(serviceState)
                @Deprecated("Deprecated in Java")
                override fun onCallStateChanged(state: Int, phoneNumber: String?) = onCall(state)
                @Deprecated("Deprecated in Java")
                override fun onDataConnectionStateChanged(state: Int, networkType: Int) { netType = typeName(networkType); refresh() }
            }
            @Suppress("DEPRECATION")
            tm.listen(
                l,
                PhoneStateListener.LISTEN_SIGNAL_STRENGTHS or PhoneStateListener.LISTEN_SERVICE_STATE or
                    PhoneStateListener.LISTEN_CALL_STATE or PhoneStateListener.LISTEN_DATA_CONNECTION_STATE
            )
            phoneStateListener = l
        }
    }

    private fun onSignal(ss: SignalStrength) {
        level = ss.level
        dbm = if (Build.VERSION.SDK_INT >= 29) {
            ss.cellSignalStrengths
                .map { it.dbm }
                .firstOrNull { it != Int.MAX_VALUE && it != Int.MIN_VALUE && it != 0 }
        } else null
        refresh()
    }

    private fun onService(s: ServiceState) {
        serviceState = s.state
        refresh()
    }

    /** Sanity poll so a missed callback can't leave us stuck. */
    private fun poll() {
        try { if (Build.VERSION.SDK_INT >= 28) tm.signalStrength?.let { onSignal(it) } } catch (_: Exception) {}
        try { if (hasPhoneState()) tm.serviceState?.let { onService(it) } } catch (_: Exception) {}
        try { if (hasPhoneState()) { netType = typeName(tm.dataNetworkType) } } catch (_: Exception) {}
        refresh()
    }

    private fun compute(): Status = when {
        serviceState == ServiceState.STATE_OUT_OF_SERVICE ||
            serviceState == ServiceState.STATE_POWER_OFF ||
            serviceState == ServiceState.STATE_EMERGENCY_ONLY -> Status.NONE
        level == 0 -> Status.NONE // SIGNAL_STRENGTH_NONE_OR_UNKNOWN
        level == 1 -> Status.WEAK
        level >= 2 -> Status.GOOD
        else -> Status.UNKNOWN
    }

    private fun buildDetail(): String {
        val parts = mutableListOf<String>()
        dbm?.let { parts += "$it dBm" }
        if (level >= 0) parts += "$level/4 bars"
        if (netType.isNotEmpty()) parts += netType
        when (liveDataOk) {
            true -> parts += if (dataTransport == "wifi") "data via wifi" else "data ok"
            false -> parts += "no data"
            null -> {}
        }
        return parts.joinToString(" · ")
    }

    private fun refresh() {
        val raw = compute()
        detail = buildDetail()
        if (stable == Status.UNKNOWN) {
            if (raw != Status.UNKNOWN) commit(raw, initial = true)
            return
        }
        if (raw == stable) {
            if (pending) { pending = false; handler.removeCallbacks(commitRunnable) }
        } else if (!pending) {
            pending = true
            handler.postDelayed(commitRunnable, STABLE_MS)
        }
        updateStatusNotification()
    }

    private fun commitPending() {
        pending = false
        val raw = compute()
        if (raw != Status.UNKNOWN && raw != stable) commit(raw)
    }

    private fun commit(s: Status, initial: Boolean = false) {
        val prev = stable
        val now = System.currentTimeMillis()
        val outFor = if (prev == Status.NONE && stableSince > 0) now - stableSince else 0L
        stable = s
        stableSince = now
        current = s
        since = now

        val id = store.add(now, EventStore.KIND_STATUS, s.name, if (initial) "started watching" else null, dbm)
        captureLocation(id)

        if (s == Status.NONE) {
            nm.cancel(Notes.ID_BACK)
            nm.notify(Notes.ID_DROP, Notes.drop(this, now))
        } else if (prev == Status.NONE) {
            nm.cancel(Notes.ID_DROP)
            nm.notify(Notes.ID_BACK, Notes.back(this, outFor, s))
        }
        updateStatusNotification()
    }

    private fun updateStatusNotification() {
        if (!running) return
        nm.notify(Notes.ID_FOREGROUND, Notes.status(this, stable, detail, stableSince))
    }

    // ---------------------------------------------------------------- data connectivity

    private fun registerNetwork() {
        val cb = object : ConnectivityManager.NetworkCallback() {
            override fun onCapabilitiesChanged(network: Network, caps: NetworkCapabilities) {
                val ok = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
                dataTransport = when {
                    caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
                    caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cell"
                    else -> "other"
                }
                setDataOk(ok)
            }
            override fun onLost(network: Network) { dataTransport = ""; setDataOk(false) }
        }
        try { cm.registerDefaultNetworkCallback(cb); netCallback = cb } catch (_: Exception) {}
    }

    private fun setDataOk(ok: Boolean) {
        handler.post {
            liveDataOk = ok
            dataOk = ok
            detail = buildDetail()
            if (loggedDataOk == null) { loggedDataOk = ok; updateStatusNotification(); return@post }
            handler.removeCallbacks(dataRunnable)
            if (ok != loggedDataOk) handler.postDelayed(dataRunnable, STABLE_MS)
            updateStatusNotification()
        }
    }

    private fun commitData() {
        val ok = liveDataOk ?: return
        if (ok == loggedDataOk) return
        loggedDataOk = ok
        store.add(
            System.currentTimeMillis(), EventStore.KIND_DATA, stable.name,
            if (ok) "Data working again" + (if (dataTransport == "wifi") " (wifi)" else "") else "Data stopped working"
        )
    }

    // ---------------------------------------------------------------- calls

    private fun onCall(state: Int) {
        val now = System.currentTimeMillis()
        when (state) {
            TelephonyManager.CALL_STATE_RINGING -> ringing = true
            TelephonyManager.CALL_STATE_OFFHOOK -> if (callStart == 0L) { callStart = now; callIncoming = ringing }
            TelephonyManager.CALL_STATE_IDLE -> {
                if (callStart != 0L) {
                    store.add(
                        now, EventStore.KIND_CALL, stable.name,
                        (if (callIncoming) "Incoming" else "Outgoing") + " call, " + Notes.duration(now - callStart)
                    )
                    callStart = 0L
                } else if (ringing) {
                    store.add(now, EventStore.KIND_CALL, stable.name, "Missed call")
                }
                ringing = false
            }
        }
    }

    // ---------------------------------------------------------------- housekeeping tick

    private val tick = object : Runnable {
        override fun run() {
            sampleData()
            poll()
            handler.postDelayed(this, TICK_MS)
        }
    }

    private fun sampleData() {
        val rx = TrafficStats.getMobileRxBytes()
        val tx = TrafficStats.getMobileTxBytes()
        if (rx == TrafficStats.UNSUPPORTED.toLong() || tx == TrafficStats.UNSUPPORTED.toLong()) return
        val now = rx + tx
        val t = System.currentTimeMillis()
        if (lastMobileBytes >= 0) {
            // Counters reset on reboot; if they went backwards, count what has accrued since boot.
            val delta = if (now >= lastMobileBytes) now - lastMobileBytes else now
            if (delta > 0) store.addMobileBytes(t, delta)
            if (delta >= DATA_BURST_BYTES) {
                store.add(t, EventStore.KIND_DATA, stable.name, "Data burst: ${mb(delta)} in the last minute")
            }
        }
        lastMobileBytes = now
    }

    // ---------------------------------------------------------------- location

    private fun captureLocation(eventId: Long) {
        if (!hasLocation()) return
        val lm = getSystemService(LocationManager::class.java)
        try {
            val provider = when {
                lm.isProviderEnabled(LocationManager.GPS_PROVIDER) -> LocationManager.GPS_PROVIDER
                lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER) -> LocationManager.NETWORK_PROVIDER
                else -> return
            }
            if (Build.VERSION.SDK_INT >= 30) {
                lm.getCurrentLocation(provider, null, mainExecutor, Consumer<Location?> { loc ->
                    if (loc != null) store.setLocation(eventId, loc.latitude, loc.longitude)
                })
            } else {
                @Suppress("DEPRECATION")
                lm.requestSingleUpdate(provider, object : LocationListener {
                    override fun onLocationChanged(location: Location) { store.setLocation(eventId, location.latitude, location.longitude) }
                    @Deprecated("Deprecated in Java")
                    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
                    override fun onProviderEnabled(provider: String) {}
                    override fun onProviderDisabled(provider: String) {}
                }, Looper.getMainLooper())
            }
        } catch (_: Exception) {}
    }

    // ---------------------------------------------------------------- helpers

    private fun hasLocation() =
        ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED

    private fun hasPhoneState() =
        ContextCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED

    private fun mb(bytes: Long): String = "%.1f MB".format(bytes / 1048576.0)

    private fun typeName(t: Int): String = when (t) {
        TelephonyManager.NETWORK_TYPE_NR -> "5G"
        TelephonyManager.NETWORK_TYPE_LTE -> "LTE"
        TelephonyManager.NETWORK_TYPE_HSPAP, TelephonyManager.NETWORK_TYPE_HSPA,
        TelephonyManager.NETWORK_TYPE_HSDPA, TelephonyManager.NETWORK_TYPE_HSUPA,
        TelephonyManager.NETWORK_TYPE_UMTS -> "3G"
        TelephonyManager.NETWORK_TYPE_EDGE, TelephonyManager.NETWORK_TYPE_GPRS -> "2G"
        TelephonyManager.NETWORK_TYPE_UNKNOWN -> ""
        else -> "cell"
    }
}
