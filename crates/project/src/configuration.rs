use std::{
    fmt,
    ops::{Add, Div, Mul, Sub, SubAssign},
    path::Path,
};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use specta::Type;

use crate::cursor::ElementBounds;

#[derive(Type, Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub enum AspectRatio {
    #[default]
    Wide,
    Vertical,
    Square,
    Classic,
    Tall,
}

pub type Color = [u16; 3];

#[derive(Type, Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum BackgroundSource {
    Wallpaper {
        path: Option<String>,
    },
    Image {
        path: Option<String>,
    },
    Color {
        value: Color,
        #[serde(default = "default_alpha")]
        alpha: u8,
    },
    Gradient {
        from: Color,
        to: Color,
        #[serde(default = "default_gradient_angle")]
        angle: u16,
        #[serde(default)]
        noise_intensity: Option<f32>,
        #[serde(default)]
        noise_scale: Option<f32>,
        #[serde(default)]
        animated: Option<bool>,
        #[serde(default)]
        animation_speed: Option<f32>,
    },
}

fn default_gradient_angle() -> u16 {
    90
}

fn default_alpha() -> u8 {
    u8::MAX
}

impl Default for BackgroundSource {
    fn default() -> Self {
        BackgroundSource::Color {
            value: [255, 255, 255],
            alpha: 255,
        }
    }
}

#[derive(Type, Serialize, Deserialize, Clone, Copy, Debug, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct XY<T> {
    pub x: T,
    pub y: T,
}

impl<T> XY<T> {
    pub const fn new(x: T, y: T) -> Self {
        Self { x, y }
    }

    pub fn map<U, F: Fn(T) -> U>(self, f: F) -> XY<U> {
        XY {
            x: f(self.x),
            y: f(self.y),
        }
    }
}

impl<T: Add<Output = T>> Add for XY<T> {
    type Output = Self;

    fn add(self, other: Self) -> Self {
        Self {
            x: self.x + other.x,
            y: self.y + other.y,
        }
    }
}

impl<T: Sub<Output = T>> Sub for XY<T> {
    type Output = Self;

    fn sub(self, other: Self) -> Self {
        Self {
            x: self.x - other.x,
            y: self.y - other.y,
        }
    }
}

impl<T: Sub<Output = T> + Copy> Sub<T> for XY<T> {
    type Output = Self;

    fn sub(self, other: T) -> Self {
        Self {
            x: self.x - other,
            y: self.y - other,
        }
    }
}

impl<T: Mul<Output = T> + Copy> Mul<XY<T>> for XY<T> {
    type Output = Self;

    fn mul(self, other: Self) -> Self {
        Self {
            x: self.x * other.x,
            y: self.y * other.y,
        }
    }
}

impl<T: Mul<Output = T> + Copy> Mul<T> for XY<T> {
    type Output = Self;

    fn mul(self, other: T) -> Self {
        Self {
            x: self.x * other,
            y: self.y * other,
        }
    }
}

impl<T: Div<Output = T> + Copy> Div<T> for XY<T> {
    type Output = Self;

    fn div(self, other: T) -> Self {
        Self {
            x: self.x / other,
            y: self.y / other,
        }
    }
}

impl<T: Div<Output = T>> Div<XY<T>> for XY<T> {
    type Output = Self;

    fn div(self, other: XY<T>) -> Self {
        Self {
            x: self.x / other.x,
            y: self.y / other.y,
        }
    }
}

impl<T> SubAssign for XY<T>
where
    T: SubAssign + Copy,
{
    fn sub_assign(&mut self, rhs: Self) {
        self.x -= rhs.x;
        self.y -= rhs.y;
    }
}

impl From<XY<f32>> for XY<f64> {
    fn from(val: XY<f32>) -> Self {
        XY {
            x: val.x as f64,
            y: val.y as f64,
        }
    }
}

impl<T> From<(T, T)> for XY<T> {
    fn from(val: (T, T)) -> Self {
        XY { x: val.0, y: val.1 }
    }
}

#[derive(Type, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum CornerStyle {
    #[default]
    Squircle,
    Rounded,
}

#[derive(Type, Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct Crop {
    pub position: XY<u32>,
    pub size: XY<u32>,
}

impl Crop {
    pub fn aspect_ratio(&self) -> f32 {
        self.size.x as f32 / self.size.y as f32
    }
}

#[derive(Type, Serialize, Deserialize, Clone, Debug)]
#[serde(default)]
pub struct ShadowConfiguration {
    pub size: f32,
    pub opacity: f32,
    pub blur: f32,
}

#[derive(Type, Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct BorderConfiguration {
    pub enabled: bool,
    pub width: f32,
    pub color: Color,
    pub opacity: f32,
}

#[derive(Type, Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct BackgroundConfiguration {
    pub source: BackgroundSource,
    pub blur: f64,
    pub padding: f64,
    pub rounding: f64,
    pub rounding_type: CornerStyle,
    pub inset: u32,
    pub crop: Option<Crop>,
    pub shadow: f32,
    pub advanced_shadow: Option<ShadowConfiguration>,
    pub border: Option<BorderConfiguration>,
}

impl Default for BorderConfiguration {
    fn default() -> Self {
        Self {
            enabled: false,
            width: 5.0,
            color: [255, 255, 255], // White
            opacity: 80.0,          // 80% opacity
        }
    }
}

impl Default for BackgroundConfiguration {
    fn default() -> Self {
        Self {
            source: BackgroundSource::default(),
            blur: 0.0,
            padding: 0.0,
            rounding: 0.0,
            rounding_type: CornerStyle::default(),
            inset: 0,
            crop: None,
            shadow: 73.6,
            advanced_shadow: Some(ShadowConfiguration::default()),
            border: None, // Border is disabled by default for backwards compatibility
        }
    }
}

