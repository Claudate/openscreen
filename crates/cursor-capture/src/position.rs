use device_query::{DeviceQuery, DeviceState};
use scap_targets::{Display, bounds::*};

// Physical on Windows, Logical on macOS
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct RawCursorPosition {
    x: i32,
    y: i32,
}

impl RawCursorPosition {
    pub fn get() -> Self {
        let device_state = DeviceState::new();
        let position = device_state.get_mouse().coords;

        Self {
            x: position.0,
            y: position.1,
        }
    }

    /// 从任意全局坐标构造，坐标系与 [`RawCursorPosition::get`] 完全一致
    /// （macOS 为逻辑坐标、Windows 为物理坐标，top-left 原点）。
    ///
    /// 用途：把无障碍 API（macOS AX / Windows UIA）反查到的元素矩形角点，
    /// 喂入与光标相同的 `relative_to_display → normalize → with_crop` 换算链，
    /// 保证语义缩放的元素坐标与现有光标坐标对齐到同一 UV 空间。
    pub fn new(x: i32, y: i32) -> Self {
        Self { x, y }
    }

    pub fn relative_to_display(&self, display: Display) -> Option<RelativeCursorPosition> {
        RelativeCursorPosition::from_raw(*self, display)
    }
}

// relative to display using top-left origin
#[derive(Clone, Copy)]
pub struct RelativeCursorPosition {
    x: i32,
    y: i32,
    display: Display,
}

impl RelativeCursorPosition {
    pub fn from_raw(raw: RawCursorPosition, display: Display) -> Option<Self> {
        #[cfg(windows)]
        {
            let physical_bounds = display.raw_handle().physical_bounds()?;

            Some(Self {
                x: raw.x - physical_bounds.position().x() as i32,
                y: raw.y - physical_bounds.position().y() as i32,
                display,
            })
        }

        #[cfg(target_os = "macos")]
        {
            let logical_bounds = display.raw_handle().logical_bounds()?;

            Some(Self {
                x: raw.x - logical_bounds.position().x() as i32,
                y: raw.y - logical_bounds.position().y() as i32,
                display,
            })
        }
    }

    pub fn display(&self) -> &Display {
        &self.display
    }

    pub fn normalize(&self) -> Option<NormalizedCursorPosition> {
        #[cfg(windows)]
        {
            let bounds = self.display().raw_handle().physical_bounds()?;
            let size = bounds.size();

            Some(NormalizedCursorPosition {
                x: self.x as f64 / size.width(),
                y: self.y as f64 / size.height(),
                crop: CursorCropBounds {
                    x: 0.0,
                    y: 0.0,
                    width: size.width(),
                    height: size.height(),
                },
                display: self.display,
            })
        }

        #[cfg(target_os = "macos")]
        {
            let bounds = self.display().raw_handle().logical_bounds()?;
            let size = bounds.size();

            Some(NormalizedCursorPosition {
                x: self.x as f64 / size.width(),
                y: self.y as f64 / size.height(),
                crop: CursorCropBounds {
                    x: 0.0,
                    y: 0.0,
                    width: size.width(),
                    height: size.height(),
                },
                display: self.display,
            })
        }
    }
}

impl std::fmt::Debug for RelativeCursorPosition {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RelativeCursorPosition")
            .field("x", &self.x)
            .field("y", &self.y)
            .finish()
    }
}

#[derive(Clone, Copy, Debug)]
/// Needs to be logical coordinates on macOS and physical on Windows
/// This type is opqaue on purpose as the logical/physical invariants need to hold
pub struct CursorCropBounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

impl CursorCropBounds {
    #[cfg(target_os = "macos")]
    pub fn new_macos(bounds: LogicalBounds) -> Self {
        Self {
            x: bounds.position().x(),
            y: bounds.position().y(),
            width: bounds.size().width(),
            height: bounds.size().height(),
        }
    }

    #[cfg(target_os = "windows")]
    pub fn new_windows(bounds: PhysicalBounds) -> Self {
        Self {
            x: bounds.position().x(),
            y: bounds.position().y(),
            width: bounds.size().width(),
            height: bounds.size().height(),
        }
    }

    pub fn x(&self) -> f64 {
        self.x
    }

    pub fn y(&self) -> f64 {
        self.y
    }

    pub fn width(&self) -> f64 {
        self.width
    }

    pub fn height(&self) -> f64 {
        self.height
    }
}

pub struct NormalizedCursorPosition {
    x: f64,
    y: f64,
    crop: CursorCropBounds,
    display: Display,
}

impl NormalizedCursorPosition {
    pub fn x(&self) -> f64 {
        self.x
    }

    pub fn y(&self) -> f64 {
        self.y
    }

    pub fn display(&self) -> &Display {
        &self.display
    }

    pub fn crop(&self) -> CursorCropBounds {
        self.crop
    }

    pub fn with_crop(&self, crop: CursorCropBounds) -> Self {
        let raw_px = (
            self.x * self.crop.width + self.crop.x,
            self.y * self.crop.height + self.crop.y,
        );

        Self {
            x: (raw_px.0 - crop.x) / crop.width,
            y: (raw_px.1 - crop.y) / crop.height,
            crop,
            display: self.display,
        }
    }
}

impl std::fmt::Debug for NormalizedCursorPosition {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("NormalizedCursorPosition")
            .field("x", &self.x)
            .field("y", &self.y)
            .finish()
    }
}
