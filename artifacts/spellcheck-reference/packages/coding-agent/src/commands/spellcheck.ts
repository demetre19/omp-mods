import { Args, Command, renderCommandHelp } from "@oh-my-pi/pi-utils/cli";
import {
	forgetSpellcheckReplacement,
	getSpellcheckUserWordsPath,
	learnSpellcheckIgnoredWord,
	learnSpellcheckReplacement,
	loadSpellcheckUserWords,
	unlearnSpellcheckIgnoredWord,
} from "../modes/spellcheck-user-words";
import { initTheme } from "../modes/theme/theme";

const ACTIONS = ["learn", "unlearn", "replace", "forget", "list", "path"] as const;
type SpellcheckAction = (typeof ACTIONS)[number];

function printWords(): void {
	const words = loadSpellcheckUserWords();
	if (words.ignoredWords.length === 0 && Object.keys(words.replacements).length === 0) {
		process.stdout.write("No learned spellcheck words yet.\n");
		return;
	}
	if (words.ignoredWords.length > 0) {
		process.stdout.write("Ignored words:\n");
		for (const word of words.ignoredWords) process.stdout.write(`  ${word}\n`);
	}
	const replacements = Object.entries(words.replacements);
	if (replacements.length > 0) {
		process.stdout.write("Custom replacements:\n");
		for (const [typo, correction] of replacements) process.stdout.write(`  ${typo} -> ${correction}\n`);
	}
}

function requireWord(words: string[], index: number, label: string): string {
	const word = words[index];
	if (!word) throw new Error(`Missing ${label}`);
	return word;
}

export default class Spellcheck extends Command {
	static description = "Manage learned spellcheck words and replacements";

	static args = {
		action: Args.string({
			description: "Spellcheck action",
			required: false,
			options: ACTIONS as unknown as string[],
		}),
		words: Args.string({ description: "Word, typo, or correction", required: false, multiple: true }),
	};

	static examples = [
		"# Remember a brand or project word so it is never autocorrected\n  omp spellcheck learn cmux",
		"# Remove a learned ignored word\n  omp spellcheck unlearn cmux",
		"# Add a personal typo correction\n  omp spellcheck replace autocorrel autocorrect",
		"# List learned ignored words and replacements\n  omp spellcheck list",
	];

	async run(): Promise<void> {
		const { args } = await this.parse(Spellcheck);
		const action = args.action as SpellcheckAction | undefined;
		const words = Array.isArray(args.words) ? args.words : args.words ? [args.words] : [];

		await initTheme();

		if (!action) {
			renderCommandHelp("omp", "spellcheck", Spellcheck);
			return;
		}

		switch (action) {
			case "learn": {
				const word = requireWord(words, 0, "word to learn");
				learnSpellcheckIgnoredWord(word);
				process.stdout.write(`Learned ignored spellcheck word: ${word.trim().toLowerCase()}\n`);
				return;
			}
			case "unlearn": {
				const word = requireWord(words, 0, "word to unlearn");
				unlearnSpellcheckIgnoredWord(word);
				process.stdout.write(`Removed ignored spellcheck word: ${word.trim().toLowerCase()}\n`);
				return;
			}
			case "replace": {
				const typo = requireWord(words, 0, "typo");
				const correction = requireWord(words, 1, "correction");
				learnSpellcheckReplacement(typo, correction);
				process.stdout.write(
					`Learned spellcheck replacement: ${typo.trim().toLowerCase()} -> ${correction.trim().toLowerCase()}\n`,
				);
				return;
			}
			case "forget": {
				const typo = requireWord(words, 0, "typo to forget");
				forgetSpellcheckReplacement(typo);
				process.stdout.write(`Removed spellcheck replacement: ${typo.trim().toLowerCase()}\n`);
				return;
			}
			case "list":
				printWords();
				return;
			case "path":
				process.stdout.write(`${getSpellcheckUserWordsPath()}\n`);
				return;
		}
	}
}
