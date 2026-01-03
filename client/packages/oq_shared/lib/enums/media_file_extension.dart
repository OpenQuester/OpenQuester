/// Media file extension types supported in the application
enum MediaFileExtension {
  /// WebM video/audio format
  webm('webm'),

  /// MP3 audio format
  mp3('mp3'),

  /// MP4 video format
  mp4('mp4'),

  /// WAV audio format
  wav('wav'),

  /// OGG audio format
  ogg('ogg');

  const MediaFileExtension(this.extension);

  final String extension;

  @override
  String toString() => extension;
}
