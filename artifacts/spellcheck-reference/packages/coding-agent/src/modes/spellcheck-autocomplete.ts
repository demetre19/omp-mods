import nspell from "nspell";
import { dictionaryEnAu } from "./spellcheck-dictionary-en-au.generated";
import type { SpellcheckUserWords } from "./spellcheck-user-words";
import {
	isSpellcheckIgnoredWord,
	loadSpellcheckUserWords,
	spellcheckUserReplacementFor,
} from "./spellcheck-user-words";

const AU_DICTIONARY_SOURCE = "dictionary-en-au";

interface SpellcheckInlineReplaceOptions {
	autoReplaceEnabled?: boolean;
	userWords?: SpellcheckUserWords;
}

interface SpellcheckEngine {
	correct(word: string): boolean;
	suggest(word: string): string[];
}

const REPLACEMENTS: Record<string, string> = {
	teh: "the",
	adn: "and",
	dont: "don't",
	cant: "can't",
	wont: "won't",
	im: "I'm",
	ive: "I've",
	ill: "I'll",
	thus: "this",
	thar: "that",
	cam: "can",
	bur: "but",
	nit: "not",
	whet: "what",
	bely: "best",
	expectef: "expected",
	sortef: "sorted",
	autocomenple: "autocomplete",
	autocomeplete: "autocomplete",
	becuase: "because",
	recieve: "receive",
	seperate: "separate",
	definately: "definitely",
	occured: "occurred",
	acheive: "achieve",
	adress: "address",
	corectly: "correctly",
	enviroment: "environment",
	funciton: "function",
	retun: "return",
	noe: "now",
	chekc: "check",
	chek: "check",
	speled: "spelled",
	worfs: "words",
};

const SAFE_AUTOREPLACE_WORDS = new Set([
	"above",
	"achieve",
	"address",
	"and",
	"autocomplete",
	"autocorrect",
	"because",
	"better",
	"but",
	"can",
	"check",
	"correctly",
	"definitely",
	"dictionary",
	"environment",
	"correction",
	"exactly",
	"expected",
	"function",
	"good",
	"not",
	"now",
	"much",
	"properly",
	"really",
	"receive",
	"return",
	"separate",
	"spelled",
	"the",
	"spell",
	"that",
	"sorted",
	"this",
	"why",
	"words",
]);

let engineCache: SpellcheckEngine | null = null;

function isAsciiLetter(c: number): boolean {
	return (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a);
}

function isWordChar(c: number): boolean {
	return isAsciiLetter(c) || c === 0x27; // apostrophe
}

function isDelimiter(c: number): boolean {
	return c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d || c === 0x2e || c === 0x2c || c === 0x21 || c === 0x3f;
}

function hasLeftBoundary(text: string, index: number): boolean {
	if (index === 0) return true;
	const c = text.charCodeAt(index - 1);
	return c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d || c === 0x28 || c === 0x5b || c === 0x7b || c === 0x3e;
}

function hasNaturalHyphenLeftBoundary(text: string, index: number): boolean {
	if (index < 2 || text.charCodeAt(index - 1) !== 0x2d) return false;
	let prefixStart = index - 1;
	while (prefixStart > 0 && isWordChar(text.charCodeAt(prefixStart - 1))) prefixStart--;
	if (prefixStart === index - 1) return false;
	return hasLeftBoundary(text, prefixStart);
}