#[derive(Type, Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub enum CameraXPosition {
    Left,
    Center,
    #[default]
    Right,
}

#[derive(Type, Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub enum CameraYPosition {
    Top,
    #[default]
    Bottom,
}

#[derive(Type, Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct CameraPosition {
    pub x: CameraXPosition,
    pub y: CameraYPosition,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type, Default)]
#[serde(rename_all = "camelCase")]
pub enum BackgroundBlurMode {
    #[default]
    Off,
    Light,
    Heavy,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct BackgroundBlurConfig {
    pub mode: BackgroundBlurMode,
}

impl BackgroundBlurConfig {
    pub fn is_active(&self) -> bool {
        self.mode != BackgroundBlurMode::Off
    }
}

impl Default for BackgroundBlurConfig {
    fn default() -> Self {
        Self {
            mode: BackgroundBlurMode::Off,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct Camera {
    pub hide: bool,
    pub mirror: bool,
    pub position: CameraPosition,
    pub size: f32,
    #[serde(alias = "zoom_size")]
    pub zoom_size: Option<f32>,
    pub rounding: f32,
    pub shadow: f32,
    #[serde(alias = "advanced_shadow")]
    pub advanced_shadow: Option<ShadowConfiguration>,
    pub shape: CameraShape,
    #[serde(alias = "rounding_type")]
    pub rounding_type: CornerStyle,
    #[serde(default = "Camera::default_scale_during_zoom")]
    pub scale_during_zoom: f32,
    #[serde(default)]
    pub background_blur: BackgroundBlurConfig,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Type, Default)]
#[serde(rename_all = "camelCase")]
pub enum CameraShape {
    #[default]
    Square,
    Source,
}

impl Camera {
    pub fn default_zoom_size() -> f32 {
        60.0
    }

    fn default_rounding() -> f32 {
        100.0
    }

    fn default_scale_during_zoom() -> f32 {
        0.7
    }
}

impl Default for Camera {
    fn default() -> Self {
        Self {
            hide: false,
            mirror: false,
            position: CameraPosition::default(),
            size: 30.0,
            zoom_size: Some(Self::default_zoom_size()),
            rounding: Self::default_rounding(),
            shadow: 62.5,
            advanced_shadow: Some(ShadowConfiguration {
                size: 33.9,
                opacity: 44.2,
                blur: 10.5,
            }),
            shape: CameraShape::Square,
            rounding_type: CornerStyle::default(),
            scale_during_zoom: Self::default_scale_during_zoom(),
            background_blur: BackgroundBlurConfig::default(),
        }
    }
}

impl Default for ShadowConfiguration {
    fn default() -> Self {
        Self {
            size: 14.4,
            opacity: 68.1,
            blur: 3.8,
        }
    }
}

#[derive(Type, Serialize, Deserialize, Clone, Debug, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub enum StereoMode {
    #[default]
    Stereo,
    MonoL,
    MonoR,
}

#[derive(Type, Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct AudioConfiguration {
    pub mute: bool,
    pub improve: bool,
    pub mic_volume_db: f32,
    pub mic_stereo_mode: StereoMode,
    pub system_volume_db: f32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bgm: Option<BgmConfiguration>,
}

#[derive(Type, Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct BgmConfiguration {
    pub path: String,
    pub volume_db: f32,
    pub start_offset: f64,
    pub enabled: bool,
    pub loop_playback: bool,
}

impl Default for BgmConfiguration {
    fn default() -> Self {
        Self {
            path: String::new(),
            volume_db: -6.0,
            start_offset: 0.0,
            enabled: true,
            loop_playback: false,
        }
    }
}

impl Default for AudioConfiguration {
    fn default() -> Self {
        Self {
            mute: false,
            improve: false,
            mic_volume_db: 0.0,
            mic_stereo_mode: StereoMode::default(),
            system_volume_db: 0.0,
            bgm: None,
        }
    }
}

#[derive(Type, Serialize, Deserialize, Clone, Debug, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum CursorType {
    #[default]
    Auto,
    Pointer,
    Circle,
}

#[derive(Type, Serialize, Deserialize, Clone, Copy, Debug, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum CursorAnimationStyle {
    Slow,
    Smooth,
    #[default]
    #[serde(alias = "regular", alias = "quick", alias = "rapid")]
    Mellow,
    Fast,
    Custom,
}

#[derive(Type, Serialize, Deserialize, Clone, Copy, Debug)]
pub struct CursorSmoothingPreset {
    pub tension: f32,
    pub mass: f32,
    pub friction: f32,
}

#[derive(Type, Serialize, Deserialize, Clone, Copy, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ClickSpringConfig {
    pub tension: f32,
    pub mass: f32,
    pub friction: f32,
}

impl Default for ClickSpringConfig {
    fn default() -> Self {
        Self {
            tension: 530.0,
            mass: 1.0,
            friction: 40.0,
        }
    }
}

#[derive(Type, Serialize, Deserialize, Clone, Copy, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ScreenMovementSpring {
    pub stiffness: f32,
    pub damping: f32,
    pub mass: f32,
}

impl Default for ScreenMovementSpring {
    fn default() -> Self {
        Self {
            stiffness: 200.0,
            damping: 40.0,
            mass: 2.25,
        }
    }
}

impl CursorAnimationStyle {
    pub fn preset(self) -> Option<CursorSmoothingPreset> {
        match self {
            Self::Slow => Some(CursorSmoothingPreset {
                tension: 200.0,
                mass: 2.25,
                friction: 40.0,
            }),
            Self::Smooth => Some(CursorSmoothingPreset {
                tension: 80.0,
                mass: 2.5,
                friction: 28.0,
            }),
            Self::Mellow => Some(CursorSmoothingPreset {
                tension: 470.0,
                mass: 3.0,
                friction: 70.0,
            }),
            Self::Fast => Some(CursorSmoothingPreset {
                tension: 380.0,
                mass: 1.0,
                friction: 30.0,
            }),
            Self::Custom => None,
        }
    }
}

