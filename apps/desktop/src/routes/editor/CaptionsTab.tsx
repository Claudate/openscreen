import { Button } from "@cap/ui-solid";
import { Select as KSelect } from "@kobalte/core/select";
import { appLocalDataDir, join } from "@tauri-apps/api/path";
import { exists } from "@tauri-apps/plugin-fs";
import { cx } from "cva";
import {
	createEffect,
	createMemo,
	createSignal,
	on,
	onMount,
	Show,
} from "solid-js";
import { produce } from "solid-js/store";
import toast from "solid-toast";
import { Toggle } from "~/components/Toggle";
import Tooltip from "~/components/Tooltip";
import { t } from "~/i18n";
import { defaultCaptionSettings } from "~/store/captions";
import type { OrganizationBrandColorSwatch } from "~/utils/organization-branding";
import type { CaptionSettings } from "~/utils/tauri";
import { commands, events } from "~/utils/tauri";
import IconCapChevronDown from "~icons/cap/chevron-down";
import IconCapCircleCheck from "~icons/cap/circle-check";
import IconLucideDownload from "~icons/lucide/download";
import IconLucideInfo from "~icons/lucide/info";
import {
	applyCaptionResultToProject,
	CAPTION_MODEL_FOLDER,
	DEFAULT_CAPTION_MODEL,
	DEFAULT_WHISPER_CAPTION_MODEL,
	getCaptionGenerationErrorMessage,
	getModelPath,
	PARAKEET_DIR_MODELS,
	resolveCaptionModel,
	supportsParakeetTranscription,
	syncCaptionWordsWithText,
	transcribeEditorCaptions,
} from "./captions";
import { useEditorContext } from "./context";
import {
	CAPTION_POSITION_OPTIONS,
	FONT_OPTIONS,
	getTextWeightLabel,
	HexColorInput,
	TEXT_WEIGHT_OPTIONS,
} from "./text-style";
import {
	Field,
	Input,
	MenuItem,
	MenuItemList,
	PopperContent,
	Slider,
	Subfield,
	topLeftAnimateClasses,
	topSlideAnimateClasses,
} from "./ui";

interface ModelOption {
	name: string;
	label: string;
	modelName: string;
	size: string;
	description: string;
}

interface LanguageOption {
	code: string;
	label: string;
}

const MODEL_OPTIONS = (): ModelOption[] => [
	{
		name: "best",
		label: t("editor.captionsTab.modelRecommended"),
		modelName: "parakeet-tdt-0.6b-v3 int8",
		size: "~640MB",
		description: t("editor.captionsTab.modelRecommendedDesc"),
	},
	{
		name: "best-max",
		label: t("editor.captionsTab.modelHighAccuracy"),
		modelName: "parakeet-tdt-0.6b-v3",
		size: "~2.4GB",
		description: t("editor.captionsTab.modelHighAccuracyDesc"),
	},
	{
		name: "small",
		modelName: "whisper.cpp small",
		label: t("editor.captionsTab.modelSmall"),
		size: "466MB",
		description: t("editor.captionsTab.modelSmallDesc"),
	},
	{
		name: "medium",
		modelName: "whisper.cpp medium",
		label: t("editor.captionsTab.modelMedium"),
		size: "1.5GB",
		description: t("editor.captionsTab.modelMediumDesc"),
	},
];

const LANGUAGE_OPTIONS = (): LanguageOption[] => [
	{ code: "auto", label: t("editor.languages.auto") },
	{ code: "en", label: t("editor.languages.en") },
	{ code: "es", label: t("editor.languages.es") },
	{ code: "fr", label: t("editor.languages.fr") },
	{ code: "de", label: t("editor.languages.de") },
	{ code: "it", label: t("editor.languages.it") },
	{ code: "pt", label: t("editor.languages.pt") },
	{ code: "nl", label: t("editor.languages.nl") },
	{ code: "pl", label: t("editor.languages.pl") },
	{ code: "ru", label: t("editor.languages.ru") },
	{ code: "sk", label: t("editor.languages.sk") },
	{ code: "tr", label: t("editor.languages.tr") },
	{ code: "ja", label: t("editor.languages.ja") },
	{ code: "ko", label: t("editor.languages.ko") },
	{ code: "zh", label: t("editor.languages.zh") },
	{ code: "ar", label: t("editor.languages.ar") },
	{ code: "hi", label: t("editor.languages.hi") },
	{ code: "bn", label: t("editor.languages.bn") },
	{ code: "ta", label: t("editor.languages.ta") },
	{ code: "te", label: t("editor.languages.te") },
	{ code: "mr", label: t("editor.languages.mr") },
	{ code: "gu", label: t("editor.languages.gu") },
	{ code: "pa", label: t("editor.languages.pa") },
	{ code: "ur", label: t("editor.languages.ur") },
	{ code: "fa", label: t("editor.languages.fa") },
	{ code: "he", label: t("editor.languages.he") },
];

