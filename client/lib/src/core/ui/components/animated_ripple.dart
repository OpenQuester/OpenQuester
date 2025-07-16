import 'package:flutter/material.dart';

/// A widget that adds a customizable ripple effect to its child
class AnimatedRipple extends StatefulWidget {
  const AnimatedRipple({
    required this.child,
    this.onTap,
    this.rippleColor,
    this.splashColor,
    this.highlightColor,
    this.borderRadius,
    this.enableFeedback = true,
    super.key,
  });

  final Widget child;
  final VoidCallback? onTap;
  final Color? rippleColor;
  final Color? splashColor;
  final Color? highlightColor;
  final BorderRadius? borderRadius;
  final bool enableFeedback;

  @override
  State<AnimatedRipple> createState() => _AnimatedRippleState();
}

class _AnimatedRippleState extends State<AnimatedRipple>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 300),
      vsync: this,
    );
    _animation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOut,
    ));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _handleTap() {
    if (widget.enableFeedback) {
      _controller.forward().then((_) {
        _controller.reverse();
      });
    }
    widget.onTap?.call();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: _handleTap,
        splashColor: widget.splashColor ?? 
                    theme.colorScheme.primary.withValues(alpha: 0.1),
        highlightColor: widget.highlightColor ?? 
                       theme.colorScheme.primary.withValues(alpha: 0.05),
        borderRadius: widget.borderRadius ?? BorderRadius.circular(8),
        child: AnimatedBuilder(
          animation: _animation,
          builder: (context, child) {
            return Container(
              decoration: widget.enableFeedback
                  ? BoxDecoration(
                      borderRadius: widget.borderRadius ?? BorderRadius.circular(8),
                      boxShadow: [
                        BoxShadow(
                          color: (widget.rippleColor ?? theme.colorScheme.primary)
                              .withValues(alpha: _animation.value * 0.1),
                          blurRadius: _animation.value * 8,
                          spreadRadius: _animation.value * 2,
                        ),
                      ],
                    )
                  : null,
              child: widget.child,
            );
          },
        ),
      ),
    );
  }
}

/// Extension to easily add ripple effects to widgets
extension RippleExtension on Widget {
  Widget withRipple({
    VoidCallback? onTap,
    Color? rippleColor,
    Color? splashColor,
    Color? highlightColor,
    BorderRadius? borderRadius,
    bool enableFeedback = true,
  }) {
    return AnimatedRipple(
      onTap: onTap,
      rippleColor: rippleColor,
      splashColor: splashColor,
      highlightColor: highlightColor,
      borderRadius: borderRadius,
      enableFeedback: enableFeedback,
      child: this,
    );
  }
}