#[derive(Type, Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct CursorConfiguration {
    pub hide: bool,
    pub hide_when_idle: bool,
    pub hide_when_idle_delay: f32,
    pub size: u32,
    r#type: CursorType,
    pub animation_style: CursorAnimationStyle,
    pub tension: f32,
    pub mass: f32,
    pub friction: f32,
    pub raw: bool,
    pub motion_blur: f32,
    pub use_svg: bool,
    #[serde(default = "CursorConfiguration::default_rotation_amount")]
    pub rotation_amount: f32,
    #[serde(default)]
    pub base_rotation: f32,
    #[serde(default)]
    pub click_spring: Option<ClickSpringConfig>,
    #[serde(default)]
    pub stop_movement_in_last_seconds: Option<f32>,
}

impl Default for CursorConfiguration {
    fn default() -> Self {
        let animation_style = CursorAnimationStyle::default();
        let mut config = Self {
            hide: false,
            hide_when_idle: false,
            hide_when_idle_delay: Self::default_hide_when_idle_delay(),
            size: 100,
            r#type: CursorType::default(),
            animation_style,
            tension: 470.0,
            mass: 3.0,
            friction: 70.0,
            raw: false,
            motion_blur: 0.5,
            use_svg: true,
            rotation_amount: Self::default_rotation_amount(),
            base_rotation: 0.0,
            click_spring: None,
            stop_movement_in_last_seconds: None,
        };

        if let Some(preset) = animation_style.preset() {
            config.tension = preset.tension;
            config.mass = preset.mass;
            config.friction = preset.friction;
        }

        config
    }
}
impl CursorConfiguration {
    fn default_hide_when_idle_delay() -> f32 {
        2.0
    }

    fn default_rotation_amount() -> f32 {
        0.15
    }

    pub fn cursor_type(&self) -> &CursorType {
        &self.r#type
    }

    pub fn click_spring_config(&self) -> ClickSpringConfig {
        self.click_spring.unwrap_or_default()
    }
}

#[derive(Type, Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct HotkeysConfiguration {
    show: bool,
}

#[derive(Type, Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct TimelineSegment {
    #[serde(default, rename = "recordingSegment")]
    pub recording_clip: u32,
    pub timescale: f64,
    pub start: f64,
    pub end: f64,
}

impl TimelineSegment {
    fn interpolate_time(&self, tick: f64) -> Option<f64> {
        if tick > self.duration() {
            None
        } else {
            Some(self.start + tick * self.timescale)
        }
    }

    /// in seconds
    pub fn duration(&self) -> f64 {
        (self.end - self.start) / self.timescale
    }
}

#[derive(Type, Serialize, Deserialize, Clone, Debug, Default, PartialEq, Eq, Copy)]
#[serde(rename_all = "kebab-case")]
pub enum GlideDirection {
    #[default]
    None,
    Left,
    Right,
    Up,
    Down,
}

#[derive(Type, Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ZoomSegment {
    pub start: f64,
    pub end: f64,
    pub amount: f64,
    pub mode: ZoomMode,
    #[serde(default)]
    pub glide_direction: GlideDirection,
    #[serde(default = "ZoomSegment::default_glide_speed")]
    pub glide_speed: f64,
    #[serde(default)]
    pub instant_animation: bool,
    #[serde(default = "ZoomSegment::default_edge_snap_ratio")]
    pub edge_snap_ratio: f64,
    /// 语义聚焦矩形（点击命中 UI 元素的并集包围盒，归一化 UV）。
    /// 由生成层写入；`None`（含旧版工程文件）= 无语义信号，渲染层走既有中心点逻辑。
    /// 双向兼容：旧版反序列化新文件忽略未知字段无碍，新版读旧文件得 `None`。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub element_bounds: Option<ElementBounds>,
    /// 语义贴边框选的边距（归一化 UV，0~0.5）。`None` = 用内置默认值。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub element_padding: Option<f64>,
    /// 语义缩放显式开关。`None` = 开（有 `element_bounds` 即生效）；
    /// 显式 `false` 关闭渲染但保留矩形数据，UI 可随时再开。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub semantic_zoom: Option<bool>,
}

impl ZoomSegment {
    /// 语义贴边框选的内置默认边距（归一化 UV）。
    pub const DEFAULT_ELEMENT_PADDING: f64 = 0.05;

    fn default_glide_speed() -> f64 {
        0.5
    }

    fn default_edge_snap_ratio() -> f64 {
        0.25
    }

    /// 语义缩放是否生效：需同时满足「有有效矩形」且「未被显式关闭」。
    pub fn semantic_zoom_enabled(&self) -> bool {
        self.semantic_zoom.unwrap_or(true) && self.element_bounds.is_some_and(|b| b.is_meaningful())
    }

    /// 语义边距（缺省取内置默认，并夹紧到合法区间）。
    pub fn element_padding_or_default(&self) -> f64 {
        self.element_padding
            .unwrap_or(Self::DEFAULT_ELEMENT_PADDING)
            .clamp(0.0, 0.5)
    }
}

#[derive(Type, Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub enum ZoomMode {
    Auto,
    Manual { x: f32, y: f32 },
}

#[derive(Type, Serialize, Deserialize, Clone, Copy, Debug)]
#[serde(rename_all = "camelCase")]
pub enum MaskKind {
    Sensitive,
    Highlight,
    Silhouette,
    EdgeGlow,
}

#[derive(Type, Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct MaskScalarKeyframe {
    pub time: f64,
    pub value: f64,
}

