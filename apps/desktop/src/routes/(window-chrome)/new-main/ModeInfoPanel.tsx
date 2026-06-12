import { cx } from "cva";
import { For } from "solid-js";
import { Transition } from "solid-transition-group";
import { t } from "~/i18n";
import { commands, type RecordingMode } from "~/utils/tauri";
import IconLucideArrowLeft from "~icons/lucide/arrow-left";
import { useRecordingOptions } from "../OptionsContext";

interface ModeInfoPanelProps {
	onBack: () => void;
}

const modeOptions = [
	{
		mode: "instant" as RecordingMode,
		titleKey: "mode.instantMode" as const,
		descKey: "mode.instantModeDesc" as const,
		icon: IconCapInstant,
	},
	{
		mode: "studio" as RecordingMode,
		titleKey: "mode.studioMode" as const,
		descKey: "mode.studioModeDesc" as const,
		icon: IconCapFilmCut,
	},
	{
		mode: "screenshot" as RecordingMode,
		titleKey: "mode.screenshotMode" as const,
		descKey: "mode.screenshotModeDesc" as const,
		icon: IconCapScreenshot,
	},
];

export default function ModeInfoPanel(props: ModeInfoPanelProps) {
	const { rawOptions, setOptions } = useRecordingOptions();

	const handleModeSelect = (mode: RecordingMode) => {
		setOptions({ mode });
		commands.setRecordingMode(mode);
		props.onBack();
	};

	return (
		<div class="flex flex-col w-full h-full min-h-0">
			<div class="flex gap-3 justify-between items-center mt-3">
				<button
					type="button"
					onClick={() => props.onBack()}
					class="flex gap-1 items-center rounded-md px-1.5 text-xs
					text-gray-11 transition-opacity hover:opacity-70 hover:text-gray-12
					focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-9 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-1"
				>
					<IconLucideArrowLeft class="size-3 text-gray-11" />
					<span class="font-medium text-gray-12">{t("common.back")}</span>
				</button>
				<span class="text-xs font-medium text-gray-11">
					{t("mode.recordingModes")}
				</span>
			</div>
			<div class="flex flex-col flex-1 min-h-0 pt-4">
				<div class="px-1 custom-scroll flex-1 overflow-y-auto">
					<div class="flex flex-col gap-2 pb-4">
						<For each={modeOptions}>
							{(option, index) => {
								const isSelected = () => rawOptions.mode === option.mode;

								return (
									<Transition
										appear
										enterActiveClass="transition duration-200"
										enterClass="scale-95 opacity-0"
										enterToClass="scale-100 opacity-100"
										exitActiveClass="transition duration-200"
										exitClass="scale-100"
										exitToClass="scale-95"
									>
										<div style={{ "transition-delay": `${index() * 100}ms` }}>
											<button
												type="button"
												onClick={() => handleModeSelect(option.mode)}
												class={cx(
													"flex flex-col gap-1.5 w-full p-3 text-left rounded-xl border transition-colors duration-200",
													isSelected()
														? "border-blue-7 bg-blue-3/40"
														: "border-gray-4 bg-gray-2 hover:border-gray-6 hover:bg-gray-3",
												)}
											>
												<div class="flex gap-2 items-center">
													<option.icon class="size-4 text-gray-12" />
													<span class="text-sm font-medium text-gray-12">
														{t(option.titleKey)}
													</span>
												</div>
												<p class="text-xs leading-relaxed text-gray-11">
													{t(option.descKey)}
												</p>
											</button>
										</div>
									</Transition>
								);
							}}
						</For>
					</div>
				</div>
			</div>
		</div>
	);
}
