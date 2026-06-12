import { createWritableMemo } from "@solid-primitives/memo";
import { t } from "~/i18n";
import {
	getHexColorDigitCount,
	normalizeOpaqueHexColor,
} from "~/utils/hex-color";
import type { OrganizationBrandColorSwatch } from "~/utils/organization-branding";
import { BrandColorsDropdown } from "./BrandColorsDropdown";
import { getColorPreviewBorderColor } from "./color-utils";
import { TextInput } from "./TextInput";

export const FONT_OPTIONS = () => [
	{ value: "System Sans-Serif", label: t("editor.textStyle.fontSansSerif") },
	{ value: "System Serif", label: t("editor.textStyle.fontSerif") },
	{ value: "System Monospace", label: t("editor.textStyle.fontMonospace") },
];

const POSITION_OPTIONS = () => [
	{ value: "top-left", label: t("editor.textStyle.topLeft") },
	{ value: "top-center", label: t("editor.textStyle.topCenter") },
	{ value: "top-right", label: t("editor.textStyle.topRight") },
	{ value: "bottom-left", label: t("editor.textStyle.bottomLeft") },
	{ value: "bottom-center", label: t("editor.textStyle.bottomCenter") },
	{ value: "bottom-right", label: t("editor.textStyle.bottomRight") },
];

export const CAPTION_POSITION_OPTIONS = POSITION_OPTIONS;

export const KEYBOARD_POSITION_OPTIONS = POSITION_OPTIONS;

export const TEXT_WEIGHT_OPTIONS = () => [
	{ label: t("editor.textStyle.weightNormal"), value: 400 },
	{ label: t("editor.textStyle.weightMedium"), value: 500 },
	{ label: t("editor.textStyle.weightBold"), value: 700 },
];

export function getTextWeightLabel(weight: number | null | undefined) {
	const option = TEXT_WEIGHT_OPTIONS().find(
		(option) => option.value === weight,
	);
	if (option) return option.label;
	if (weight != null) return t("editor.textStyle.weightCustom", { weight });
	return t("editor.textStyle.weightNormal");
}

export function HexColorInput(props: {
	value: string;
	onChange: (value: string) => void;
	brandColorSwatches?: OrganizationBrandColorSwatch[];
}) {
	const [text, setText] = createWritableMemo(() => props.value);
	let prevColor = props.value;
	let colorInput!: HTMLInputElement;

	const commitValue = (raw: string) => {
		const normalized = normalizeOpaqueHexColor(raw);
		if (normalized) {
			props.onChange(normalized);
			setText(normalized);
			return true;
		}
		return false;
	};

	const selectBrandColor = (color: string) => {
		setText(color);
		prevColor = color;
		props.onChange(color);
	};

	return (
		<div class="flex flex-col gap-2">
			<div class="flex flex-row items-center gap-[0.75rem] relative">
				<button
					type="button"
					class="size-[2rem] rounded-[0.5rem]"
					style={{
						"background-color": text(),
						"box-shadow": `inset 0 0 0 1px ${getColorPreviewBorderColor(
							text(),
						)}`,
					}}
					onClick={() => colorInput.click()}
				/>
				<input
					ref={colorInput}
					type="color"
					class="absolute left-0 bottom-0 size-[2rem] opacity-0"
					value={text()}
					onChange={(e) => {
						setText(e.target.value);
						props.onChange(e.target.value);
					}}
				/>
				<TextInput
					class="w-[5rem] p-[0.375rem] border border-gray-3 text-gray-12 rounded-[0.5rem] bg-gray-2"
					value={text()}
					onFocus={() => {
						prevColor = props.value;
					}}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							if (!commitValue(e.currentTarget.value)) {
								setText(prevColor);
							}
							e.currentTarget.blur();
						}
					}}
					onInput={(e) => {
						setText(e.currentTarget.value);
						if (getHexColorDigitCount(e.currentTarget.value) !== 6) return;

						const normalized = normalizeOpaqueHexColor(e.currentTarget.value);
						if (normalized) {
							props.onChange(normalized);
						}
					}}
					onBlur={(e) => {
						if (!commitValue(e.target.value)) {
							setText(prevColor);
							props.onChange(props.value);
						}
					}}
				/>
			</div>
			<BrandColorsDropdown
				swatches={props.brandColorSwatches ?? []}
				onSelect={selectBrandColor}
			/>
		</div>
	);
}
