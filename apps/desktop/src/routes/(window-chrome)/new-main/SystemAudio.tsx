import { createQuery } from "@tanstack/solid-query";
import { cx } from "cva";
import type { Component, ComponentProps, JSX } from "solid-js";
import { Dynamic } from "solid-js/web";
import { t } from "~/i18n";
import {
	createCurrentRecordingQuery,
	isSystemAudioSupported,
} from "~/utils/queries";
import { useRecordingOptions } from "../OptionsContext";
import {
	DEVICE_ROW_CLASS,
	DEVICE_ROW_ICON_CLASS,
	DEVICE_ROW_LABEL_CLASS,
	DEVICE_ROW_TRAILING_CLASS,
} from "./deviceRowStyles";
import InfoPill from "./InfoPill";

export default function SystemAudio() {
	return (
		<SystemAudioToggleRoot
			class={cx(DEVICE_ROW_CLASS, "KSelect")}
			PillComponent={InfoPill}
			icon={<IconPhMonitorBold class={DEVICE_ROW_ICON_CLASS} />}
		/>
	);
}

export function SystemAudioToggleRoot(
	props: Omit<
		ComponentProps<"button">,
		"onClick" | "disabled" | "title" | "type" | "children"
	> & {
		PillComponent: Component<{
			variant: "blue" | "red" | "gray";
			children: JSX.Element;
		}>;
		icon: JSX.Element;
	},
) {
	const { rawOptions, setOptions } = useRecordingOptions();
	const currentRecording = createCurrentRecordingQuery();
	const systemAudioSupported = createQuery(() => isSystemAudioSupported);

	const isDisabled = () =>
		!!currentRecording.data || systemAudioSupported.data === false;
	const tooltipMessage = () => {
		if (systemAudioSupported.data === false) {
			return t("main.systemAudioRequiresMacos");
		}
		return undefined;
	};

	return (
		<button
			{...props}
			type="button"
			title={tooltipMessage()}
			onClick={() => {
				if (!rawOptions || isDisabled()) return;
				setOptions({ captureSystemAudio: !rawOptions.captureSystemAudio });
			}}
			disabled={isDisabled()}
			aria-pressed={rawOptions.captureSystemAudio ? "true" : "false"}
		>
			{props.icon}
			<p class={DEVICE_ROW_LABEL_CLASS}>
				{rawOptions.captureSystemAudio
					? t("main.recordSystemAudio")
					: t("main.noSystemAudio")}
			</p>
			<div class={DEVICE_ROW_TRAILING_CLASS}>
				<Dynamic
					component={props.PillComponent}
					variant={rawOptions.captureSystemAudio ? "blue" : "gray"}
				>
					{rawOptions.captureSystemAudio ? t("main.on") : t("main.off")}
				</Dynamic>
			</div>
		</button>
	);
}
