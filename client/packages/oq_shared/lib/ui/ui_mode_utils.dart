import 'package:flutter/material.dart';

class UiModeUtils {
  static bool wideModeOn(
    BuildContext context, [
    double width = UiModeUtils.medium,
  ]) {
    final size = MediaQuery.sizeOf(context);
    return size.width > width;
  }

  static bool landscapeScreenSize(BuildContext context) {
    return MediaQuery.sizeOf(context).aspectRatio > 1;
  }

  static const double extraLarge = 1600;
  static const double large = 1200;
  static const double medium = 600;

  static const double maximumDialogWidth = medium;
}
