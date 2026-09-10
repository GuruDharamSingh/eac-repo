package ca.signalwatch

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class Event(
    val id: Long,
    val t: Long,
    val kind: String,
    val status: String?,
    val detail: String?,
    val dbm: Int?,
    val lat: Double?,
    val lon: Double?,
)

/** Plain SQLite. Keeps the last [RETENTION_DAYS] days of events plus a per-day mobile data total. */
class EventStore private constructor(context: Context) :
    SQLiteOpenHelper(context.applicationContext, "signalwatch.db", null, 1) {

    companion object {
        const val RETENTION_DAYS = 5L
        const val KIND_STATUS = "status"
        const val KIND_CALL = "call"
        const val KIND_DATA = "data"
        const val KIND_NOTE = "note"

        private val dayFmt = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        fun dayKey(t: Long): String = dayFmt.format(Date(t))

        @Volatile private var instance: EventStore? = null
        fun get(context: Context): EventStore =
            instance ?: synchronized(this) { instance ?: EventStore(context).also { instance = it } }
    }

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            "CREATE TABLE events(id INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER NOT NULL, kind TEXT NOT NULL, " +
                "status TEXT, detail TEXT, dbm INTEGER, lat REAL, lon REAL)"
        )
        db.execSQL("CREATE INDEX events_t ON events(t)")
        db.execSQL("CREATE TABLE days(day TEXT PRIMARY KEY, mobile_bytes INTEGER NOT NULL DEFAULT 0)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {}

    @Synchronized
    fun add(t: Long, kind: String, status: String? = null, detail: String? = null, dbm: Int? = null): Long {
        val cv = ContentValues().apply {
            put("t", t); put("kind", kind); put("status", status); put("detail", detail)
            if (dbm != null) put("dbm", dbm)
        }
        val id = writableDatabase.insert("events", null, cv)
        prune()
        return id
    }

    @Synchronized
    fun setLocation(id: Long, lat: Double, lon: Double) {
        writableDatabase.update(
            "events", ContentValues().apply { put("lat", lat); put("lon", lon) }, "id=?", arrayOf(id.toString())
        )
    }

    @Synchronized
    fun addMobileBytes(t: Long, bytes: Long) {
        val day = dayKey(t)
        writableDatabase.execSQL("INSERT OR IGNORE INTO days(day, mobile_bytes) VALUES(?, 0)", arrayOf(day))
        writableDatabase.execSQL("UPDATE days SET mobile_bytes = mobile_bytes + ? WHERE day = ?", arrayOf(bytes, day))
    }

    fun mobileBytes(day: String): Long =
        readableDatabase.rawQuery("SELECT mobile_bytes FROM days WHERE day=?", arrayOf(day)).use {
            if (it.moveToFirst()) it.getLong(0) else 0L
        }

    fun recent(): List<Event> =
        readableDatabase.rawQuery(
            "SELECT id,t,kind,status,detail,dbm,lat,lon FROM events WHERE t>=? ORDER BY t DESC",
            arrayOf(cutoff().toString())
        ).use { c ->
            buildList {
                while (c.moveToNext()) add(
                    Event(
                        c.getLong(0), c.getLong(1), c.getString(2), c.getString(3), c.getString(4),
                        if (c.isNull(5)) null else c.getInt(5),
                        if (c.isNull(6)) null else c.getDouble(6),
                        if (c.isNull(7)) null else c.getDouble(7),
                    )
                )
            }
        }

    /** The most recent committed status, used to keep the persistent "No service" alert across restarts. */
    fun lastStatus(): Event? =
        readableDatabase.rawQuery(
            "SELECT id,t,kind,status,detail,dbm,lat,lon FROM events WHERE kind=? ORDER BY t DESC LIMIT 1",
            arrayOf(KIND_STATUS)
        ).use { c ->
            if (!c.moveToFirst()) null else Event(
                c.getLong(0), c.getLong(1), c.getString(2), c.getString(3), c.getString(4),
                if (c.isNull(5)) null else c.getInt(5),
                if (c.isNull(6)) null else c.getDouble(6),
                if (c.isNull(7)) null else c.getDouble(7),
            )
        }

    @Synchronized
    fun clear() {
        writableDatabase.delete("events", null, null)
        writableDatabase.delete("days", null, null)
    }

    private fun cutoff(): Long = System.currentTimeMillis() - RETENTION_DAYS * 86_400_000L

    private fun prune() {
        val c = cutoff()
        writableDatabase.delete("events", "t<?", arrayOf(c.toString()))
        writableDatabase.delete("days", "day<?", arrayOf(dayKey(c)))
    }
}
