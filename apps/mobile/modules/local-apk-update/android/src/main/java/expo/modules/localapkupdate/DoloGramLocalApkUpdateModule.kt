package expo.modules.localapkupdate

import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import androidx.core.content.FileProvider
import com.facebook.react.bridge.ReactContext
import com.facebook.react.common.LifecycleState
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap

private const val APK_MIME_TYPE = "application/vnd.android.package-archive"
private const val DISPATCH_DEADLINE_MS = 10_000L
private const val PARSE_DEADLINE_MS = 120_000L

private class LocalApkUpdateException(
  code: String,
  message: String,
  cause: Throwable? = null
) : CodedException("LOCAL_APK_UPDATE_${code.uppercase()}", message, cause)

class DoloGramLocalApkUpdateModule : Module() {
  private val invalidAttempts = ConcurrentHashMap.newKeySet<String>()
  private val launchedAttempts = ConcurrentHashMap.newKeySet<String>()
  private val attemptLocks = ConcurrentHashMap<String, Any>()
  private val mainHandler = Handler(Looper.getMainLooper())

  private val context: Context
    get() = appContext.reactContext
      ?: throw LocalApkUpdateException("activityUnavailable", "The app context is no longer available.")

  private val packageManager: PackageManager
    get() = context.packageManager

  override fun definition() = ModuleDefinition {
    Name("DoloGramLocalApkUpdate")

    AsyncFunction("getInstalledInfo") {
      getInstalledInfo()
    }

    AsyncFunction("inspectCandidate") { stagedFileUri: String, attemptId: String ->
      inspectCandidate(stagedFileUri, attemptId)
    }

    AsyncFunction("canRequestInstall") {
      canRequestInstall()
    }

    AsyncFunction("openInstallPermissionSettings") { attemptId: String, promise: Promise ->
      openInstallPermissionSettings(attemptId, promise)
    }

    Function("invalidateAttempt") { attemptId: String ->
      if (attemptId.isNotBlank()) {
        invalidAttempts.add(attemptId)
      }
    }

    AsyncFunction("launchInstaller") { stagedFileUri: String, attemptId: String, promise: Promise ->
      launchInstaller(stagedFileUri, attemptId, promise)
    }

    AsyncFunction("removeStagedAttempt") { stagedFileUri: String ->
      val file = ownedCandidateFile(stagedFileUri)
      val directory = requireNotNull(file.parentFile)
      // Only known files, never recursive cache deletion or following directory symlinks.
      if (directory.listFiles()?.any { it.name != "candidate.apk" } == true) {
        throw LocalApkUpdateException("unreadable", "The update cache could not be cleaned safely.")
      }
      val uri = FileProvider.getUriForFile(context, "${context.packageName}.FileSystemFileProvider", file)
      context.revokeUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
      if (file.exists() && !file.delete()) {
        throw LocalApkUpdateException("unreadable", "The update copy could not be removed.")
      }
      if (directory.exists() && !directory.delete()) {
        throw LocalApkUpdateException("unreadable", "The update directory could not be removed.")
      }
    }

    AsyncFunction("discardPickerCopy") { fileUri: String ->
      val uri = Uri.parse(fileUri)
      if (uri.scheme == "file" && uri.path != null) {
        val requested = File(requireNotNull(uri.path))
        val file = requested.canonicalFile
        val pickerRoot = File(appContext.cacheDirectory.canonicalFile, "DocumentPicker")
        if (file.parentFile == pickerRoot && file == File(pickerRoot, requested.name) && file.isFile && !file.delete()) {
          throw LocalApkUpdateException("unreadable", "The temporary selection could not be removed.")
        }
      }
    }
  }

  private fun getInstalledInfo(): Map<String, Any?> {
    val packageInfo = try {
      packageInfoFor(context.packageName, installedPackageFlags())
    } catch (error: PackageManager.NameNotFoundException) {
      throw LocalApkUpdateException("installerUnavailable", "The installed DoloGram package could not be read.", error)
    }

    return installedApkInfo(packageInfo)
  }

