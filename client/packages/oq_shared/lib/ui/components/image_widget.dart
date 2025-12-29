import 'dart:async';

import 'package:animate_do/animate_do.dart';
import 'package:flutter/material.dart';
import 'package:nb_utils/nb_utils.dart';
import 'package:oq_shared/oq_shared.dart';

class ImageWidget extends StatefulWidget {
  const ImageWidget({
    required this.url,
    this.avatarRadius,
    this.fit = BoxFit.cover,
    this.afterLoad,
    this.forcedLoaderBuilder,
    super.key,
  });

  final String? url;
  final double? avatarRadius;
  final BoxFit? fit;
  final VoidCallback? afterLoad;
  final Widget Function(BuildContext context, Widget child)?
  forcedLoaderBuilder;

  @override
  State<ImageWidget> createState() => _ImageWidgetState();
}

class _ImageWidgetState extends State<ImageWidget> {
  ImageProvider<Object>? imageProvider;
  bool loaded = false;

  Future<void> _setProvider() async {
    if (widget.url == null) {
      imageProvider = null;
      return;
    }

    imageProvider = await getImageProvider(widget.url!);
    if (mounted) setState(() {});
  }

  @override
  void initState() {
    unawaited(_setProvider());
    super.initState();
  }

  @override
  void didUpdateWidget(covariant ImageWidget oldWidget) {
    if (oldWidget.url != widget.url) {
      unawaited(_setProvider());
    }
    super.didUpdateWidget(oldWidget);
  }

  @override
  Widget build(BuildContext context) {
    final child = imageProvider == null
        ? placeholder()
        : Image(
            image: imageProvider!,
            fit: widget.fit,
            errorBuilder: (_, _, _) => placeholder(),
            frameBuilder: (context, child, frame, wasSynchronouslyLoaded) {
              if (widget.forcedLoaderBuilder != null) {
                return widget.forcedLoaderBuilder!(context, child);
              }
              return child;
            },
            loadingBuilder: (context, child, loadingProgress) {
              if (loadingProgress == null && !loaded) {
                widget.afterLoad?.call();
                loaded = true;
              }

              return child;
            },
          ).fadeIn();

    // Default to 48px diameter (24 radius) when avatarRadius is not provided.
    final size = widget.avatarRadius != null
        ? (widget.avatarRadius! * 2)
        : 48.0;

    return AnimatedContainer(
      duration: Durations.medium1,
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: widget.avatarRadius != null
            ? BoxShape.circle
            : BoxShape.rectangle,
      ),
      clipBehavior: Clip.antiAlias,
      child: child,
    );
  }

  Widget placeholder() {
    final radius = widget.avatarRadius ?? 24.0;
    return Container(
      alignment: Alignment.center,
      child: Icon(
        Icons.person,
        size: radius,
        color: context.theme.colorScheme.onSurface,
      ),
    );
  }
}
