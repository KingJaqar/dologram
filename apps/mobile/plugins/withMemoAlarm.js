const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

module.exports = (config) => withAndroidManifest(config, (mod) => {
  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
  const permissions = mod.modResults.manifest['uses-permission'] || [];
  if (!permissions.some((entry) => entry.$?.['android:name'] === 'android.permission.SCHEDULE_EXACT_ALARM')) {
    permissions.push({ $: { 'android:name': 'android.permission.SCHEDULE_EXACT_ALARM' } });
    mod.modResults.manifest['uses-permission'] = permissions;
  }
  const receivers = application.receiver || [];
  if (!receivers.some((entry) => entry.$?.['android:name'] === 'expo.modules.memoalarm.DoloGramMemoAlarmReceiver')) {
    receivers.push({ $: { 'android:name': 'expo.modules.memoalarm.DoloGramMemoAlarmReceiver', 'android:exported': 'false' } });
    application.receiver = receivers;
  }
  return mod;
});
