# Cap 语义元素缩放（Semantic Zoom）· 二期 PRD「贴边框选 + 调参 + AX 异步化」v1.2

> 版本：v1.2（二期·已落地待集成验证）｜ 输出：产品经理（Agent-3）｜ 阶段：P2 MVP 落地后的视觉与体验增强
> 代码基线：`e069be47c`（`main` HEAD）+ 工作区未提交改动 **7 文件 +445/-7**（K0 采集层修复 + **T1~T5 全部已落码且 T4 已接通**，详见 9.3 状态表）。⚠️ 原始 `e069be47c` 采集层「最后一公里」编译不过（见第八节 **K0**）；本 PRD 全部事实/行号以「含全部工作区改动」为基线，实测核验。
> **v1.1 修订（与实现对齐）**：T1 已由架构师拍板方案 B 并扩展为三字段（4.1）；padding 默认值 0.15→**0.05**、范围 0~0.5（4.4/5.2，对齐 T1 拍板）；contain 数学由「乘法边距+硬 clamp」修订为「**加法边距 + amount 上限 + ≥1.0**」（5.2，对齐 `zoom.rs` 实现）；开关语义由「清空矩形」修订为「`semantic_zoom=false` 显式关闭、**保留矩形可逆**」（4.4）。
> **v1.2 修订（T4 接通核验）**：T4 调参面板**已完整接通**——`TODO(T1-wire)` 桥接类型与 `PREVIEW_FRAMED_ZOOM` 预览占位全部删除，控件经 `setProject` 直接读写真实三字段；`tauri.ts` 以**手补方式**补齐 `ElementBounds` 类型与 `ZoomSegment` 三个 camelCase 可选字段（PM 与 Rust `#[serde(rename_all = "camelCase")]` 契约逐字段核对一致）。风险 N4 闭环，残留收敛为「K1 后 specta 重生成复核手补绑定」（4.4 / 风险表）。
> 关联文档：`docs/语义元素缩放PRD与验收标准.md`（一期，本文上游）、`docs/语义元素缩放技术预研报告.md`、`docs/自动缩放调参面板设计方案.md`、`docs/商业化功能规划.md`
> 一句话定位：把一期「精准**定位**到你点的控件中心」升级为「精准**框住**整个控件矩形」——viewport 贴着按钮/输入框/工具栏的几何边界放大，而非以中心点做等比拉近。这是 Screen Studio 纯光标架构在原生应用上彻底做不到的观感跃迁。

---

## 一、背景与目标

### 1.1 二期解决什么（承接一期遗留）

一期（`e069be47c`）已打通**采集 → 数据 → 生成**的语义链路，但**渲染层只消费了元素矩形的中心点**，矩形的宽高在生成阶段就被丢弃。一期 PRD 第六节将此明确登记为两条遗留：

| 一期风险编号 | 一期描述 | 二期对应动作 |
|---|---|---|
| **K5** | 生成层 `Manual` 仅用元素**中心点**，并集矩形的宽高未驱动渲染动画——「定位更准」尚未做到「贴边框选」 | 渲染层贴边框选 + 数据契约透传矩形 |
| **K2** | 点击时**同步**调用 AX（0.25s 超时），非 `spawn_blocking` 完全异步 | AX 调用异步化 |
| （一期 2.2 Out of Scope） | 渲染层按元素矩形「贴边框选」动画 + 调参 UI 暴露语义开关 | 调参面板语义开关 + 强度 |

> 二期 = 一期路线图第七节明列的「二期」三件套的产品化落地：**`ZoomMode` 矩形渲染 + 调参面板语义开关/强度 + AX 异步化**。

### 1.2 为什么值得做（增量护城河）

- **一期的价值**：点击命中按钮 → 放大框的**中心**对准按钮中心。对近似正方形的小图标，观感已优于纯光标。
- **二期的增量价值**：对**非正方形元素**（长输入框、横向工具栏、列表行、宽对话框按钮区），"中心点 + 统一放大倍数"会出现**两端被切**或**四周留白过多**；"贴边框选"让 viewport 的可视区域**恰好包裹整个元素**（四周留统一安全边距），放大后元素完整、居中、占满——这是"录屏看起来像专业产品演示"的关键一档。
- **竞品对照**：Screen Studio 逐点击缩放是纯光标驱动的等比拉近，**没有元素几何**，永远做不到"框住一个具体控件矩形"。二期把一期已建立的差异化再拉开一个身位。

### 1.3 产品目标与北极星

