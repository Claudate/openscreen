import { Button } from "@cap/ui-solid";
import { createWritableMemo } from "@solid-primitives/memo";
import { useMutation } from "@tanstack/solid-query";
import { createResource, Show, Suspense } from "solid-js";
import { t } from "~/i18n";
import { Input } from "~/routes/editor/ui";
import { createSelectedOrganization } from "~/utils/organization-branding";
import { commands } from "~/utils/tauri";
import { apiClient, protectedHeaders } from "~/utils/web-api";
import { Section, SectionCard, SettingsPageContent } from "../Setting";
import { IntegrationConfigHeader } from "./config-header";

interface S3Config {
	provider: string;
	accessKeyId: string;
	secretAccessKey: string;
	endpoint: string;
	bucketName: string;
	region: string;
}

const DEFAULT_CONFIG = {
	provider: "aws",
	accessKeyId: "",
	secretAccessKey: "",
	endpoint: "https://s3.amazonaws.com",
	bucketName: "",
	region: "us-east-1",
};

export default function S3ConfigPage() {
	const organizationSelection = createSelectedOrganization();
	const [_s3Config, { refetch }] = createResource(
		() => organizationSelection.selectedOrganizationId(),
		async (orgId) => {
			const response = await apiClient.desktop.getS3Config({
				query: orgId ? { orgId } : undefined,
				headers: await protectedHeaders(),
			});

			if (response.status !== 200) throw new Error("Failed to fetch S3 config");

			return response.body;
		},
	);

	const managedByOrganization = () =>
		_s3Config()?.managedByOrganization ?? null;
	const hasConfig = () =>
		_s3Config()?.source === "user" && !!_s3Config()?.config.accessKeyId;

	const saveConfig = useMutation(() => ({
		mutationFn: async (config: S3Config) => {
			const response = await apiClient.desktop.setS3Config({
				body: config,
				headers: await protectedHeaders(),
			});

			if (response.status !== 200) throw new Error("Failed to save S3 config");
			return response;
		},
		onSuccess: async () => {
			await refetch();
			await commands.globalMessageDialog(
				t("settings.integrations.s3.savedSuccess"),
			);
		},
	}));

	const deleteConfig = useMutation(() => ({
		mutationFn: async () => {
			const response = await apiClient.desktop.deleteS3Config({
				headers: await protectedHeaders(),
			});

			if (response.status !== 200)
				throw new Error("Failed to delete S3 config");
			return response;
		},
		onSuccess: async () => {
			await refetch();
			await commands.globalMessageDialog(
				t("settings.integrations.s3.deletedSuccess"),
			);
		},
	}));

	const testConfig = useMutation(() => ({
		mutationFn: async (config: S3Config) => {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 5500);

			try {
				const response = await apiClient.desktop.testS3Config({
					body: config,
					headers: await protectedHeaders(),
					fetchOptions: { signal: controller.signal },
				});

				clearTimeout(timeoutId);

				if (response.status !== 200)
					throw new Error(t("settings.integrations.s3.testFailed"));

				return response;
			} catch (error) {
				clearTimeout(timeoutId);

				if (error instanceof Error) {
					if (error.name === "AbortError")
						throw new Error(t("settings.integrations.s3.testTimeout"));
				}

				throw error;
			}
		},
		onSuccess: async () => {
			await commands.globalMessageDialog(
				t("settings.integrations.s3.testSuccess"),
			);
		},
	}));

	const [s3Config, setS3Config] = createWritableMemo(
		() => _s3Config.latest?.config ?? DEFAULT_CONFIG,
	);

	const renderInput = (
		label: string,
		key: keyof ReturnType<typeof s3Config>,
		placeholder: string,
		type: "text" | "password" = "text",
	) => (
		<div class="space-y-2">
			<label class="text-[13px] text-gray-12">{label}</label>
			<Input
				class="bg-gray-3!"
				type={type}
				value={s3Config()[key] ?? ""}
				disabled={!!managedByOrganization()}
				onInput={(e: InputEvent & { currentTarget: HTMLInputElement }) =>
					setS3Config({
						...s3Config(),
						[key]: e.currentTarget.value,
					})
				}
				placeholder={placeholder}
				autocomplete="off"
				autocapitalize="off"
				autocorrect="off"
				spellcheck={false}
			/>
		</div>
	);

	return (
		<div class="cap-settings-page flex flex-col h-full custom-scroll">
			<SettingsPageContent>
				<IntegrationConfigHeader title={t("settings.integrations.s3.name")} />
				<Section
					title={t("settings.integrations.s3.configuration")}
					description={
						<>
							{t("settings.integrations.s3.configDescriptionPrefix")}{" "}
							<a
								href="https://cap.so/docs/s3-config"
								target="_blank"
								class="underline text-gray-12"
								rel="noopener"
							>
								{t("settings.integrations.s3.storageConfigGuide")}
							</a>{" "}
							{t("settings.integrations.s3.configDescriptionSuffix")}
						</>
					}
				>
					<SectionCard padded class="custom-scroll">
						<Suspense
							fallback={
								<div class="flex justify-center items-center w-full h-screen">
									<IconCapLogo class="animate-spin size-16" />
								</div>
							}
						>
							<div class="space-y-4 animate-in fade-in">
								<Show when={managedByOrganization()}>
									{(organization) => (
										<p class="text-xs leading-relaxed text-gray-10">
											{t("settings.integrations.managedByOrganizationNamed", {
												name: organization().name,
											})}
										</p>
									)}
								</Show>

								<div class="space-y-2">
									<label class="text-[13px] text-gray-12">
										{t("settings.integrations.s3.storageProvider")}
									</label>
									<div class="relative">
										<select
											value={s3Config().provider}
											disabled={!!managedByOrganization()}
											onChange={(e) =>
												setS3Config((c) => ({
													...c,
													provider: e.currentTarget.value,
												}))
											}
											class="px-3 py-2 pr-10 w-full rounded-lg border border-transparent transition-all duration-200 appearance-none outline-hidden bg-gray-3 focus:border-gray-8"
										>
											<option value="aws">
												{t("settings.integrations.s3.providerAws")}
											</option>
											<option value="cloudflare">
												{t("settings.integrations.s3.providerCloudflare")}
											</option>
											<option value="supabase">
												{t("settings.integrations.s3.providerSupabase")}
											</option>
											<option value="minio">
												{t("settings.integrations.s3.providerMinio")}
											</option>
											<option value="other">
												{t("settings.integrations.s3.providerOther")}
											</option>
										</select>
										<div class="flex absolute inset-y-0 right-0 items-center px-2 pointer-events-none">
											<svg
												class="w-4 h-4 text-gray-11"
												xmlns="http://www.w3.org/2000/svg"
												viewBox="0 0 20 20"
												fill="currentColor"
											>
												<path
													fill-rule="evenodd"
													d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
													clip-rule="evenodd"
												/>
											</svg>
										</div>
									</div>
								</div>

								{renderInput(
									t("settings.integrations.s3.accessKeyId"),
									"accessKeyId",
									"PL31OADSQNK",
									"password",
								)}
								{renderInput(
									t("settings.integrations.s3.secretAccessKey"),
									"secretAccessKey",
									"PL31OADSQNK",
									"password",
								)}
								{renderInput(
									t("settings.integrations.s3.endpoint"),
									"endpoint",
									"https://s3.amazonaws.com",
								)}
								{renderInput(
									t("settings.integrations.s3.bucketName"),
									"bucketName",
									"my-bucket",
								)}
								{renderInput(
									t("settings.integrations.s3.region"),
									"region",
									"us-east-1",
								)}
							</div>
						</Suspense>
					</SectionCard>
				</Section>
				<div class="shrink-0">
					<fieldset
						class="flex justify-between items-center"
						disabled={
							_s3Config.loading ||
							saveConfig.isPending ||
							deleteConfig.isPending ||
							testConfig.isPending ||
							!!managedByOrganization()
						}
					>
						<div class="flex gap-2">
							{!_s3Config.loading && hasConfig() && (
								<Button
									variant="destructive"
									onClick={() => deleteConfig.mutate()}
								>
									{deleteConfig.isPending
										? t("settings.integrations.s3.removing")
										: t("settings.integrations.s3.removeConfig")}
								</Button>
							)}
							<Button
								variant="gray"
								onClick={() => testConfig.mutate(s3Config())}
							>
								{testConfig.isPending
									? t("settings.integrations.s3.testing")
									: t("settings.integrations.s3.testConnection")}
							</Button>
						</div>
						<Button
							class="min-w-[72px]"
							variant="primary"
							onClick={() => saveConfig.mutate(s3Config())}
						>
							{saveConfig.isPending
								? t("settings.integrations.s3.saving")
								: t("settings.integrations.s3.save")}
						</Button>
					</fieldset>
				</div>
			</SettingsPageContent>
		</div>
	);
}
