package com.lightflow.widgets

import android.app.Activity
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews
import androidx.work.ExistingPeriodicWorkPolicy
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
private val KYIV: ZoneId = ZoneId.of("Europe/Kyiv")

private data class Period(val start: String, val end: String, val off: Boolean)
private data class Schedule(val periods: List<Period>, val checkedAt: Instant)

private fun minutes(text: String): Int? {
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

private fun siteIntent(context: Context): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(SITE))
    return PendingIntent.getActivity(
        context, 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )
}

private object Renderer {
    private fun status(schedule: Schedule?): Pair<String, Boolean?> {
        if (schedule == null) return "Статус невідомий" to null
        val time = ZonedDateTime.now(KYIV)
        val minute = time.hour * 60 + time.minute
        val period = schedule.periods.firstOrNull {
            val a = minutes(it.start) ?: 0
            val b = minutes(it.end) ?: 1440
            minute >= a && minute < b
        } ?: return "Статус невідомий" to null
        return (if (period.off) "Відключення" else "Світло має бути") to period.off
    }
    private fun info(schedule: Schedule?): String {
        if (schedule == null) return "Немає актуальних даних"
        val t = ZonedDateTime.now(KYIV)
        val minute = t.hour * 60 + t.minute
        val next = schedule.periods.firstOrNull { (minutes(it.end) ?: 0) > minute }?.end
        return if (next != null && next != "24:00") "Зміна о $next · за графіком"
               else "За графіком до кінця дня"
    }
    private fun updateFor(context: Context, component: Class<*>, layout: Int,
                          large: Boolean, schedule: Schedule?) {
        val manager = AppWidgetManager.getInstance(context)
        val ids = manager.getAppWidgetIds(ComponentName(context, component))
        if (ids.isEmpty()) return
        val (title, off) = status(schedule)
        val color = Color.parseColor(when (off) {
            true -> RED
            false -> GREEN
            null -> NEUTRAL
        })
        for (id in ids) {
            val view = RemoteViews(context.packageName, layout)
            if (!large) {
                view.setTextViewText(R.id.smallStatus, title)
                view.setTextColor(R.id.smallStatus, color)
                view.setTextViewText(R.id.smallInfo, info(schedule))
                view.setOnClickPendingIntent(R.id.smallRoot, siteIntent(context))
            } else {
                view.setTextViewText(R.id.largeStatus, title)
                view.setTextColor(R.id.largeStatus, color)
                view.setTextViewText(R.id.largeInfo, info(schedule))
                view.setOnClickPendingIntent(R.id.largeRoot, siteIntent(context))
                val rowIds = intArrayOf(
                    R.id.period1, R.id.period2, R.id.period3, R.id.period4, R.id.period5,
                    R.id.period6, R.id.period7, R.id.period8, R.id.period9, R.id.period10
                )
                val periods = schedule?.periods ?: emptyList()
                for (index in rowIds.indices) {
                    val rowId = rowIds[index]
                    val isOverflow = index == rowIds.lastIndex && periods.size > rowIds.size
                    if (index >= periods.size) {
                        view.setViewVisibility(rowId, View.GONE)
                    } else {
                        view.setViewVisibility(rowId, View.VISIBLE)
                        if (isOverflow) {
                            view.setTextViewText(rowId, "Ще ${periods.size - index} інтервалів — відкрити сайт")
                            view.setTextColor(rowId, Color.parseColor(NEUTRAL))
                        } else {
                            val period = periods[index]
                            val label = if (period.off) "Без світла" else "Є світло"
                            view.setTextViewText(rowId, "${period.start}–${period.end}   ● ${label}")
                            view.setTextColor(rowId, Color.parseColor(if (period.off) RED else GREEN))
                        }
                    }
                }
            }
            manager.updateAppWidget(id, view)
        }
    }

    fun render(context: Context, schedule: Schedule?) {
        updateFor(context, SmallWidgetProvider::class.java, R.layout.widget_small, false, schedule)
        updateFor(context, LargeWidgetProvider::class.java, R.layout.widget_large, true, schedule)
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
        return Result.success()
    }

    companion object {
        private fun workManager(context: Context) = WorkManager.getInstance(context.applicationContext)

        fun schedule(context: Context) {
            val periodic = PeriodicWorkRequestBuilder<RefreshWorker>(15, TimeUnit.MINUTES).build()
            workManager(context).enqueueUniquePeriodicWork(
                "LightFlowWidgetRefresh", ExistingPeriodicWorkPolicy.KEEP, periodic
            )
            refresh(context)
        }
        fun refresh(context: Context) {
            workManager(context).enqueue(OneTimeWorkRequestBuilder<RefreshWorker>().build())
        }
    }
}

class SmallWidgetProvider : AppWidgetProvider() {
    override fun onEnabled(context: Context) { RefreshWorker.schedule(context) }
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        RefreshWorker.schedule(context)
    }
}

class LargeWidgetProvider : AppWidgetProvider() {
    override fun onEnabled(context: Context) { RefreshWorker.schedule(context) }
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        RefreshWorker.schedule(context)
    }
}

class OpenSiteActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(SITE)))
        finish()
    }
}
