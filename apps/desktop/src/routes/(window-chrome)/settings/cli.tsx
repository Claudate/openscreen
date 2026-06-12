import { Button } from "@cap/ui-solid";
import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { createResource, createSignal, Show } from "solid-js";
import toast from "solid-toast";
import { t } from "~/i18n";
import { Section, SectionCard, SettingsPageContent } from "./Setting";

type CliInstallStatus = {
	installDir: string;
	shimPath: string;
	targetPath: string;
	installed: boolean;
	onPath: boolean;
	conflict: string | null;
	pathEntry: string;
	shellCommand: string;
	pathConfigured: boolean;
};

const getCliInstallStatus = () =>
	invoke<CliInstallStatus>("get_cli_install_status");

const installCli = () => invoke<CliInstallStatus>("install_cli");

const uninstallCli = () => invoke<CliInstallStatus>("uninstall_cli");

function errorMessage(error: unknown, fallback: string) {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	return fallback;
}

export default function CliSettings() {
	const [status, { refetch, mutate }] = createResource(getCliInstallStatus);
	const [isInstalling, setIsInstalling] = createSignal(false);
	const [isUninstalling, setIsUninstalling] = createSignal(false);

	const installButtonLabel = () => {
		if (isInstalling())
			return status()?.installed
				? t("settings.cli.repairing")
				: t("settings.cli.installing");
		return status()?.installed
			? t("settings.cli.repair")
			: t("settings.cli.installCli");
	};

	const handleInstall = async () => {
		setIsInstalling(true);

		try {
			mutate(await installCli());
			toast.success(t("settings.cli.installedToast"));
		} catch (error) {
			toast.error(errorMessage(error, t("settings.cli.installFailedToast")));
			await refetch();
		} finally {
			setIsInstalling(false);
		}
	};

	const handleUninstall = async () => {
		setIsUninstalling(true);

		try {
			mutate(await uninstallCli());
			toast.success(t("settings.cli.removedToast"));
		} catch (error) {
			toast.error(errorMessage(error, t("settings.cli.removeFailedToast")));
			await refetch();
		} finally {
			setIsUninstalling(false);
		}
	};

	const copyPathCommand = async (command: string) => {
		await writeText(command);
		toast.success(t("settings.cli.copiedToast"));
	};

	return (
		<div class="cap-settings-page flex flex-col h-full custom-scroll">
			<SettingsPageContent>
				<Section
					title={t("settings.cli.title")}
					description={t("settings.cli.description")}
				>
					<SectionCard padded>
						<Show
							when={!status.error && status()}
							fallback={
								<Show
									when={status.error}
									fallback={
										<div class="h-20 rounded-lg bg-gray-3 animate-pulse" />
									}
								>
									<div class="flex flex-col gap-2">
										<p class="text-xs leading-relaxed text-red-11">
											{t("settings.cli.loadError")}{" "}
											{errorMessage(
												status.error,
												t("settings.cli.unknownError"),
											)}
										</p>
										<Button
											size="sm"
											variant="gray"
											class="self-start"
											onClick={() => refetch()}
										>
											{t("settings.cli.retry")}
										</Button>
									</div>
								</Show>
							}
						>
							{(currentStatus) => (
								<div class="flex flex-col gap-4">
									<div class="flex items-start justify-between gap-4">
										<div class="flex flex-col gap-1 min-w-0">
											<p class="text-[13px] text-gray-12">
												{currentStatus().installed
													? t("settings.cli.installed")
													: t("settings.cli.notInstalled")}
											</p>
											<p class="text-xs leading-snug text-gray-10">
												{t("settings.cli.installDesc", { command: "cap" })}
											</p>
										</div>
										<div class="flex shrink-0 gap-2">
											<Show when={currentStatus().installed}>
												<Button
													size="sm"
													variant="gray"
													disabled={isUninstalling()}
													onClick={handleUninstall}
												>
													{isUninstalling()
														? t("settings.cli.removing")
														: t("settings.cli.remove")}
												</Button>
											</Show>
											<Button
												size="sm"
												variant="dark"
												disabled={isInstalling()}
												onClick={handleInstall}
											>
												{installButtonLabel()}
											</Button>
										</div>
									</div>

									<div class="grid gap-2 text-xs">
										<PathRow
											label={t("settings.cli.command")}
											value={currentStatus().shimPath}
										/>
										<PathRow
											label={t("settings.cli.target")}
											value={currentStatus().targetPath}
										/>
									</div>

									<Show when={currentStatus().conflict}>
										{(conflict) => (
											<p class="rounded-lg border border-red-300/40 bg-red-500/10 px-3 py-2 text-xs leading-relaxed text-red-11">
												{conflict()}
											</p>
										)}
									</Show>

									<Show
										when={currentStatus().installed && !currentStatus().onPath}
									>
										<div class="flex flex-col gap-2 rounded-lg border border-gray-4 bg-gray-3 px-3 py-3">
											<p class="text-xs leading-relaxed text-gray-10">
												<Show
													when={currentStatus().pathConfigured}
													fallback={t("settings.cli.pathAdd", {
														pathEntry: currentStatus().pathEntry,
														command: "cap",
													})}
												>
													{t("settings.cli.pathAdded", { command: "cap" })}
												</Show>
											</p>
											<div class="flex items-center gap-2">
												<code class="flex-1 min-w-0 truncate rounded-md bg-gray-1 px-2 py-1.5 font-mono text-xs text-gray-12">
													{currentStatus().shellCommand}
												</code>
												<Button
													size="sm"
													variant="gray"
													onClick={() =>
														copyPathCommand(currentStatus().shellCommand)
													}
												>
													{t("settings.cli.copy")}
												</Button>
											</div>
										</div>
									</Show>
								</div>
							)}
						</Show>
					</SectionCard>
				</Section>
			</SettingsPageContent>
		</div>
	);
}

function PathRow(props: { label: string; value: string }) {
	return (
		<div class="flex items-center gap-3 min-w-0">
			<span class="w-16 shrink-0 text-gray-10">{props.label}</span>
			<code class="min-w-0 truncate rounded-md bg-gray-3 px-2 py-1 font-mono text-[11px] text-gray-12">
				{props.value}
			</code>
		</div>
	);
}
