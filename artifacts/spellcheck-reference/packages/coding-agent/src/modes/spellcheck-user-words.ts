import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getAgentDir } from "@oh-my-pi/pi-utils";

export interface SpellcheckUserWords {
	ignoredWords: string[];
	replacements: Record<string, string>;
}

function emptySpellcheckUserWords(): SpellcheckUserWords {
	return { ignoredWords: [], replacements: {} };
}
const WORD_PATTERN = /^[A-Za-z][A-Za-z']{1,31}$/;

export function getSpellcheckUserWordsPath(agentDir: string = getAgentDir()): string {
	return path.join(agentDir, "spellcheck-words.json");
}

export function normalizeSpellcheckWord(word: string): string {
	const normalized = word.trim().toLowerCase();
	if (!WORD_PATTERN.test(normalized)) {
		throw new Error(`Spellcheck words must be 2-32 ASCII letters/apostrophes: ${JSON.stringify(word)}`);
	}
	return normalized;
}

function normalizeLoadedWords(raw: unknown): SpellcheckUserWords {
	if (!raw || typeof raw !== "object") return emptySpellcheckUserWords();
	const input = raw as { ignoredWords?: unknown; replacements?: unknown };
	const ignoredWords = Array.isArray(input.ignoredWords)
		? [
				...new Set(
					input.ignoredWords
						.filter((word): word is string => typeof word === "string")
						.map(word => word.toLowerCase()),
				),
			]
				.filter(word => WORD_PATTERN.test(word))
				.sort()
		: [];
	const replacements: Record<string, string> = {};
	if (input.replacements && typeof input.replacements === "object" && !Array.isArray(input.replacements)) {
		for (const [typo, correction] of Object.entries(input.replacements)) {
			if (typeof correction !== "string") continue;
			const normalizedTypo = typo.trim().toLowerCase();
			const normalizedCorrection = correction.trim().toLowerCase();
			if (WORD_PATTERN.test(normalizedTypo) && WORD_PATTERN.test(normalizedCorrection)) {
				replacements[normalizedTypo] = normalizedCorrection;
			}
		}
	}
	return {
		ignoredWords,
		replacements: Object.fromEntries(Object.entries(replacements).sort(([a], [b]) => a.localeCompare(b))),
	};
}

export function loadSpellcheckUserWords(filePath: string = getSpellcheckUserWordsPath()): SpellcheckUserWords {
	try {
		if (!existsSync(filePath)) return emptySpellcheckUserWords();
		return normalizeLoadedWords(JSON.parse(readFileSync(filePath, "utf8")));
	} catch {
		return emptySpellcheckUserWords();
	}
}

export function saveSpellcheckUserWords(
	words: SpellcheckUserWords,
	filePath: string = getSpellcheckUserWordsPath(),
): SpellcheckUserWords {
	const normalized = normalizeLoadedWords(words);
	mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
	writeFileSync(filePath, `${JSON.stringify(normalized, null, "\t")}\n`, { mode: 0o600 });
	return normalized;
}

export function learnSpellcheckIgnoredWord(word: string, filePath?: string): SpellcheckUserWords {
	const normalizedWord = normalizeSpellcheckWord(word);
	const words = loadSpellcheckUserWords(filePath);
	words.ignoredWords = [...new Set([...words.ignoredWords, normalizedWord])].sort();
	delete words.replacements[normalizedWord];
	return saveSpellcheckUserWords(words, filePath);
}

export function unlearnSpellcheckIgnoredWord(word: string, filePath?: string): SpellcheckUserWords {
	const normalizedWord = normalizeSpellcheckWord(word);
	const words = loadSpellcheckUserWords(filePath);
	words.ignoredWords = words.ignoredWords.filter(item => item !== normalizedWord);
	return saveSpellcheckUserWords(words, filePath);
}

export function learnSpellcheckReplacement(typo: string, correction: string, filePath?: string): SpellcheckUserWords {
	const normalizedTypo = normalizeSpellcheckWord(typo);
	const normalizedCorrection = normalizeSpellcheckWord(correction);
	if (normalizedTypo === normalizedCorrection)
		throw new Error("Spellcheck replacement typo and correction must differ");
	const words = loadSpellcheckUserWords(filePath);
	words.ignoredWords = words.ignoredWords.filter(item => item !== normalizedTypo);
	words.replacements[normalizedTypo] = normalizedCorrection;
	return saveSpellcheckUserWords(words, filePath);
}

export function forgetSpellcheckReplacement(typo: string, filePath?: string): SpellcheckUserWords {
	const normalizedTypo = normalizeSpellcheckWord(typo);
	const words = loadSpellcheckUserWords(filePath);
	delete words.replacements[normalizedTypo];
	return saveSpellcheckUserWords(words, filePath);
}

export function isSpellcheckIgnoredWord(word: string, words: SpellcheckUserWords = loadSpellcheckUserWords()): boolean {
	return new Set(words.ignoredWords).has(word.toLowerCase());
}

export function spellcheckUserReplacementFor(
	word: string,
	words: SpellcheckUserWords = loadSpellcheckUserWords(),
): string | null {
	return words.replacements[word.toLowerCase()] ?? null;
}
