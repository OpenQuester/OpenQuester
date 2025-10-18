import 'package:flutter/material.dart';
import 'package:nb_utils/nb_utils.dart';

class DiagonalLineBackground extends StatelessWidget {
  const DiagonalLineBackground({
    required this.child,
    this.borderRadius = const BorderRadius.all(Radius.circular(12)),
    super.key,
  });
  final Widget child;
  final BorderRadius borderRadius;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: borderRadius,
      child: CustomPaint(painter: DiagonalLinesPainter(), child: child),
    ).paddingAll(2);
  }
}

class DiagonalLinesPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.grey
          .withValues(alpha: .2) // subtle gray
      ..strokeWidth = 1;

    const spacing = 15.0; // space between lines

    for (var i = -size.height; i < size.width; i += spacing) {
      canvas.drawLine(
        Offset(i + size.height, size.height),
        Offset(i, 0),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(CustomPainter oldDelegate) => false;
}
