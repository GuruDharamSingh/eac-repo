package ca.signalwatch

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.View
import androidx.core.content.ContextCompat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Signal strength over time: dBm line (coloured by bars), red bands where service was out, and a strip of
 * bars 0-4 underneath. Touch to read a single sample.
 */
class SignalGraph @JvmOverloads constructor(ctx: Context, attrs: AttributeSet? = null) : View(ctx, attrs) {

    var threshold: Int = 0
    var onPick: ((Sample?) -> Unit)? = null

    private var data: List<Sample> = emptyList()
    private var from = 0L
    private var to = 1L
    private var picked = -1

    private val d = resources.displayMetrics.density
    private val yMax = -50f
    private val yMin = -130f
    private val gap = 4 * 60_000L

    private val grid = Paint().apply { color = Color.argb(40, 255, 255, 255); strokeWidth = 1f }
    private val label = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = ContextCompat.getColor(ctx, R.color.muted); textSize = 10 * d }
    private val line = Paint(Paint.ANTI_ALIAS_FLAG).apply { strokeWidth = 2 * d; style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND }
    private val band = Paint().apply { color = Color.argb(70, 229, 72, 77) }
    private val fill = Paint()
    private val cursor = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE; strokeWidth = 1.5f * d }

    fun setData(samples: List<Sample>, from: Long, to: Long) {
        data = samples; this.from = from; this.to = maxOf(to, from + 1); picked = -1
        invalidate()
    }

    private fun levelColor(level: Int): Int = ContextCompat.getColor(
        context, when { level >= 3 -> R.color.good; level == 2 -> R.color.good; level == 1 -> R.color.weak; else -> R.color.none }
    )

    private fun stripColor(level: Int): Int = when (level) {
        4 -> Color.rgb(47, 191, 113)
        3 -> Color.rgb(110, 200, 100)
        2 -> Color.rgb(170, 200, 80)
        1 -> Color.rgb(240, 166, 58)
        else -> Color.rgb(229, 72, 77)
    }

    override fun onDraw(c: Canvas) {
        val left = 38 * d
        val right = width - 6 * d
        val top = 6 * d
        val stripH = 12 * d
        val axisH = 16 * d
        val plotBottom = height - axisH - stripH - 6 * d
        val stripTop = plotBottom + 6 * d
        val w = right - left

        fun x(t: Long) = left + (t - from).toFloat() / (to - from) * w
        fun y(dbm: Float) = top + (yMax - dbm.coerceIn(yMin, yMax)) / (yMax - yMin) * (plotBottom - top)

        for (v in intArrayOf(-60, -80, -100, -120)) {
            val yy = y(v.toFloat())
            c.drawLine(left, yy, right, yy, grid)
            c.drawText("$v", 2 * d, yy + 4 * d, label)
        }

        if (threshold != 0) {
            val ty = y(threshold.toFloat())
            val dash = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = Color.argb(200, 240, 166, 58); strokeWidth = 1.5f * d; style = Paint.Style.STROKE
                pathEffect = android.graphics.DashPathEffect(floatArrayOf(8 * d, 5 * d), 0f)
            }
            c.drawLine(left, ty, right, ty, dash)
            c.drawText("alert $threshold", left + 4 * d, ty - 3 * d, label)
        }

        val fmt = SimpleDateFormat(if (to - from > 30 * 3_600_000L) "EEE" else "h a", Locale.getDefault())
        for (i in 0..4) {
            val t = from + (to - from) * i / 4
            val s = fmt.format(Date(t))
            val tx = x(t).coerceIn(left, right - label.measureText(s))
            c.drawText(s, tx, height - 2 * d, label)
        }

        if (data.isEmpty()) {
            c.drawText("No samples in this range yet", left + 8 * d, (top + plotBottom) / 2, label)
            return
        }

        for (i in data.indices) {
            val a = data[i]
            val end = if (i + 1 < data.size && data[i + 1].t - a.t <= gap) data[i + 1].t else minOf(a.t + 60_000L, to)
            if (a.level == 0) c.drawRect(x(a.t), top, x(end), plotBottom, band)
            fill.color = stripColor(a.level)
            c.drawRect(x(a.t), stripTop, maxOf(x(end), x(a.t) + 1f), stripTop + stripH, fill)
        }

        val path = Path()
        var lastLevel = -1
        var open = false
        fun flush() {
            if (open) { line.color = levelColor(lastLevel); c.drawPath(path, line); path.reset(); open = false }
        }
        for (i in data.indices) {
            val s = data[i]
            val dbm = s.dbm
            if (dbm == null) { flush(); continue }
            val broke = i > 0 && s.t - data[i - 1].t > gap
            if (broke) flush()
            val px = x(s.t); val py = y(dbm.toFloat())
            if (open && levelColor(s.level) != levelColor(lastLevel)) {
                path.lineTo(px, py); flush()
            }
            if (!open) { path.moveTo(px, py); open = true } else path.lineTo(px, py)
            lastLevel = s.level
        }
        flush()

        if (picked in data.indices) {
            val s = data[picked]
            c.drawLine(x(s.t), top, x(s.t), stripTop + stripH, cursor)
        }
    }

    override fun onTouchEvent(e: MotionEvent): Boolean {
        if (data.isEmpty()) return false
        parent?.requestDisallowInterceptTouchEvent(e.actionMasked != MotionEvent.ACTION_UP)
        if (e.actionMasked == MotionEvent.ACTION_UP || e.actionMasked == MotionEvent.ACTION_CANCEL) return true
        val left = 38 * d
        val t = from + ((e.x - left) / (width - left - 6 * d) * (to - from)).toLong()
        var best = 0
        var bestD = Long.MAX_VALUE
        for (i in data.indices) { val dd = Math.abs(data[i].t - t); if (dd < bestD) { bestD = dd; best = i } }
        picked = best
        onPick?.invoke(data[best])
        invalidate()
        return true
    }
}