- **主目标**：原生 macOS 应用录屏中，语义命中的放大段从「中心对齐」升级为「矩形贴边框选」，且对细长/大尺寸元素观感显著优于一期。
- **北极星指标**：语义框选段（携带有效元素矩形的段）占全部自动缩放段比例 ≥ 60%（原生应用为主场景），且其中**非正方形元素**（宽高比偏离 1.0 超过 1.5×）的"贴边框选"主观满意度高于一期中心点方案。
- **不可退让的底线（继承一期兜底铁律）**：任何场景体验 **≥** 一期；拿不到矩形时自动退回一期行为（中心点 / 坐标聚类），只升不降。

---

## 二、功能范围

### 2.1 本期（二期）做什么

| # | 能力 | 说明 |
|---|---|---|
| T1 | **数据契约：缩放段携带元素矩形** | 让 `ZoomSegment` 能表达「这一段要贴边框选的元素矩形」（详见 4.1 两方案对比，推荐 `Option` 兼容方案） |
| T2 | **生成层透传矩形** | `recording.rs` 语义分支把 `element_union()` 已算出的**完整矩形**透传下去（当前仅取 `center()`，宽高被丢弃，**无需重算**） |
| T3 | **渲染层贴边框选** | `zoom.rs` 的 `SegmentBounds` 计算新增「矩形 contain」分支：viewport 贴合矩形宽高 + 统一 padding，复用现有弹簧缓动与光标可见性约束 |
| T4 | **调参面板语义开关 + 强度** | `ConfigSidebar.tsx` 的 `ZoomSegmentConfig` 暴露「贴边框选 开/关」与「框选边距/强度」，并支持单段回退中心点 |
| T5 | **AX 调用异步化** | `cursor.rs` 的 AX 反查从采集线程同步调用改为 `spawn_blocking`/独立线程（消除一期 K2 的极端高频点击微抖动隐患） |

### 2.2 非本期（Out of Scope，列入后续）

| 能力 | 阶段 | 说明 |
|---|---|---|
| 视觉（ONNX）兜底 Electron/浏览器/canvas | 三期 | 一期 K3，复用 `ort`+CoreML，~10MB 模型 |
| Windows UIA 对称实现（`ElementFromPoint`+`CurrentBoundingRectangle`） | 待排期 | 一期 K4，二期 macOS 优先 |
| 停留（dwell）弱信号聚焦 | 待排期 | 代码已留接入点（`detect_dwell_clusters`，`#[allow(dead_code)]`），二期不启用 |
| 各向异性（非等比）缩放 | 暂不做 | 现渲染管线为各向同性单标量缩放，二期沿用 contain 语义（见 5.2），不改缩放维度模型 |

---

## 三、现状核验结论（二期改造基线，逐项实测 `e069be47c`）

> 本节是二期 PRD 的事实地基——每一条都经源码逐行核对，非推断。

### 3.1 数据层（无需大改，已具备）

- `ElementBounds`（`crates/project/src/cursor.rs` L34-68）：`x/y/width/height`（归一化 0–1 UV）+ `center()` / `area_ratio()` / `is_meaningful()`（`width<0.95 && height<0.95`）。**二期直接复用，无需新增几何类型**。
- `CursorClickEvent.element_bounds`（同文件 L78-79）：`Option<ElementBounds>` + `#[serde(default, skip_serializing_if = "Option::is_none")]`。**这是一期确立的向后兼容铁律**，二期 T1 推荐沿用同一模式（见 4.1）。

### 3.2 数据层 `ZoomMode` / `ZoomSegment`（待扩展）

- `ZoomMode`（`crates/project/src/configuration.rs` L672-675）：当前仅 `Auto` / `Manual { x: f32, y: f32 }`，**确无 `Element` 变体**。
- `ZoomSegment`（同文件 L645 起）：`start / end / amount / mode / glide_direction / glide_speed / instant_animation / edge_snap_ratio`，**无任何矩形字段**。

### 3.3 生成层（关键发现：矩形已现成）

- `ClickCluster::element_union()`（`apps/desktop/src-tauri/src/recording.rs` L3182-3202）：**已经算出簇内所有有效元素的并集包围盒**，返回完整 `ElementBounds { x, y, width, height }`。
- 但语义分支（同文件 L3400-3409）**只取了 `union.center()`** 喂给 `ZoomMode::Manual { x, y }`，`width/height` 当场丢弃：

```rust
        let (mode, amount) = match cluster.element_union() {
            Some(union) => {
                let (cx, cy) = union.center();
                (
                    ZoomMode::Manual {
                        x: cx.clamp(0.0, 1.0),
                        y: cy.clamp(0.0, 1.0),
                    },
                    ClickCluster::element_amount(&union),
                )
            }
            None => (ZoomMode::Auto, cluster.dynamic_amount()),
        };
```

