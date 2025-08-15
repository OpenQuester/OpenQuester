import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

class ScoreText extends StatelessWidget {
  const ScoreText({
    required this.score,
    this.textStyle,
    super.key,
  });
  final int score;
  final TextStyle? textStyle;

  @override
  Widget build(BuildContext context) {
    final compactFormat = score >= 1_000_000;
    final decimalFormatter = NumberFormat.decimalPattern();
    final formatter = compactFormat ? NumberFormat.compact() : decimalFormatter;

    final text = Text(
      formatter.format(score),
      style: textStyle,
    );

    if (!compactFormat) return text;

    return Tooltip(message: decimalFormatter.format(score), child: text);
  }
}