#[derive(Type, Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct MaskVectorKeyframe {
    pub time: f64,
    pub x: f64,
    pub y: f64,
}

#[derive(Type, Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct MaskKeyframes {
    #[serde(default)]
    pub position: Vec<MaskVectorKeyframe>,
    #[serde(default)]
    pub size: Vec<MaskVectorKeyframe>,
    #[serde(default)]
    pub intensity: Vec<MaskScalarKeyframe>,
}

#[derive(Type, Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MaskSegment {
    pub start: f64,
    pub end: f64,
    #[serde(default)]
    pub track: u32,
    #[serde(default = "MaskSegment::default_enabled")]
    pub enabled: bool,
    pub mask_type: MaskKind,
    pub center: XY<f64>,
    pub size: XY<f64>,
    #[serde(default)]
    pub feather: f64,
    #[serde(default = "MaskSegment::default_opacity")]
    pub opacity: f64,
    #[serde(default)]
    pub pixelation: f64,
    #[serde(default)]
    pub darkness: f64,
    #[serde(default = "MaskSegment::default_fade_duration")]
    pub fade_duration: f64,
    #[serde(default)]
    pub keyframes: MaskKeyframes,
}

impl MaskSegment {
    fn default_enabled() -> bool {
        true
    }

    fn default_opacity() -> f64 {
        1.0
    }

    fn default_fade_duration() -> f64 {
        0.15
    }
}

#[derive(Type, Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TextSegment {
    pub start: f64,
    pub end: f64,
    #[serde(default)]
    pub track: u32,
    #[serde(default = "TextSegment::default_enabled")]
    pub enabled: bool,
    #[serde(default = "TextSegment::default_content")]
    pub content: String,
    #[serde(default = "TextSegment::default_center")]
    pub center: XY<f64>,
    #[serde(default = "TextSegment::default_size")]
    pub size: XY<f64>,
    #[serde(default = "TextSegment::default_font_family")]
    pub font_family: String,
    #[serde(default = "TextSegment::default_font_size")]
    pub font_size: f32,
    #[serde(default = "TextSegment::default_font_weight")]
    pub font_weight: f32,
    #[serde(default)]
    pub italic: bool,
    #[serde(default = "TextSegment::default_color")]
    pub color: String,
    #[serde(default = "TextSegment::default_fade_duration")]
    pub fade_duration: f64,
}

impl TextSegment {
    fn default_enabled() -> bool {
        true
    }

    fn default_content() -> String {
        "Text".to_string()
    }

    fn default_center() -> XY<f64> {
        XY::new(0.5, 0.5)
    }

    fn default_size() -> XY<f64> {
        XY::new(0.35, 0.2)
    }

    fn default_font_family() -> String {
        "sans-serif".to_string()
    }

    fn default_font_size() -> f32 {
        48.0
    }

    fn default_font_weight() -> f32 {
        700.0
    }

    fn default_color() -> String {
        "#ffffff".to_string()
    }

    fn default_fade_duration() -> f64 {
        0.15
    }
}

#[derive(Type, Serialize, Deserialize, Clone, Copy, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub enum SceneMode {
    #[default]
    Default,
    CameraOnly,
    HideCamera,
    SplitScreen,
}

#[derive(Type, Serialize, Deserialize, Clone, Copy, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct SplitLayout {
    pub screen_zoom: f64,
    pub screen_position: XY<f64>,
    pub camera_zoom: f64,
    pub camera_position: XY<f64>,
}

impl Default for SplitLayout {
    fn default() -> Self {
        Self {
            screen_zoom: 1.0,
            screen_position: XY::new(0.5, 0.5),
            camera_zoom: 1.0,
            camera_position: XY::new(0.5, 0.5),
        }
    }
}

fn default_scene_transition() -> f64 {
    0.3
}

#[derive(Type, Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SceneSegment {
    pub start: f64,
    pub end: f64,
    #[serde(default)]
    pub mode: SceneMode,
    #[serde(default)]
    pub split_layout: Option<SplitLayout>,
    #[serde(default = "default_scene_transition")]
    pub transition_in: f64,
    #[serde(default = "default_scene_transition")]
    pub transition_out: f64,
}

#[derive(Type, Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TimelineConfiguration {
    pub segments: Vec<TimelineSegment>,
    pub zoom_segments: Vec<ZoomSegment>,
    #[serde(default)]
    pub scene_segments: Vec<SceneSegment>,
    #[serde(default)]
    pub mask_segments: Vec<MaskSegment>,
    #[serde(default)]
    pub text_segments: Vec<TextSegment>,
    #[serde(default)]
    pub caption_segments: Vec<CaptionTrackSegment>,
    #[serde(default)]
    pub keyboard_segments: Vec<crate::KeyboardTrackSegment>,
    #[serde(default)]
    pub bgm_segments: Vec<BgmTrackSegment>,
}

#[derive(Type, Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BgmTrackSegment {
    pub id: String,
    pub start: f64,
    pub end: f64,
    pub source_start: f64,
    pub volume_db: f32,
    #[serde(default)]
    pub fade_in: f64,
    #[serde(default)]
    pub fade_out: f64,
}

#[derive(Type, Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CaptionTrackSegment {
    pub id: String,
    pub start: f64,
    pub end: f64,
    pub text: String,
    #[serde(default)]
    pub words: Vec<CaptionWord>,
    #[serde(default)]
    pub fade_duration_override: Option<f32>,
    #[serde(default)]
    pub linger_duration_override: Option<f32>,
    #[serde(default)]
    pub position_override: Option<String>,
    #[serde(default)]
    pub color_override: Option<String>,
    #[serde(default)]
    pub background_color_override: Option<String>,
    #[serde(default)]
    pub font_size_override: Option<u32>,
}