> **结论**：二期 T2「透传矩形」**不需要任何新算法**，把 `union` 完整带下去即可——这把二期工作量与风险大幅降低。

### 3.4 渲染层（核心改造点，K5 铁证）

- `SegmentBounds::from_segment_with_cursor_constraint()`（`crates/rendering/src/zoom.rs` L59-95）：

```rust
        let is_auto_mode = matches!(segment.mode, cap_project::ZoomMode::Auto);

        let focus_pos = match segment.mode {
            cap_project::ZoomMode::Auto => (zoom_focus.x, zoom_focus.y),
            cap_project::ZoomMode::Manual { x, y } => (x as f64, y as f64),
        };

        let (effective_zoom, viewport_center) = if is_auto_mode {
            let center =
                Self::calculate_follow_center(focus_pos, segment.amount, segment.edge_snap_ratio);
            (segment.amount, center)
        } else {
            (segment.amount, focus_pos)
        };
```

- `Manual` 分支：`effective_zoom = segment.amount`（**统一标量倍数**），`viewport_center = focus_pos`（**仅中心点**）。矩形宽高完全未参与。这就是 K5 的代码铁证。
- **穷尽匹配约束**：`zoom.rs` 内 `match segment.mode` / `matches!(..., Auto)` 出现于 L64、L66、L265、L418 等处；T1 若走新枚举变体，**所有这些点都必须新增分支**才能通过编译（见 4.1 方案 A 缺点）。

### 3.5 调参面板（前端，待加 UI）

- 前端类型 `ZoomMode`（`apps/desktop/src/utils/tauri.ts` L697）：`"auto" | { manual: { x: number; y: number } }`（由 specta 从 Rust 自动生成，二期 Rust 改完此处自动更新）。
- `ZoomSegmentConfig`（`apps/desktop/src/routes/editor/ConfigSidebar.tsx` L3896 起）：单段配置 UI，含「Zoom Mode」Field（L3934，`auto` / `manual` 切换）+ 手动焦点拖拽 pad（L4160 `mode().x`）。
- `ZoomAnimationControls`（同文件 L3775，注释原文：字段"exist on the backend `ZoomSegment` but were never exposed in the editor"）——这是「把后端字段暴露到调参 UI」的**现成标准范式**，T4 照此实现即可。

### 3.6 AX 采集（K2 铁证，含 agent-2 采集层接线修复）

- **采集层接线**（工作区已改未提交）：点击**按下**瞬间 `click_element_bounds(coords, display, crop_bounds)`（`crates/recording/src/cursor.rs` L326-330）→ 回填 `CursorClickEvent.element_bounds`（L338）；顶部已 `use cap_project::{… ElementBounds …}`（L3-6）。⚠️ 此调用链是 agent-2 在 `e069be47c` 后补齐的——原始提交此处为 dead code（见 K0）。
- `ax::element_frame_at()`（同文件 L851 起）：同步 `unsafe` 块，`AXUIElementSetMessagingTimeout(_, 0.25)` + `AXUIElementCopyElementAtPosition`，最坏阻塞 0.25s。这是 K2「同步 AX」的代码事实，也是 T5 异步化的对象。

---

## 四、功能规格与改造点（严格对齐真实代码）

### 4.1 T1 数据契约 — 两方案对比（**推荐方案 B**）

二期需让「缩放段」表达「贴边框选的元素矩形」。一期路线图第七节原写法是 `ZoomMode::Element{rect}`（方案 A）。核验后，我提出更优的方案 B 并推荐：

| 维度 | 方案 A：新增 `ZoomMode::Element { x, y, width, height }` | 方案 B（推荐）：`ZoomSegment` 加 `#[serde(default, skip_serializing_if)] element_bounds: Option<ElementBounds>`，`mode` 仍为 `Manual` |
|---|---|---|
| 类型语义 | 显式、强类型 | 复用 `Manual`（中心点）+ 可选矩形增强 |
| 向后兼容（旧版 Cap 读新工程） | ❌ 旧版反序列化未知 `element` 变体**报错**（与一期 C2 同类但更严重——枚举变体不可忽略） | ✅ 多一个 `Option` 字段，旧版**忽略不报错**——与一期 `element_bounds` 完全同一兼容铁律 |
| 渲染层改动 | 所有 `match segment.mode`（L64/66/265/418…）**强制改**，漏一处不编译 | 仅 `Manual` 分支内 `if let Some(rect) = segment.element_bounds { 贴边框选 } else { 中心点 }`，其余 match 不动 |
| 回退/手动编辑 | 切回中心点需切换枚举变体 | 清空 `element_bounds` 即回退纯中心点，天然顺滑 |
| 前端类型影响 | `ZoomMode` 联合类型新增成员 | `ZoomSegment` 多一个可选字段 |
| 符合项目原则 | — | ✅ 契合 `AGENTS.md`「先复用再新增 / 稳定边界 / 向后兼容」与一期既有风格 |

