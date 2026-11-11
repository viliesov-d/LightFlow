package com.lightflow.widgets

import android.app.Activity
import android.app.ActivityOptions
import android.app.PendingIntent
import android.app.AlarmManager
import android.content.BroadcastReceiver
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.SystemClock
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.View
import android.widget.RemoteViews
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OutOfQuotaPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime
import java.util.concurrent.TimeUnit

private const val API = "https://lightflow-api.lightflow-viliesov.workers.dev/api/v1/schedule"
private const val SITE = "https://lightflow-api.lightflow-viliesov.workers.dev/"
private const val RED = "#FF838B"
private const val GREEN = "#55DFA9"
private const val NEUTRAL = "#CAD7E7"
private const val ACTION_REFRESH = "com.lightflow.widgets.ACTION_REFRESH_WIDGET"
private const val PERIODIC_WORK = "LightFlowWidgetRefresh"
private const val BOUNDARY_WORK = "LightFlowNextBoundary"
private const val MANUAL_WORK = "LightFlowUserRefresh"
private const val ACTION_CLOCK = "com.lightflow.widgets.ACTION_CLOCK_TICK"
private val KYIV: ZoneId = ZoneId.of("Europe/Kyiv")

internal data class Period(val start: String, val end: String, val off: Boolean)
internal data class Schedule(val periods: List<Period>, val checkedAt: Instant)

internal fun minutes(text: String): Int? {
    if (!Regex("^\\d{2}:\\d{2}$").matches(text)) return null
    val (hour, minute) = text.split(":").map { it.toInt() }
    if (hour > 24 || minute > 59 || (hour == 24 && minute != 0)) return null
    return hour * 60 + minute
}

/** The API must be fresh, date-scoped, and cover 00:00 to 24:00 without gaps. */
private fun parseSchedule(raw: String): Schedule? {
    val data = JSONObject(raw)
    if (data.optString("kind") != "schedule") return null
    if (data.optString("state") !in listOf("scheduled_off", "scheduled_on")) return null
    if (data.optString("date") != LocalDate.now(KYIV).toString()) return null

    val checked = try { Instant.parse(data.getString("checkedAt")) }
    catch (_: Exception) { return null }
    val ageSeconds = Duration.between(checked, Instant.now()).seconds
    if (ageSeconds < -60 || ageSeconds > 20 * 60) return null

    val items = data.optJSONArray("periods") ?: return null
    if (items.length() == 0 || items.length() > 48) return null
    val periods = mutableListOf<Period>()
    var cursor = 0
    for (i in 0 until items.length()) {
        val item = items.optJSONObject(i) ?: return null
        val start = item.optString("start")
        val end = item.optString("end")
        val a = minutes(start) ?: return null
        val b = minutes(end) ?: return null
        val state = item.optString("state")
        if (a != cursor || b <= a || b > 1440 ||
            state !in listOf("scheduled_off", "scheduled_on")) return null
        periods.add(Period(start, end, state == "scheduled_off"))
        cursor = b
    }
    if (cursor != 1440) return null
    return Schedule(periods, checked)
}

