import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:cached_network_image_platform_interface/cached_network_image_platform_interface.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_avif/flutter_avif.dart';
import 'package:flutter_cache_manager/flutter_cache_manager.dart';

const int maxImageCacheSize = 2000;

Future<ImageProvider> getImageProvider(
  String url,
) async {
  final defaultProvider = CachedNetworkImageProvider(
    url,
    imageRenderMethodForWeb: ImageRenderMethodForWeb.HttpGet,
    maxHeight: maxImageCacheSize,
    maxWidth: maxImageCacheSize,
  );

  final stream = DefaultCacheManager().getImageFile(
    url,
    withProgress: true,
  );

  await for (final event in stream) {
    if (event is FileInfo) {
      final file = event.file;
      final bytes = await file.readAsBytes();

      if (bytes.lengthInBytes == 0) {
        throw StateError('$url is empty and cannot be loaded as an image.');
      }

      final fType = isAvifFile(bytes.sublist(0, 16));

      if (fType == AvifFileType.unknown) {
        return defaultProvider;
      } else {
        return CachedNetworkAvifImageProvider(url);
      }
    }
  }
  return defaultProvider;
}