> **推荐方案 B**：延续一期 `Option<ElementBounds>` 的兼容铁律，**回滚零风险**（不写矩形即等价一期），渲染层改动面最小，手动编辑回退最自然。
> **✅ 已拍板并落码（v1.1）**：架构师（Agent-2）评审采纳**方案 B**（msg `m-1781072107471`），且在 `configuration.rs` 落码时扩展为**三个 `Option` 字段**（均 `#[serde(default, skip_serializing_if)]`，兼容铁律不变）：
>
> 1. `element_bounds: Option<ElementBounds>` — 生成层写入并集矩形（贴边框选数据源）
> 2. `element_padding: Option<f64>` — 框选边距（0~0.5 UV，`None`=内置默认 `DEFAULT_ELEMENT_PADDING=0.05`，`element_padding_or_default()` 自动夹紧）
> 3. `semantic_zoom: Option<bool>` — 显式开关（`None`=开，**显式 `false` 才关**；关闭保留矩形数据，可随时再开）
>
> 生效判定收口于 `ZoomSegment::semantic_zoom_enabled()`：有有效矩形（`is_meaningful()`）且未被显式关闭。

### 4.2 T2 生成层透传矩形（`apps/desktop/src-tauri/src/recording.rs`）✅ 已落码

- 语义分支（L3400-3409）：保持 `mode = Manual { center }`（兼容现有渲染与手动编辑），**额外把 `union` 完整写入新字段** `element_bounds: Some(union)`。
- `element_amount()`（L3206-3211）按 `union.width.max(union.height)` 反推的强度**继续作为 `amount` 写入**（作为渲染 contain 的强度上限锚点 / 调参默认值）。
- 兜底分支（L3411 `None => Auto`）不变，`element_bounds` 留空。
- 单测同步：现有 `semantic_zoom_uses_manual_mode_at_element_center`（recording.rs L4112 起）需补「矩形被透传且与 `union` 一致」断言。
- **落地核验（v1.1）**：以上全部按规格实现——语义分支返回三元组 `(mode, amount, element_bounds)`，`Auto` 兜底分支矩形为 `None`；单测已补「透传矩形与 `union` 逐字段一致（1e-9 容差）」与「非语义段必须不携带矩形」两条断言。

### 4.3 T3 渲染层贴边框选（`crates/rendering/src/zoom.rs`，核心）✅ 已落码

在 `from_segment_with_cursor_constraint()` 的非 auto 分支内，当 `segment.semantic_zoom_enabled()` 且携带 `element_bounds` 时，用矩形宽高计算 viewport（contain 语义，最终数学以 5.2 v1.1 修订版为准）：

- **缩放强度**：逐轴加边距 `padded = (rect.w/h + 2·padding).min(1.0)` → `contain_zoom = min(1/padded_w, 1/padded_h)` → `zoom = contain_zoom.min(segment.amount).max(1.0)`。`amount` 退位为**放大上限**（生成层按占屏比反推 / 用户滑杆可调），不再硬 clamp 1.5~2.8——上限约束已由生成层的 `element_amount()` 范围保证。
- **viewport 中心**：`rect.center()` 后按 `half = 0.5/zoom` 夹紧到 `[half, 1-half]`——**贴屏幕边缘的元素自动内收，不露黑边**（实现增强，超出原规格）。
- **复用**：弹簧缓动 `spring_ease` / `ensure_cursor_visible(_gentle)` 光标可见性约束**全部复用**，二期不碰缓动物理。
- 无矩形或被显式关闭时 → 原 `Manual` 中心点逻辑（行为等价一期）。
- **落地核验（v1.1）**：已实现并新增 ~7 个语义单测（contain 贴合含边距 / amount 上限 / 边缘夹紧 / 显式关闭回退 / 旧段回归等），原 ~15 个 `SegmentBounds` 单测结构兼容（仅补三个 `None` 字段）。

### 4.4 T4 调参面板（`apps/desktop/src/routes/editor/ConfigSidebar.tsx`）✅ 已接通（v1.2）

在 `ZoomSegmentConfig` 的 `ZoomAnimationControls` 之后挂载 `ZoomSemanticControls`（设计师 agent-5 交付，范式 100% 对齐既有 Field/Slider/Toggle/KCollapsible + `~icons` SVG，零 Emoji）：