/** Widget taps are delivered directly to our app; they never launch a browser. */
private fun refreshIntent(context: Context, widgetId: Int): PendingIntent {
    val intent = Intent(context, RefreshTapReceiver::class.java).apply {
        action = ACTION_REFRESH
        putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
        addFlags(Intent.FLAG_RECEIVER_FOREGROUND)
    }
    return PendingIntent.getBroadcast(
        context, widgetId, intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
}

private object Renderer {
    private data class Layout(
        val kind: WidgetArt.Kind,
        val provider: Class<out AppWidgetProvider>,
        val resource: Int,
        val root: Int,
        val artwork: Int,
        val loading: Int,
        val ripple: Int,
        val label: Int
    )
    private val layouts = listOf(
        Layout(WidgetArt.Kind.BULB, SmallWidgetProvider::class.java,
            R.layout.widget_small, R.id.smallRoot, R.id.smallArtwork,
            R.id.smallLoading, R.id.smallRipple, R.id.smallLoadingText),
        Layout(WidgetArt.Kind.COMPACT_DIAL, CompactDialWidgetProvider::class.java,
            R.layout.widget_compact, R.id.compactRoot, R.id.compactArtwork,
            R.id.compactLoading, R.id.compactRipple, R.id.compactLoadingText),
        Layout(WidgetArt.Kind.DIAL, LargeWidgetProvider::class.java,
            R.layout.widget_large, R.id.largeRoot, R.id.largeArtwork,
            R.id.largeLoading, R.id.largeRipple, R.id.largeLoadingText)
    )

    fun render(context: Context, schedule: Schedule?, only: WidgetArt.Kind? = null) {
        val manager = AppWidgetManager.getInstance(context)
        // Draw with the PHONE clock at this moment. All colors come from verified periods.
        val now = ZonedDateTime.now(KYIV)
        for (config in layouts) {
            if (only != null && config.kind != only) continue
            val ids = manager.getAppWidgetIds(ComponentName(context, config.provider))
            if (ids.isEmpty()) continue
            val bitmap = WidgetArt.draw(config.kind, schedule, now)
            for (id in ids) {
                val views = RemoteViews(context.packageName, config.resource)
                views.setImageViewBitmap(config.artwork, bitmap)
                views.setViewVisibility(config.artwork, View.VISIBLE)
                views.setViewVisibility(config.loading, View.GONE)
                views.setOnClickPendingIntent(config.root, refreshIntent(context, id))
                manager.updateAppWidget(id, views)
            }
        }
    }

    /** Undo a partial loading frame if a second tap changes the gesture into 'open'. */
    fun cancelLoading(context: Context, widgetId: Int) {
        val manager = AppWidgetManager.getInstance(context)
        val info = manager.getAppWidgetInfo(widgetId) ?: return
        val config = layouts.firstOrNull { it.provider.name == info.provider.className } ?: return
        val view = RemoteViews(context.packageName, config.resource)
        view.setViewVisibility(config.loading, View.GONE)
        view.setViewVisibility(config.artwork, View.VISIBLE)
        manager.partiallyUpdateAppWidget(widgetId, view)
    }

    fun loadingFrame(context: Context, widgetId: Int, step: Int) {
        val manager = AppWidgetManager.getInstance(context)
        val info = manager.getAppWidgetInfo(widgetId) ?: return
        val config = layouts.firstOrNull { it.provider.name == info.provider.className } ?: return
        val views = RemoteViews(context.packageName, config.resource)
        val frame = when(step.coerceIn(0,7)) {
            0 -> R.drawable.ripple_stage_1
            1 -> R.drawable.ripple_stage_2
            2 -> R.drawable.ripple_stage_3
            3 -> R.drawable.ripple_stage_4
            4 -> R.drawable.ripple_stage_5
            5 -> R.drawable.ripple_stage_6
            6 -> R.drawable.ripple_stage_7
            else -> R.drawable.ripple_stage_8
        }
        // Hide the old card artwork while the transparent ripple is visible.
        // This avoids text/ring collisions and never introduces a square background.
        views.setViewVisibility(config.artwork, View.INVISIBLE)
        views.setViewVisibility(config.loading, View.VISIBLE)
        views.setImageViewResource(config.ripple, frame)
        views.setTextViewText(config.label, when(step) {
            0 -> " "
            in 1..3 -> "Оновлюємо…"
            in 4..6 -> "Оновлюємо графік…"
            else -> "Перевіряємо дані…"
        })
        // Text brightens over consecutive frames; the overlay has no rectangular background.
        views.setTextColor(config.label, Color.parseColor(when(step) {
            0 -> "#0E1928"
            1 -> "#718DA6"
            2 -> "#91B3BE"
            3 -> "#BEDACF"
            else -> "#F8FBFF"
        }))
        // Lightweight frame update preserves prior artwork in RemoteViews.
        // Never partiallyUpdateAppWidget with a new bitmap (bitmap memory leak risk).
        manager.partiallyUpdateAppWidget(widgetId, views)
    }
}

/**
 * WorkManager performs HTTPS requests away from the broadcast receiver/main thread.
 * No JSON data or schedule is saved on disk.
 */
class RefreshWorker(context: Context, params: WorkerParameters): Worker(context, params) {
    override fun doWork(): Result {
        val schedule = try {
            val connection = (URL(API).openConnection() as HttpURLConnection).apply {
                connectTimeout = 12000
                readTimeout = 12000
                requestMethod = "GET"
                useCaches = false
                setRequestProperty("Accept", "application/json")
            }
            try {
                if (connection.responseCode != 200) null
                else connection.inputStream.bufferedReader().use { reader ->
                    parseSchedule(reader.readText())
                }
            } finally {
                connection.disconnect()
            }
        } catch (_: Exception) {
            null
        }
        Renderer.render(applicationContext, schedule)
        WidgetClock.schedule(applicationContext)
        scheduleNextBoundary(applicationContext, schedule)
        return Result.success()
    }

    companion object {
        private fun workManager(context: Context) = WorkManager.getInstance(context.applicationContext)

        /** Android requires >=15 min periodic work; the change-boundary job is an extra check. */
        fun schedule(context: Context) {
            val periodic = PeriodicWorkRequestBuilder<RefreshWorker>(15, TimeUnit.MINUTES).build()
            workManager(context).enqueueUniquePeriodicWork(
                PERIODIC_WORK, ExistingPeriodicWorkPolicy.KEEP, periodic
            )
            WidgetClock.schedule(context)
            refresh(context)
        }

        fun refresh(context: Context, userInitiated: Boolean = false) {
            val request = OneTimeWorkRequestBuilder<RefreshWorker>()
            // Before Android 12, expedited WorkManager jobs require a foreground service
            // and notification. The standard one-time request is safe for those devices.
            if (userInitiated && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                request.setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
            }
            val uniqueName = if (userInitiated) MANUAL_WORK else "LightFlowInitialRefresh"
            workManager(context).enqueueUniqueWork(
                uniqueName, ExistingWorkPolicy.KEEP, request.build()
            )
        }

        /** Best-effort extra online check near the next published state change. */
        private fun scheduleNextBoundary(context: Context, schedule: Schedule?) {
            val manager = workManager(context)
            if (schedule == null) {
                manager.cancelUniqueWork(BOUNDARY_WORK)
                return
            }
            val clock = ZonedDateTime.now(KYIV)
            val currentMinutes = clock.hour * 60 + clock.minute
            val next = schedule.periods.mapNotNull { minutes(it.end) }
                .firstOrNull { it > currentMinutes && it < 1440 }
            if (next == null) {
                manager.cancelUniqueWork(BOUNDARY_WORK)
                return
            }
            val target = LocalDate.now(KYIV)
                .atTime(next / 60, next % 60)
                .atZone(KYIV).toInstant().plusSeconds(5)
            val delay = Duration.between(Instant.now(), target).toMillis().coerceAtLeast(1000L)
            val request = OneTimeWorkRequestBuilder<RefreshWorker>()
                .setInitialDelay(delay, TimeUnit.MILLISECONDS).build()
            manager.enqueueUniqueWork(BOUNDARY_WORK, ExistingWorkPolicy.REPLACE, request)
        }

        fun stopIfNoWidgets(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val small = manager.getAppWidgetIds(ComponentName(context, SmallWidgetProvider::class.java))
            val large = manager.getAppWidgetIds(ComponentName(context, LargeWidgetProvider::class.java))
            val compact = manager.getAppWidgetIds(ComponentName(context, CompactDialWidgetProvider::class.java))
            if (small.isEmpty() && large.isEmpty() && compact.isEmpty()) {
                workManager(context).cancelUniqueWork(PERIODIC_WORK)
                workManager(context).cancelUniqueWork(BOUNDARY_WORK)
                WidgetClock.cancel(context)
            }
        }
    }
}

/**
 * A widget PendingIntent is a broadcast, so Android never supplies a click count.
 * Hold a first tap for a short window. If a second tap on THAT SAME widget arrives,
 * cancel the refresh and open the site instead. Nothing is saved on disk.
 */
// Launcher delivery adds latency; 340 ms was too short and caused two single taps.
private const val DOUBLE_TAP_WINDOW_MS = 700L
// A slightly later second tap can still cancel an animation before its network request.
private const val LATE_DOUBLE_TAP_MS = 1250L

private object WidgetTapGestures {
    private val main = Handler(Looper.getMainLooper())

    private class TapSession(
        val startedAt: Long,
        val result: BroadcastReceiver.PendingResult
    ) {
        val callbacks = mutableListOf<Runnable>()
        var refreshing = false
        var finished = false
        var active = true

        fun finish() {
            if (!finished) {
                finished = true
                result.finish()
            }
        }
    }

    // One session per widget; the receiver and handler both run on the main thread.
    private val sessions = mutableMapOf<Int, TapSession>()

    private fun delay(session: TapSession, millis: Long, action: () -> Unit) {
        val task = Runnable { if (session.active) action() }
        session.callbacks.add(task)
        main.postDelayed(task, millis)
    }

    private fun cancel(session: TapSession) {
        session.active = false
        session.callbacks.forEach(main::removeCallbacks)
        session.callbacks.clear()
        session.finish()
    }

    fun handle(context: Context, widgetId: Int, result: BroadcastReceiver.PendingResult) {
        val now = SystemClock.elapsedRealtime()
        val prev = sessions[widgetId]
        if (prev != null && now - prev.startedAt <= LATE_DOUBLE_TAP_MS) {
            sessions.remove(widgetId)
            cancel(prev)
            if (prev.refreshing) {
                runCatching { Renderer.cancelLoading(context, widgetId) }
            }
            try {
                // A direct startActivity() from a background BroadcastReceiver may be
                // blocked by modern Android. Use a user-initiated Activity PendingIntent.
                val browser = Intent(Intent.ACTION_VIEW, Uri.parse(SITE)).apply {
                    addCategory(Intent.CATEGORY_BROWSABLE)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                val launch = PendingIntent.getActivity(
                    context, 80000 + widgetId, browser,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                    val options = ActivityOptions.makeBasic().apply {
                        pendingIntentBackgroundActivityStartMode =
                            ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED
                    }
                    launch.send(context, 0, null, null, null, null, options.toBundle())
                } else {
                    launch.send()
                }
            } catch (_: Exception) {
                android.widget.Toast.makeText(
                    context, "Не вдалося відкрити сайт", android.widget.Toast.LENGTH_SHORT
                ).show()
            } finally {
                result.finish()
            }
            return
        }

        if (prev != null) {
            sessions.remove(widgetId)
            cancel(prev)
        }
        val session = TapSession(now, result)
        sessions[widgetId] = session

        // First tap waits for another tap. Unlike the old 340ms window, 700ms
        // tolerates launchers that deliver RemoteViews click broadcasts late.
        delay(session, DOUBLE_TAP_WINDOW_MS) {
            session.refreshing = true
            try {
                Renderer.loadingFrame(context, widgetId, 0)
                for (step in 1..7) {
                    delay(session, step * 105L) {
                        runCatching { Renderer.loadingFrame(context, widgetId, step) }
                    }
                }
                // Network request begins only AFTER the late double-tap window.
                delay(session, 780L) {
                    try {
                        RefreshWorker.refresh(context, userInitiated = true)
                    } finally {
                        session.finish()
                    }
                }
            } catch (_: Exception) {
                try {
                    RefreshWorker.refresh(context, userInitiated = true)
                } finally {
                    session.finish()
                }
            }
        }
        // Expire the gesture after the double-tap grace period. Do not keep
        // old sessions indefinitely or misinterpret unrelated later touches.
        delay(session, LATE_DOUBLE_TAP_MS + 1L) {
            if (sessions[widgetId] === session) sessions.remove(widgetId)
        }
    }
}

class RefreshTapReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION_REFRESH) return
        val widgetId = intent.getIntExtra(
            AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID
        )
        if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) return
        WidgetTapGestures.handle(context.applicationContext, widgetId, goAsync())
    }
}

