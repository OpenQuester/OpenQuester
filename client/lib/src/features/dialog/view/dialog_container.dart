import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

class DialogContainer extends StatelessWidget {
  const DialogContainer({
    required this.child,
    this.maxWidth,
    super.key,
  });
  final Widget child;
  final double? maxWidth;

  @override
  Widget build(BuildContext context) {
    return AnimationConfigurationClass.synchronized(
      duration: Durations.short2,
      child: SafeArea(
        minimum: 8.all,
        child: MaxSizeContainer(
          maxWidth: maxWidth,
          child: ScaffoldMessenger(
            child: Scaffold(
              backgroundColor: Colors.transparent,
              appBar: AppBar(
                actions: [
                  CloseButton(
                    style: ButtonStyle(
                      backgroundColor: WidgetStatePropertyAll(
                        context.theme.colorScheme.primaryContainer.withValues(
                          alpha: 0.3,
                        ),
                      ),
                    ),
                  ),
                ],
                automaticallyImplyLeading: false,
                backgroundColor: Colors.transparent,
                scrolledUnderElevation: 0,
                elevation: 0,
              ),
              body: child,
            ),
          ),
        ),
      ),
    );
  }
}