- **「贴边框选」开关**（`Toggle`，文案 `Snap to Element`）：绑定 `semanticZoom ?? true`（**v1.1 修订**：关闭 = 显式置 `semanticZoom=false`、**保留矩形数据可逆再开**，不再清空 `element_bounds`——对齐 T1 拍板，比"清空矩形"更优）。仅在该段**携带矩形**时可用，否则整组置灰并提示「此段未命中 UI 元素」。
- **「框选边距 padding」滑块**（**v1.1 修订**，文案 `Framing Padding`）：默认 **0.05**（= 后端 `DEFAULT_ELEMENT_PADDING`），字段范围 0~0.5，UI 滑杆 0~30%。
- **「强度上限 amount」**：复用现有 `amount` 滑块（已存在），文案补充「语义段的实际放大会在框选 fit 与此上限间取约束」，**不新增独立强度控件**（T1 拍板）。
- 录制级**全局默认开关**：在录制/项目设置处提供「默认开启语义框选」（兜底已是代码默认，UI 仅显式入口），对应一期上线建议第 2 条。**本项未随接通落地，列入后续**。
- **✅ 已接通（v1.2 核验）**：`TODO(T1-wire)` 桥接类型与 `PREVIEW_FRAMED_ZOOM` 预览占位**已全部删除**（全仓搜索零残留）；开关与滑块经 `setProject("timeline","zoomSegments",idx,"semanticZoom"/"elementPadding",v)` 直接读写真实字段。前端类型由 `tauri.ts` **手补**：新增 `ElementBounds = { x, y, width, height }` 与 `ZoomSegment` 三个可选字段 `elementBounds`/`elementPadding`/`semanticZoom`——PM 已与 Rust 侧 `#[serde(rename_all = "camelCase")]`（`configuration.rs` / `cursor.rs`）逐字段核对一致。biome / `tsc --noEmit` 复验全绿。**残留**：K1 解除后跑 specta 重生成，复核自动生成结果与手补完全一致（预期一致，零风险项）。

### 4.5 T5 AX 异步化（`crates/recording/src/cursor.rs`，K2）✅ 已落码

- 现状（改造前）：采集侧点击 down 同步调 `click_element_bounds` → `ax::element_frame_at`（同步 unsafe，0.25s 超时上限），最坏阻塞 16ms 采集节拍约 15 帧。
- **落地并发模型（架构师实现，v1.1 核验）**：
  1. 点击按下 → 事件以 `element_bounds: None` 占位**立即入列**（时间戳不受 AX 影响）；
  2. AX 反查投递 `tokio::task::spawn_blocking`，坐标取按下瞬间快照，**以事件索引锁定归属**（`unbounded_channel<(usize, Option<ElementBounds>)>` 回传）——时序零错配（满足 P5 硬约束）；
  3. 采集循环内 `try_recv()` 非阻塞回填；
  4. 录制结束后排水：等未完成反查回流（1s 总余量防呆），超时放弃、`None` 占位即兜底。
- 保留 0.25s 消息超时与 `CFType`(create rule) 内存托管不变；macOS-only 分支不变，非 macOS 仍返回 `None`。
- 验收口径见 6.3 P5（连点采样 ≈60Hz + 矩形零错配，待真机）。

---

## 五、关键设计决策

### 5.1 为什么"透传"而非"重算"

核验证实 `element_union()`（recording.rs L3182）已产出完整并集矩形，一期只是在 `Manual` 分支丢了宽高。**二期的矩形是免费的现成数据**，T2 仅是"别丢"，这是二期低风险的根本原因。

### 5.2 贴边框选的数学模型（各向同性 contain）【v1.1 已按实现修订】

现渲染为**各向同性单标量缩放**（`effective_zoom` 是标量，见 zoom.rs L71-77），元素矩形宽高比任意。为保证**整个矩形完整可见**，采用 contain 语义。最终落地实现（`zoom.rs`）：

```text
padding      = segment.element_padding ?? 0.05        // 加法边距（UV），T4 滑块可调，clamp 0~0.5
padded_w     = min(rect.width  + 2*padding, 1.0)
padded_h     = min(rect.height + 2*padding, 1.0)
contain_zoom = min(1/padded_w, 1/padded_h)            // 逐轴 fit 取小者 → 含边距矩形完整入框
zoom         = max(min(contain_zoom, segment.amount), 1.0)  // amount 退位为放大上限；下限 1.0 防缩小
cx, cy       = rect.center()
half         = 0.5 / zoom
center       = (clamp(cx, half, 1-half), clamp(cy, half, 1-half))  // 贴边元素内收，不露黑边
// 再经现有 ensure_cursor_visible 约束，保证光标始终可见
```

