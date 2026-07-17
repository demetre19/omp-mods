# VoiceClip Android companion

VoiceClip is a tiny Android Activity for the Termux dictation workflow documented in [`../../docs/termux-voiceclip-dictation.md`](../../docs/termux-voiceclip-dictation.md). It opens the device speech recognizer, copies the first recognized phrase to the Android clipboard, and returns to Termux. The Termux extra-key row then provides a one-tap `PASTE` key.

## What is included

- A minimal Android application project with no runtime dependencies.
- The manifest, Java Activity, and resource files used by the workflow.
- A Termux launcher and example extra-key configuration.
- Reproducible debug and release build commands.

## Why the signed APK is not included

The original working `VoiceClip.apk` was a locally signed installation artifact. It is intentionally excluded from this public repository because the signing key and build provenance are not part of the repository. Publishing an opaque prebuilt APK would make the source harder to audit and would encourage users to trust an unverifiable binary.

Build and sign your own APK from the checked-in source instead. Never publish or commit your release keystore, passwords, or signing properties.

## Requirements

- Android SDK Platform 35 and Build Tools 35.x
- JDK 17
- Gradle 8.10.2 or Android Studio with a compatible bundled Gradle
- An Android device with Termux and a speech recognition provider

The project uses Android Gradle Plugin 8.8.2. It has no application libraries or network permissions.

## Build

From this directory:

```sh
gradle :app:assembleDebug
```

The installable debug APK is written to:

```text
app/build/outputs/apk/debug/app-debug.apk
```

Install it with ADB:

```sh
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell cmd package path com.omp.voiceclip
```

For a release build, create and protect your own keystore, then sign the unsigned release APK outside this repository:

```sh
gradle :app:assembleRelease
zipalign -p -f 4 app/build/outputs/apk/release/app-release-unsigned.apk VoiceClip-aligned.apk
apksigner sign --ks /secure/path/voiceclip-release.jks --out VoiceClip.apk VoiceClip-aligned.apk
apksigner verify --verbose VoiceClip.apk
```

Do not place the keystore or passwords in this directory.

## Configure Termux

1. Copy [`termux/voiceclip`](./termux/voiceclip) to `$PREFIX/bin/voiceclip`.
2. Run `chmod 700 "$PREFIX/bin/voiceclip"`.
3. Merge [`termux/termux.properties.example`](./termux/termux.properties.example) into `~/.termux/termux.properties`.
4. Run `termux-reload-settings`.
5. Tap the microphone key, dictate, then tap `PASTE`.

## Security and privacy

The app requests no microphone permission itself. It delegates recognition to the installed Android speech provider, which owns the microphone UI and may process audio remotely. The recognized phrase is placed on the shared Android clipboard. Do not dictate secrets.
