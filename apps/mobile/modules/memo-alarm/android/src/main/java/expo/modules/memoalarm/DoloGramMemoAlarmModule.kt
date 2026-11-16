package expo.modules.memoalarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DoloGramMemoAlarmModule : Module() {
  private val context: Context get() = appContext.reactContext ?: throw IllegalStateException("App context unavailable")
  private val alarmManager: AlarmManager get() = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
  private fun pending(occurrenceId: String, url: String): PendingIntent {
    val intent = Intent(context, DoloGramMemoAlarmReceiver::class.java).apply {
      putExtra("occurrence_id", occurrenceId)
      putExtra("url", url)
    }
    return PendingIntent.getBroadcast(context, occurrenceId.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }
  override fun definition() = ModuleDefinition {
    Name("DoloGramMemoAlarm")
    AsyncFunction("canScheduleExactAlarms") { Build.VERSION.SDK_INT < 31 || alarmManager.canScheduleExactAlarms() }
    AsyncFunction("openExactAlarmSettings") {
      if (Build.VERSION.SDK_INT < 31) false else { context.startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:${context.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); true }
    }
    AsyncFunction("scheduleExact") { occurrenceId: String, at: Double, url: String ->
      if (Build.VERSION.SDK_INT >= 31 && !alarmManager.canScheduleExactAlarms()) throw IllegalStateException("Exact alarm access is disabled")
      val intent = pending(occurrenceId, url)
      alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at.toLong(), intent)
      mapOf("scheduleId" to occurrenceId)
    }
    AsyncFunction("cancel") { scheduleId: String -> alarmManager.cancel(pending(scheduleId, "")) }
  }
}
