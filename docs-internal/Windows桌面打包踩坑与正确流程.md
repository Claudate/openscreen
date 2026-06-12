# Windows 桌面端打包：踩坑复盘与正确流程

> 本文记录 Cap（openscreen）桌面端在 Windows 本地打包过程中遇到的全部阻塞、根因与正确做法，供后续打包直接复用，避免重复踩坑。

## 一、结论速览

| 项 | 值 |
|---|---|
| 打包目标 | Tauri v2 桌面端 → Windows `.exe`(NSIS) / `.msi`(WiX) / 便携版 |
| 主程序产物 | `target/x86_64-pc-windows-msvc/release/Cap - Development.exe` |
| 安装包产物 | `target/x86_64-pc-windows-msvc/release/bundle/{nsis,msi}/` |
| Release profile | `lto=true` + `codegen-units=1` + `opt-level="s"`：link 阶段耗时长（约 30 分钟）、内存峰值高（约 16GB），属正常现象 |
| 首选打包途径 | **GitHub Actions 云端**（`build-desktop.yml`），不依赖本机环境，规避本地杀软/工具链问题 |

## 二、踩过的坑与根因（按发现顺序）

### 坑 1：MSVC 工具链定位错误
- **现象**：`pnpm cap-setup` / `cargo build` 报 MSVC 版本不达标或 `No CMAKE_C_COMPILER`。
- **根因**：本机同时存在「残缺的 VS Professional」与「完整的 H:\BuildTools」。`vswhere -latest` 命中了残缺的 Professional（缺 x64 编译器）。
- **正解**：`vswhere` 改用 `-all -products *`，并对 `installationVersion` 数值排序取最高、对 `installationPath` 取首个满足 `VC.Tools.x86.x64` 的安装。见 `scripts/setup.js`。

### 坑 2：node 版本过低导致前端原生绑定缺失
- **现象**：前端构建（vinxi/rolldown）失败，`node_modules/**/*.node` 全部缺失（含 `@rolldown/binding-win32-x64-msvc`）。
- **根因**：本机 node `20.18.0` < rolldown 绑定要求的 `^20.19.0`，pnpm 按 engine 字段**静默跳过**了全部平台原生绑定（esbuild 要 ≥18 已装、rolldown 要 ≥20.19 被跳，对比即可印证）。
- **正解**：使用 node ≥ `20.20.2`（可用便携版放 `H:\tools`，零系统副作用），以 `--config.node-version=20.20.2` 重装依赖，16 个平台绑定即全部就位。

### 坑 3：whisper-rs-sys 的 cmake 找不到编译器
- **现象**：编译 `whisper-rs-sys`（cmake 编 whisper.cpp）报 `No CMAKE_C_COMPILER could be found`。
- **根因**：当前 shell 未加载 MSVC 开发环境，cmake 找不到 `cl.exe`（cc-rs 系 crate 能自动定位故未暴露，cmake 不能）。
- **正解**：构建前加载 `H:\BuildTools\VC\Auxiliary\Build\vcvars64.bat` 注入 MSVC 环境（`cl.exe` + `ninja`）。

### 坑 4：whisper.lib 链接路径不匹配
- **现象**：链接阶段 `could not find native static library 'whisper'`。
- **根因**：`whisper-rs-sys` 的 build.rs 在 Windows 期望库位于 `out/build/Release/`（多配置布局）。单配置 Ninja 把库放在 `out/build/`（无 `Release` 子目录），路径对不上。
- **正解**：设 `CMAKE_GENERATOR="Ninja Multi-Config"`（多配置 Ninja，用 PATH 中的 `cl.exe`，且产物落在 `build/Release/`，与 build.rs 匹配）。`Visual Studio 17 2022` generator 亦可，但需 `--target x86_64-pc-windows-msvc` 让其经 BuildTools 而非残缺 Professional。

### 坑 5：recording.rs 缺少 ElementBounds import（本次核心修复）
- **现象**：`cargo build` 报 6 个 `E0433/E0412/E0422`：`use of undeclared type ElementBounds`（`apps/desktop/src-tauri/src/recording.rs`）。
- **根因**：「语义元素缩放」功能的 `ClickCluster` 实现（`meaningful_element_bounds`/`element_union`/`element_amount`）使用了 `cap_project::ElementBounds`，但文件顶部漏了 import。该代码因上游主要在 macOS 开发、长期未做完整 Windows/全量编译而从未被编译验证过。
- **正解**：在 `recording.rs` 顶部 `use cap_project::{...}` 加入 `ElementBounds`。此修复对**云端 CI 打包同样必需**。