function isCodeishContext(
	textBeforeWord: string,
	word: string,
	options: { allowTrailingHyphen?: boolean } = {},
): boolean {
	if (word.length < 3) return true;
	if (/[A-Z]/.test(word.slice(1))) return true;
	if (textBeforeWord.trimStart().startsWith("/")) return true;
	if (textBeforeWord.endsWith("@")) return true;
	const trailingPunctuationContext =
		options.allowTrailingHyphen && textBeforeWord.endsWith("-") ? textBeforeWord.slice(0, -1) : textBeforeWord;
	if (/[@/:._`'"\\-]$/.test(trailingPunctuationContext)) return true;
	if (
		/(?:^|\s)(?:https?|file|ssh|skill|agent|artifact|memory|rule|local|mcp|issue|pr):\/\/[\S]*$/i.test(textBeforeWord)
	)
		return true;
	if (/(?:^|\s)(?:[.~]?\/|@?\.\.?\/|[A-Za-z]:[\\/])\S*$/i.test(textBeforeWord)) return true;
	if (
		/(?:^|\s)(?:const|let|var|function|class|interface|type|import|export|return|grep|sed|awk|npm|bun|pnpm|yarn|git|curl|ssh)\s+\S*$/i.test(
			textBeforeWord,
		)
	)
		return true;
	return false;
}

function preserveCase(source: string, replacement: string): string {
	if (source.toUpperCase() === source) return replacement.toUpperCase();
	if (source[0]?.toUpperCase() === source[0] && source.slice(1).toLowerCase() === source.slice(1)) {
		return replacement[0]!.toUpperCase() + replacement.slice(1);
	}
	return replacement;
}

function extractCompletedWord(textBeforeCursor: string): { word: string; term: string; start: number } | null {
	const len = textBeforeCursor.length;
	if (len < 2) return null;
	const termCode = textBeforeCursor.charCodeAt(len - 1);
	if (!isDelimiter(termCode)) return null;
	const term = textBeforeCursor[len - 1]!;
	let end = len - 1;
	while (end > 0 && isDelimiter(textBeforeCursor.charCodeAt(end - 1))) end--;
	let start = end;
	while (start > 0 && isWordChar(textBeforeCursor.charCodeAt(start - 1))) start--;
	if (start === end) return null;
	const naturalHyphenBoundary = hasNaturalHyphenLeftBoundary(textBeforeCursor, start);
	if (!hasLeftBoundary(textBeforeCursor, start) && !naturalHyphenBoundary) return null;
	const word = textBeforeCursor.slice(start, end);
	if (isCodeishContext(textBeforeCursor.slice(0, start), word, { allowTrailingHyphen: naturalHyphenBoundary }))
		return null;
	return { word, term, start };
}

function getSpellcheckEngine(): SpellcheckEngine {
	engineCache ??= nspell(dictionaryEnAu) as SpellcheckEngine;
	return engineCache;
}

function normalizedSuggestion(suggestion: string): string | null {
	const word = suggestion.trim();
	if (word.length < 3 || word.length > 24) return null;
	if (!/^[A-Za-z]+(?:'[A-Za-z]+)?$/.test(word)) return null;
	return word.toLowerCase();
}

function editDistance(a: string, b: string): number {
	const prev = new Array<number>(b.length + 1);
	const curr = new Array<number>(b.length + 1);
	for (let j = 0; j <= b.length; j += 1) prev[j] = j;
	for (let i = 1; i <= a.length; i += 1) {
		curr[0] = i;
		for (let j = 1; j <= b.length; j += 1) {
			const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
			curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
		}
		for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j]!;
	}
	return prev[b.length]!;
}

function safeSuggestionFor(word: string): string | null {
	const lower = word.toLowerCase();
	const spell = getSpellcheckEngine();
	if (spell.correct(lower)) return null;

	const suggestions = spell
		.suggest(lower)
		.map(normalizedSuggestion)
		.filter((candidate): candidate is string => Boolean(candidate));
	if (suggestions.length === 0) return null;

	if (suggestions.length === 1) {
		const only = suggestions[0]!;
		return editDistance(lower, only) <= 2 ? only : null;
	}

	let safeBest: { word: string; distance: number; index: number } | null = null;
	for (const [index, suggestion] of suggestions.entries()) {
		if (!SAFE_AUTOREPLACE_WORDS.has(suggestion)) continue;
		const distance = editDistance(lower, suggestion);
		if (distance > 2) continue;
		if (!safeBest || distance < safeBest.distance || (distance === safeBest.distance && index < safeBest.index)) {
			safeBest = { word: suggestion, distance, index };
		}
	}

	return safeBest?.word ?? null;
}

function auDictionaryEntryCount(): number {
	const firstLine = Number.parseInt(dictionaryEnAu.dic.split(/\r?\n/, 1)[0] ?? "", 10);
	return Number.isFinite(firstLine) ? firstLine : 0;
}

function autoCorrectionFor(word: string, userWords: SpellcheckUserWords): string | null {
	if (isSpellcheckIgnoredWord(word, userWords)) return null;
	const userReplacement = spellcheckUserReplacementFor(word, userWords);
	if (userReplacement) return preserveCase(word, userReplacement);

	const lower = word.toLowerCase();
	const replacement = REPLACEMENTS[lower];
	if (replacement) return preserveCase(word, replacement);

	const suggestion = safeSuggestionFor(word);
	return suggestion ? preserveCase(word, suggestion) : null;
}

export function getSpellcheckDictionaryStats(): { size: number; source: string } {
	return { size: auDictionaryEntryCount(), source: AU_DICTIONARY_SOURCE };
}

export function trySpellcheckInlineReplace(
	textBeforeCursor: string,
	options: SpellcheckInlineReplaceOptions = {},
): { replaceLen: number; insert: string } | null {
	if (options.autoReplaceEnabled === false) return null;
	const completed = extractCompletedWord(textBeforeCursor);
	if (!completed) return null;
	const replacement = autoCorrectionFor(completed.word, options.userWords ?? loadSpellcheckUserWords());
	if (!replacement) return null;
	const insert = replacement + completed.term;
	return { replaceLen: completed.word.length + completed.term.length, insert };
}
