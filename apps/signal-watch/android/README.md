# Signal Watch (Android)

A single-purpose Android app: it watches the phone's cellular signal in the background and tells you when service drops and when it comes back. No accounts, no server, no data used for monitoring.

## What it does

- **Reads the real signal.** Uses the phone's own signal meter (bars and dBm) and service state. Nothing is pinged, so monitoring costs no data.
- **Runs with the screen off.** A foreground service keeps watching; a quiet status line sits in the notification shade showing the current state.
- **Alerts only on real changes.** A change has to hold for 15 seconds before it counts. When service drops you get **one** alert that stays in the shade, with a running timer, until service returns. When it returns you get one "Service is back, was out for N min". Good ↔ Weak wobbles are logged but never alert.
- **Keeps a 5-day log.** Every drop and recovery with time and dBm, plus:
  - phone calls (incoming/outgoing, duration, missed) and what the signal was at the time
  - "Data stopped working / working again" when the internet stops validating even though there's signal
  - data bursts (20 MB or more in a minute) and a mobile-data total per day
  - GPS coordinates on each status change, if you allow location (GPS works without cell service)
- **Share the log** as text through any app, or clear it.
- **Survives reboots.** If it was watching, it starts again after the phone restarts.

## Installing on the phone

Get the APK onto the phone, tap it, and allow installing from that source when asked. Ways to get it there:

- **GitHub release link** (once the workflow in `.github/workflows/signal-watch-android.yml` has run on `main`): `https://github.com/<owner>/<repo>/releases/download/signal-watch-latest/signal-watch.apk`. Text or email that link to the phone.
- **Send the file** from a local build: `app/build/outputs/apk/release/app-release.apk` by email, Nextcloud, Drive, or USB.
- **adb:** `adb install app/build/outputs/apk/release/app-release.apk`

First run:

1. Tap **Start watching**. Allow **Notifications** and **Phone** (needed to read the signal). **Location** is optional and only adds coordinates to the log.
2. Accept the **"Keep it running"** prompt. That exempts the app from battery optimisation so Android doesn't kill it overnight. If you skip it, a yellow button on the main screen brings it back.
3. Leave it. The status line in the notification shade shows it's alive.

Some phones (Samsung, Xiaomi, Huawei, OnePlus) have an extra "sleeping apps" or "app battery" setting that still kills background apps. If alerts ever stop arriving, find Signal Watch in the phone's battery settings and set it to **Unrestricted**.

## Building

Needs JDK 17 and an Android SDK with platform 34 and build-tools 34. On this server they live in `~/android-toolchain`:

```
export JAVA_HOME=$HOME/android-toolchain/jdk17 ANDROID_HOME=$HOME/android-toolchain/sdk
cd apps/signal-watch/android
./gradlew assembleRelease
```

The APK is signed with the throwaway key in `keystore/signal-watch.jks` (password `signalwatch`). It is checked in on purpose: every build signs identically, so a new build installs over the old one without uninstalling. It is not a secret worth protecting because the app is never published to a store.

Bump `versionCode` in `app/build.gradle.kts` when you ship a new build.

## How the status is decided

| Signal level (0-4) | Service state | Status |
|---|---|---|
| any | out of service / emergency only / radio off | No service |
| 0 | in service | No service |
| 1 | in service | Weak |
| 2-4 | in service | Good |

Tunables at the top of `MonitorService.kt`: `STABLE_MS` (15 s hold), `TICK_MS` (60 s housekeeping), `DATA_BURST_BYTES` (20 MB). Retention is `EventStore.RETENTION_DAYS` (5).
