import 'dart:convert';
import 'dart:math';

import 'package:oq_compress/oq_compress.dart';
import 'package:universal_io/io.dart';

/// Wraps ffmpeg/ffprobe commands for metadata inspection and media encoding.
class CommandWrapper {
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
    // --------------------------------------------------------
    // CPU / threading setup (used for video & image AV1 speedups)
    // --------------------------------------------------------
    final cpuCount = min(6, Platform.numberOfProcessors);
    final av1MultiCpuArgs = [
      '-threads', '$cpuCount',
      '-cpu-used', '$cpuCount', // speed vs. quality tradeoff
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
    final svtArgs = [
      'film-grain=10',
      'tune=2',
      'preset=6',
      'crf=40',
      'min-qp=0',
      'scm=0',
      'enable-qm=1',
      'qm-min=0',
      'qm-max=40',
    ].join(':');

    final videoArgs = [
      // video codec & container
      '-c:v', 'libsvtav1',
      '-f', 'webm',
      // visual quality & speed tuning
      '-fpsmax', '20',
      '-svtav1-params',
      '"$svtArgs"',
      // pixel format & color range
      '-pix_fmt', 'yuv420p',
      '-color_range', 'mpeg',
    ];
    const imageFilters = [
      // downscale to max 1280×720
      '-vf',
      "scale='if(gt(a,1280/720),1280,-2)':'if(gt(a,1280/720),-2,720)'",
      // limit duration to 10 seconds
      '-t', '10',
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
    final imageArgs = [
      // speedups & parallelism will be injected via _av1MultiCpuArgs
      // container and codec
      '-f', 'avif',
      '-c:v', 'libsvtav1',
      // 4:4:4 chroma, 10 bit depth
      '-pix_fmt', 'yuv444p10le',
      '-svtav1-params',
      '"$svtArgs"',
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
      if ({CodecType.image, CodecType.video}.contains(codecType))
        ...imageFilters,
      outputFile.path, // output file
    ];

    await runProcess('ffmpeg', args);
    return outputFile;
  }
}
