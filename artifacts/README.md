# Implementation artifacts

This directory contains the source files that were still recoverable from the installed OMP modifications.

## Project picker

[`project-picker/`](./project-picker/) is a complete portable copy of the user-level `/ompp` extension, skill, launcher wrapper, CMUX launcher scripts, and sample project registry. See its [`README.md`](./project-picker/README.md) for installation.

## VoiceClip Android companion

[`voiceclip/`](./voiceclip/) contains the Android manifest, Java Activity, resources, Gradle build configuration, and Termux launcher for the speech-to-clipboard workflow. The locally signed APK is intentionally excluded; build and sign your own auditable installation artifact from the checked-in source.

## Spellcheck reference source

[`spellcheck-reference/`](./spellcheck-reference/) contains the recovered source and focused tests for the OMP 16.3.9 spellcheck work. The current local OMP checkout has since moved to 17.x, so these files are preserved as reference source rather than advertised as a drop-in patch for current upstream. See its [`README.md`](./spellcheck-reference/README.md) and the main [`spellcheck guide`](../docs/spellcheck-autocorrect.md) for the original integration points and verification.

Other OMP core changes in this repository survive as detailed, versioned recreation notes because their original uncommitted source diffs were not present in the current checkout. The repository does not substitute patches generated from a different OMP version.
