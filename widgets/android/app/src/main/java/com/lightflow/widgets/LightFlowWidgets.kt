package com.lightflow.widgets

import android.app.Activity
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
        Layout(WidgetArt.Kind.CAROUSEL, MediumWidgetProvider::class.java,
            R.layout.widget_medium, R.id.mediumRoot, R.id.mediumArtwork,
            R.id.mediumLoading, R.id.mediumRipple, R.id.mediumLoadingText),
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
            val medium = manager.getAppWidgetIds(ComponentName(context, MediumWidgetProvider::class.java))
            if (small.isEmpty() && large.isEmpty() && medium.isEmpty()) {
                workManager(context).cancelUniqueWork(PERIODIC_WORK)
                workManager(context).cancelUniqueWork(BOUNDARY_WORK)
                WidgetClock.cancel(context)
            }
        }
    }
}

/**
 * A home-screen RemoteViews click carries widget ID but not the exact touch coordinates.
 * Eight gentle vector frames approximate a ripple spreading from the widget centre.
 * The update starts only after the label has appeared. No Activity/browser is launched.
 */
class RefreshTapReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION_REFRESH) return
        val id = intent.getIntExtra(
            AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID
        )
        if (id == AppWidgetManager.INVALID_APPWIDGET_ID) return

        val app = context.applicationContext
        val pending = goAsync()
        val handler = Handler(Looper.getMainLooper())
        try {
            Renderer.loadingFrame(app, id, 0)
            // Shorter gaps and smaller radius changes make the motion feel softer.
            // A launcher may coalesce RemoteViews updates: 60 FPS is not possible here.
            for (step in 1..7) {
                handler.postDelayed({
                    runCatching { Renderer.loadingFrame(app, id, step) }
                }, step * 105L)
            }
            handler.postDelayed({
                try {
                    RefreshWorker.refresh(app, userInitiated = true)
                } finally {
                    pending.finish()
                }
            }, 880L)
        } catch (_: Exception) {
            pending.finish()
            RefreshWorker.refresh(app, userInitiated = true)
        }
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

/** New compact full-width widget: 66%-width time segments and a stationary centre arrow. */
class MediumWidgetProvider : AppWidgetProvider() {
    override fun onEnabled(context: Context) { RefreshWorker.schedule(context) }
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        Renderer.render(context, null, WidgetArt.Kind.CAROUSEL)
        RefreshWorker.schedule(context)
    }
    override fun onDisabled(context: Context) { RefreshWorker.stopIfNoWidgets(context) }
}

/**
 * The visual dial and carousel can only change when Android applies a RemoteViews update.
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
