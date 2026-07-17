# Termux VoiceClip dictation key

## System modified

- OMP / CMUX / both: neither core OMP nor core CMUX code is modified. This is a companion mobile workflow documented in the CMUX settings folder because it supports the Mobile-OMP / RustDesk / Termux workflow.
- Platform: Android Termux on a Samsung phone, operated from macOS through RustDesk; local APK build performed on macOS.
- CMUX required: no for the Android dictation key itself. CMUX is only relevant when the Termux phone session is used as part of the Mobile-OMP workflow.

## Prerequisites

- Android phone with Termux installed.
- RustDesk remote desktop to the Android phone, or equivalent direct access to edit Termux files.
- Android native speech recognition provider installed, e.g. Google speech / Google app.
- A tiny companion APK installed on the phone with package name `com.omp.voiceclip`.
- Termux extra keys enabled and reloadable with `termux-reload-settings`.
- Termux `$PREFIX/bin` on PATH.
- Existing verified Termux PASTE extra key; dictation is copied to Android clipboard, then inserted with PASTE.
- On macOS, Android command-line build tools were installed under `/opt/homebrew/share/android-commandlinetools`, with Homebrew OpenJDK at `/opt/homebrew/opt/openjdk`.
- The built APK was copied into the Wireguard folder for reuse:
  - `~/Downloads/VoiceClip.apk`

## What this change does

Adds a one-tap MIC key to Termux's extra-key row:

- Top row: `ESC / - HOME UP END PGUP 🎙`
- Bottom row: `TAB CTRL ALT LEFT DOWN RIGHT PGDN PASTE`

Tapping `🎙` runs a Termux command named `voiceclip`, which launches the installed Android Activity:

```text
com.omp.voiceclip/.VoiceClipActivity
```

The Activity starts Android native speech recognition, receives the recognized text, copies the first recognition result to Android clipboard, shows a short toast, and returns to Termux. The user then taps the Termux `PASTE` key to insert the dictated text into the shell/input field.

This deliberately avoids:

- Termux:API speech commands, which were timing out/unreliable on this phone.
- Android input-method picker workflows.
- Fleksy customization or SDK work.
- Shell-only `am start` RecognizerIntent attempts that cannot receive Activity results.

## Why this change exists

The phone is controlled through RustDesk, and normal keyboard dictation was too many taps: open input picker, choose Google Voice Typing, dictate, switch back, paste or type into Termux. The desired workflow was a visible MIC key beside the Termux navigation keys, with no picker and no dependency on Termux:API.

Android speech recognition returns results through an Activity result callback. A Termux shell command can launch the recognizer UI but cannot directly receive `RecognizerIntent.EXTRA_RESULTS`. The companion APK supplies that Activity boundary and writes the result to clipboard.

## Files to create or edit

On Android/Termux:

- `$PREFIX/bin/voiceclip` - launches the companion APK Activity.
- `~/.termux/termux.properties` - defines the MIC and PASTE extra keys.

On macOS / reusable artifact storage:

- `~/Downloads/VoiceClip.apk` - built companion APK.
- Optional source/build scratch path used during the original build:
  - `/tmp/omp-voiceclip/AndroidManifest.xml`
  - `/tmp/omp-voiceclip/src/com/omp/voiceclip/VoiceClipActivity.java`
  - `/tmp/omp-voiceclip/res/values/strings.xml`
  - `/tmp/omp-voiceclip/res/values/styles.xml`

## LLM recreation instructions

Give these instructions to an LLM:

1. Build or reuse a tiny Android APK with package `com.omp.voiceclip` and exported Activity `.VoiceClipActivity`.
2. The Activity must call `RecognizerIntent.ACTION_RECOGNIZE_SPEECH` via `startActivityForResult`, read `RecognizerIntent.EXTRA_RESULTS`, copy the first result to Android clipboard with `ClipboardManager`, show a toast such as `Copied to clipboard`, and finish.
3. Do not request Android microphone permission in the companion app unless changing architecture; the recognizer provider owns the actual microphone UI.
4. Install the APK on the Android phone. The installed package should resolve with `cmd package path com.omp.voiceclip`.
5. In Termux, create `$PREFIX/bin/voiceclip`:

```sh
#!/data/data/com.termux/files/usr/bin/sh
am start -n com.omp.voiceclip/.VoiceClipActivity >/dev/null 2>&1
```

6. Make it executable:

```sh
chmod 700 "$PREFIX/bin/voiceclip"
```

7. Set `~/.termux/termux.properties` to:

```properties
extra-keys = [[ \
  'ESC', '/', '-', 'HOME', 'UP', 'END', 'PGUP', {macro: "voiceclip ENTER", display: "🎙"} \
], [ \
  'TAB', 'CTRL', 'ALT', 'LEFT', 'DOWN', 'RIGHT', 'PGDN', {key: 'PASTE', display: 'PASTE'} \
]]
```

