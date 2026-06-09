use cap_audio::AudioData;

fn play_audio(bytes: &'static [u8]) {
    use rodio::{Decoder, OutputStream, Sink};
    use std::io::Cursor;

    std::thread::spawn(move || {
        if let Ok((_, stream)) = OutputStream::try_default() {
            let file = Cursor::new(bytes);
            let source = Decoder::new(file).unwrap();
            let sink = Sink::try_new(&stream).unwrap();
            sink.append(source);
            sink.sleep_until_end();
        }
    });
}

#[allow(dead_code)]
pub enum AppSounds {
    StartRecording,
    StopRecording,
    Screenshot,
    Notification,
}

impl AppSounds {
    pub fn play(&self) {
        let bytes = self.get_sound_bytes();
        play_audio(bytes);
    }

    fn get_sound_bytes(&self) -> &'static [u8] {
        match self {
            AppSounds::StartRecording => include_bytes!("../sounds/start-recording.ogg"),
            AppSounds::StopRecording => include_bytes!("../sounds/stop-recording.ogg"),
            AppSounds::Screenshot => include_bytes!("../sounds/screenshot.ogg"),
            AppSounds::Notification => include_bytes!("../sounds/action.ogg"),
        }
    }
}

/// 波形每个采样点代表的时长（秒）。get_waveform 以 SAMPLE_RATE/10 为块长，故每点 = 100ms。
pub const WAVEFORM_BUCKET_SECONDS: f64 = 0.1;

pub fn get_waveform(audio: &AudioData) -> Vec<f32> {
    const CHUNK_SIZE: usize = (cap_audio::AudioData::SAMPLE_RATE as usize) / 10; // ~100ms

    let channels = audio.channels() as usize;
    let samples = audio.samples();
    let mut waveform = Vec::new();

    let mut i = 0;
    while i < samples.len() {
        let end = (i + CHUNK_SIZE * channels).min(samples.len());
        let mut sum = 0.0f32;
        for s in &samples[i..end] {
            sum += s.abs();
        }
        let avg = if end > i { sum / (end - i) as f32 } else { 0.0 };
        waveform.push(avg);
        i += CHUNK_SIZE * channels;
    }

    // Convert to absolute dBFS (0 dBFS = digital full scale)
    for v in waveform.iter_mut() {
        *v = if *v > 0.0 {
            20.0 * v.log10() // Absolute dBFS relative to 1.0
        } else {
            -60.0 // Set silence to -60dBFS instead of -∞ for practical use
        };
    }

    waveform
}

// === 自动静音移除：检测算法 ===
// 设计：消费 get_waveform 输出的 dBFS 序列（每点 100ms），找出「持续低于响度阈值且足够长」的静音段，
// 输出可被时间轴消费的删除区间（秒）。执行端用编辑器既有的 splitClipSegment + deleteClipSegment 落地。
// 纯逻辑、零外部依赖，可离线单测，与渲染/ffmpeg 解耦（对标 Loom 的 remove-silence）。

/// 一段静音区间（单位：秒，相对该音轨起点）。
#[derive(Clone, Copy, Debug, PartialEq, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SilenceSpan {
    pub start: f64,
    pub end: f64,
}

impl SilenceSpan {
    pub fn duration(&self) -> f64 {
        (self.end - self.start).max(0.0)
    }
}

/// 静音检测可调参数（前端调参面板可直连）。
#[derive(Clone, Copy, Debug, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SilenceDetectOptions {
    /// 响度阈值（dBFS）。低于此值的帧视为「静音帧」。默认 -40：比纯数字静音(-60)宽容，覆盖真实环境底噪。
    pub threshold_db: f32,
    /// 最短静音时长（秒）。短于此的静音段保留（正常语句停顿不删），默认 0.5s。
    pub min_silence_seconds: f64,
    /// 边缘保留（秒）。静音段两端各保留这么久，避免切到话音首尾、产生咔哒感，默认 0.1s。
    pub edge_padding_seconds: f64,
}

impl Default for SilenceDetectOptions {
    fn default() -> Self {
        Self {
            threshold_db: -40.0,
            min_silence_seconds: 0.5,
            edge_padding_seconds: 0.1,
        }
    }
}

