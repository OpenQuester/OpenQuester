import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

class AdaptiveDialog extends StatefulWidget {
  const AdaptiveDialog({
    required this.builder,
    this.allowBottomSheet = true,
    super.key,
  });
  final Widget Function(BuildContext) builder;
  final bool allowBottomSheet;

  @override
  State<AdaptiveDialog> createState() => _AdaptiveDialogState();
}

class _AdaptiveDialogState extends State<AdaptiveDialog>
    with TickerProviderStateMixin {
  late AnimationController _backdropController;
  late Animation<double> _backdropAnimation;

  @override
  void initState() {
    super.initState();
    _backdropController = AnimationController(
      duration: const Duration(milliseconds: 250),
      vsync: this,
    );

    _backdropAnimation = Tween<double>(
      begin: 0.0,
      end: 0.5,
    ).animate(CurvedAnimation(
      parent: _backdropController,
      curve: Curves.easeOut,
    ));

    // Start backdrop animation
    _backdropController.forward();
  }

  @override
  void dispose() {
    _backdropController.dispose();
    super.dispose();
  }

  Future<void> _handleClose() async {
    await _backdropController.reverse();
    if (mounted) {
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    final showDialog =
        !widget.allowBottomSheet || UiModeUtils.wideModeOn(context);

    final child = GestureDetector(
      child: widget.builder(context),
      onTap: () {
        /* do nothing—this swallows the tap */
      },
    );

    return Material(
      color: Colors.transparent,
      child: AnimatedBuilder(
        animation: _backdropAnimation,
        builder: (context, _) {
          return Container(
            color: Colors.black.withValues(alpha: _backdropAnimation.value),
            child: GestureDetector(
              onTap: _handleClose,
              child: Scaffold(
                backgroundColor: Colors.transparent,
                body: showDialog
                    ? DialogContainer(child: child)
                    : GestureDetector(onTap: _handleClose),
                bottomSheet: showDialog
                    ? const SizedBox() // Fixes child duplicates
                    : BottomSheet(
                        elevation: 0,
                        onClosing: () {},
                        showDragHandle: true,
                        animationController: BottomSheet.createAnimationController(
                          this,
                        )..duration = const Duration(milliseconds: 300),
                        builder: (_) => Container(
                          decoration: BoxDecoration(
                            borderRadius: const BorderRadius.vertical(
                              top: Radius.circular(16),
                            ),
                            color: Theme.of(context).colorScheme.surface,
                          ),
                          child: child,
                        ),
                      ),
              ),
            ),
          );
        },
      ),
    );
  }
}
