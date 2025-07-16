import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

/// Enhanced progress indicators with smooth animations
class AnimatedProgressIndicator extends StatefulWidget {
  const AnimatedProgressIndicator({
    this.value,
    this.backgroundColor,
    this.valueColor,
    this.strokeWidth = 4.0,
    this.semanticsLabel,
    this.semanticsValue,
    this.size = 24.0,
    this.enablePulseAnimation = false,
    this.enableRotationAnimation = true,
    super.key,
  });

  final double? value;
  final Color? backgroundColor;
  final Color? valueColor;
  final double strokeWidth;
  final String? semanticsLabel;
  final String? semanticsValue;
  final double size;
  final bool enablePulseAnimation;
  final bool enableRotationAnimation;

  @override
  State<AnimatedProgressIndicator> createState() => _AnimatedProgressIndicatorState();
}

class _AnimatedProgressIndicatorState extends State<AnimatedProgressIndicator>
    with TickerProviderStateMixin {
  late AnimationController _pulseController;
  late AnimationController _rotationController;
  late Animation<double> _pulseAnimation;
  late Animation<double> _rotationAnimation;

  @override
  void initState() {
    super.initState();
    
    _pulseController = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    );
    
    _rotationController = AnimationController(
      duration: const Duration(milliseconds: 2000),
      vsync: this,
    );

    _pulseAnimation = Tween<double>(
      begin: 0.8,
      end: 1.2,
    ).animate(CurvedAnimation(
      parent: _pulseController,
      curve: Curves.easeInOut,
    ));

    _rotationAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(
      parent: _rotationController,
      curve: Curves.linear,
    ));

    if (widget.enablePulseAnimation && widget.value == null) {
      _pulseController.repeat(reverse: true);
    }

    if (widget.enableRotationAnimation && widget.value == null) {
      _rotationController.repeat();
    }
  }

  @override
  void didUpdateWidget(AnimatedProgressIndicator oldWidget) {
    super.didUpdateWidget(oldWidget);
    
    if (widget.value == null && oldWidget.value != null) {
      // Started indeterminate
      if (widget.enablePulseAnimation) {
        _pulseController.repeat(reverse: true);
      }
      if (widget.enableRotationAnimation) {
        _rotationController.repeat();
      }
    } else if (widget.value != null && oldWidget.value == null) {
      // Became determinate
      _pulseController.stop();
      _rotationController.stop();
    }
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _rotationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    Widget progressIndicator = SizedBox(
      width: widget.size,
      height: widget.size,
      child: CircularProgressIndicator(
        value: widget.value,
        backgroundColor: widget.backgroundColor,
        valueColor: widget.valueColor != null
            ? AlwaysStoppedAnimation<Color>(widget.valueColor!)
            : null,
        strokeWidth: widget.strokeWidth,
        semanticsLabel: widget.semanticsLabel,
        semanticsValue: widget.semanticsValue,
      ),
    );

    if (widget.enableRotationAnimation && widget.value == null) {
      progressIndicator = AnimatedBuilder(
        animation: _rotationAnimation,
        builder: (context, child) {
          return Transform.rotate(
            angle: _rotationAnimation.value * 2 * math.pi,
            child: child,
          );
        },
        child: progressIndicator,
      );
    }

    if (widget.enablePulseAnimation && widget.value == null) {
      progressIndicator = AnimatedBuilder(
        animation: _pulseAnimation,
        builder: (context, child) {
          return Transform.scale(
            scale: _pulseAnimation.value,
            child: child,
          );
        },
        child: progressIndicator,
      );
    }

    return progressIndicator;
  }
}

/// Enhanced linear progress indicator
class AnimatedLinearProgressIndicator extends StatefulWidget {
  const AnimatedLinearProgressIndicator({
    this.value,
    this.backgroundColor,
    this.valueColor,
    this.minHeight = 4.0,
    this.semanticsLabel,
    this.semanticsValue,
    this.borderRadius,
    this.enableShimmerAnimation = false,
    super.key,
  });

