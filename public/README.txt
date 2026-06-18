InkClip 图标套装 · 使用说明
========================================

本压缩包按平台分好目录，拿来即用。所有图标均在本机生成，未上传任何服务器。

【web/】网站 / PWA
  把 web/ 里的文件复制到你网站根目录，然后在 <head> 里加：

    <link rel="icon" href="/favicon.ico" sizes="any">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="manifest" href="/site.webmanifest">

  maskable-*.png 是 PWA 自适应图标（带安全区，避免被圆形/方形遮罩裁切），
  已在 site.webmanifest 里以 purpose:"maskable" 引用。

【ios/】iOS App
  把 ios/ 里的 PNG 拖进 Xcode 的 Assets.xcassets → AppIcon，
  按尺寸对号入座（icon-1024 为 App Store 图）。

【android/】Android App
  mipmap-*.png 分别放进 res/mipmap-mdpi ~ mipmap-xxxhdpi 目录，
  命名为 ic_launcher.png；playstore-512.png 用于 Google Play 上架图。

【macos/】macOS App
  直接用现成的 AppIcon.icns（含 Retina @2x 各级，拖进 Xcode 项目即可）。
  若想自己用系统工具重打：把 icon_*.png 放进一个名为 AppIcon.iconset 的文件夹，
  执行：iconutil -c icns AppIcon.iconset

【windows/】Windows App
  app.ico 为多分辨率应用图标（16~256），可直接设为可执行文件图标 /
  在 .rc 资源或 Tauri/Electron 打包配置里引用。

【png/】你自选的其它尺寸（如有）
顶层 icon.ico / icon.icns（如勾选）：跨平台通用的单文件图标。
