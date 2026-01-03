import 'package:flutter/material.dart';

/// Builder that conditionally wraps child in SingleChildScrollView
/// based on available height constraints
class ConditionalScrollBuilder extends StatelessWidget {
  const ConditionalScrollBuilder({
    required this.child,
    required this.minHeightThreshold,
    this.scrollDirection = Axis.vertical,
    super.key,
  });

  final Widget child;
  final double minHeightThreshold;
  final Axis scrollDirection;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final maxHeight = scrollDirection == Axis.vertical
            ? constraints.maxHeight
            : constraints.maxWidth;

        // If available space is less than threshold, wrap in scroll view
        if (maxHeight < minHeightThreshold) {
          return SingleChildScrollView(
            scrollDirection: scrollDirection,
            child: ConstrainedBox(
              constraints: scrollDirection == Axis.vertical
                  ? BoxConstraints(maxHeight: minHeightThreshold)
                  : BoxConstraints(maxWidth: minHeightThreshold),
              child: child,
            ),
          );
        }

        // Otherwise, just return the child
        return child;
      },
    );
  }
}