impl TimelineConfiguration {
    pub fn get_segment_time(&self, frame_time: f64) -> Option<(f64, &TimelineSegment)> {
        let mut accum_duration = 0.0;

        for segment in self.segments.iter() {
            if frame_time < accum_duration + segment.duration() {
                return segment
                    .interpolate_time(frame_time - accum_duration)
                    .map(|t| (t, segment));
            }

            accum_duration += segment.duration();
        }

        None
    }

    pub fn duration(&self) -> f64 {
        self.segments.iter().map(|s| s.duration()).sum()
    }
}

pub const WALLPAPERS_PATH: &str = "assets/backgrounds/macOS";

#[derive(Type, Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct CaptionWord {
    pub text: String,
    pub start: f32,
    pub end: f32,
}

#[derive(Type, Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct CaptionSegment {
    pub id: String,
    pub start: f32,
    pub end: f32,
    pub text: String,
    #[serde(default)]
    pub words: Vec<CaptionWord>,
}

#[derive(Type, Serialize, Deserialize, Clone, Copy, Debug, Default, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum CaptionPosition {
    TopLeft,
    TopCenter,
    TopRight,
    #[default]
    BottomLeft,
    BottomCenter,
    BottomRight,
}

#[derive(Type, Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct CaptionSettings {
    pub enabled: bool,
    pub font: String,
    pub size: u32,
    pub color: String,
    #[serde(alias = "backgroundColor")]
    pub background_color: String,
    #[serde(alias = "backgroundOpacity")]
    pub background_opacity: u32,
    pub position: String,
    pub italic: bool,
    #[serde(alias = "fontWeight")]
    pub font_weight: u32,
    pub outline: bool,
    #[serde(alias = "outlineColor")]
    pub outline_color: String,
    #[serde(alias = "exportWithSubtitles")]
    pub export_with_subtitles: bool,
    #[serde(alias = "highlightColor")]
    pub highlight_color: String,
    #[serde(alias = "fadeDuration")]
    pub fade_duration: f32,
    #[serde(alias = "lingerDuration")]
    pub linger_duration: f32,
    #[serde(alias = "wordTransitionDuration")]
    pub word_transition_duration: f32,
    #[serde(alias = "activeWordHighlight")]
    pub active_word_highlight: bool,
}

impl CaptionSettings {
    fn default_highlight_color() -> String {
        "#FFFFFF".to_string()
    }

    fn default_font_weight() -> u32 {
        700
    }

    fn default_fade_duration() -> f32 {
        0.15
    }

    fn default_linger_duration() -> f32 {
        0.4
    }

    fn default_word_transition_duration() -> f32 {
        0.25
    }

    fn default_active_word_highlight() -> bool {
        false
    }
}

impl Default for CaptionSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            font: "System Sans-Serif".to_string(),
            size: 24,
            color: "#FFFFFF".to_string(),
            background_color: "#000000".to_string(),
            background_opacity: 90,
            position: "bottom-center".to_string(),
            italic: false,
            font_weight: Self::default_font_weight(),
            outline: false,
            outline_color: "#000000".to_string(),
            export_with_subtitles: false,
            highlight_color: Self::default_highlight_color(),
            fade_duration: Self::default_fade_duration(),
            linger_duration: Self::default_linger_duration(),
            word_transition_duration: Self::default_word_transition_duration(),
            active_word_highlight: Self::default_active_word_highlight(),
        }
    }
}

#[derive(Type, Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct CaptionsData {
    pub segments: Vec<CaptionSegment>,
    pub settings: CaptionSettings,
}

#[derive(Type, Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct KeyboardSettings {
    pub enabled: bool,
    pub font: String,
    pub size: u32,
    pub color: String,
    pub background_color: String,
    pub background_opacity: u32,
    pub position: String,
    pub font_weight: u32,
    pub fade_duration: f32,
    pub linger_duration: f32,
    pub grouping_threshold_ms: f64,
    pub show_modifiers: bool,
    pub show_special_keys: bool,
    pub uppercase: bool,
}

impl Default for KeyboardSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            font: "System Sans-Serif".to_string(),
            size: 50,
            color: "#FFFFFF".to_string(),
            background_color: "#000000".to_string(),
            background_opacity: 95,
            position: "bottom-center".to_string(),
            font_weight: 400,
            fade_duration: 0.15,
            linger_duration: 0.8,
            grouping_threshold_ms: 500.0,
            show_modifiers: true,
            show_special_keys: true,
            uppercase: false,
        }
    }
}

#[derive(Type, Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct KeyboardData {
    pub settings: KeyboardSettings,
}

#[derive(Type, Serialize, Deserialize, Clone, Copy, Debug, Default)]
pub struct ClipOffsets {
    #[serde(default)]
    pub camera: f32,
    #[serde(default)]
    pub mic: f32,
    #[serde(default)]
    pub system_audio: f32,
}

#[derive(Type, Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct ClipConfiguration {
    pub index: u32,
    pub offsets: ClipOffsets,
}

#[derive(Type, Serialize, Deserialize, Clone, Copy, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum AnnotationType {
    Arrow,
    Circle,
    Rectangle,
    Text,
    Mask,
}

#[derive(Type, Serialize, Deserialize, Clone, Copy, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum MaskType {
    Blur,
    Pixelate,
}

#[derive(Debug, PartialEq)]
pub enum AnnotationValidationError {
    MaskTypeMissing {
        id: String,
    },
    MaskLevelMissing {
        id: String,
    },
    MaskLevelInvalid {
        id: String,
        level: f64,
    },
    MaskDataNotAllowed {
        id: String,
        annotation_type: AnnotationType,
    },
}

