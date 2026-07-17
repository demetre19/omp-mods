# Global OpenAI model choices in OMP

## System modified

- OMP / CMUX / both: OMP
- Platform: Cross-platform OMP configuration; the recorded path is for this macOS installation
- CMUX required: No

## Prerequisites

- An OMP installation that reads global settings from `~/.omp/agent/config.yml`.
- OpenAI Codex authentication with access to the requested models.
- An OMP model catalog containing `openai-codex/gpt-5.6-terra`, `openai-codex/gpt-5.6-sol`, `openai-codex/gpt-5.6-luna`, and `openai-codex/gpt-5.5`.

## What this change does

OMP's global model allow-list exposes four OpenAI Codex choices in every project:

- GPT-5.6 Terra
- GPT-5.6 Sol
- GPT-5.6 Luna
- GPT-5.5

Sol is the official spelling. The corresponding model IDs are `gpt-5.6-terra`, `gpt-5.6-sol`, `gpt-5.6-luna`, and `gpt-5.5`.

## Why this change exists

The previous global allow-list exposed only GPT-5.6 Sol. This change makes Terra and Luna selectable as alternative GPT-5.6 cost/capability tiers and retains GPT-5.5 as an additional option without requiring per-project configuration.

## Files to create or edit

- `~/.omp/agent/config.yml` - global OMP settings used by every project.

## LLM recreation instructions

Give these instructions to an LLM:

1. Read OpenAI's current official model guide at `https://developers.openai.com/api/docs/guides/latest-model` and preserve the documented model IDs. In particular, use `sol`, not `soul`.
2. Confirm OMP's live catalog contains the four `openai-codex` model IDs with `omp models` or by inspecting OMP's model registry.
3. Edit the global `enabledModels` array in `~/.omp/agent/config.yml` so it contains exactly:

   ```yaml
   enabledModels:
     - openai-codex/gpt-5.6-terra
     - openai-codex/gpt-5.6-sol
     - openai-codex/gpt-5.6-luna
     - openai-codex/gpt-5.5
   ```

4. Leave `modelRoles` unchanged unless the user separately asks to change the default model. In this setup, Sol remains the default.
5. Start a new OMP session if an existing session does not refresh the model selector automatically.

## Verification

- From a project directory, run `omp config get enabledModels` and confirm all four selectors are returned.
- Run the same command from an unrelated directory such as `/private/tmp` to prove the setting is global.
- Open OMP's model selector and confirm GPT-5.6 Terra, GPT-5.6 Sol, GPT-5.6 Luna, and GPT-5.5 are available.
- Optionally prove backend access with `omp -p --model openai-codex/<model-id> --no-tools "Reply exactly OK"` for each model.

## Notes for non-CMUX users

CMUX is not involved. The setting applies to OMP wherever its global configuration directory is available. On Windows, edit the equivalent OMP global `agent/config.yml` path for that installation rather than the macOS path shown above. A new OMP process may be required before an already-running selector reflects the change.
