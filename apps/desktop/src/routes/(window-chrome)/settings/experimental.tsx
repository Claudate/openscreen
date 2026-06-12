import { invoke } from "@tauri-apps/api/core";
import { type } from "@tauri-apps/plugin-os";
import { createResource, Show } from "solid-js";
import { createStore } from "solid-js/store";
import { t } from "~/i18n";
import { generalSettingsStore } from "~/store";
import {
	deriveGeneralSettings,
	type GeneralSettingsStore,
} from "~/utils/general-settings";
import {
	Section,
	SectionRows,
	SettingsPageContent,
	ToggleSettingItem,
} from "./Setting";

export default function ExperimentalSettings() {
	const [store] = createResource(() => generalSettingsStore.get());
	const osType = type();

	return (
		<Show when={store.state === "ready" && ([store()] as const)}>
			{(store) => <Inner initialStore={store()[0] ?? null} osType={osType} />}
		</Show>
	);
}

function Inner(props: {
	initialStore: GeneralSettingsStore | null;
	osType: ReturnType<typeof type>;
}) {
	const [settings, setSettings] = createStore<GeneralSettingsStore>(
		deriveGeneralSettings(props.initialStore),
	);

	const handleChange = async <K extends keyof typeof settings>(
		key: K,
		value: (typeof settings)[K],
	) => {
		console.log(`Handling settings change for ${key}: ${value}`);

		const previousValue = settings[key];
		setSettings(key as keyof GeneralSettingsStore, value);
		try {
			if (key === "enableNativeCameraPreview") {
				await invoke("set_native_camera_preview_enabled", { enabled: value });
				await generalSettingsStore.set({ [key]: value });
			} else {
				await generalSettingsStore.set({ [key]: value });
			}
		} catch (error) {
			setSettings(key as keyof GeneralSettingsStore, previousValue);
			console.error(`Failed to update ${key}`, error);
		}
	};

	return (
		<div class="cap-settings-page flex flex-col h-full custom-scroll">
			<SettingsPageContent>
				<Show
					when={props.osType !== "windows"}
					fallback={
						<p class="text-xs leading-relaxed text-gray-10 px-1">
							{t("settings.experimental.noFeaturesWindows")}
						</p>
					}
				>
					<Section title={t("settings.experimental.preview")}>
						<SectionRows>
							<ToggleSettingItem
								label={t("settings.experimental.nativeCameraPreview")}
								description={t("settings.experimental.nativeCameraPreviewDesc")}
								value={!!settings.enableNativeCameraPreview}
								onChange={(value) =>
									handleChange("enableNativeCameraPreview", value)
								}
							/>
						</SectionRows>
					</Section>
				</Show>

				<Section title={t("settings.experimental.reliability")}>
					<SectionRows>
						<ToggleSettingItem
							label={t("settings.experimental.outOfProcessMuxer")}
							description={t("settings.experimental.outOfProcessMuxerDesc")}
							value={!!settings.outOfProcessMuxer}
							onChange={(value) => handleChange("outOfProcessMuxer", value)}
						/>
					</SectionRows>
				</Section>
			</SettingsPageContent>
		</div>
	);
}
