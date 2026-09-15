# omp-mods

Quality-of-life modifications and recreation notes for [Oh My Pi (OMP)](https://github.com/can1357/oh-my-pi).

This collection documents practical changes made to OMP's terminal UI, prompt editing, model selection, project switching, mobile workflow, and local skill setup. Each guide explains the user-facing benefit, the source files involved, the original verification, and the compatibility limits.

> These are community modification notes, not official OMP releases. Most entries describe source patches tested against a specific OMP version. Review the recorded base version and current upstream code before applying a change.

## Modification list

| Improvement | Quality-of-life benefit | Guide |
| --- | --- | --- |
| Inline spellcheck and autocorrect | Corrects high-confidence prompt typos after a delimiter without opening a distracting word-suggestion dropdown. Includes Australian English, learned words, custom replacements, mobile input chunks, and code-aware guardrails | [`docs/spellcheck-autocorrect.md`](./docs/spellcheck-autocorrect.md) and [`artifacts/spellcheck-reference/`](./artifacts/spellcheck-reference/) |
| Calm mode (extension) | Hides every tool-call/tool-result row so the transcript reads as agent prose, with an animated boat while the agent works. Drop-in extension — no rebuild; `/calm` toggles, on by default | [`docs/calm-extension.md`](./docs/calm-extension.md) and [`artifacts/calm/`](./artifacts/calm/) |
| Responsive two-row status line | Uses two status rows on narrow phone terminals and one row on wider desktop terminals so important session information remains readable | [`docs/responsive-two-row-status-line.md`](./docs/responsive-two-row-status-line.md) |
| Mid-text skill autocomplete | Lets users type a skill selector after existing prompt text while preserving the surrounding draft and invoking the selected skill correctly | [`docs/mid-text-skill-autocomplete.md`](./docs/mid-text-skill-autocomplete.md) |
| Skill dropdown investigation | Records the original autocomplete limitation, first-pass design, build process, and install-path issue that led to the later draft-preserving implementation | [`docs/skill-dropdown-after-text.md`](./docs/skill-dropdown-after-text.md) |
| Selected-list contrast | Makes selected radio, checkbox, and picker rows readable on bright themes by choosing a contrast-aware foreground | [`docs/selected-list-contrast.md`](./docs/selected-list-contrast.md) |
| Selected description styling | Keeps secondary description text visually distinct when a skill or list item is selected | [`docs/skill-dropdown-selected-description.md`](./docs/skill-dropdown-selected-description.md) |
| Global OpenAI model choices | Adds selected OpenAI models to the global OMP configuration so they appear consistently across projects | [`docs/global-openai-model-choices.md`](./docs/global-openai-model-choices.md) |
| Project picker (`ompp`) | Uses one numbered project list to start OMP in a project or switch the active OMP session without manually typing paths | [`docs/project-picker.md`](./docs/project-picker.md) and [`artifacts/project-picker/`](./artifacts/project-picker/) |
| Termux VoiceClip dictation | Adds a one-tap Android speech-to-clipboard key for Mobile-OMP and Termux workflows | [`docs/termux-voiceclip-dictation.md`](./docs/termux-voiceclip-dictation.md) and [`artifacts/voiceclip/`](./artifacts/voiceclip/) |
| External SkillOpt storage | Moves reusable SkillOpt state and shared skills to an external volume while keeping OMP and Codex discovery paths aligned | [`docs/skillopt-omp-codex-external-storage.md`](./docs/skillopt-omp-codex-external-storage.md) |
| Clipboard-to-device shortcuts | Sends the current macOS clipboard to a phone, laptop, Mac mini, or every configured device through a private Tailscale connector and STM Desktop Listener command shortcuts | [`docs/clipboard-to-tailscale-device.md`](./docs/clipboard-to-tailscale-device.md) and [`artifacts/msg/`](./artifacts/msg/) |
| Session auto-resume | Re-enters the last OMP session in a pane ~3s after it exits, so closing a session restarts it in place. Press any key to stay in the shell; auto-bypasses for scripts, PRD lanes, and one-shot prompts | [`docs/session-auto-resume.md`](./docs/session-auto-resume.md) and [`artifacts/autoresume/`](./artifacts/autoresume/) |

## How to use this repository

1. Open the guide for the behavior you want.
2. Check the documented OMP base version and affected package paths.
3. Compare the guide with the current upstream implementation. OMP changes quickly, so line numbers and APIs may have moved.
4. Apply the smallest source change that recreates the documented behavior.
5. Run the focused tests and package checks listed in the guide.
6. Build and smoke-test a temporary binary before replacing the active `omp` executable.
7. Back up the active binary and use an atomic rename for installation when the guide calls for it.

The two skill-autocomplete documents describe different stages of the same work. Where they conflict, [`mid-text-skill-autocomplete.md`](./docs/mid-text-skill-autocomplete.md) is the newer behavior and takes precedence over the historical first-pass explainer.

## Repository structure

```text
docs/       Versioned recreation notes for OMP and Mobile-OMP improvements
artifacts/  Recoverable source, extensions, skills, launchers, and sample configuration
```

This repository preserves recoverable implementation artifacts plus detailed verification records. It does not distribute a forked OMP binary or the locally signed VoiceClip APK, and it does not claim that a change recorded against OMP 16.x applies unchanged to a newer release.

## Related repository

CMUX-only and joint CMUX integrations are kept separately in [`demetre19/cmux-mods`](https://github.com/demetre19/cmux-mods). That repository includes the CMUX side of the shared project picker.

## Build notes

The recorded source builds use Bun and the OMP monorepo's existing lockfile. Follow the version stated in each guide. Do not run blind dependency upgrades, and do not overwrite a live executable before a temporary build passes both `--version` and a simple print-mode smoke check.

## Public-release hygiene

Personal home paths, private project names, caches, backups, session data, access tokens, and compiled binaries are not included. Paths in the guides use `~`, `~/Projects`, or generic external-volume examples.

Choose one modification, reproduce it against a matching OMP revision, and confirm the linked verification before installing it into your active terminal workflow.