  private fun inspectCandidate(stagedFileUri: String, attemptId: String): Map<String, Any?> {
    ensureAttemptActive(attemptId)
    val candidateFile = candidateFile(stagedFileUri)
    if (candidateFile.parentFile?.name != attemptId) {
      throw LocalApkUpdateException("invalidAttempt", "The APK belongs to another update attempt.")
    }
    val candidate = inspectCandidatePackage(candidateFile)
    validateCandidate(candidate, attemptId)
    return apkInfo(candidate, attemptId)
  }

  private fun canRequestInstall(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      // Android 7 and below enforce the device-wide setting in the installer.
      return true
    }
    return packageManager.canRequestPackageInstalls()
  }

  private fun openInstallPermissionSettings(attemptId: String, promise: Promise) {
    val startedAt = SystemClock.elapsedRealtime()
    try {
      ensureAttemptActive(attemptId)
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
        throw LocalApkUpdateException(
          "settingsUnavailable",
          "Per-app install-source settings are unavailable on this Android version."
        )
      }
      val activity = appContext.currentActivity
        ?: throw LocalApkUpdateException("activityUnavailable", "DoloGram is not attached to a foreground activity.")

      dispatchOnMain(promise) {
        val intent = Intent(
          Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
          Uri.parse("package:${context.packageName}")
        )
        try {
          synchronized(lockFor(attemptId)) {
            ensureDispatchable(attemptId, startedAt)
          }
          if ((appContext.reactContext as? ReactContext)?.lifecycleState != LifecycleState.RESUMED ||
            appContext.currentActivity !== activity || activity.isFinishing || activity.isDestroyed) {
            throw LocalApkUpdateException("activityUnavailable", "Return to DoloGram before updating.")
          }
          ensureDispatchable(attemptId, startedAt)
          activity.startActivity(intent)
          mapOf("opened" to true)
        } catch (error: LocalApkUpdateException) {
          throw error
        } catch (error: Exception) {
          throw LocalApkUpdateException(
            "settingsUnavailable",
            "Android could not open install-source settings.",
            error
          )
        }
      }
    } catch (error: Throwable) {
      reject(promise, error)
    }
  }

  private fun launchInstaller(stagedFileUri: String, attemptId: String, promise: Promise) {
    val startedAt = SystemClock.elapsedRealtime()
    try {
      ensureAttemptActive(attemptId)
      val candidateFile = candidateFile(stagedFileUri)
      if (candidateFile.parentFile?.name != attemptId) {
        throw LocalApkUpdateException("invalidAttempt", "The APK belongs to another update attempt.")
      }
      val candidate = inspectCandidatePackage(candidateFile)
      validateCandidate(candidate, attemptId)
      if (SystemClock.elapsedRealtime() - startedAt > PARSE_DEADLINE_MS) {
        throw LocalApkUpdateException("operationTimedOut", "APK revalidation took too long.")
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !packageManager.canRequestPackageInstalls()) {
        throw LocalApkUpdateException("permissionRequired", "DoloGram is not authorized to request APK installation.")
      }
      val activity = appContext.currentActivity
        ?: throw LocalApkUpdateException("activityUnavailable", "DoloGram is not attached to a foreground activity.")
      val contentUri = try {
        FileProvider.getUriForFile(
          activity,
          "${context.packageName}.FileSystemFileProvider",
          candidateFile
        )
      } catch (error: Exception) {
        throw LocalApkUpdateException(
          "installerUnavailable",
          "DoloGram could not prepare the selected APK for Android.",
          error
        )
      }

      val dispatchStartedAt = SystemClock.elapsedRealtime()
      dispatchOnMain(promise) {
        synchronized(lockFor(attemptId)) {
          ensureDispatchable(attemptId, dispatchStartedAt)
          if (!launchedAttempts.add(attemptId)) {
            throw LocalApkUpdateException("alreadyLaunched", "The Android installer was already opened for this attempt.")
          }
        }

        val intent = Intent(Intent.ACTION_VIEW).apply {
          setDataAndType(contentUri, APK_MIME_TYPE)
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
          clipData = ClipData.newRawUri("DoloGram APK update", contentUri)
        }

        try {
          if ((appContext.reactContext as? ReactContext)?.lifecycleState != LifecycleState.RESUMED ||
            appContext.currentActivity !== activity || activity.isFinishing || activity.isDestroyed) {
            throw LocalApkUpdateException("activityUnavailable", "Return to DoloGram before updating.")
          }
          ensureDispatchable(attemptId, dispatchStartedAt)
          activity.startActivity(intent)
          mapOf("attemptId" to attemptId, "status" to "handedOff")
        } catch (error: LocalApkUpdateException) {
          throw error
        } catch (error: Exception) {
          throw LocalApkUpdateException(
            "installerUnavailable",
            "Android could not open its package installer.",
            error
          )
        }
      }
    } catch (error: Throwable) {
      reject(promise, error)
    }
  }

  private fun dispatchOnMain(
    promise: Promise,
    block: () -> Map<String, Any?>
  ) {
    if (!mainHandler.post {
        try {
          promise.resolve(block())
        } catch (error: Throwable) {
          reject(promise, error)
        }
      }) {
      throw LocalApkUpdateException("installerUnavailable", "Android could not schedule the installer handoff.")
    }
  }

  private fun ensureAttemptActive(attemptId: String) {
    if (attemptId.isBlank()) {
      throw LocalApkUpdateException("invalidAttempt", "The local update attempt identifier is invalid.")
    }
    if (invalidAttempts.contains(attemptId)) {
      throw LocalApkUpdateException("staleAttempt", "The local update attempt is no longer active.")
    }
  }

  private fun ensureDispatchable(attemptId: String, startedAt: Long) {
    ensureAttemptActive(attemptId)
    if (SystemClock.elapsedRealtime() - startedAt > DISPATCH_DEADLINE_MS) {
      throw LocalApkUpdateException("operationTimedOut", "The Android installer handoff took too long.")
    }
  }

  private fun lockFor(attemptId: String): Any = attemptLocks.computeIfAbsent(attemptId) { Any() }

  private fun ownedCandidateFile(stagedFileUri: String): File {
    val uri = try {
      Uri.parse(stagedFileUri)
    } catch (error: Exception) {
      throw LocalApkUpdateException("unreadable", "The selected APK could not be read.", error)
    }
    if (uri.scheme != "file") {
      throw LocalApkUpdateException("unreadable", "The selected APK is not available as a local file.")
    }

    val file = try {
      File(requireNotNull(uri.path))
    } catch (error: Exception) {
      throw LocalApkUpdateException("unreadable", "The selected APK could not be read.", error)
    }
    val canonicalFile = try {
      file.canonicalFile
    } catch (error: Exception) {
      throw LocalApkUpdateException("unreadable", "The selected APK could not be read.", error)
    }
    val cacheRoot = try {
      File(appContext.cacheDirectory, "local-updates").canonicalFile
    } catch (error: Exception) {
      throw LocalApkUpdateException("unreadable", "The app cache could not be accessed.", error)
    }
    val directory = canonicalFile.parentFile
    val requestedAttempt = file.parentFile?.name ?: ""
    if (cacheRoot.parentFile != appContext.cacheDirectory.canonicalFile ||
      canonicalFile != File(File(cacheRoot, requestedAttempt), "candidate.apk") ||
      file.name != "candidate.apk" || directory?.parentFile != cacheRoot ||
      !Regex("lu-[0-9]{13}-[a-fA-F0-9-]{36}").matches(requestedAttempt)) {
      throw LocalApkUpdateException("unreadable", "The selected APK is outside DoloGram's update cache.")
    }
    return canonicalFile
  }

  private fun candidateFile(stagedFileUri: String): File {
    val file = ownedCandidateFile(stagedFileUri)
    if (!file.isFile || !file.canRead() || file.length() == 0L) {
      throw LocalApkUpdateException("unreadable", "The selected APK could not be read.")
    }
    return file
  }

  private fun inspectCandidatePackage(file: File): PackageInfo {
    val packageInfo = try {
      packageArchiveInfoFor(file.path, archivePackageFlags())
    } catch (error: Exception) {
      throw LocalApkUpdateException("invalidApk", "The selected file is not a readable Android APK.", error)
    } ?: throw LocalApkUpdateException("invalidApk", "The selected file is not a readable Android APK.")

    if (packageInfo.splitNames?.isNotEmpty() == true || isIdentifiableSplitName(file.name)) {
      throw LocalApkUpdateException("unsupportedApk", "Split APKs and bundled APK containers are not supported.")
    }
    if (signingDigests(packageInfo).isEmpty()) {
      throw LocalApkUpdateException("wrongSigner", "The selected APK has no usable signing identity.")
    }
    return packageInfo
  }

  private fun validateCandidate(candidate: PackageInfo, attemptId: String) {
    ensureAttemptActive(attemptId)
    val installed = try {
      packageInfoFor(context.packageName, installedPackageFlags())
    } catch (error: PackageManager.NameNotFoundException) {
      throw LocalApkUpdateException("installerUnavailable", "The installed DoloGram package could not be read.", error)
    }

    if (candidate.packageName != context.packageName) {
      throw LocalApkUpdateException("wrongPackage", "The selected APK is not a DoloGram package.")
    }
    if (signingDigests(candidate) != signingDigests(installed)) {
      throw LocalApkUpdateException("wrongSigner", "The selected APK is signed by a different release identity.")
    }

    val installedCode = versionCode(installed)
    val candidateCode = versionCode(candidate)
    when {
      candidateCode == installedCode ->
        throw LocalApkUpdateException("sameVersion", "The selected APK is already installed.")
      candidateCode < installedCode ->
        throw LocalApkUpdateException("olderVersion", "The selected APK is older than the installed DoloGram build.")
    }
  }

  private fun apkInfo(packageInfo: PackageInfo, attemptId: String): Map<String, Any?> = mapOf(
    "applicationId" to packageInfo.packageName,
    "versionName" to (packageInfo.versionName ?: ""),
    "versionCode" to versionCode(packageInfo).toString(),
    "attemptId" to attemptId
  )

  private fun installedApkInfo(packageInfo: PackageInfo): Map<String, Any?> = mapOf(
    "applicationId" to packageInfo.packageName,
    "versionName" to (packageInfo.versionName ?: ""),
    "versionCode" to versionCode(packageInfo).toString()
  )

  private fun versionCode(packageInfo: PackageInfo): Long =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      packageInfo.longVersionCode
    } else {
      @Suppress("DEPRECATION")
      packageInfo.versionCode.toLong()
    }

  private fun installedPackageFlags(): Long =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      PackageManager.GET_SIGNING_CERTIFICATES.toLong()
    } else {
      @Suppress("DEPRECATION")
      PackageManager.GET_SIGNATURES.toLong()
    }

  private fun archivePackageFlags(): Long = installedPackageFlags()

  private fun packageInfoFor(packageName: String, flags: Long): PackageInfo =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      packageManager.getPackageInfo(packageName, PackageManager.PackageInfoFlags.of(flags))
    } else {
      @Suppress("DEPRECATION")
      packageManager.getPackageInfo(packageName, flags.toInt())
    }

  private fun packageArchiveInfoFor(path: String, flags: Long): PackageInfo? =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      packageManager.getPackageArchiveInfo(path, PackageManager.PackageInfoFlags.of(flags))
    } else {
      @Suppress("DEPRECATION")
      packageManager.getPackageArchiveInfo(path, flags.toInt())
    }

  private fun signingDigests(packageInfo: PackageInfo): Set<String> {
    val signatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      val signingInfo = packageInfo.signingInfo
        ?: throw LocalApkUpdateException("wrongSigner", "The APK signing identity could not be read.")
      signingInfo.apkContentsSigners.toSet()
    } else {
      @Suppress("DEPRECATION")
      packageInfo.signatures?.toSet() ?: emptySet()
    }

    return signatures.map { signature ->
      MessageDigest.getInstance("SHA-256").digest(signature.toByteArray()).toHexString()
    }.toSet()
  }

  private fun isIdentifiableSplitName(name: String): Boolean {
    val lowerName = name.lowercase()
    return lowerName.startsWith("split_") || lowerName.startsWith("split-") || lowerName.startsWith("config.")
  }

  private fun reject(promise: Promise, error: Throwable) {
    when (error) {
      is CodedException -> promise.reject(error)
      else -> promise.reject(
        LocalApkUpdateException("unknown", "The local update operation could not be completed.", error)
      )
    }
  }
}

private fun ByteArray.toHexString(): String = joinToString(separator = "") { byte -> "%02x".format(byte.toInt() and 0xff) }