### 坑 6：360 安全卫士拦截打包工具（NSIS / WiX）
- **现象**：cargo 编译全部成功、主程序 exe 已产出，但 `tauri build` 在「下载并解压 NSIS / WiX 工具」阶段崩溃：`Failed to open file: code 5 PermissionDenied (拒绝访问)`。
- **根因**：360 实时防护/主动防御对 NSIS 的 `System.dll`/`TypeLib.dll`（可调任意 Win32 API，杀软高频误报）等做**文件级拦截**，阻止其落地。已验证 NSIS、WiX(MSI)、甚至 PowerShell 手动解压均被拦——属 360 的硬拦截，非权限配置问题（目录可写、Defender 已关）。
- **正解（任选）**：
  1. **云端打包**：GitHub Actions 不受本机杀软影响（首选）。
  2. 打包前临时退出 360 / 关实时防护，出包后恢复。
  3. 将 `%LOCALAPPDATA%\tauri` 加入 360 信任区。
  4. **便携版**：直接收集 `主程序 exe + ffmpeg dll + DirectML.dll + 3 个 sidecar` 到一个目录，免安装运行，完全绕开打包工具与 360。

## 三、正确的本地打包流程（以本机 H:\BuildTools / H:\tools\node 为例）

```powershell
# 1) 加载 MSVC 环境（解决坑 3）
$vcvars = "H:\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
cmd /c "`"$vcvars`" && set" | ForEach-Object {
  if ($_ -match '^([^=]+)=(.*)$') { Set-Item -Path "env:$($matches[1])" -Value $matches[2] }
}

# 2) PATH 指向 node>=20.20.2 与 cargo（解决坑 2）
$env:Path = "H:\tools\node-v20.20.2-win-x64;C:\Users\Administrator\.cargo\bin;$env:Path"

# 3) whisper 多配置（解决坑 4）
$env:CMAKE_GENERATOR = "Ninja Multi-Config"
$env:CMAKE_POLICY_VERSION_MINIMUM = "3.5"

# 4) 先构建前端（除非已构建且最新）
pnpm --dir apps/desktop build   # 产出 apps/desktop/.output/public

# 5) 打包（NSIS 需先解决坑 6：360）。stderr 必须用 cmd 重定向，PowerShell 的 2>&1 会吞编译错误
cmd /c "dotenv -e .env -- pnpm --dir apps/desktop tauri build --target x86_64-pc-windows-msvc > build.log 2>&1"
```

## 四、关键注意事项

- **杀软**：360/火绒等会拦截 NSIS/WiX 工具落地。本机打安装包前务必处理（见坑 6），否则只能出便携版。
- **前端时效（隐性炸弹）**：`ci-nofe.conf.json` 的 `skip-frontend-build` 仅在 `.output/public` 已最新、且 `apps/desktop/dist` symlink 存在时才安全。**改了前端却忘记重跑 `pnpm --dir apps/desktop build`，快速包就会装旧前端**。出正式分发包前请显式构建一次前端。默认 `tauri.conf.json` 的 `beforeBuildCommand` 必须保留为正常前端构建，不要提交 `skip-frontend` hack。
- **日志读取**：cargo 的真实错误在 stderr，PowerShell 的 `2>&1` 会把它转成 ErrorRecord 丢失，必须用 `cmd /c "... > log 2>&1"` 重定向。
- **link 阶段静默**：fat LTO + codegen-units=1 下，最终 binary 的 codegen/link 会长时间无日志输出（约 30 分钟、内存约 16GB），属正常，勿误判为卡死——以 rustc 进程 CPU 是否持续增长判断健康。

## 五、产物形式对照

| 形式 | 命令/做法 | 优点 | 限制 |
|---|---|---|---|
| NSIS `.exe` | `tauri build --bundles nsis` | 标准安装程序 | 需 NSIS 工具（被 360 拦） |
| MSI `.msi` | `tauri build --bundles msi` | 企业部署友好 | 需 WiX 工具（被 360 拦） |
| 便携版 | 收集 exe+dll+sidecar 到一目录打 zip | 免安装、绕开杀软 | 非标准安装包，依赖系统 WebView2 |
| 云端 | GitHub Actions `build-desktop.yml` | 不依赖本机环境/杀软 | 需推分支触发 |
