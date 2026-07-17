import { describe, expect, it } from "bun:test";
import {
	getSpellcheckDictionaryStats,
	trySpellcheckInlineReplace,
} from "@oh-my-pi/pi-coding-agent/modes/spellcheck-autocomplete";

describe("spellcheck inline auto-replace", () => {
	it("reports the AU nspell dictionary source backing auto-replace", () => {
		const stats = getSpellcheckDictionaryStats();

		expect(stats.source).toBe("dictionary-en-au");
		expect(stats.size).toBeGreaterThan(40_000);
	});

	it("rewrites a safe typo after a delimiter and preserves the trailing space", () => {
		expect(trySpellcheckInlineReplace("teh ")).toEqual({ replaceLen: 4, insert: "the " });
		expect(trySpellcheckInlineReplace("fix teh ")).toEqual({ replaceLen: 4, insert: "the " });
	});

	it("rewrites common prompt typos after a trailing space", () => {
		const cases = [
			["thus", "this"],
			["whet", "what"],
			["expectef", "expected"],
			["worfs", "words"],
			["speled", "spelled"],
			["corectly", "correctly"],
			["autocomenple", "autocomplete"],
			["autocomeplete", "autocomplete"],
			["noe", "now"],
			["thar", "that"],
			["cam", "can"],
			["sortef", "sorted"],
			["mucj", "much"],
			["beter", "better"],
			["bur", "but"],
			["speel", "spell"],
		] as const;

		for (const [typo, correction] of cases) {
			expect(trySpellcheckInlineReplace(`${typo} `), typo).toEqual({
				replaceLen: typo.length + 1,
				insert: `${correction} `,
			});
			expect(trySpellcheckInlineReplace(`fix ${typo} `), `mid-prompt ${typo}`).toEqual({
				replaceLen: typo.length + 1,
				insert: `${correction} `,
			});
		}
	});

	it("applies replacements as each delimiter completes the user's observed phrase", () => {
		let draft = "";

		for (const char of "this is nit the bely ") {
			draft += char;
			const replacement = trySpellcheckInlineReplace(draft);
			if (replacement) {
				draft = draft.slice(0, -replacement.replaceLen) + replacement.insert;
			}
		}

		expect(draft).toBe("this is not the best ");
	});

	it("applies replacements through the user's reported thar cam be sortef phrase", () => {
		let draft = "";

		for (const char of "this is something thar cam be sortef ") {
			draft += char;
			const replacement = trySpellcheckInlineReplace(draft);
			if (replacement) {
				draft = draft.slice(0, -replacement.replaceLen) + replacement.insert;
			}
		}

		expect(draft).toBe("this is something that can be sorted ");
	});

	it("applies replacements through the reported spellcheck quality sentence", () => {
		let draft = "";

		for (const char of "this should be mucj beter bur it isn't see above speel check and auto-corrction still not amazing ") {
			draft += char;
			const replacement = trySpellcheckInlineReplace(draft);
			if (replacement) {
				draft = draft.slice(0, -replacement.replaceLen) + replacement.insert;
			}
		}

		expect(draft).toBe(
			"this should be much better but it isn't see above spell check and auto-correction still not amazing ",
		);
	});

	it("chooses safe common prompt corrections over nspell's first suggestion while typing", () => {
		expect(trySpellcheckInlineReplace("this is exactkt ")).toEqual({
			replaceLen: 8,
			insert: "exactly ",
		});
		expect(trySpellcheckInlineReplace("this is exactly whye ")).toEqual({
			replaceLen: 5,
			insert: "why ",
		});

		let draft = "";

		for (const char of "this is exactkt whye I was ") {
			draft += char;
			const replacement = trySpellcheckInlineReplace(draft);
			if (replacement) {
				draft = draft.slice(0, -replacement.replaceLen) + replacement.insert;
			}
		}

		expect(draft).toBe("this is exactly why I was ");
	});

	it("rewrites safe nspell-backed dictionary misspellings without opening a suggestion list", () => {
		const cases = [
			["aboev", "above"],
			["dictoionary", "dictionary"],
			["expexted", "expected"],
			["realli", "really"],
			["goid", "good"],
		] as const;

		for (const [typo, correction] of cases) {
			expect(trySpellcheckInlineReplace(`is ${typo} `), typo).toEqual({
				replaceLen: typo.length + 1,
				insert: `${correction} `,
			});
		}
	});

	it("rewrites natural-language hyphenated words without weakening code-ish guards", () => {
		for (const textBeforeCursor of ["auto-corrction ", "this is auto-corrction "] as const) {
			const replacement = trySpellcheckInlineReplace(textBeforeCursor);
			expect(replacement, textBeforeCursor).not.toBeNull();
			expect(textBeforeCursor.slice(0, -replacement!.replaceLen) + replacement!.insert, textBeforeCursor).toBe(
				textBeforeCursor.replace("auto-corrction ", "auto-correction "),
			);
		}

		const codeishCases = [
			["URL", "https://example.com/auto-corrction "],
			["relative path", "./auto-corrction "],
			["slash command", "/auto-corrction "],
			["property access", "config.auto-corrction "],
		] as const;

		for (const [name, textBeforeCursor] of codeishCases) {
			expect(trySpellcheckInlineReplace(textBeforeCursor), name).toBeNull();
		}
	});

	it("preserves capitalization when rewriting inline", () => {
		expect(trySpellcheckInlineReplace("Teh ")).toEqual({ replaceLen: 4, insert: "The " });
		expect(trySpellcheckInlineReplace("Realli ")).toEqual({ replaceLen: 7, insert: "Really " });
	});

	it("lets learned ignored words suppress built-in, user, and nspell corrections", () => {
		const userWords = {
			ignoredWords: ["teh", "frobble", "aboev"],
			replacements: { frobble: "feature" },
		};

		expect(trySpellcheckInlineReplace("teh ", { userWords })).toBeNull();
		expect(trySpellcheckInlineReplace("Frobble,", { userWords })).toBeNull();
		expect(trySpellcheckInlineReplace("aboev ", { userWords })).toBeNull();
	});

	it("applies user replacements while preserving case and the completed delimiter", () => {
		const userWords = { ignoredWords: [], replacements: { frobble: "feature" } };

		expect(trySpellcheckInlineReplace("Frobble?", { userWords })).toEqual({
			replaceLen: 8,
			insert: "Feature?",
		});
		expect(trySpellcheckInlineReplace("fix frobble.", { userWords })).toEqual({
			replaceLen: 8,
			insert: "feature.",
		});
	});

	it("lets user replacements override built-in corrections", () => {
		const userWords = { ignoredWords: [], replacements: { teh: "tea" } };

		expect(trySpellcheckInlineReplace("teh ", { userWords })).toEqual({
			replaceLen: 4,
			insert: "tea ",
		});
		expect(trySpellcheckInlineReplace("Teh ", { userWords })).toEqual({
			replaceLen: 4,
			insert: "Tea ",
		});
	});

	it("does not rewrite identifiers, URLs, paths, slash commands, or at-file references", () => {
		const cases = [
			["identifier", "teh_value "],
			["URL", "https://example.com/teh "],
			["relative path", "./teh "],
			["slash command", "/teh "],
			["at-file reference", "@teh "],
			["property access", "config.teh "],
			["call expression", "teh() "],
		] as const;

		for (const [name, textBeforeCursor] of cases) {
			expect(trySpellcheckInlineReplace(textBeforeCursor), name).toBeNull();
		}
	});

	it("does not blindly rewrite ambiguous AU spelling to an unrelated first suggestion", () => {
		expect(trySpellcheckInlineReplace("set color ")).toBeNull();
	});

	it("keeps AU suggestion safety conservative when learned ignored words are loaded", () => {
		const userWords = { ignoredWords: ["colour"], replacements: {} };

		expect(trySpellcheckInlineReplace("set color ", { userWords })).toBeNull();
		expect(trySpellcheckInlineReplace("this is exactkt ", { userWords })).toEqual({
			replaceLen: 8,
			insert: "exactly ",
		});
	});

	it("honors the explicit autoreplace config gate", () => {
		expect(trySpellcheckInlineReplace("teh ", { autoReplaceEnabled: false })).toBeNull();
	});
});