与 v1.0 草案的三处差异（均为实现侧更优，产品确认采纳）：

| 项 | v1.0 草案 | v1.1 落地 | 理由 |
|---|---|---|---|
| 边距 | 乘法 `long_side×(1+2p)`，默认 0.15 | **加法 `side+2p`，默认 0.05** | 加法边距对大小元素留白绝对量一致，观感更稳；默认值经 T1 评审下调贴更紧 |
| 强度范围 | 硬 `clamp(1.5, 2.8)` | **`min(amount)` + `max(1.0)`** | 1.5~2.8 已由生成层 `element_amount()` 保证；渲染端硬 clamp 会让"大元素 contain<1.5"被强行放大反而裁切元素 |
| 视口中心 | 仅 `rect.center()` | **中心夹紧 `[half, 1-half]`** | 屏幕边缘元素不露黑边 |

- 对**近似正方形小控件**：行为≈一期（长短边相近，contain 与中心点等比拉近接近）。
- 对**细长/大元素**：contain 保证长边方向完整入框、四周等距留白 → 这正是二期相对一期的肉眼增量。
- **不引入各向异性**（不分别缩放 x/y）：避免破坏现有缩放管线与所有 `SegmentBounds` 单测（zoom.rs L688-1164 共 ~15 个），保持回归面可控。

### 5.3 向后兼容（方案 B 落地后）

- 旧工程（无新字段）：三字段反序列化均 `None` → 走中心点 → 等价一期。
- 新工程被旧版 Cap 打开：`Option + skip_serializing_if` → 旧版忽略未知字段，按 `Manual` 中心点渲染，**不报错不崩溃**（继承一期 C2 容错）。
- 关闭语义框选（v1.1）= 显式 `semantic_zoom=false`（保留矩形、可逆）→ 渲染走一期中心点路径；彻底回滚 = 生成层不写矩形，**回滚零代码风险**。

### 5.4 与手动编辑的关系

用户在调参面板拖拽焦点 pad（ConfigSidebar L4160）调整中心时，可选择保留或清除矩形；清除后该段变为纯手动中心点，符合"自动建议 + 人工微调"的编辑器心智。

---

## 六、验收标准（可量化、可执行）

> 图例：✅ 必须通过（阻断上线）｜ ⬜ 建议通过（记录为已知项）

### 6.1 功能正确性

| # | 验收项 | 判定标准 | 优先级 |
|---|---|---|:--:|
| F1 | 细长元素贴边框选 | 点击长输入框/横向工具栏 → 放大后**整个元素完整可见且居中**，四周边距≈padding，**无两端被切** | ✅ |
| F2 | 小图标 | 点 ≤24pt 图标 → 放大趋近 `AMOUNT_MAX`，观感不低于一期 | ✅ |
| F3 | 大面板可点区 | 点占屏 >50% 面板 → 放大趋近 `AMOUNT_MIN`，不过度放大 | ✅ |
| F4 | 并集多控件 | 同簇点相邻多控件 → viewport 框住**并集矩形**，无抖动跳变 | ✅ |
| F5 | 矩形透传一致性 | 生成的段 `element_bounds` 与 `element_union()` 输出逐字段一致（单测） | ✅ |
| F6 | 单段回退 | 调参面板关「贴边框选」→ 立即回退中心点放大，无报错 | ✅ |

### 6.2 观感（差异化价值，主观 + 可复核）

| # | 验收项 | 判定标准 | 优先级 |
|---|---|---|:--:|
| V1 | 二期 vs 一期 A/B | 同一录制，非正方形元素段二期主观观感 **≥** 一期（盲评不劣，目标更优） | ✅ |
| V2 | 缓动连续性 | 进入/退出框选段无跳变、无回弹突兀（复用弹簧，回归 zoom.rs 单测全绿） | ✅ |
| V3 | 光标始终可见 | 框选放大后光标不被裁出视口（`ensure_cursor_visible` 生效） | ✅ |

### 6.3 性能与稳定性

| # | 验收项 | 判定标准 | 优先级 |
|---|---|---|:--:|
| P1 | 渲染无新增掉帧 | 预览/导出帧率不低于一期，contain 计算为常数级开销 | ✅ |
| P5 | AX 异步化（K2） | 异步后采集线程不再因 AX 阻塞；极端高频点击（连点）采样仍 ≈60Hz；矩形与点击时序**零错配** | ✅ |
| P3 | 内存无泄漏 | 长录制 AX 对象正常释放（`CFType` 托管不变） | ⬜ |

