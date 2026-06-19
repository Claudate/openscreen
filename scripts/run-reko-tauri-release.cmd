@echo off
setlocal
set PATH=H:\tools\node-v20.20.2-win-x64;C:\Users\Administrator\.cargo\bin;%PATH%
set NODE_OPTIONS=--max-old-space-size=12288
set CMAKE_GENERATOR=Visual Studio 17 2022
set LOG=H:\Web\openscreen\reko-release-build-%RANDOM%.log
set ROOT=H:\Web\openscreen

echo === REKO RELEASE START %DATE% %TIME% === > "%LOG%"

call H:\BuildTools\VC\Auxiliary\Build\vcvars64.bat >>"%LOG%" 2>&1

if not exist "%ROOT%\apps\desktop\.output\public\index.html" (
  echo === VINXI START === >> "%LOG%"
  cd /d %ROOT%\apps\desktop
  H:\tools\node-v20.20.2-win-x64\node.exe node_modules\vinxi\bin\cli.mjs build >> "%LOG%" 2>&1
  echo VINXI_EXIT=%ERRORLEVEL% >> "%LOG%"
) else (
  echo === SKIP VINXI frontend exists === >> "%LOG%"
)

cd /d %ROOT%
echo === TAURI START === >> "%LOG%"
pnpm exec dotenv -e .env -- pnpm --dir apps/desktop run preparescript >> "%LOG%" 2>&1
pnpm exec dotenv -e .env -- pnpm --dir apps/desktop tauri build --target x86_64-pc-windows-msvc --config src-tauri/ci-nofe.conf.json --no-bundle >> "%LOG%" 2>&1
echo TAURI_EXIT=%ERRORLEVEL% >> "%LOG%"

if not %ERRORLEVEL%==0 goto :fail

H:\tools\node-v20.20.2-win-x64\node.exe "%ROOT%\scripts\stage-windows-bundle-runtime.mjs" >> "%LOG%" 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\package-screen-portable-zh.ps1" >> "%LOG%" 2>&1
echo === REKO RELEASE END OK %DATE% %TIME% === >> "%LOG%"
exit /b 0

:fail
echo === REKO RELEASE FAILED %DATE% %TIME% === >> "%LOG%"
exit /b 1
