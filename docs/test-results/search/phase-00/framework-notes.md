# Versioned framework contracts read in Phase 0

2026-11-11. Installed identities are in [toolchain.json](toolchain.json).
These are relevant API reads, not a claim to have read entire SDK manuals.

| Contract | Official/versioned source read | Finding for subsequent implementation |
| --- | --- | --- |
| Expo 57 | [SDK 57 index](https://docs.expo.dev/versions/v57.0.0/), [Expo documentation index](https://docs.expo.dev/llms.txt) | Match installed SDK and use local CLI/CNG conventions. No native project generation or upgrade in this phase. |
| SQLite 57.0.4 | [SDK 57 SQLite](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/) — getAllAsync, openDatabaseAsync, closeAsync, binding and transaction sections | Bound SQL accepts array parameters; async reads return typed rows. Close fixture connections. execAsync does not escape interpolated user input. No native cancellation promise is assumed. |
| Router 57.0.30 | [SDK 57 Router](https://docs.expo.dev/versions/v57.0.0/sdk/router/) — useLocalSearchParams and navigation APIs | Read local route parameters; validate scalar/array values before using them. Stack retention still needs later platform evidence. |
| RN 0.86.3 input | [TextInput 0.86](https://reactnative.dev/docs/0.86/textinput) — controlled value, defaultValue, submit, focus/blur | A supplied value controls displayed text; submit carries current native text. Preserve immediate clear, callback debounce and focus behavior together. |
| RN 0.86.3 Back | [BackHandler 0.86](https://reactnative.dev/docs/0.86/backhandler) | Last-registered handlers run first; true consumes the event; subscriptions require removal. An open native Modal does not publish BackHandler events. |
| Native fixture entry | [Expo 57 registerRootComponent](https://docs.expo.dev/versions/v57.0.0/sdk/expo/#registerrootcomponentcomponent), [RN AppRegistry 0.86](https://reactnative.dev/docs/0.86/appregistry), installed `expo/src/launch/registerRootComponent.tsx` | A custom main must register its root. The evidence entry is separate from production Expo Router discovery. It adds no product navigation. |
| Development client | [SDK 57 DevClient](https://docs.expo.dev/versions/v57.0.0/sdk/dev-client/) and installed CLI start help/ManifestMiddleware | Reuse the installed client; offline CLI mode supports anonymous manifests. Installed CLI rejects combining offline with localhost. |

Original installed SQLite sources confirm `:memory:` handling in Android
`SQLiteModule.kt`, typed bindings/close in `SQLiteDatabase.d.ts`, and development
tooling's `__DEV__` guard in `SQLiteDevToolsClient.ts`. The final offline fixture
therefore uses non-development JS, exact source imports and an ephemeral native
database, with no fabricated SDK method or package.

Phase 0 does not change React application behavior, AsyncStorage, Markdown,
Supabase APIs or test-runner configuration. Later phases must read additional
version-matched APIs before changing those libraries. No new library is needed
to complete the Phase 0 work.