impl fmt::Display for AnnotationValidationError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::MaskTypeMissing { id } => {
                write!(f, "annotation {id} of type mask is missing maskType")
            }
            Self::MaskLevelMissing { id } => {
                write!(f, "annotation {id} of type mask is missing maskLevel")
            }
            Self::MaskLevelInvalid { id, level } => {
                write!(f, "annotation {id} has invalid maskLevel {level}")
            }
            Self::MaskDataNotAllowed {
                id,
                annotation_type,
            } => write!(
                f,
                "annotation {id} with type {annotation_type:?} cannot include mask data"
            ),
        }
    }
}

impl std::error::Error for AnnotationValidationError {}

#[derive(Type, Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Annotation {
    pub id: String,
    #[serde(rename = "type")]
    pub annotation_type: AnnotationType,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub stroke_color: String,
    pub stroke_width: f64,
    pub fill_color: String,
    pub opacity: f64,
    pub rotation: f64,
    pub text: Option<String>,
    #[serde(default)]
    pub mask_type: Option<MaskType>,
    #[serde(default)]
    pub mask_level: Option<f64>,
}

impl Annotation {
    pub fn validate(&self) -> Result<(), AnnotationValidationError> {
        match self.annotation_type {
            AnnotationType::Mask => {
                if self.mask_type.is_none() {
                    return Err(AnnotationValidationError::MaskTypeMissing {
                        id: self.id.clone(),
                    });
                }

                let level =
                    self.mask_level
                        .ok_or_else(|| AnnotationValidationError::MaskLevelMissing {
                            id: self.id.clone(),
                        })?;

                if !level.is_finite() || level <= 0.0 {
                    return Err(AnnotationValidationError::MaskLevelInvalid {
                        id: self.id.clone(),
                        level,
                    });
                }

                Ok(())
            }
            _ => {
                if self.mask_type.is_some() || self.mask_level.is_some() {
                    return Err(AnnotationValidationError::MaskDataNotAllowed {
                        id: self.id.clone(),
                        annotation_type: self.annotation_type,
                    });
                }

                Ok(())
            }
        }
    }
}

/// 自动缩放观感预设（生成层参数基线，前端三档切换）。
#[derive(Type, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum AutoZoomPreset {
    /// 克制：放大更轻、停留聚焦关闭，适合界面密集/快节奏演示。
    Subtle,
    /// 默认：与内置常量一致的均衡观感。
    Normal,
    /// 强烈：放大更重、停留聚焦更明显，适合教学/讲解类录屏。
    Dramatic,
}

/// 自动缩放生成参数（项目级可调，驱动「重新生成 zoom 段」）。
/// 全部 Option：`None` = 跟随 preset（preset 也缺省则用内置默认）；
/// 显式字段 > preset 基线 > 内置默认。serde 兼容铁律：旧工程文件缺字段零影响。
#[derive(Type, Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AutoZoomConfiguration {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preset: Option<AutoZoomPreset>,
    /// 聚类时间阈值（ms）：相邻点击间隔 ≤ 此值才可能归入同一聚焦段。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cluster_time_eps_ms: Option<f64>,
    /// 聚类空间阈值（归一化 UV）：点击到簇质心距离 ≤ 此值才归入同簇。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cluster_space_eps: Option<f64>,
    /// 停留聚焦开关（无点击的长停留也产生轻度聚焦段）。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dwell_enabled: Option<bool>,
    /// 停留聚焦最短停留时长（ms）。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dwell_min_duration_ms: Option<f64>,
    /// 动态强度下限。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub amount_min: Option<f64>,
    /// 动态强度上限。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub amount_max: Option<f64>,
}

/// 解析后的自动缩放生成参数（运行时值，非序列化契约）。
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct ResolvedAutoZoom {
    pub cluster_time_eps_ms: f64,
    pub cluster_space_eps: f64,
    pub dwell_enabled: bool,
    pub dwell_min_duration_ms: f64,
    /// 停留段的固定温和强度（弱信号弱表达，由 preset 决定，不单独暴露字段）。
    pub dwell_amount: f64,
    pub amount_min: f64,
    pub amount_max: f64,
}

impl Default for ResolvedAutoZoom {
    /// 内置默认 = Normal 预设 = 既有硬编码常量值（行为零变化基线）。
    fn default() -> Self {
        Self {
            cluster_time_eps_ms: 1200.0,
            cluster_space_eps: 0.18,
            dwell_enabled: true,
            dwell_min_duration_ms: 1500.0,
            dwell_amount: 1.6,
            amount_min: 1.5,
            amount_max: 2.8,
        }
    }
}

impl AutoZoomConfiguration {
    /// 解析三层优先级：显式字段 > preset 基线 > 内置默认（Normal）。
    /// 数值做防呆 clamp，保证任意输入下生成层参数合法。
    pub fn resolve(config: Option<&AutoZoomConfiguration>) -> ResolvedAutoZoom {
        let mut resolved = match config.and_then(|c| c.preset) {
            Some(AutoZoomPreset::Subtle) => ResolvedAutoZoom {
                dwell_enabled: false,
                dwell_amount: 1.4,
                amount_min: 1.4,
                amount_max: 2.2,
                ..ResolvedAutoZoom::default()
            },
            Some(AutoZoomPreset::Dramatic) => ResolvedAutoZoom {
                dwell_amount: 1.8,
                amount_min: 1.7,
                amount_max: 3.4,
                ..ResolvedAutoZoom::default()
            },
            Some(AutoZoomPreset::Normal) | None => ResolvedAutoZoom::default(),
        };

        if let Some(config) = config {
            if let Some(v) = config.cluster_time_eps_ms {
                resolved.cluster_time_eps_ms = v.clamp(100.0, 10_000.0);
            }
            if let Some(v) = config.cluster_space_eps {
                resolved.cluster_space_eps = v.clamp(0.01, 1.0);
            }
            if let Some(v) = config.dwell_enabled {
                resolved.dwell_enabled = v;
            }
            if let Some(v) = config.dwell_min_duration_ms {
                resolved.dwell_min_duration_ms = v.clamp(300.0, 30_000.0);
            }
            if let Some(v) = config.amount_min {
                resolved.amount_min = v.clamp(1.0, 5.0);
            }
            if let Some(v) = config.amount_max {
                resolved.amount_max = v.clamp(1.0, 5.0);
            }
            // 防呆：上下限倒挂时取并集中点排序。
            if resolved.amount_min > resolved.amount_max {
                std::mem::swap(&mut resolved.amount_min, &mut resolved.amount_max);
            }
        }

        resolved
    }
}

