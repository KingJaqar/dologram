package com.dologram.callbackground

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class DoloGramCallActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val callId = intent.getStringExtra(DoloGramCallService.EXTRA_CALL_ID) ?: return
    val action = intent.getStringExtra(DoloGramCallService.EXTRA_ACTION) ?: return
    if (callId.isBlank()) return

    DoloGramCallActionStore.save(context, callId, action)
    if (action == DoloGramCallService.ACTION_DECLINE || action == DoloGramCallService.ACTION_END) {
      context.stopService(Intent(context, DoloGramCallService::class.java))
    }

    context.packageManager.getLaunchIntentForPackage(context.packageName)?.let { launch ->
      launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      context.startActivity(launch)
    }
  }
}

internal object DoloGramCallActionStore {
  private const val PREFS = "dologram_call_background"
  private const val CALL_ID = "pending_call_id"
  private const val ACTION = "pending_action"

  fun save(context: Context, callId: String, action: String) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putString(CALL_ID, callId)
      .putString(ACTION, action)
      .commit()
  }

  fun consume(context: Context): Map<String, String>? {
    val preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val callId = preferences.getString(CALL_ID, null)
    val action = preferences.getString(ACTION, null)
    if (callId.isNullOrBlank() || action.isNullOrBlank()) return null
    preferences.edit().remove(CALL_ID).remove(ACTION).commit()
    return mapOf("callId" to callId, "action" to action)
  }
}