  final double? value;
  final Color? backgroundColor;
  final Color? valueColor;
  final double minHeight;
  final String? semanticsLabel;
  final String? semanticsValue;
  final BorderRadius? borderRadius;
  final bool enableShimmerAnimation;

  @override
  State<AnimatedLinearProgressIndicator> createState() => _AnimatedLinearProgressIndicatorState();
}

class _AnimatedLinearProgressIndicatorState extends State<AnimatedLinearProgressIndicator>
    with TickerProviderStateMixin {
  late AnimationController _shimmerController;
  late Animation<double> _shimmerAnimation;

  @override
  void initState() {
    super.initState();
    
    _shimmerController = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    );

    _shimmerAnimation = Tween<double>(
      begin: -1.0,
      end: 2.0,
    ).animate(CurvedAnimation(
      parent: _shimmerController,
      curve: Curves.easeInOut,
    ));

    if (widget.enableShimmerAnimation && widget.value == null) {
      _shimmerController.repeat();
    }
  }

  @override
  void didUpdateWidget(AnimatedLinearProgressIndicator oldWidget) {
    super.didUpdateWidget(oldWidget);
    
    if (widget.value == null && oldWidget.value != null) {
      // Started indeterminate
      if (widget.enableShimmerAnimation) {
        _shimmerController.repeat();
      }
    } else if (widget.value != null && oldWidget.value == null) {
      // Became determinate
      _shimmerController.stop();
    }
  }

  @override
  void dispose() {
    _shimmerController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    Widget progressIndicator = ClipRRect(
      borderRadius: widget.borderRadius ?? BorderRadius.circular(widget.minHeight / 2),
      child: LinearProgressIndicator(
        value: widget.value,
        backgroundColor: widget.backgroundColor,
        valueColor: widget.valueColor != null
            ? AlwaysStoppedAnimation<Color>(widget.valueColor!)
            : null,
        minHeight: widget.minHeight,
        semanticsLabel: widget.semanticsLabel,
        semanticsValue: widget.semanticsValue,
      ),
    );

    if (widget.enableShimmerAnimation && widget.value == null) {
      progressIndicator = AnimatedBuilder(
        animation: _shimmerAnimation,
        builder: (context, child) {
          return ShaderMask(
            shaderCallback: (bounds) {
              return LinearGradient(
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
                stops: [
                  _shimmerAnimation.value - 0.3,
                  _shimmerAnimation.value,
                  _shimmerAnimation.value + 0.3,
                ],
                colors: [
                  Colors.transparent,
                  Colors.white.withValues(alpha: 0.5),
                  Colors.transparent,
                ],
              ).createShader(bounds);
            },
            blendMode: BlendMode.srcATop,
            child: child,
          );
        },
        child: progressIndicator,
      );
    }

    return progressIndicator;
  }
}

/// Utility widget for showing loading states with consistent animations
class LoadingOverlay extends StatelessWidget {
  const LoadingOverlay({
    required this.isLoading,
    required this.child,
    this.loadingWidget,
    this.backgroundColor,
    this.opacity = 0.8,
    super.key,
  });

  final bool isLoading;
  final Widget child;
  final Widget? loadingWidget;
  final Color? backgroundColor;
  final double opacity;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        child,
        AppAnimatedSwitcher(
          animationType: AppAnimationType.fade,
          duration: AppAnimations.medium,
          child: isLoading
              ? Container(
                  color: (backgroundColor ?? Colors.black).withValues(alpha: opacity),
                  child: Center(
                    child: loadingWidget ??
                        AnimatedCard(
                          backgroundColor: Theme.of(context).colorScheme.surface,
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const AnimatedProgressIndicator(
                                enablePulseAnimation: true,
                                size: 48,
                              ),
                              const SizedBox(height: 16),
                              Text(
                                'Loading...',
                                style: Theme.of(context).textTheme.bodyMedium,
                              ),
                            ],
                          ),
                        ),
                  ),
                )
              : const SizedBox.shrink(),
        ),
      ],
    );
  }
}