/// 从 dBFS 波形序列检测静音区间。
///
/// 算法：
/// 1) 逐帧判定 loud / quiet（dBFS 是否 ≥ 阈值）；
/// 2) 把连续 quiet 帧聚成候选静音段 [start_idx, end_idx)；
/// 3) 过滤掉时长 < min_silence 的候选（保留正常停顿）；
/// 4) 每段向内收缩 edge_padding（两端各留白），收缩后仍 > 0 才输出。
///
/// 时间换算：帧索引 i 对应区间 [i*bucket, (i+1)*bucket)，bucket = WAVEFORM_BUCKET_SECONDS。
pub fn detect_silence_segments(
    waveform: &[f32],
    opts: SilenceDetectOptions,
) -> Vec<SilenceSpan> {
    let bucket = WAVEFORM_BUCKET_SECONDS;
    if waveform.is_empty() || bucket <= 0.0 {
        return Vec::new();
    }

    let min_buckets = (opts.min_silence_seconds / bucket).ceil() as usize;
    // 每端要收缩的帧数（向内取整，避免过度收缩把短静音段抹没）。
    let pad_buckets = (opts.edge_padding_seconds / bucket).floor() as usize;

    let mut spans: Vec<SilenceSpan> = Vec::new();
    let mut run_start: Option<usize> = None;

    let flush = |start: usize, end_exclusive: usize, out: &mut Vec<SilenceSpan>| {
        let len = end_exclusive - start;
        if len < min_buckets || len == 0 {
            return;
        }
        // 向内收缩：两端各去掉 pad_buckets 帧。若收缩后无剩余则丢弃。
        if len <= pad_buckets * 2 {
            return;
        }
        let inner_start = start + pad_buckets;
        let inner_end = end_exclusive - pad_buckets;
        let start_s = inner_start as f64 * bucket;
        let end_s = inner_end as f64 * bucket;
        if end_s > start_s {
            out.push(SilenceSpan {
                start: start_s,
                end: end_s,
            });
        }
    };

    for (i, &db) in waveform.iter().enumerate() {
        let is_quiet = db < opts.threshold_db;
        match (is_quiet, run_start) {
            (true, None) => run_start = Some(i),
            (false, Some(start)) => {
                flush(start, i, &mut spans);
                run_start = None;
            }
            _ => {}
        }
    }
    // 收尾：序列以静音结束。
    if let Some(start) = run_start {
        flush(start, waveform.len(), &mut spans);
    }

    spans
}

/// 逐帧取两条 dBFS 波形的较大响度（响度高=非静音）。
/// 用于合并麦克风与系统音频：只有「两者都安静」的帧才会被判定为静音。
/// 长度不一致时以较长者为准，缺失帧按 -60dBFS（数字静音）补齐。
pub fn max_dbfs_per_bucket(a: &[f32], b: &[f32]) -> Vec<f32> {
    const DIGITAL_SILENCE_DB: f32 = -60.0;
    let len = a.len().max(b.len());
    let mut out = Vec::with_capacity(len);
    for i in 0..len {
        let av = a.get(i).copied().unwrap_or(DIGITAL_SILENCE_DB);
        let bv = b.get(i).copied().unwrap_or(DIGITAL_SILENCE_DB);
        out.push(av.max(bv));
    }
    out
}

