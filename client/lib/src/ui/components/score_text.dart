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
    final (formattedScore, compactFormat) = formatScore(score);
    final text = Text(
      formattedScore,
      style: textStyle,
    );

    if (!compactFormat) return text;

    return Tooltip(message: longNumberFormatter.format(score), child: text);
  }

  static (String, bool) formatScore(int? score) {
    final compactFormat = (score ?? 0) >= 1_000_000;
    final formatter = compactFormat
        ? compactNumberFormatter
        : longNumberFormatter;

    return (formatter.format(score ?? 0), compactFormat);
  }

  static final longNumberFormatter = NumberFormat.decimalPattern();
  static final compactNumberFormatter = NumberFormat.compact();
}