8. Reload Termux settings:

```sh
termux-reload-settings
```

9. If multi-line paste into Termux is unreliable through RustDesk, write the files with base64 one-liners instead of heredocs. The original successful approach encoded the script and properties content, then decoded them on the phone with `base64 -d > target-file`.

## Minimal Android source

Use this Activity implementation:

```java
package com.omp.voiceclip;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognizerIntent;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.Locale;

public final class VoiceClipActivity extends Activity {
    private static final int REQUEST_SPEECH = 1001;
    private boolean launched;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (savedInstanceState != null) {
            launched = savedInstanceState.getBoolean("launched", false);
        }
        if (!launched) {
            launched = true;
            startSpeechRecognition();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        outState.putBoolean("launched", launched);
        super.onSaveInstanceState(outState);
    }

    private void startSpeechRecognition() {
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault());
        intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "Speak, then tap Paste in Termux");
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);

        try {
            startActivityForResult(intent, REQUEST_SPEECH);
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "No speech recognizer installed", Toast.LENGTH_LONG).show();
            finish();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQUEST_SPEECH) {
            finish();
            return;
        }

        if (resultCode == RESULT_OK && data != null) {
            ArrayList<String> matches = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            if (matches != null && !matches.isEmpty()) {
                String text = matches.get(0);
                ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                clipboard.setPrimaryClip(ClipData.newPlainText("VoiceClip", text));
                Toast.makeText(this, "Copied to clipboard", Toast.LENGTH_SHORT).show();
            } else {
                Toast.makeText(this, "No speech text returned", Toast.LENGTH_SHORT).show();
            }
        } else {
            Toast.makeText(this, "Voice cancelled", Toast.LENGTH_SHORT).show();
        }
        finish();
    }
}
```

Use this manifest shape:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.omp.voiceclip">
    <queries>
        <intent>
            <action android:name="android.speech.action.RECOGNIZE_SPEECH" />
        </intent>
    </queries>

    <application
        android:label="@string/app_name"
        android:allowBackup="false"
        android:supportsRtl="true">
        <activity
            android:name=".VoiceClipActivity"
            android:exported="true"
            android:excludeFromRecents="true"
            android:theme="@style/AppTheme">
            <intent-filter>
                <action android:name="com.omp.voiceclip.RECOGNIZE" />
                <category android:name="android.intent.category.DEFAULT" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

Use resource-backed label/theme instead of a completely resource-free APK; Android package installer rejected the first minimal packaging attempt with `There was a problem while parsing the package` even though SDK tools could inspect it.

## Verification

Observed verification from the working phone:

- `cmd package path com.omp.voiceclip` returned a package path and `VOICECLIP_PACKAGE_RC:0`.
- `VOICECLIP_WIRED` printed after writing `$PREFIX/bin/voiceclip` and `~/.termux/termux.properties`.
- The Termux extra-key layout showed a mic icon to the right of `PGUP`, above `PASTE`.
- Tapping the mic key inserted/runs `voiceclip` and opened the native Google speech UI.
- After dictation, Android copied the recognized text to clipboard; the user then taps Termux `PASTE` to insert it.

Mac-side APK verification used:

- `apksigner verify --verbose ~/Desktop/VoiceClip.apk` -> verified with v1, v2, and v3 signing schemes.
- `zipalign -c -p 4 ~/Desktop/VoiceClip.apk` -> passed.
- `aapt2 dump badging ~/Desktop/VoiceClip.apk` -> package `com.omp.voiceclip`, label `VoiceClip`, minSdk 23, targetSdk 35.

## Notes for non-CMUX users

- CMUX is not required for the VoiceClip Android APK or Termux extra key.
- Windows users can use the same Android APK and Termux configuration if they can transfer the APK and edit Termux files.
- The macOS-specific pieces are only the local build/tooling paths and RustDesk helper automation used in the original session.
- If the phone is not controlled through RustDesk, install the APK and edit Termux files manually or through any Android file/terminal workflow.

## Compatibility and security notes

- This uses Android's native speech provider. On many phones that means Google/Samsung speech services and may stream audio to remote services.
- The companion app stores only the latest recognized text in Android clipboard.
- Android clipboard is shared across apps; do not dictate secrets.
- Termux wake locks, if used separately, keep the Android CPU awake for Termux work; they do not keep the Mac awake.
- If WireGuard is disabled on the phone, SSH to the Mac's WireGuard IP will not work unless another route exists, such as same-LAN SSH, public SSH exposure, another VPN, or a RustDesk TCP tunnel.