/// 把「删除静音」转成「保留区间」(keep ranges)，给时间轴 split/delete 链路或导出用。
/// 输入静音段（须已按 start 升序、不重叠），总时长 total_seconds；输出补集（要保留的片段）。
pub fn silence_to_keep_ranges(
    silences: &[SilenceSpan],
    total_seconds: f64,
) -> Vec<SilenceSpan> {
    let mut keeps: Vec<SilenceSpan> = Vec::new();
    let mut cursor = 0.0_f64;
    for s in silences {
        if s.start > cursor {
            keeps.push(SilenceSpan {
                start: cursor,
                end: s.start.min(total_seconds),
            });
        }
        cursor = cursor.max(s.end);
    }
    if cursor < total_seconds {
        keeps.push(SilenceSpan {
            start: cursor,
            end: total_seconds,
        });
    }
    keeps
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 构造 dBFS 序列：loud 段用 -10，quiet 段用 -55。
    fn waveform_from_pattern(pattern: &[(bool, usize)]) -> Vec<f32> {
        let mut v = Vec::new();
        for &(quiet, count) in pattern {
            let db = if quiet { -55.0 } else { -10.0 };
            for _ in 0..count {
                v.push(db);
            }
        }
        v
    }

    #[test]
    fn empty_waveform_yields_no_silence() {
        assert!(detect_silence_segments(&[], SilenceDetectOptions::default()).is_empty());
    }

    #[test]
    fn all_loud_yields_no_silence() {
        let wf = waveform_from_pattern(&[(false, 50)]);
        assert!(detect_silence_segments(&wf, SilenceDetectOptions::default()).is_empty());
    }

    #[test]
    fn short_pause_is_preserved() {
        // 10 帧 loud + 3 帧 quiet(300ms < 500ms min) + 10 帧 loud → 不删。
        let wf = waveform_from_pattern(&[(false, 10), (true, 3), (false, 10)]);
        let spans = detect_silence_segments(&wf, SilenceDetectOptions::default());
        assert!(spans.is_empty(), "300ms pause must be preserved, got {spans:?}");
    }

    #[test]
    fn long_silence_is_detected_with_edge_padding() {
        // 10 帧 loud + 20 帧 quiet(2s) + 10 帧 loud。
        // quiet 区间索引 [10,30)；默认 edge_padding=0.1s=1帧 → 收缩到 [11,29) = 1.1s..2.9s。
        let wf = waveform_from_pattern(&[(false, 10), (true, 20), (false, 10)]);
        let spans = detect_silence_segments(&wf, SilenceDetectOptions::default());
        assert_eq!(spans.len(), 1);
        assert!((spans[0].start - 1.1).abs() < 1e-9, "start={}", spans[0].start);
        assert!((spans[0].end - 2.9).abs() < 1e-9, "end={}", spans[0].end);
    }

    #[test]
    fn trailing_silence_is_detected() {
        // 以静音结尾：5 帧 loud + 12 帧 quiet(1.2s)。收缩 1 帧 → [6,16)=0.6s..1.6s。
        let wf = waveform_from_pattern(&[(false, 5), (true, 12)]);
        let spans = detect_silence_segments(&wf, SilenceDetectOptions::default());
        assert_eq!(spans.len(), 1);
        assert!((spans[0].start - 0.6).abs() < 1e-9, "start={}", spans[0].start);
        assert!((spans[0].end - 1.6).abs() < 1e-9, "end={}", spans[0].end);
    }

    #[test]
    fn multiple_silences_are_split() {
        // loud / quiet(1s) / loud / quiet(1s) / loud → 两段。
        let wf = waveform_from_pattern(&[
            (false, 8),
            (true, 10),
            (false, 8),
            (true, 10),
            (false, 8),
        ]);
        let spans = detect_silence_segments(&wf, SilenceDetectOptions::default());
        assert_eq!(spans.len(), 2, "expected two silences, got {spans:?}");
    }

    #[test]
    fn threshold_controls_sensitivity() {
        // 一段 -45dBFS（中等安静）：默认阈值 -40 → 视为静音；阈值收紧到 -50 → 不算。
        let wf: Vec<f32> = std::iter::repeat_n(-45.0_f32, 20).collect();
        let detected_default = detect_silence_segments(&wf, SilenceDetectOptions::default());
        assert_eq!(detected_default.len(), 1, "-45 should be silent at -40 thresh");

        let strict = SilenceDetectOptions {
            threshold_db: -50.0,
            ..SilenceDetectOptions::default()
        };
        let detected_strict = detect_silence_segments(&wf, strict);
        assert!(
            detected_strict.is_empty(),
            "-45 should NOT be silent at -50 thresh, got {detected_strict:?}"
        );
    }

    #[test]
    fn keep_ranges_are_complement_of_silence() {
        // 总时长 10s，静音 [3,5) → 保留 [0,3) 和 [5,10)。
        let silences = vec![SilenceSpan { start: 3.0, end: 5.0 }];
        let keeps = silence_to_keep_ranges(&silences, 10.0);
        assert_eq!(keeps.len(), 2);
        assert_eq!(keeps[0], SilenceSpan { start: 0.0, end: 3.0 });
        assert_eq!(keeps[1], SilenceSpan { start: 5.0, end: 10.0 });
    }

    #[test]
    fn keep_ranges_handle_leading_and_trailing_silence() {
        // 静音覆盖首尾：[0,2) 和 [8,10)，总 10s → 只保留中间 [2,8)。
        let silences = vec![
            SilenceSpan { start: 0.0, end: 2.0 },
            SilenceSpan { start: 8.0, end: 10.0 },
        ];
        let keeps = silence_to_keep_ranges(&silences, 10.0);
        assert_eq!(keeps.len(), 1);
        assert_eq!(keeps[0], SilenceSpan { start: 2.0, end: 8.0 });
    }

    #[test]
    fn combined_audio_keeps_segment_loud_in_either_track() {
        // 麦克风安静但系统音频有声 → 合并后该帧应判为「响」，不算静音。
        let mic = waveform_from_pattern(&[(true, 20)]); // 全安静
        let sys = waveform_from_pattern(&[(false, 20)]); // 全有声
        let combined = max_dbfs_per_bucket(&mic, &sys);
        let spans = detect_silence_segments(&combined, SilenceDetectOptions::default());
        assert!(
            spans.is_empty(),
            "system audio present → not silent, got {spans:?}"
        );
    }

    #[test]
    fn combined_audio_silent_only_when_both_quiet() {
        // 两条音轨同时安静的时段才算静音。
        let mic = waveform_from_pattern(&[(false, 8), (true, 12)]);
        let sys = waveform_from_pattern(&[(false, 8), (true, 12)]);
        let combined = max_dbfs_per_bucket(&mic, &sys);
        let spans = detect_silence_segments(&combined, SilenceDetectOptions::default());
        assert_eq!(spans.len(), 1, "both quiet → one silence, got {spans:?}");
    }

    #[test]
    fn combined_handles_unequal_lengths() {
        // 长度不一致：短轨缺失帧按数字静音补齐，不 panic 且逻辑正确。
        let mic = waveform_from_pattern(&[(false, 5)]); // 仅 5 帧有声
        let sys = waveform_from_pattern(&[(false, 5), (true, 15)]); // 20 帧，后 15 安静
        let combined = max_dbfs_per_bucket(&mic, &sys);
        assert_eq!(combined.len(), 20);
        // 前 5 帧两者有声 → 响；后 15 帧 sys 安静 + mic 缺失(补-60) → 静音 1.5s。
        let spans = detect_silence_segments(&combined, SilenceDetectOptions::default());
        assert_eq!(spans.len(), 1, "got {spans:?}");
    }
}