### 6.4 兼容性

| # | 验收项 | 判定标准 | 优先级 |
|---|---|---|:--:|
| C1 | 旧工程回放 | 一期及更早工程（无 `element_bounds`）打开/重生成 → 全部走中心点，正常 | ✅ |
| C2 | 新工程跨旧版 | 新 `project-config` 含矩形字段，旧版 Cap 读取忽略不报错（`Option` 容错） | ⬜ |
| C3 | 多段录制 | 跨段矩形归一正确，连续无错位 | ✅ |

### 6.5 永不退步（兜底铁律 · 一票否决，继承一期 R1/R2）

| # | 验收项 | 判定标准 | 优先级 |
|---|---|---|:--:|
| R1 | 全场景不劣于一期 | 任一录制开启二期后体验 **≥** 一期；「比一期差」即不通过 | ✅ |
| R2 | 无新增权限/依赖 | 不引入 P0/一期之外的新系统授权或新 crate（AX 既有、矩形复用） | ✅ |

---

## 七、真机验收清单（GUI 实操，逐条勾选）

> 前置：可用 Xcode 环境完成整包构建（一期 K1 仍是前置阻塞），已授予「屏幕录制 + 辅助功能」权限。验收后删除临时录制。

### 7.1 贴边框选矩阵（验 F1/V1）

- [ ] **长输入框**（如 Safari 地址栏、设置搜索框）：点击 → 整框完整入画、左右不切、四周留白均匀
- [ ] **横向工具栏**（Finder/备忘录工具栏）：点击 → 工具栏带宽完整可见
- [ ] **列表行 / 宽按钮**（系统设置左栏条目）：点击 → 行矩形贴边，非仅中心
- [ ] **小图标**（≤24pt）：放大趋近上限，不低于一期
- [ ] **大面板可点区**：放大趋近下限，不过度

### 7.2 A/B 与回退（验 V1/F6）

- [ ] 同一录制：开/关「贴边框选」对比，非正方形段二期观感不劣
- [ ] 单段关闭语义 → 即时回退中心点，无报错无空段

### 7.3 兼容与稳定（验 C1/P5）

- [ ] 一期工程重生成 → 全走中心点正常（C1）
- [ ] 连点压力（短时密集点击）→ 采样不掉帧、矩形与点击不错配（P5）
- [ ] 无响应 App 上点击 → 0.25s 超时降级，录制不中断

### 7.4 验收结论模板

| 维度 | 通过/不通过 | 实测数据 | 备注 |
|---|:--:|---|---|
| 功能 F1–F6 |  |  |  |
| 观感 V1–V3 |  | 非正方形段 A/B 盲评 ___ |  |
| 性能 P1/P5 |  | 连点采样率 ___Hz |  |
| 兼容 C1/C3 |  |  |  |
| 永不退步 R1/R2 |  |  |  |

---

## 八、已知风险与限制（诚实披露）

| # | 风险 | 现状/影响 | 处置 |
|---|---|---|---|
| K0 | **一期采集层接线缺陷（已修复待提交）** | 原始 `e069be47c` 的 `crates/recording/src/cursor.rs` **未接线即提交**：`click_element_bounds` 为 dead code、`CursorClickEvent` 缺 `element_bounds`（E0063）、缺 `ElementBounds` import → **编译不过**（因 Xcode 阻塞从未真编译）。agent-2 已接线修复，且 T5 异步化已基于此修复叠加完成（同文件，工作区未提交） | 修复 + T5 经 Xcode 集成验证后随二期一并提交 |
| K1（继承） | **整包编译前置未完成（当前唯一硬阻塞）** | `cap-recording` 完整构建受 `cidre`/Xcode 环境阻塞（实测本机仅 CommandLineTools）→ 三件事被卡：①采集/生成层集成编译验证 ②specta 重生成复核手补绑定（v1.2 后降为复核项）③真机端到端验收 | 上线前必须在可用 Xcode 环境补整包构建 + 第七节清单（环境依赖，非代码缺口） |
| ~~N1~~ | ~~数据契约方案待评审~~ **已闭环** | 架构师已拍板方案 B 并落码（4.1 v1.1），三字段 `Option` 兼容铁律 | 无残留 |
| N2 | **各向同性约束** | 现管线单标量缩放，细长元素 contain 后短边方向留白偏多（非裁切，属安全侧） | padding 可调；各向异性列入暂不做（2.2） |
| N3 | **AX 异步时序** | **已按「事件索引锁定 + channel 回传」实现**（4.5），逻辑上零错配 | 残留：真机连点压力实测（7.3 / P5）后销项 |
| ~~N4~~ | ~~T4 前端未接通~~ **已闭环（v1.2）** | 占位全部删除、真实字段直接读写，`tauri.ts` 手补类型与 Rust serde 契约逐字段核对一致，biome/tsc 全绿 | 残留降级：K1 后 specta 重生成复核手补一致性（预期零差异） |
| K3（继承） | Electron/浏览器/canvas 命中低 | 这类 App 无矩形 → 自动走中心点/坐标兜底（不退步） | 三期视觉兜底 |
| K4（继承） | Windows 无语义缩放 | 非 macOS 返回 None | 待排期 UIA 对称补齐 |

