import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

class ImageWidget extends StatefulWidget {
  ImageWidget({
    required String? url,
    this.avatarRadius,
    this.fit = BoxFit.cover,
    super.key,
  }) : _provider = url == null
           ? null
           : NetworkImageProvider(
               url,
               cacheKey: url,
               maxHeight: 1000,
               maxWidth: 1000,
               errorListener: logger.w,
             );

  final ImageProvider? _provider;
  final double? avatarRadius;
  final BoxFit? fit;

  @override
  State<ImageWidget> createState() => _ImageWidgetState();
}

class _ImageWidgetState extends State<ImageWidget> {
  late ImageProvider<Object>? image;

  void _setProvider() {
    image = widget._provider;
  }

  @override
  void initState() {
    _setProvider();
    super.initState();
  }

  @override
  void didUpdateWidget(covariant ImageWidget oldWidget) {
    if (oldWidget._provider != widget._provider) {
      setState(_setProvider);
    }
    super.didUpdateWidget(oldWidget);
  }

  @override
  Widget build(BuildContext context) {
    final child = image == null
        ? placeholder()
        : Image(
            image: image!,
            fit: widget.fit,
            errorBuilder: (_, _, _) => placeholder(),
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
    return Container(color: context.theme.primaryColor, padding: 16.all);
  }
}
