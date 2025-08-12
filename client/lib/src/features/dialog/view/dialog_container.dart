import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

class DialogContainer extends StatelessWidget {
  const DialogContainer({required this.child, super.key});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return AnimationConfigurationClass.synchronized(
      duration: Durations.short2,
      child: SafeArea(
        minimum: 8.all,
        child: MaxSizeContainer(
          maxWidth: UiModeUtils.maximumDialogWidth,
          child: ScaffoldMessenger(
            child: Scaffold(
              backgroundColor: Colors.transparent,
              appBar: AppBar(
                actions: const [CloseButton()],
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
