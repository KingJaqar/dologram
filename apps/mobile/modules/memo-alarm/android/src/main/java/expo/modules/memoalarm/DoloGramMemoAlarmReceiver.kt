package expo.modules.memoalarm

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

class DoloGramMemoAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val url = intent.getStringExtra("url") ?: return
    val channelId = "memo-reminders-alarm-v1"
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(NotificationChannel(channelId, "Memo alarms", NotificationManager.IMPORTANCE_HIGH))
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply { data = android.net.Uri.parse(url); addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP) } ?: return
    val click = PendingIntent.getActivity(context, url.hashCode(), launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val builder = if (Build.VERSION.SDK_INT >= 26) android.app.Notification.Builder(context, channelId) else android.app.Notification.Builder(context)
    val notification = builder
      .setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle("DoloGram").setContentText("Memo reminder").setContentIntent(click).setAutoCancel(true).setCategory(android.app.Notification.CATEGORY_REMINDER).build()
    manager.notify(url.hashCode(), notification)
  }
}
