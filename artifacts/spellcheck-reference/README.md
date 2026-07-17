# Spellcheck reference source

Recovered implementation files from the local OMP 16.3.9 spellcheck and autocorrect modification.

These files preserve the custom spellcheck engine, Australian English dictionary embedding, learned-word storage, CLI command, TypeScript declaration, and focused tests. They are included so the implementation is not lost, but they are not a complete patch against current OMP.

## Recorded base

- OMP base documented by the original work: `16.3.9`
- `nspell`: `2.1.5`
- `dictionary-en-au`: `3.0.0`
- Current checkout observed during publication: `17.0.1`

Do not copy these files into OMP 17.x without reviewing current APIs and rebuilding the integration.

## Included source

```text
packages/coding-agent/src/commands/spellcheck.ts
packages/coding-agent/src/modes/spellcheck-autocomplete.ts
packages/coding-agent/src/modes/spellcheck-dictionary-en-au.generated.ts
packages/coding-agent/src/modes/spellcheck-user-words.ts
packages/coding-agent/src/types/nspell.d.ts
packages/coding-agent/test/spellcheck-autocomplete.test.ts
packages/coding-agent/test/spellcheck-user-words.test.ts
third-party/dictionary-en-au-LICENSE
```

## Integration points from the original modification

The full 16.3.9 change also modified tracked files that were no longer present as a recoverable local diff when this repository was assembled:

- `packages/coding-agent/src/cli-commands.ts`
- `packages/coding-agent/src/modes/prompt-action-autocomplete.ts`
- `packages/coding-agent/src/config/settings-schema.ts`
- `packages/tui/src/components/editor.ts`
- `packages/coding-agent/package.json`
- `bun.lock`
- related prompt-action, autocomplete, and editor regression tests

Use [`docs/spellcheck-autocorrect.md`](../../docs/spellcheck-autocorrect.md) for the recorded behavior, dependencies, integration details, guardrails, and original verification results.

## Licensing

The embedded dictionary was generated from `dictionary-en-au@3.0.0`, licensed under MIT and BSD terms. Its license text is preserved in `third-party/dictionary-en-au-LICENSE`.