#[derive(Type, Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct ProjectConfiguration {
    pub aspect_ratio: Option<AspectRatio>,
    pub background: BackgroundConfiguration,
    pub camera: Camera,
    pub audio: AudioConfiguration,
    pub cursor: CursorConfiguration,
    pub hotkeys: HotkeysConfiguration,
    pub timeline: Option<TimelineConfiguration>,
    pub captions: Option<CaptionsData>,
    pub keyboard: Option<KeyboardData>,
    pub clips: Vec<ClipConfiguration>,
    pub annotations: Vec<Annotation>,
    #[serde(skip_serializing)]
    pub hidden_text_segments: Vec<usize>,
    #[serde(default = "ProjectConfiguration::default_screen_motion_blur")]
    pub screen_motion_blur: f32,
    #[serde(default)]
    pub screen_movement_spring: ScreenMovementSpring,
    /// 自动缩放生成参数（`None` = 内置默认；serde 兼容旧工程文件）。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub auto_zoom: Option<AutoZoomConfiguration>,
}

fn camera_config_needs_migration(value: &Value) -> bool {
    value
        .get("camera")
        .and_then(|camera| camera.as_object())
        .is_some_and(|camera| {
            camera.contains_key("zoom_size")
                || camera.contains_key("advanced_shadow")
                || camera.contains_key("rounding_type")
        })
}

impl Default for ProjectConfiguration {
    fn default() -> Self {
        Self {
            aspect_ratio: Default::default(),
            background: Default::default(),
            camera: Default::default(),
            audio: Default::default(),
            cursor: Default::default(),
            hotkeys: Default::default(),
            timeline: Default::default(),
            captions: Default::default(),
            keyboard: Default::default(),
            clips: Default::default(),
            annotations: Default::default(),
            hidden_text_segments: Default::default(),
            screen_motion_blur: Self::default_screen_motion_blur(),
            screen_movement_spring: Default::default(),
            auto_zoom: Default::default(),
        }
    }
}

impl ProjectConfiguration {
    fn default_screen_motion_blur() -> f32 {
        0.5
    }

    pub fn validate(&self) -> Result<(), AnnotationValidationError> {
        for annotation in &self.annotations {
            annotation.validate()?;
        }

        Ok(())
    }

    pub fn load(project_path: impl AsRef<Path>) -> Result<Self, std::io::Error> {
        let project_path = project_path.as_ref();
        let config_path = project_path.join("project-config.json");
        let config_str = std::fs::read_to_string(&config_path)?;
        let parsed_value = serde_json::from_str::<Value>(&config_str).ok();
        let missing_screen_motion_blur = parsed_value.as_ref().is_some_and(|value| {
            value
                .as_object()
                .is_some_and(|object| !object.contains_key("screenMotionBlur"))
        });
        let needs_camera_migration = parsed_value
            .as_ref()
            .map(camera_config_needs_migration)
            .unwrap_or(false);
        let mut config: Self = serde_json::from_str(&config_str)
            .map_err(|error| std::io::Error::new(std::io::ErrorKind::InvalidData, error))?;
        let cursor_motion_blur = config.cursor.motion_blur.clamp(0.0, 1.0);
        let screen_motion_blur = config.screen_motion_blur.clamp(0.0, 1.0);
        let needs_motion_blur_clamp = (config.cursor.motion_blur - cursor_motion_blur).abs()
            > f32::EPSILON
            || (config.screen_motion_blur - screen_motion_blur).abs() > f32::EPSILON;
        let needs_screen_motion_blur_migration = missing_screen_motion_blur
            || (screen_motion_blur - cursor_motion_blur).abs() > f32::EPSILON;
        config.cursor.motion_blur = cursor_motion_blur;
        if needs_screen_motion_blur_migration {
            config.screen_motion_blur = config.cursor.motion_blur;
        } else {
            config.screen_motion_blur = screen_motion_blur;
        }
        config
            .validate()
            .map_err(|error| std::io::Error::new(std::io::ErrorKind::InvalidData, error))?;

        if needs_camera_migration || needs_motion_blur_clamp || needs_screen_motion_blur_migration {
            match config.write(project_path) {
                Ok(_) => {
                    eprintln!("Updated project-config.json migrated settings");
                }
                Err(error) => {
                    eprintln!("Failed to migrate project-config.json: {error}");
                }
            }
        }

        Ok(config)
    }

    pub fn write(&self, project_path: impl AsRef<Path>) -> Result<(), std::io::Error> {
        self.validate()
            .map_err(|error| std::io::Error::new(std::io::ErrorKind::InvalidData, error))?;

        let project_path = project_path.as_ref();
        let config_path = project_path.join("project-config.json");
        let temp_path =
            project_path.join(format!(".project-config-{}.json.tmp", uuid::Uuid::new_v4()));

        std::fs::write(&temp_path, serde_json::to_string_pretty(self)?)?;

        if let Err(error) = std::fs::rename(&temp_path, &config_path) {
            let _ = std::fs::remove_file(&temp_path);
            return Err(error);
        }

        Ok(())
    }

