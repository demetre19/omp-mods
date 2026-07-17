declare module "nspell" {
	interface HunspellDictionary {
		aff: Uint8Array | string;
		dic: Uint8Array | string;
	}

	interface SpellcheckEngine {
		correct(word: string): boolean;
		suggest(word: string): string[];
		spell(word: string): boolean;
		add(word: string): void;
		remove(word: string): void;
	}

	export default function nspell(dictionary: HunspellDictionary): SpellcheckEngine;
}
