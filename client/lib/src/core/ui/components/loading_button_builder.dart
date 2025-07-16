import 'dart:async';

import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

class LoadingButtonBuilder extends StatefulWidget {
  const LoadingButtonBuilder({
    required this.onPressed,
    required this.child,
    required this.builder,
    super.key,
  });
  final Future<void> Function()? onPressed;
  final Widget child;
  final Widget Function(
    BuildContext context,
    Widget child,
    Future<void> Function() onPressed,
  )
  builder;

  @override
  State<LoadingButtonBuilder> createState() => _LoadingButtonBuilderState();
}

class _LoadingButtonBuilderState extends State<LoadingButtonBuilder>
    with TickerProviderStateMixin {
  bool loading = false;
  late AnimationController _scaleController;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _scaleController = AnimationController(
      duration: const Duration(milliseconds: 150),
      vsync: this,
    );
    _scaleAnimation = Tween<double>(
      begin: 1.0,
      end: 0.95,
    ).animate(CurvedAnimation(
      parent: _scaleController,
      curve: Curves.easeInOut,
    ));
  }

  @override
  void dispose() {
    _scaleController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final loader = Container(
      decoration: BoxDecoration(
        color: context.theme.colorScheme.onSecondary,
        shape: BoxShape.circle,
      ),
      padding: 4.all,
      margin: 4.all,
      child: CircularProgressIndicator(
        valueColor: AlwaysStoppedAnimation(context.theme.colorScheme.secondary),
        constraints: BoxConstraints.tight(const Size.square(18)),
        strokeWidth: 2,
      ),
    );

    Future<void> onPressed(
      void Function(void Function()) setState,
      Future<void> Function()? onPressed,
    ) async {
      if (loading) return;
      
      // Scale animation on press
      await _scaleController.forward();
      await _scaleController.reverse();
      
      setState(() => loading = true);
      try {
        await onPressed?.call();
      } catch (e) {
        if (context.mounted) {
          await getIt<ToastController>().show(e);
        }
      } finally {
        if (context.mounted) setState(() => loading = false);
      }
    }

    return GestureDetector(
      onTapDown: (_) => _scaleController.forward(),
      onTapUp: (_) => _scaleController.reverse(),
      onTapCancel: () => _scaleController.reverse(),
      child: AnimatedBuilder(
        animation: _scaleAnimation,
        builder: (context, child) {
          return Transform.scale(
            scale: _scaleAnimation.value,
            child: widget.builder(
              context,
              AppAnimatedSwitcher(
                animationType: AppAnimationType.scale,
                duration: const Duration(milliseconds: 200),
                child: loading 
                  ? loader 
                  : widget.child,
              ),
              () async => onPressed(setState, widget.onPressed),
            ),
          );
        },
      ),
    );
  }
}