---

## 九、工作量、排期与协作分工

### 9.1 工作量评估（细化一期路线图「3–4 人日」）

| 任务 | 落点 | 预估 | 备注 |
|---|---|:--:|---|
| T1 数据契约（方案 B） | `configuration.rs` + specta 前端类型 | 0.5 人日 | 加 `Option` 字段 + 评审 |
| T2 生成层透传 | `recording.rs` L3400 区 + 单测 | 0.5 人日 | 矩形现成，仅"别丢" |
| T3 渲染贴边框选 | `zoom.rs` `SegmentBounds` + 单测 | 1.5 人日 | 核心，contain 数学 + 回归 |
| T4 调参面板 | `ConfigSidebar.tsx` `ZoomSegmentConfig` | 1 人日 | 复用现成范式 |
| T5 AX 异步化 | `cursor.rs` AX 调用 | 1 人日 | 并发模型 + 时序保证 |
| 集成 + 真机回归 | 整包构建 + 第七节 | 0.5–1 人日 | **依赖 Xcode 环境（K1）** |
| **合计** | | **≈ 5–5.5 人日** | 含调参 UI 与异步化 |

### 9.2 协作分工

| 角色 | 职责 | 状态 |
|---|---|:--:|
| 产品经理（Agent-3） | 本二期 PRD + 验收标准 + 真机清单 + v1.1/v1.2 落地核验修订 | ✅ 已交付 |
| 资深全栈架构师（Agent-2） | T1 方案评审拍板 + T1/T2/T3/T5 实现 + 整包构建（K1） | ✅ T1~T3/T5 已落码｜⏳ K1 待 Xcode |
| UX/UI 设计师（Agent-5） | T4 语义开关/边距滑块的交互与视觉细化 | ✅ 已接通（占位删除 + 真实字段读写，v1.2 核验） |
| 老板 / QA | 第七节真机清单实操签字（需 Xcode + GUI） | 待办（环境依赖） |

### 9.3 落地顺序与状态（v1.2）

| 步骤 | 内容 | 状态 | 验证 |
|---|---|:--:|---|
| 0 | K0 采集层接线修复 | ✅ 已落码（未提交） | `cargo check -p cap-project` 绿；集成编译待 Xcode |
| 1 | T1 数据契约（方案 B 三字段） | ✅ 已拍板 + 落码 | `cargo test -p cap-project` 25 测全绿（v1.2 复跑仍绿） |
| 2 | T2 生成层透传 + 单测 | ✅ 已落码 | 单测随 `cap-desktop` 整包，受 K1 阻塞 |
| 3 | T3 渲染 contain + 回归 | ✅ 已落码 | ⚠️ `cargo test -p cap-rendering` 实测被 `cidre` build.rs 卡（依赖链含 cidre，xcodebuild 需完整 Xcode）——T3 单测验证并入 K1 |
| 4 | T4 调参面板 | ✅ **已接通（v1.2）** | 占位零残留；`tauri.ts` 手补契约逐字段核对一致；biome / `tsc --noEmit` 复验全绿；K1 后 specta 重生成复核 |
| 5 | T5 AX 异步化 | ✅ 已落码 | 逻辑核验通过；连点压力待真机 |
| 6 | Xcode 整包构建 + 真机清单签字 | ⏳ **唯一硬阻塞** | 需可用 Xcode 环境 + GUI 实操 |

---

> 备注（v1.2）：二期 T1~T5 **已全部落码且 T4 已接通**（工作区 7 文件未提交 +445/-7：`configuration.rs` / `recording.rs` / `zoom.rs` / `zoom_focus_interpolation.rs` / `cursor.rs` / `ConfigSidebar.tsx` / `tauri.ts`），本文已由"开工前规格"修订为**落地核验基线**。全部代码引用经工作区实际 diff 逐行核对（文件 + 行号），无拍脑袋。剩余收尾 = K1（Xcode 集成编译 + specta 重生成复核 + T3 单测）+ 第七节真机验收 + git 提交决策。
