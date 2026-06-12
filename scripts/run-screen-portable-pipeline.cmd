@echo off
setlocal
set PATH=H:\tools\node-v20.20.2-win-x64;E:\NodeJs\node_global;C:\Users\Administrator\.cargo\bin;%PATH%
set NODE_OPTIONS=--max-old-space-size=12288
set CMAKE_GENERATOR=Visual Studio 17 2022
set LOG=H:\Web\openscreen\screen-portable-build.log
set ROOT=H:\Web\openscreen

echo === PIPELINE START %DATE% %TIME% === > "%LOG%"

call H:\BuildTools\VC\Auxiliary\Build\vcvars64.bat >>"%LOG%" 2>&1

cd /d %ROOT%\apps\desktop
echo === VINXI START === >> "%LOG%"
H:\tools\node-v20.20.2-win-x64\node.exe node_modules\vinxi\bin\cli.mjs build >> "%LOG%" 2>&1
echo VINXI_EXIT=%ERRORLEVEL% >> "%LOG%"

if not exist "%ROOT%\apps\desktop\.output\public\index.html" (
  echo === ASSEMBLE FALLBACK === >> "%LOG%"
  powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\assemble-frontend-public.ps1" >> "%LOG%" 2>&1
)

cd /d %ROOT%
echo === TAURI START === >> "%LOG%"
pnpm exec dotenv -e .env -- pnpm --dir apps/desktop run preparescript >> "%LOG%" 2>&1
pnpm exec dotenv -e .env -- pnpm --dir apps/desktop tauri build --target x86_64-pc-windows-msvc --config src-tauri/ci-nofe.conf.json --no-bundle >> "%LOG%" 2>&1
echo TAURI_EXIT=%ERRORLEVEL% >> "%LOG%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\package-screen-portable-zh.ps1" >> "%LOG%" 2>&1
echo === PIPELINE END %DATE% %TIME% === >> "%LOG%"