export function CaptionsTab(props: {
	brandColorSwatches: OrganizationBrandColorSwatch[];
}) {
	const { project, setProject, editorInstance, editorState, setEditorState } =
		useEditorContext();

	const selectedCaptionIndex = () =>
		editorState.timeline.selection?.type === "caption" &&
		editorState.timeline.selection.indices.length === 1
			? editorState.timeline.selection.indices[0]
			: -1;

	const selectedCaptionSegment = () =>
		project.timeline?.captionSegments?.[selectedCaptionIndex()];

	const updateSelectedCaption = (
		update: (
			segment: NonNullable<ReturnType<typeof selectedCaptionSegment>>,
		) => void,
	) => {
		const index = selectedCaptionIndex();
		if (index < 0) return;

		setProject(
			produce((currentProject: typeof project) => {
				const timelineSegment =
					currentProject.timeline?.captionSegments?.[index];
				if (!timelineSegment) return;

				update(timelineSegment);

				const captionSegment = currentProject.captions?.segments?.[index];
				if (!captionSegment) return;

				captionSegment.start = timelineSegment.start;
				captionSegment.end = timelineSegment.end;
				captionSegment.text = timelineSegment.text;
				captionSegment.words = timelineSegment.words?.map((word) => ({
					...word,
				}));
			}),
		);
	};

	const getSetting = <K extends keyof CaptionSettings>(
		key: K,
	): NonNullable<CaptionSettings[K]> =>
		(project?.captions?.settings?.[key] ??
			defaultCaptionSettings[key]) as NonNullable<CaptionSettings[K]>;

	const updateCaptionSetting = <K extends keyof CaptionSettings>(
		key: K,
		value: CaptionSettings[K],
	) => {
		if (!project?.captions) return;

		setProject("captions", "settings", key, value);
	};

	const [selectedModel, setSelectedModel] = createSignal(
		resolveCaptionModel(DEFAULT_CAPTION_MODEL),
	);
	const [selectedLanguage, setSelectedLanguage] = createSignal("auto");
	const [downloadedModels, setDownloadedModels] = createSignal<string[]>([]);

	const isDownloading = () => editorState.captions.isDownloading;
	const setIsDownloading = (value: boolean) =>
		setEditorState("captions", "isDownloading", value);
	const downloadProgress = () => editorState.captions.downloadProgress;
	const setDownloadProgress = (value: number) =>
		setEditorState("captions", "downloadProgress", value);
	const downloadingModel = () => editorState.captions.downloadingModel;
	const setDownloadingModel = (value: string | null) =>
		setEditorState("captions", "downloadingModel", value);
	const isGenerating = () => editorState.captions.isGenerating;
	const setIsGenerating = (value: boolean) =>
		setEditorState("captions", "isGenerating", value);
	const [hasAudio, setHasAudio] = createSignal(false);
	const availableModelOptions = createMemo(() =>
		supportsParakeetTranscription()
			? MODEL_OPTIONS()
			: MODEL_OPTIONS().filter((model) => !PARAKEET_DIR_MODELS.has(model.name)),
	);
	const selectedModelOption = createMemo(
		() =>
			availableModelOptions().find((model) => model.name === selectedModel()) ??
			null,
	);

	createEffect(
		on(
			() => project && editorInstance && !project.captions,
			(shouldInit) => {
				if (shouldInit) {
					setProject("captions", {
						segments: [],
						settings: { ...defaultCaptionSettings },
					});
				}
			},
		),
	);

	onMount(async () => {
		try {
			const appDataDirPath = await appLocalDataDir();
			const modelsPath = await join(appDataDirPath, CAPTION_MODEL_FOLDER);

			if (!(await exists(modelsPath))) {
				await commands.createDir(modelsPath, true);
			}

			const models = await Promise.all(
				availableModelOptions().map(async (model) => {
					const downloaded = await checkModelExists(model.name);
					return { name: model.name, downloaded };
				}),
			);

			const downloadedModelNames = models
				.filter((m) => m.downloaded)
				.map((m) => m.name);
			setDownloadedModels(downloadedModelNames);

			const savedModel = resolveCaptionModel(
				localStorage.getItem("selectedTranscriptionModel"),
			);
			if (
				savedModel &&
				availableModelOptions().some((model) => model.name === savedModel)
			) {
				setSelectedModel(savedModel);
			} else {
				setSelectedModel(
					availableModelOptions()[0]?.name ?? DEFAULT_WHISPER_CAPTION_MODEL,
				);
			}

			const savedLanguage = localStorage.getItem(
				"selectedTranscriptionLanguage",
			);
			if (
				savedLanguage &&
				LANGUAGE_OPTIONS().some((l) => l.code === savedLanguage)
			) {
				setSelectedLanguage(savedLanguage);
			}

			if (editorInstance?.recordings) {
				const hasAudioTrack = editorInstance.recordings.segments.some(
					(segment) => segment.mic !== null || segment.system_audio !== null,
				);
				setHasAudio(hasAudioTrack);
			}

			const downloadState = localStorage.getItem("modelDownloadState");
			if (downloadState) {
				const { model, progress } = JSON.parse(downloadState);
				if (model && progress < 100) {
					setDownloadingModel(model);
					setDownloadProgress(progress);
					setIsDownloading(true);
				} else {
					localStorage.removeItem("modelDownloadState");
				}
			}
		} catch (error) {
			console.error("Error checking models:", error);
		}
	});

	createEffect(
		on(
			() => [isDownloading(), downloadingModel(), downloadProgress()] as const,
			([downloading, model, progress]) => {
				if (downloading && model) {
					localStorage.setItem(
						"modelDownloadState",
						JSON.stringify({ model, progress }),
					);
				} else {
					localStorage.removeItem("modelDownloadState");
				}
			},
		),
	);

	createEffect(
		on(
			selectedModel,
			(model) => {
				if (model) localStorage.setItem("selectedTranscriptionModel", model);
			},
			{ defer: true },
		),
	);

	createEffect(
		on(
			selectedLanguage,
			(language) => {
				if (language)
					localStorage.setItem("selectedTranscriptionLanguage", language);
			},
			{ defer: true },
		),
	);

	const checkModelExists = async (modelName: string) => {
		if (PARAKEET_DIR_MODELS.has(modelName)) {
			const modelPath = await getModelPath(modelName);
			return await commands.checkParakeetModelExists(modelPath);
		}
		const appDataDirPath = await appLocalDataDir();
		const modelsPath = await join(appDataDirPath, CAPTION_MODEL_FOLDER);
		const path = await join(modelsPath, `${modelName}.bin`);
		return await commands.checkModelExists(path);
	};

	const downloadModel = async () => {
		try {
			const modelToDownload = selectedModel();
			setIsDownloading(true);
			setDownloadProgress(0);
			setDownloadingModel(modelToDownload);

			const unlisten = await events.downloadProgress.listen((event) => {
				setDownloadProgress(event.payload.progress);
			});

			if (PARAKEET_DIR_MODELS.has(modelToDownload)) {
				const modelDir = await getModelPath(modelToDownload);
				try {
					await commands.createDir(modelDir, true);
				} catch (err) {
					console.error("Error creating directory:", err);
				}
				await commands.downloadParakeetModel(modelDir);
			} else {
				const appDataDirPath = await appLocalDataDir();
				const modelsPath = await join(appDataDirPath, CAPTION_MODEL_FOLDER);
				const modelPath = await join(modelsPath, `${modelToDownload}.bin`);

				try {
					await commands.createDir(modelsPath, true);
				} catch (err) {
					console.error("Error creating directory:", err);
				}
				await commands.downloadWhisperModel(modelToDownload, modelPath);
			}

			unlisten();

			setDownloadedModels((prev) => [...prev, modelToDownload]);
			toast.success(t("editor.captionsTab.downloadSuccess"));
		} catch (error) {
			console.error("Error downloading model:", error);
			toast.error(t("editor.captionsTab.downloadFailed"));
		} finally {
			setIsDownloading(false);
			setDownloadingModel(null);
		}
	};

	const generateCaptions = async () => {
		if (!editorInstance) {
			toast.error(t("editor.captionsTab.editorNotFound"));
			return;
		}

		setIsGenerating(true);

		try {
			const result = await transcribeEditorCaptions(
				editorInstance.path,
				selectedModel(),
				selectedLanguage(),
			);

			if (result && result.segments.length > 0) {
				setProject(
					produce((p) => {
						applyCaptionResultToProject(
							p,
							result.segments,
							editorInstance.recordings.segments,
							editorInstance.recordingDuration,
						);
					}),
				);
				setEditorState("timeline", "tracks", "caption", true);
				setEditorState("captions", "isStale", false);

				toast.success(t("editor.captionsTab.generateSuccess"));
			} else {
				toast.error(t("editor.captionsTab.noCaptionsGenerated"));
			}
		} catch (error) {
			console.error("Error generating captions:", error);
			const errorMessage = getCaptionGenerationErrorMessage(error);
			toast.error(
				t("editor.captionsTab.generateFailed", { message: errorMessage }),
			);
		} finally {
			setIsGenerating(false);
		}
	};

	const hasCaptions = createMemo(
		() =>
			(project.timeline?.captionSegments?.length ?? 0) > 0 ||
			(project.captions?.segments?.length ?? 0) > 0,
	);

	return (
		<Field
			name={t("editor.captionsTab.captions")}
			icon={<IconCapMessageBubble />}
			badge="Beta"
		>
			<div class="flex flex-col gap-4">
				<div class="space-y-6 transition-all duration-200">
					<div class="space-y-4">
						<Subfield name={t("editor.captionsTab.model")} class="items-start">
							<KSelect<string>
								options={availableModelOptions().map((model) => model.name)}
								value={selectedModel()}
								onChange={(value: string | null) => {
									if (value) setSelectedModel(value);
								}}
								itemComponent={(props) => {
									const model = availableModelOptions().find(
										(option) => option.name === props.item.rawValue,
									);

									return (
										<MenuItem<typeof KSelect.Item>
											as={KSelect.Item}
											item={props.item}
										>
											<div class="flex w-full items-center gap-3">
												<div class="min-w-0 flex-1">
													<div class="flex items-center gap-1.5 text-gray-12">
														<KSelect.ItemLabel class="truncate font-medium">
															{model?.label ?? props.item.rawValue}
														</KSelect.ItemLabel>
														<Show when={model}>
															<Tooltip openDelay={0} content={model?.modelName}>
																<button
																	type="button"
																	class="flex shrink-0 text-gray-9 transition-colors hover:text-gray-12"
																	onPointerDown={(event) =>
																		event.stopPropagation()
																	}
																	onClick={(event) => event.stopPropagation()}
																>
																	<IconLucideInfo class="size-3.5" />
																</button>
															</Tooltip>
														</Show>
													</div>
													<Show when={model}>
														<div class="truncate text-xs text-gray-11">
															{model?.description}
														</div>
													</Show>
												</div>
												<Show when={model}>
													<span class="shrink-0 text-[10px] text-gray-10">
														{model?.size}
													</span>
												</Show>
											</div>
										</MenuItem>
									);
								}}
							>
								<KSelect.Trigger class="flex min-w-0 flex-row items-center gap-2 rounded-lg border border-gray-3 bg-gray-2 px-3 py-2 text-sm text-gray-12 transition-colors hover:border-gray-4 hover:bg-gray-3 focus:border-blue-9 focus:ring-1 focus:ring-blue-9">
									<div class="min-w-0 flex-1 text-left">
										<div class="flex items-center gap-1.5">
											<span class="truncate font-medium">
												{selectedModelOption()?.label ||
													t("editor.captionsTab.selectModel")}
											</span>
											<Show when={selectedModelOption()}>
												<Tooltip
													openDelay={0}
													content={selectedModelOption()?.modelName}
												>
													<button
														type="button"
														class="flex shrink-0 text-gray-9 transition-colors hover:text-gray-12"
														onPointerDown={(event) => event.stopPropagation()}
														onClick={(event) => event.stopPropagation()}
													>
														<IconLucideInfo class="size-3.5" />
													</button>
												</Tooltip>
											</Show>
										</div>
										<Show when={selectedModelOption()}>
											<div class="truncate text-xs text-gray-11">
												{selectedModelOption()?.description}
											</div>
										</Show>
									</div>
									<Show when={selectedModelOption()}>
										<span class="shrink-0 text-[10px] text-gray-10">
											{selectedModelOption()?.size}
										</span>
									</Show>
									<KSelect.Icon>
										<IconCapChevronDown class="size-4 shrink-0 transform transition-transform data-expanded:rotate-180" />
									</KSelect.Icon>
								</KSelect.Trigger>
								<KSelect.Portal>
									<PopperContent<typeof KSelect.Content>
										as={KSelect.Content}
										class={topLeftAnimateClasses}
									>
										<MenuItemList<typeof KSelect.Listbox>
											as={KSelect.Listbox}
										/>
									</PopperContent>
								</KSelect.Portal>
							</KSelect>
						</Subfield>

						<Show when={!supportsParakeetTranscription()}>
							<p class="text-xs text-gray-10">
								{t("editor.captionsTab.parakeetUnavailable")}
							</p>
						</Show>

						<Subfield name={t("editor.captionsTab.language")}>
							<KSelect<string>
								options={LANGUAGE_OPTIONS().map((l) => l.code)}
								value={selectedLanguage()}
								onChange={(value: string | null) => {
									if (value) setSelectedLanguage(value);
								}}
								itemComponent={(props) => (
									<MenuItem<typeof KSelect.Item>
										as={KSelect.Item}
										item={props.item}
									>
										<KSelect.ItemLabel class="flex-1">
											{
												LANGUAGE_OPTIONS().find(
													(l) => l.code === props.item.rawValue,
												)?.label
											}
										</KSelect.ItemLabel>
									</MenuItem>
								)}
							>
								<KSelect.Trigger class="flex flex-row items-center h-9 px-3 gap-2 border rounded-lg border-gray-3 bg-gray-2 w-full text-gray-12 text-sm hover:border-gray-4 hover:bg-gray-3 focus:border-blue-9 focus:ring-1 focus:ring-blue-9 transition-colors">
									<KSelect.Value<string> class="flex-1 text-left truncate">
										{(state) => {
											const language = LANGUAGE_OPTIONS().find(
												(l) => l.code === state.selectedOption(),
											);
											return (
												<span>
													{language?.label ||
														t("editor.captionsTab.selectLanguage")}
												</span>
											);
										}}
									</KSelect.Value>
									<KSelect.Icon>
										<IconCapChevronDown class="size-4 shrink-0 transform transition-transform data-expanded:rotate-180" />
									</KSelect.Icon>
								</KSelect.Trigger>
								<KSelect.Portal>
									<PopperContent<typeof KSelect.Content>
										as={KSelect.Content}
										class={topLeftAnimateClasses}
									>
										<MenuItemList<typeof KSelect.Listbox>
											class="max-h-48 overflow-y-auto"
											as={KSelect.Listbox}
										/>
									</PopperContent>
								</KSelect.Portal>
							</KSelect>
						</Subfield>

						<div class="pt-2">
							<Show
								when={downloadedModels().includes(selectedModel())}
								fallback={
									<div class="space-y-2">
										<Button
											class="w-full flex items-center justify-center gap-2"
											onClick={downloadModel}
											disabled={isDownloading()}
										>
											<Show
												when={isDownloading()}
												fallback={
													<>
														<IconLucideDownload class="size-4" />
														{t("editor.captionsTab.downloadModel", {
															label:
																availableModelOptions().find(
																	(m) => m.name === selectedModel(),
																)?.label ?? "",
														})}
													</>
												}
											>
												{t("editor.captionsTab.downloading", {
													percent: Math.round(downloadProgress()),
												})}
											</Show>
										</Button>
										<Show when={isDownloading()}>
											<div class="w-full bg-gray-3 rounded-full h-1.5 overflow-hidden">
												<div
													class="bg-blue-9 h-1.5 rounded-full transition-all duration-300"
													style={{ width: `${downloadProgress()}%` }}
												/>
											</div>
										</Show>
									</div>
								}
							>
								<Show when={hasAudio()}>
									<Button
										onClick={generateCaptions}
										disabled={isGenerating()}
										class="w-full"
									>
										{isGenerating()
											? t("editor.captionsTab.generating")
											: hasCaptions()
												? t("editor.captionsTab.regenerateCaptions")
												: t("editor.captionsTab.generateCaptions")}
									</Button>
								</Show>
							</Show>
						</div>
					</div>

					<div
						class={cx(
							"space-y-4",
							!hasCaptions() && "opacity-50 pointer-events-none",
						)}
					>
						<Field
							name={t("editor.captionsTab.fontSettings")}
							icon={<IconCapMessageBubble />}
						>
							<div class="space-y-3">
								<div class="flex flex-col gap-2">
									<span class="text-gray-11 text-sm">
										{t("editor.captionsTab.fontFamily")}
									</span>
									<KSelect<string>
										options={FONT_OPTIONS().map((f) => f.value)}
										value={getSetting("font")}
										onChange={(value) => {
											if (value === null) return;
											updateCaptionSetting("font", value);
										}}
										disabled={!hasCaptions()}
										itemComponent={(props) => (
											<MenuItem<typeof KSelect.Item>
												as={KSelect.Item}
												item={props.item}
											>
												<KSelect.ItemLabel class="flex-1">
													{
														FONT_OPTIONS().find(
															(f) => f.value === props.item.rawValue,
														)?.label
													}
												</KSelect.ItemLabel>
											</MenuItem>
										)}
									>
										<KSelect.Trigger class="w-full flex items-center justify-between rounded-lg px-3 py-2 bg-gray-2 border border-gray-3 text-gray-12 hover:border-gray-4 hover:bg-gray-3 focus:border-blue-9 focus:ring-1 focus:ring-blue-9 transition-colors">
											<KSelect.Value<string>>
												{(state) =>
													FONT_OPTIONS().find(
														(f) => f.value === state.selectedOption(),
													)?.label
												}
											</KSelect.Value>
											<KSelect.Icon>
												<IconCapChevronDown />
											</KSelect.Icon>
										</KSelect.Trigger>
										<KSelect.Portal>
											<PopperContent<typeof KSelect.Content>
												as={KSelect.Content}
												class={topLeftAnimateClasses}
											>
												<MenuItemList<typeof KSelect.Listbox>
													class="max-h-48 overflow-y-auto"
													as={KSelect.Listbox}
												/>
											</PopperContent>
										</KSelect.Portal>
									</KSelect>
								</div>

								<div class="flex flex-col gap-2">
									<span class="text-gray-11 text-sm">
										{t("editor.common.size")}
									</span>
									<Slider
										value={[getSetting("size")]}
										onChange={(v) => updateCaptionSetting("size", v[0])}
										minValue={12}
										maxValue={100}
										step={1}
										disabled={!hasCaptions()}
									/>
								</div>

								<div class="flex flex-col gap-2">
									<div class="flex items-center justify-between">
										<span class="text-gray-11 text-sm">
											{t("editor.captionsTab.activeWordHighlight")}
										</span>
										<Toggle
											checked={getSetting("activeWordHighlight")}
											onChange={(checked) =>
												updateCaptionSetting("activeWordHighlight", checked)
											}
											disabled={!hasCaptions()}
										/>
									</div>
									<p class="text-xs text-gray-10">
										{t("editor.captionsTab.activeWordHighlightNote")}
									</p>
								</div>

								<div class="flex flex-col gap-2">
									<span class="text-gray-11 text-sm">
										{t("editor.captionsTab.textColor")}
									</span>
									<HexColorInput
										value={getSetting("color")}
										brandColorSwatches={props.brandColorSwatches}
										onChange={(value) => updateCaptionSetting("color", value)}
									/>
								</div>
							</div>
						</Field>

						<Field
							name={t("editor.captionsTab.backgroundSettings")}
							icon={<IconCapMessageBubble />}
						>
							<div class="space-y-3">
								<div class="flex flex-col gap-2">
									<span class="text-gray-11 text-sm">
										{t("editor.captionsTab.backgroundColor")}
									</span>
									<HexColorInput
										value={getSetting("backgroundColor")}
										brandColorSwatches={props.brandColorSwatches}
										onChange={(value) =>
											updateCaptionSetting("backgroundColor", value)
										}
									/>
								</div>

								<div class="flex flex-col gap-2">
									<span class="text-gray-11 text-sm">
										{t("editor.captionsTab.backgroundOpacity")}
									</span>
									<Slider
										value={[getSetting("backgroundOpacity")]}
										onChange={(v) =>
											updateCaptionSetting("backgroundOpacity", v[0])
										}
										minValue={0}
										maxValue={100}
										step={1}
										disabled={!hasCaptions()}
									/>
								</div>
							</div>
						</Field>

						<Field
							name={t("editor.captionsTab.position")}
							icon={<IconCapMessageBubble />}
						>
							<KSelect<string>
								options={CAPTION_POSITION_OPTIONS().map((p) => p.value)}
								value={getSetting("position")}
								onChange={(value) => {
									if (value === null) return;
									updateCaptionSetting("position", value);
								}}
								disabled={!hasCaptions()}
								itemComponent={(props) => (
									<MenuItem<typeof KSelect.Item>
										as={KSelect.Item}
										item={props.item}
									>
										<KSelect.ItemLabel class="flex-1">
											{
												CAPTION_POSITION_OPTIONS().find(
													(p) => p.value === props.item.rawValue,
												)?.label
											}
										</KSelect.ItemLabel>
									</MenuItem>
								)}
							>
								<KSelect.Trigger class="w-full flex items-center justify-between rounded-lg px-3 py-2 bg-gray-2 border border-gray-3 text-gray-12 hover:border-gray-4 hover:bg-gray-3 focus:border-blue-9 focus:ring-1 focus:ring-blue-9 transition-colors">
									<KSelect.Value<string>>
										{(state) => (
											<span>
												{
													CAPTION_POSITION_OPTIONS().find(
														(p) => p.value === state.selectedOption(),
													)?.label
												}
											</span>
										)}
									</KSelect.Value>
									<KSelect.Icon>
										<IconCapChevronDown />
									</KSelect.Icon>
								</KSelect.Trigger>
								<KSelect.Portal>
									<PopperContent<typeof KSelect.Content>
										as={KSelect.Content}
										class={topLeftAnimateClasses}
									>
										<MenuItemList<typeof KSelect.Listbox>
											as={KSelect.Listbox}
										/>
									</PopperContent>
								</KSelect.Portal>
							</KSelect>
						</Field>

						<Field
							name={t("editor.captionsTab.animation")}
							icon={<IconCapMessageBubble />}
						>
							<div class="space-y-3">
								<div class="flex flex-col gap-2">
									<span class="text-gray-11 text-sm">
										{t("editor.captionsTab.highlightColor")}
									</span>
									<HexColorInput
										value={getSetting("highlightColor")}
										brandColorSwatches={props.brandColorSwatches}
										onChange={(value) =>
											updateCaptionSetting("highlightColor", value)
										}
									/>
								</div>
								<div class="flex flex-col gap-2">
									<span class="text-gray-11 text-sm">
										{t("editor.segment.fadeDuration")}
									</span>
									<Slider
										value={[getSetting("fadeDuration") * 100]}
										onChange={(v) =>
											updateCaptionSetting("fadeDuration", v[0] / 100)
										}
										minValue={0}
										maxValue={50}
										step={1}
										disabled={!hasCaptions()}
									/>
									<span class="text-xs text-gray-11 text-right">
										{(getSetting("fadeDuration") * 1000).toFixed(0)}ms
									</span>
								</div>
							</div>
						</Field>

						<Field
							name={t("editor.captionsTab.fontWeight")}
							icon={<IconCapMessageBubble />}
						>
							<KSelect
								options={TEXT_WEIGHT_OPTIONS()}
								optionValue="value"
								optionTextValue="label"
								value={{
									label: t("editor.common.custom"),
									value: getSetting("fontWeight"),
								}}
								onChange={(value) => {
									if (!value) return;
									updateCaptionSetting("fontWeight", value.value);
								}}
								disabled={!hasCaptions()}
								itemComponent={(selectItemProps) => (
									<MenuItem<typeof KSelect.Item>
										as={KSelect.Item}
										item={selectItemProps.item}
									>
										<KSelect.ItemLabel class="flex-1">
											{selectItemProps.item.rawValue.label}
										</KSelect.ItemLabel>
										<KSelect.ItemIndicator class="ml-auto text-blue-9">
											<IconCapCircleCheck />
										</KSelect.ItemIndicator>
									</MenuItem>
								)}
							>
								<KSelect.Trigger class="flex w-full items-center justify-between rounded-md border border-gray-3 bg-gray-2 px-3 py-2 text-sm text-gray-12 transition-colors hover:border-gray-4 hover:bg-gray-3 focus:border-blue-9 focus:outline-hidden focus:ring-1 focus:ring-blue-9">
									<KSelect.Value<{
										label: string;
										value: number;
									}> class="truncate">
										{(state) =>
											state.selectedOption()?.label ??
											getTextWeightLabel(getSetting("fontWeight"))
										}
									</KSelect.Value>
									<KSelect.Icon>
										<IconCapChevronDown class="size-4 shrink-0 transform transition-transform data-expanded:rotate-180 text-(--gray-500)" />
									</KSelect.Icon>
								</KSelect.Trigger>
								<KSelect.Portal>
									<PopperContent<typeof KSelect.Content>
										as={KSelect.Content}
										class={cx(topSlideAnimateClasses, "z-50")}
									>
										<MenuItemList<typeof KSelect.Listbox>
											class="overflow-y-auto max-h-40"
											as={KSelect.Listbox}
										/>
									</PopperContent>
								</KSelect.Portal>
							</KSelect>
						</Field>

						<Field
							name={t("editor.captionsTab.exportOptions")}
							icon={<IconCapMessageBubble />}
						>
							<Subfield name={t("editor.captionsTab.exportWithSubtitles")}>
								<Toggle
									checked={getSetting("exportWithSubtitles")}
									onChange={(checked) =>
										updateCaptionSetting("exportWithSubtitles", checked)
									}
									disabled={!hasCaptions()}
								/>
							</Subfield>
						</Field>
					</div>

					<Show
						when={
							editorState.timeline.selection?.type === "caption" &&
							editorState.timeline.selection.indices.length === 1
						}
					>
						{(() => {
							return (
								<Field
									name={t("editor.captionsTab.selectedCaptionOverride")}
									icon={<IconCapMessageBubble />}
								>
									<Show when={selectedCaptionSegment()}>
										{(seg) => (
											<div class="space-y-3">
												<Subfield name={t("editor.captionsTab.startTime")}>
													<Input
														type="number"
														value={seg().start.toFixed(2)}
														step="0.1"
														min={0}
														onChange={(e) =>
															updateSelectedCaption((segment) => {
																segment.start = Number.parseFloat(
																	e.target.value,
																);
															})
														}
													/>
												</Subfield>
												<Subfield name={t("editor.captionsTab.endTime")}>
													<Input
														type="number"
														value={seg().end.toFixed(2)}
														step="0.1"
														min={seg().start}
														onChange={(e) =>
															updateSelectedCaption((segment) => {
																segment.end = Number.parseFloat(e.target.value);
															})
														}
													/>
												</Subfield>
												<Subfield name={t("editor.captionsTab.captionText")}>
													<Input
														type="text"
														value={seg().text}
														onChange={(e) =>
															updateSelectedCaption((segment) => {
																segment.text = e.target.value;
																segment.words = syncCaptionWordsWithText(
																	e.target.value,
																	segment.words,
																	segment.start,
																	segment.end,
																);
															})
														}
													/>
												</Subfield>
												<Subfield
													name={t("editor.captionsTab.fadeDurationOverride")}
												>
													<Slider
														value={[
															(seg().fadeDurationOverride ??
																getSetting("fadeDuration")) * 100,
														]}
														onChange={(v) =>
															updateSelectedCaption((segment) => {
																segment.fadeDurationOverride = v[0] / 100;
															})
														}
														minValue={0}
														maxValue={50}
														step={1}
													/>
												</Subfield>
											</div>
										)}
									</Show>
								</Field>
							);
						})()}
					</Show>
				</div>
			</div>
		</Field>
	);
}
