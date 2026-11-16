# DoloGram
A messenger web app developed with React Native Expo and Next.js

## Local Android development build

From the repository root, run:

```powershell
./scripts/build-android-local.ps1 -Variant Debug
```

The script refreshes Expo's Android native configuration before invoking local
Gradle, including SecureStore and SQLCipher for encrypted memos. The dev-client
APK is written to `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`.
Install the rebuilt APK after native dependency or app configuration changes;
reloading JavaScript alone cannot update native modules. Start Metro with
`npm run start --workspace=@dologram/mobile -- --dev-client`.

## Repomix

Run `repomix` from the repository root to write the default pack to
`supabase/repomix/repomix-output.xml`. For named packs, set `--output` to a
path inside `supabase/repomix/`.
