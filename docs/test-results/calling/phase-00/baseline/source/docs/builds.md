# DoloGram Android builds

EAS Free allows 15 cloud builds per calendar month (6.5). A new build is made only when a native
dependency or native configuration changes (D-149); JavaScript-only changes do not need one because
the development client loads JavaScript from Metro.

| Date | Profile | EAS build id | Reason | Builds this month |
| --- | --- | --- | --- | --- |
| 2026-11-08 | development | 76224190-109e-4596-87bf-979a45a8654f | Phase 0 first build (dev client, all MVP natives, package `com.dologram.app`) | 1 |

## Android push notifications

1. Add `com.dologram.app` to Firebase. Place its `google-services.json` beside `apps/mobile/app.json` for local builds, or provide it as the `GOOGLE_SERVICES_JSON` file variable in the Expo Build environment. Configure the matching FCM V1 service account in the Expo project's Android credentials and rebuild the APK.
2. Apply Supabase migration `023_notification_delivery_preferences.sql` before releasing the mobile bundle. Deploy `send-push-notifications` and set its `PUSH_WEBHOOK_SECRET`. If enhanced push security is enabled in Expo, set `EXPO_ACCESS_TOKEN` in the Edge Function environment.
3. Create a Supabase Database Webhook for `public.messages` **INSERT**, pointing to the deployed `send-push-notifications` function. Send the same webhook secret in the `Authorization: Bearer` header. Verify on a signed-in Android device by sending a message from a different test account while DoloGram is in the background.

The settings screen reports when push registration needs device permission, Firebase configuration, or a retry. Existing installations must opt in again before message text is included in push previews.
