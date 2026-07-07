import 'package:flutter/material.dart';

abstract final class EditorLayoutMetrics {
  static const double shellMaxWidth = 1500;
  static const double formMaxWidth = 960;
  static const double listMaxWidth = 1120;
  static const double compactBreakpoint = 900;

  static const double outlineMinWidth = 280;
  static const double outlineMaxWidth = 540;
  static const double previewMinWidth = 320;
  static const double previewMaxWidth = 600;

  static EdgeInsets pagePadding(BuildContext context) {
    final isCompact = MediaQuery.sizeOf(context).width < compactBreakpoint;
    return EdgeInsets.fromLTRB(
      isCompact ? 16 : 24,
      isCompact ? 16 : 24,
      isCompact ? 16 : 24,
      isCompact ? 24 : 32,
    );
  }

  static EdgeInsets listPadding(BuildContext context) {
    final padding = pagePadding(context);
    return EdgeInsets.fromLTRB(
      padding.left,
      0,
      padding.right,
      padding.bottom,
    );
  }
}
