package com.dologram.callbackground

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Person
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder

class DoloGramCallService : Service() {
  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val callId = intent?.getStringExtra(EXTRA_CALL_ID)
    if (callId.isNullOrBlank()) {
      stopSelf()
      return START_NOT_STICKY
    }

    val displayName = intent.getStringExtra(EXTRA_DISPLAY_NAME).orEmpty().ifBlank { "DoloGram call" }
    val mediaType = intent.getStringExtra(EXTRA_MEDIA_TYPE).orEmpty()
    val incoming = intent.getBooleanExtra(EXTRA_INCOMING, false)
    val notification = buildNotification(callId, displayName, mediaType, incoming)
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
    } catch (_: SecurityException) {
      stopSelf()
    }
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    stopForeground(STOP_FOREGROUND_REMOVE)
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val channel = NotificationChannel(
      CHANNEL_ID,
      "Calls",
      NotificationManager.IMPORTANCE_HIGH,
    ).apply {
      description = "Active DoloGram calls"
      setSound(null, null)
      enableVibration(false)
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
    }
    (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(channel)
  }

  private fun buildNotification(callId: String, displayName: String, mediaType: String, incoming: Boolean): Notification {
    val openApp = applicationContext.packageManager.getLaunchIntentForPackage(applicationContext.packageName)?.apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }?.let { PendingIntent.getActivity(this, callId.hashCode(), it, pendingIntentFlags()) }

    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      Notification.Builder(this)
    }
    builder
      .setSmallIcon(android.R.drawable.sym_call_incoming)
      .setContentTitle(if (incoming) "Incoming DoloGram call" else "DoloGram call")
      .setContentText(displayName)
      .setCategory(Notification.CATEGORY_CALL)
      .setPriority(Notification.PRIORITY_MAX)
      .setOngoing(!incoming)
      .setAutoCancel(false)
      .setContentIntent(openApp)
      .setFullScreenIntent(openApp, incoming)

    val person = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) Person.Builder().setName(displayName).build() else null
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && person != null) {
      val style = if (incoming) {
        Notification.CallStyle.forIncomingCall(
          person,
          actionIntent(callId, ACTION_DECLINE),
          actionIntent(callId, ACTION_ANSWER),
        )
      } else {
        Notification.CallStyle.forOngoingCall(person, actionIntent(callId, ACTION_END))
      }
      builder.setStyle(style)
    } else if (incoming) {
      builder
        .addAction(Notification.Action.Builder(0, "Decline", actionIntent(callId, ACTION_DECLINE)).build())
        .addAction(Notification.Action.Builder(0, "Answer", actionIntent(callId, ACTION_ANSWER)).build())
    } else {
      builder.addAction(Notification.Action.Builder(0, "End", actionIntent(callId, ACTION_END)).build())
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      builder.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE)
    }
    return builder.build()
  }

  private fun actionIntent(callId: String, action: String): PendingIntent {
    val intent = Intent(this, DoloGramCallActionReceiver::class.java)
      .putExtra(EXTRA_CALL_ID, callId)
      .putExtra(EXTRA_ACTION, action)
    return PendingIntent.getBroadcast(this, (callId + action).hashCode(), intent, pendingIntentFlags())
  }

  private fun pendingIntentFlags(): Int = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE

  companion object {
    const val EXTRA_CALL_ID = "dologram_call_id"
    const val EXTRA_DISPLAY_NAME = "dologram_call_display_name"
    const val EXTRA_MEDIA_TYPE = "dologram_call_media_type"
    const val EXTRA_INCOMING = "dologram_call_incoming"
    const val EXTRA_ACTION = "dologram_call_action"
    const val ACTION_ANSWER = "answer"
    const val ACTION_DECLINE = "decline"
    const val ACTION_END = "end"
    private const val CHANNEL_ID = "calls-native-v1"
    private const val NOTIFICATION_ID = 7401
  }
}
