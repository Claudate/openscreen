import * as i18n from "@solid-primitives/i18n";
import { createMemo, createSignal } from "solid-js";
import { dict as en } from "./locales/en";
import { dict as zhCN } from "./locales/zh-CN";

export type Locale = "en" | "zh-CN";
export type RawDictionary = typeof en;

const dictionaries: Record<Locale, RawDictionary> = {
	en,
	"zh-CN": zhCN,
};

const STORAGE_KEY = "cap-locale";

function detectInitialLocale(): Locale {
	if (typeof localStorage !== "undefined") {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved === "en" || saved === "zh-CN") return saved;
	}
	const sys =
		typeof navigator !== "undefined" ? navigator.language.toLowerCase() : "en";
	return sys.startsWith("zh") ? "zh-CN" : "en";
}

const [locale, setLocaleSignal] = createSignal<Locale>(detectInitialLocale());

export function setLocale(next: Locale) {
	if (typeof localStorage !== "undefined") {
		localStorage.setItem(STORAGE_KEY, next);
	}
	setLocaleSignal(next);
}

if (typeof window !== "undefined") {
	window.addEventListener("storage", (event) => {
		if (
			event.key === STORAGE_KEY &&
			(event.newValue === "en" || event.newValue === "zh-CN")
		) {
			setLocaleSignal(event.newValue);
		}
	});
}

export { locale };

const flatDictionary = createMemo(() => i18n.flatten(dictionaries[locale()]));

export const t = i18n.translator(flatDictionary, i18n.resolveTemplate);

export const LOCALE_OPTIONS: ReadonlyArray<{ value: Locale; label: string }> = [
	{ value: "en", label: "English" },
	{ value: "zh-CN", label: "简体中文" },
];
