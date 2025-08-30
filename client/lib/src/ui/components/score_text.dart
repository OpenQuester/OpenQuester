import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

class ScoreText extends StatelessWidget {
  const ScoreText({
    required this.score,
    this.textStyle,
    this.longLimit = 1_000_000,

    super.key,
  });
  final int? score;
  final TextStyle? textStyle;
  final int longLimit;

  @override
  Widget build(BuildContext context) {
    final (formattedScore, compactFormat) = formatScore(
      score,
      longLimit: longLimit,
    );
    final text = Text(
      formattedScore,
      style: textStyle,
    );

    if (!compactFormat) return text;

    return Tooltip(
      message: score == null
          ? formattedScore
          : longNumberFormatter.format(score),
      child: text,
    );
  }

  static (String formattedText, bool isCompact) formatScore(
    int? score, {
    int longLimit = 1_000_000,
  }) {
    if (score == null) return ('...', true);

    final compactFormat = score >= longLimit;
    final formatter = compactFormat
        ? compactNumberFormatter
        : longNumberFormatter;

    return (formatter.format(score), compactFormat);
  }

  static final longNumberFormatter = NumberFormat.decimalPattern();
  static final compactNumberFormatter = NumberFormat.compact();
}
