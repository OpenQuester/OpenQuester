import 'dart:async';

import 'package:animate_do/animate_do.dart';
import 'package:flutter/material.dart';
import 'package:nb_utils/nb_utils.dart';
import 'package:oq_shared/oq_shared.dart';

class ImageWidget extends StatefulWidget {
  ImageWidget({
    required this.url,
    this.avatarRadius,
    this.fit = BoxFit.cover,
    this.afterLoad,
    this.forcedLoaderBuilder,
    this.placeholder,
    Key? key,
  }) : super(key: key ?? (url.isEmptyOrNull ? null : ValueKey(url!)));

  final String? url;
  final double? avatarRadius;
  final BoxFit? fit;
  final VoidCallback? afterLoad;
  final Widget Function(BuildContext context, Widget child)?
  forcedLoaderBuilder;
  final Widget? placeholder;

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
            key: ValueKey(imageProvider),
            image: imageProvider!,
            fit: widget.fit,
            errorBuilder: (_, _, _) => placeholder(),
            frameBuilder: (context, child, frame, wasSynchronouslyLoaded) {
              if (widget.forcedLoaderBuilder != null) {
                return widget.forcedLoaderBuilder!(context, child);
              }
              if (wasSynchronouslyLoaded) {
                return child;
              }
              return loaded ? child.fadeIn() : child;
            },
            loadingBuilder: (context, child, loadingProgress) {
              if (loadingProgress == null && !loaded) {
                widget.afterLoad?.call();
                loaded = true;
              }

              return child;
            },
          );

    final size = widget.avatarRadius != null
        ? (widget.avatarRadius! * 2)
        : null;

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
    return Container(
      color: context.theme.primaryColor,
      constraints: const BoxConstraints(minHeight: 24, minWidth: 24),
      child: widget.placeholder.center(),
    );
  }
}
