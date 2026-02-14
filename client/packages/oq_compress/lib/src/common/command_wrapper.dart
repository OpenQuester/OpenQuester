import 'dart:convert';
import 'dart:math';

import 'package:oq_compress/oq_compress.dart';
import 'package:universal_io/io.dart';

/// Wraps ffmpeg/ffprobe commands for metadata inspection and media encoding.
class CommandWrapper {
  static int? _ffmpegMajorVersionCache;

  /// Check if the current platform supports FFmpeg operations.
  ///
  /// Returns true only for desktop platforms (Windows, macOS, Linux)
  /// where both ffmpeg and ffprobe are installed and accessible.
  static Future<bool> isSupported() async {
    // Only support desktop platforms
    if (!(Platform.isWindows || Platform.isMacOS || Platform.isLinux)) {
      return false;
    }

    try {
      // Check if ffmpeg is available
      await _checkToolAvailability('ffmpeg');
      // Check if ffprobe is available
      await _checkToolAvailability('ffprobe');
      return true;
    } catch (e) {
      return false;
    }
  }

  /// Helper method to check if a specific tool is available and working.
  static Future<void> _checkToolAvailability(String tool) async {
    final result = await Process.run(
      tool,
      ['-version'],
      runInShell: Platform.isWindows,
    ).timeout(const Duration(seconds: 5));

    if (result.exitCode != 0) {
      throw Exception('$tool is not available or not working properly');
    }
  }

  /// Read FFmpeg major version from `ffmpeg -version` output.
  ///
  /// Returns null if parsing fails and caches successful reads.
  static Future<int?> _getFfmpegMajorVersion() async {
    if (_ffmpegMajorVersionCache != null) {
      return _ffmpegMajorVersionCache;
    }

    try {
      final result = await Process.run(
        'ffmpeg',
        ['-version'],
        runInShell: Platform.isWindows,
      ).timeout(const Duration(seconds: 5));

      if (result.exitCode != 0) {
        return null;
      }

      final firstLine = result.stdout
          .toString()
          .split('\n')
          .firstWhere(
            (line) => line.trim().isNotEmpty,
            orElse: () => '',
          );
      final match = RegExp(r'ffmpeg version\s+n?(\d+)').firstMatch(firstLine);
      final major = int.tryParse(match?.group(1) ?? '');
      if (major != null) {
        _ffmpegMajorVersionCache = major;
      }
      return major;
    } catch (_) {
      return null;
    }
  }

  /// Probe the input file for format and stream info.
  Future<FfprobeOutput?> metadata(File file) async {
    const ffprobeArgs = [
      '-v', 'quiet', // suppress console output
      '-print_format', 'json', // output as JSON
      '-show_format', // include format container info
      '-show_streams', // include stream details (video, audio, etc.)
    ];

    final result = await runProcess('ffprobe', [...ffprobeArgs, file.path]);
    return result == null
        ? null
        : FfprobeOutput.fromJson(jsonDecode(result) as Map<String, dynamic>);
  }

  /// Encode any media (audio, video, or image) with FFmpeg using
  /// sensible defaults for size, quality, and length limits.
  Future<File> encode({
    required File inputFile,
    required File outputFile,
    required CodecType codecType,
  }) async {
    final ffmpegMajorVersion = await _getFfmpegMajorVersion();

    // --------------------------------------------------------
    // CPU / threading setup (used for video & image AV1 speedups)
    // --------------------------------------------------------
    final cpuCount = min(6, Platform.numberOfProcessors);
    final av1MultiCpuArgs = [
      '-threads',
      '$cpuCount',
    ];

    final av1QualityArgs = ffmpegMajorVersion != null && ffmpegMajorVersion <= 7
        ? const [
            '-svtav1-params',
            'preset=6:crf=40',
          ]
        : const [
            '-preset',
            '6',
            '-crf',
            '40',
          ];

    // --------------------------------------------------------
    // Shared metadata / progress flags
    // --------------------------------------------------------
    const globalMisc = [
      '-progress', '-', // report progress to stdout
      '-map_metadata', '-1', // strip input metadata
      '-y', // overwrite output without asking
    ];

    // --------------------------------------------------------
    // Codec‐type–specific argument groups
    // --------------------------------------------------------
    // 1) Audio only (libopus, 64 kbps, VBR, 48 kHz, 16-bit)
    const audioOnlyArgs = [
      '-c:a',
      'libopus',
      '-b:a',
      '64k',
      '-vbr',
      'on',
      '-ar',
      '48000',
      '-sample_fmt',
      's16',
      '-f',
      'webm',
      ...globalMisc,
    ];

    // 2) Video + audio (SVT-AV1 video + libopus audio)
    final videoArgs = [
      // video codec & container
      '-c:v', 'libsvtav1',
      '-f', 'webm',
      // visual quality & speed tuning
      '-fpsmax', '20',
      ...av1QualityArgs,
      // pixel format & color range
      '-pix_fmt', 'yuv420p10le',
      '-color_range', 'mpeg',
    ];
    const videoFilters = [
      // downscale to max 1280×720
      '-vf',
      "scale='if(gt(a,1280/720),1280,-2)':'if(gt(a,1280/720),-2,720)'",
      // limit duration to 10 seconds
      '-t', '10',
    ];
    const imageFilters = [
      // downscale to max 1280×720
      '-vf',
      "scale='if(gt(a,1280/720),1280,-2)':'if(gt(a,1280/720),-2,720)'",
      // encode as a single AVIF image frame
      '-frames:v', '1',
    ];
    const videoAudioArgs = [
      // reuse the same audio settings as audio‐only branch
      '-c:a', 'libopus',
      '-b:a', '64k',
      '-vbr', 'on',
      '-ar', '48000',
      '-sample_fmt', 's16',
    ];

    // 3) Image AVIF
    const imageArgs = [
      // container and codec
      '-f', 'avif',
      '-c:v', 'libaom-av1',
      // constant quality mode for AVIF
      '-crf', '40',
      '-b:v', '0',
      // 4:2:0 chroma, 10 bit depth
      '-pix_fmt', 'yuv420p10le',
      ...globalMisc,
    ];

    // --------------------------------------------------------
    // Build and run the final argument list
    // --------------------------------------------------------
    final args = <String>[
      '-i', inputFile.path, // input file
      // inject AV1 multi-CPU only for video & image
      if (codecType != CodecType.audio) ...av1MultiCpuArgs,
      // branch by codec type
      if (codecType == CodecType.audio)
        ...audioOnlyArgs
      else if (codecType == CodecType.video) ...[
        ...videoArgs,
        ...videoAudioArgs,
        ...globalMisc,
      ] else if (codecType == CodecType.image)
        ...imageArgs,
      if (codecType == CodecType.video) ...videoFilters,
      if (codecType == CodecType.image) ...imageFilters,
      outputFile.path, // output file
    ];

    await runProcess('ffmpeg', args);
    return outputFile;
  }
}
