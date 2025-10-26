import 'package:flutter/material.dart';
import 'package:nb_utils/nb_utils.dart';

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
