package com.dologram.callbackground

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DoloGramCallBackgroundModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("DoloGramCallBackground")

    Function("isSupported") {
      isBackgroundCallSupported(context)
    }

    AsyncFunction("start") { callId: String, displayName: String, mediaType: String, incoming: Boolean ->
      if (!isBackgroundCallSupported(context) || callId.isBlank()) {
        return@AsyncFunction false
      }
      val intent = Intent(context, DoloGramCallService::class.java)
        .putExtra(DoloGramCallService.EXTRA_CALL_ID, callId)
        .putExtra(DoloGramCallService.EXTRA_DISPLAY_NAME, displayName.ifBlank { "DoloGram call" })
        .putExtra(DoloGramCallService.EXTRA_MEDIA_TYPE, mediaType)
        .putExtra(DoloGramCallService.EXTRA_INCOMING, incoming)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
      true
    }

    AsyncFunction("stop") { callId: String ->
      if (callId.isNotBlank()) {
        context.stopService(
          Intent(context, DoloGramCallService::class.java)
            .putExtra(DoloGramCallService.EXTRA_CALL_ID, callId),
        )
      }
      true
    }

    AsyncFunction("consumePendingAction") {
      DoloGramCallActionStore.consume(context)
    }
  }
}

internal fun isBackgroundCallSupported(context: Context): Boolean {
  if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false
  if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
    context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
    return false
  }
  val notifications = context.getSystemService(Context.NOTIFICATION_SERVICE) as? android.app.NotificationManager
  return notifications?.areNotificationsEnabled() != false
}
