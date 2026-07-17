import { describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
	forgetSpellcheckReplacement,
	learnSpellcheckIgnoredWord,
	learnSpellcheckReplacement,
	loadSpellcheckUserWords,
	unlearnSpellcheckIgnoredWord,
} from "@oh-my-pi/pi-coding-agent/modes/spellcheck-user-words";

async function withTempSpellcheckStore<T>(fn: (filePath: string) => Promise<T>): Promise<T> {
	const dir = await mkdtemp(path.join(os.tmpdir(), "omp-spellcheck-words-"));
	const filePath = path.join(dir, "spellcheck-words.json");
	await writeFile(filePath, '{"ignoredWords":[],"replacements":{}}\n', "utf8");
	try {
		return await fn(filePath);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

describe("spellcheck user words storage", () => {
	it("persists learned ignored words and removes them when unlearned", async () => {
		await withTempSpellcheckStore(async filePath => {
			expect(learnSpellcheckIgnoredWord("Teh", filePath)).toEqual({
				ignoredWords: ["teh"],
				replacements: {},
			});
			expect(loadSpellcheckUserWords(filePath)).toEqual({
				ignoredWords: ["teh"],
				replacements: {},
			});

			expect(unlearnSpellcheckIgnoredWord("TEH", filePath)).toEqual({
				ignoredWords: [],
				replacements: {},
			});
			expect(loadSpellcheckUserWords(filePath)).toEqual({
				ignoredWords: [],
				replacements: {},
			});
		});
	});

	it("persists replacement pairs and removes them when forgotten", async () => {
		await withTempSpellcheckStore(async filePath => {
			expect(learnSpellcheckReplacement("Teh", "Tea", filePath)).toEqual({
				ignoredWords: [],
				replacements: { teh: "tea" },
			});
			expect(loadSpellcheckUserWords(filePath)).toEqual({
				ignoredWords: [],
				replacements: { teh: "tea" },
			});

			expect(forgetSpellcheckReplacement("TEH", filePath)).toEqual({
				ignoredWords: [],
				replacements: {},
			});
			expect(loadSpellcheckUserWords(filePath)).toEqual({
				ignoredWords: [],
				replacements: {},
			});
		});
	});

	it("moves a word between replacement and ignored sets without leaving stale entries", async () => {
		await withTempSpellcheckStore(async filePath => {
			learnSpellcheckReplacement("aboev", "above", filePath);

			expect(learnSpellcheckIgnoredWord("ABOEV", filePath)).toEqual({
				ignoredWords: ["aboev"],
				replacements: {},
			});

			expect(learnSpellcheckReplacement("ABOEV", "above", filePath)).toEqual({
				ignoredWords: [],
				replacements: { aboev: "above" },
			});
			expect(loadSpellcheckUserWords(filePath)).toEqual({
				ignoredWords: [],
				replacements: { aboev: "above" },
			});
		});
	});
});
