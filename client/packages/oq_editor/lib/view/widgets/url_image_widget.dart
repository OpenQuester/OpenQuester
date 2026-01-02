import 'package:flutter/material.dart';

/// A reusable widget for displaying images from URLs
/// Used by both MediaPreviewWidget (thumbnails) and MediaPreviewDialog (fullscreen)
class UrlImageWidget extends StatelessWidget {
  const UrlImageWidget({
    required this.url,
    this.fit = BoxFit.contain,
    this.errorWidget,
    super.key,
  });

  final String url;
  final BoxFit fit;
  final Widget? errorWidget;

  @override
  Widget build(BuildContext context) {
    return Image.network(
      url,
      fit: fit,
      errorBuilder: (context, error, stackTrace) =>
          errorWidget ?? _defaultErrorWidget(),
    );
  }

  Widget _defaultErrorWidget() {
    return const Center(
      child: Icon(Icons.broken_image, color: Colors.red),
    );
  }
}