class SmallWidgetProvider : AppWidgetProvider() {
    override fun onEnabled(context: Context) { RefreshWorker.schedule(context) }
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        Renderer.render(context, null, WidgetArt.Kind.BULB)
        RefreshWorker.schedule(context)
    }
    override fun onDisabled(context: Context) { RefreshWorker.stopIfNoWidgets(context) }
}

class LargeWidgetProvider : AppWidgetProvider() {
    override fun onEnabled(context: Context) { RefreshWorker.schedule(context) }
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        Renderer.render(context, null, WidgetArt.Kind.DIAL)
        RefreshWorker.schedule(context)
    }
    override fun onDisabled(context: Context) { RefreshWorker.stopIfNoWidgets(context) }
}

/** Compact 2×2 dial preserves the full 24-hour schedule with readable markings. */
class CompactDialWidgetProvider : AppWidgetProvider() {
    override fun onEnabled(context: Context) { RefreshWorker.schedule(context) }
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        Renderer.render(context, null, WidgetArt.Kind.COMPACT_DIAL)
        RefreshWorker.schedule(context)
    }
    override fun onDisabled(context: Context) { RefreshWorker.stopIfNoWidgets(context) }
}

/**
 * The visual dials can only change when Android applies a RemoteViews update.
 * An inexact five-minute alarm REQUESTS an online refresh; Doze and OEM launchers may defer it.
 * No exact-alarm permission, foreground service, or client-side schedule persistence is used.
 */
internal object WidgetClock {
    private fun pending(context: Context) = PendingIntent.getBroadcast(
        context, 9001,
        Intent(context, WidgetClockReceiver::class.java).apply { action = ACTION_CLOCK },
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    fun schedule(context: Context) {
        val alarm = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarm.setAndAllowWhileIdle(
            AlarmManager.ELAPSED_REALTIME_WAKEUP,
            SystemClock.elapsedRealtime() + 5 * 60 * 1000L,
            pending(context)
        )
    }
    fun cancel(context: Context) {
        val alarm = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarm.cancel(pending(context))
    }
}

class WidgetClockReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION_CLOCK &&
            intent.action != Intent.ACTION_TIME_CHANGED &&
            intent.action != Intent.ACTION_TIMEZONE_CHANGED &&
            intent.action != Intent.ACTION_DATE_CHANGED) return
        WidgetClock.schedule(context)
        RefreshWorker.refresh(context)
    }
}

class OpenSiteActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(SITE)))
        finish()
    }
}
