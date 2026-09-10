package ca.signalwatch

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Resume watching after a reboot if it was on before. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        if (Prefs.watching(context)) MonitorService.start(context)
    }
}