    pub fn get_segment_time(&self, frame_time: f64) -> Option<(f64, &TimelineSegment)> {
        self.timeline
            .as_ref()
            .and_then(|t| t.get_segment_time(frame_time))
    }
}

pub const SLOW_SMOOTHING_SAMPLES: usize = 24;
pub const REGULAR_SMOOTHING_SAMPLES: usize = 16;
pub const FAST_SMOOTHING_SAMPLES: usize = 10;

pub const SLOW_VELOCITY_THRESHOLD: f64 = 0.003;
pub const REGULAR_VELOCITY_THRESHOLD: f64 = 0.008;
pub const FAST_VELOCITY_THRESHOLD: f64 = 0.015;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn auto_zoom_missing_field_deserializes_to_none() {
        // 旧版工程文件没有 autoZoom 字段 → 反序列化为 None（兼容铁律）。
        let value = serde_json::to_value(ProjectConfiguration::default()).unwrap();
        assert!(value.get("autoZoom").is_none(), "None must not serialize");
        let parsed: ProjectConfiguration = serde_json::from_value(value).unwrap();
        assert!(parsed.auto_zoom.is_none());
    }

    #[test]
    fn auto_zoom_preset_roundtrip() {
        let config = AutoZoomConfiguration {
            preset: Some(AutoZoomPreset::Dramatic),
            ..Default::default()
        };
        let json = serde_json::to_string(&config).unwrap();
        assert!(
            json.contains("\"dramatic\""),
            "camelCase preset, got {json}"
        );
        let parsed: AutoZoomConfiguration = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, config);
    }

    #[test]
    fn auto_zoom_resolve_default_matches_builtin_constants() {
        // None 配置 → 与既有硬编码常量完全一致（行为零变化基线）。
        let resolved = AutoZoomConfiguration::resolve(None);
        assert_eq!(resolved, ResolvedAutoZoom::default());
        assert_eq!(resolved.cluster_time_eps_ms, 1200.0);
        assert_eq!(resolved.cluster_space_eps, 0.18);
        assert_eq!(resolved.amount_min, 1.5);
        assert_eq!(resolved.amount_max, 2.8);
        assert!(resolved.dwell_enabled);
    }

    #[test]
    fn auto_zoom_resolve_priority_explicit_over_preset() {
        // 显式字段 > preset 基线：subtle 关 dwell，但显式 dwell_enabled=true 应胜出。
        let config = AutoZoomConfiguration {
            preset: Some(AutoZoomPreset::Subtle),
            dwell_enabled: Some(true),
            amount_max: Some(2.0),
            ..Default::default()
        };
        let resolved = AutoZoomConfiguration::resolve(Some(&config));
        assert!(
            resolved.dwell_enabled,
            "explicit field must override preset"
        );
        assert_eq!(resolved.amount_max, 2.0, "explicit cap wins");
        assert_eq!(resolved.amount_min, 1.4, "untouched fields follow preset");
    }

    #[test]
    fn auto_zoom_resolve_clamps_and_swaps_invalid_amounts() {
        let config = AutoZoomConfiguration {
            amount_min: Some(4.0),
            amount_max: Some(0.5), // clamp 到 1.0，且与 min 倒挂
            ..Default::default()
        };
        let resolved = AutoZoomConfiguration::resolve(Some(&config));
        assert!(resolved.amount_min <= resolved.amount_max);
        assert_eq!(resolved.amount_min, 1.0);
        assert_eq!(resolved.amount_max, 4.0);
    }

    fn write_config_with_motion_blur_values(
        project_path: &std::path::Path,
        cursor_motion_blur: f64,
        screen_motion_blur: Option<f64>,
    ) {
        let mut value = serde_json::to_value(ProjectConfiguration::default()).unwrap();
        let object = value.as_object_mut().unwrap();
        match screen_motion_blur {
            Some(value) => {
                object.insert("screenMotionBlur".to_string(), Value::from(value));
            }
            None => {
                object.remove("screenMotionBlur");
            }
        }
        object
            .get_mut("cursor")
            .unwrap()
            .as_object_mut()
            .unwrap()
            .insert("motionBlur".to_string(), Value::from(cursor_motion_blur));

        std::fs::write(
            project_path.join("project-config.json"),
            serde_json::to_string(&value).unwrap(),
        )
        .unwrap();
    }

    #[test]
    fn default_motion_blur_is_half() {
        let config = ProjectConfiguration::default();

        assert_eq!(config.cursor.motion_blur, 0.5);
        assert_eq!(config.screen_motion_blur, 0.5);
    }

    #[test]
    fn load_uses_cursor_motion_blur_when_screen_motion_blur_is_missing() {
        let dir = tempfile::tempdir().unwrap();
        write_config_with_motion_blur_values(dir.path(), 0.0, None);

        let config = ProjectConfiguration::load(dir.path()).unwrap();

        assert_eq!(config.cursor.motion_blur, 0.0);
        assert_eq!(config.screen_motion_blur, 0.0);
    }

    #[test]
    fn load_uses_cursor_motion_blur_when_screen_motion_blur_is_stale() {
        let dir = tempfile::tempdir().unwrap();
        write_config_with_motion_blur_values(dir.path(), 0.0, Some(1.0));

        let config = ProjectConfiguration::load(dir.path()).unwrap();

        assert_eq!(config.cursor.motion_blur, 0.0);
        assert_eq!(config.screen_motion_blur, 0.0);
    }

    #[test]
    fn load_caps_motion_blur_to_slider_range() {
        let dir = tempfile::tempdir().unwrap();
        write_config_with_motion_blur_values(dir.path(), 2.0, Some(2.0));

        let config = ProjectConfiguration::load(dir.path()).unwrap();

        assert_eq!(config.cursor.motion_blur, 1.0);
        assert_eq!(config.screen_motion_blur, 1.0);
    }
}
