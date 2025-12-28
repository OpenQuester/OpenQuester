import 'package:flutter/material.dart';
import 'package:nb_utils/nb_utils.dart';
import 'package:oq_shared/ui/ui_mode_utils.dart';

class MaxSizeContainer extends StatelessWidget {
  const MaxSizeContainer({
    required this.child,
    this.maxWidth = UiModeUtils.large,
    this.enabled = true,
    super.key,
  });
  final Widget child;
  final double maxWidth;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    if (!enabled) return child;

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ConstrainedBox(
          constraints: BoxConstraints(maxWidth: maxWidth),
          child: child,
        ).flexible(),
      ],
    );
  }
}
