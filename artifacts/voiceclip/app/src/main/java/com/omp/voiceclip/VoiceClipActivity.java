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
        intent.putExtra(
                RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault());
        intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "Speak, then tap Paste in Termux");
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);

        try {
            startActivityForResult(intent, REQUEST_SPEECH);
        } catch (ActivityNotFoundException error) {
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
            ArrayList<String> matches =
                    data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            if (matches != null && !matches.isEmpty()) {
                ClipboardManager clipboard =
                        (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                clipboard.setPrimaryClip(ClipData.newPlainText("VoiceClip", matches.get(0)));
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
