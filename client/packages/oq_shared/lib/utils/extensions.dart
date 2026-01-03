import 'dart:typed_data';

import 'package:animate_do/animate_do.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:nb_utils/nb_utils.dart';
import 'package:universal_io/io.dart';

extension WidgetX on Widget {
  Widget shrink() =>
      Row(mainAxisSize: MainAxisSize.min, children: [flexible()]);

  Widget withTitle(
    String title, {
    CrossAxisAlignment crossAxisAlignment = CrossAxisAlignment.start,
  }) {
    return Column(
      spacing: 4,
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: crossAxisAlignment,
      children: [Text(title), this],
    );
  }

  Widget constrained(BoxConstraints constraints) {
    return ConstrainedBox(constraints: constraints, child: this);
  }

  SliverToBoxAdapter get sliver => SliverToBoxAdapter(child: this);
}

extension NumberPaddings on num {
  EdgeInsets get all => EdgeInsets.all(toDouble());
  EdgeInsets get left => EdgeInsets.only(left: toDouble());
  EdgeInsets get right => EdgeInsets.only(right: toDouble());
  EdgeInsets get top => EdgeInsets.only(top: toDouble());
  EdgeInsets get bottom => EdgeInsets.only(bottom: toDouble());
  EdgeInsets get vertical => EdgeInsets.symmetric(vertical: toDouble());
  EdgeInsets get horizontal => EdgeInsets.symmetric(horizontal: toDouble());
  BorderRadius get circular => BorderRadius.circular(toDouble());
}

extension BrightnessX on Brightness {
  Brightness get reverse =>
      this == Brightness.light ? Brightness.dark : Brightness.light;
}

extension ColorX on Color {
  /// Change color brightness
  /// [amount] is the amount to change the brightness. From -1 to 1.
  /// Positive values will lighten the color, while negative values
  /// will darken it.
  Color withBrightness(double amount) {
    assert(amount >= -1 && amount <= 1, 'Amount must be between -1 and 1');

    final hsl = HSLColor.fromColor(this);
    final hslDark = hsl.withLightness((hsl.lightness + amount).clamp(0.0, 1.0));
    return hslDark.toColor();
  }
}

extension ListX<T> on List<T> {
  T? tryByIndex(int? index) {
    if (index == null) return null;
    if (index > length) return null;
    if (isEmpty) return null;
    return this[index];
  }
}

extension IterableX<T> on Iterable<T> {
  bool containsAnyOf<C>(
    Iterable<C> items, {
    bool Function(T item, C target)? by,
  }) {
    for (final item in items) {
      if (by != null) {
        if (any((e) => by(e, item))) {
          return true;
        }
      } else {
        if (contains(item as T)) {
          return true;
        }
      }
    }
    return false;
  }
}

extension PlatformFileX on PlatformFile {
  /// Read bytes from PlatformFile (web or native)
  /// Consistent utility across all packages for file byte access
  Future<Uint8List> readBytes() async {
    if (bytes != null) {
      return bytes!;
    }

    if (path != null) {
      return File(path!).readAsBytes();
    }

    throw Exception('Cannot read file bytes for: $name');
  }

  /// Get bytes synchronously if available, null otherwise
  /// Use this for cases where immediate bytes are needed (e.g., Image.memory)
  Uint8List? get bytesSync => bytes;

  /// Check if bytes are available synchronously
  bool get hasBytesSync => bytes != null;
}

extension FadeInExtension on Widget {
  Widget fadeIn({
    Key? key,
    Duration duration = const Duration(milliseconds: 800),
    Duration delay = Duration.zero,
    void Function(AnimationController)? controller,
    bool manualTrigger = false,
    bool animate = true,
    void Function(AnimateDoDirection direction)? onFinish,
    Curve curve = Curves.easeOut,
  }) {
    return FadeIn(
      key: key,
      duration: duration,
      delay: delay,
      controller: controller,
      manualTrigger: manualTrigger,
      animate: animate,
      onFinish: onFinish,
      curve: curve,
      child: this,
    );
  }
}
