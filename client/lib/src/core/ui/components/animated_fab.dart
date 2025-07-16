import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

/// An enhanced floating action button with smooth animations and micro-interactions
class AnimatedFAB extends StatefulWidget {
  const AnimatedFAB({
    required this.onPressed,
    required this.child,
    this.backgroundColor,
    this.foregroundColor,
    this.elevation,
    this.heroTag,
    this.tooltip,
    this.mini = false,
    this.shape,
    this.enablePulseAnimation = false,
    this.enableScaleAnimation = true,
    super.key,
  });

  final VoidCallback? onPressed;
  final Widget child;
  final Color? backgroundColor;
  final Color? foregroundColor;
  final double? elevation;
  final Object? heroTag;
  final String? tooltip;
  final bool mini;
  final ShapeBorder? shape;
  final bool enablePulseAnimation;
  final bool enableScaleAnimation;

  @override
  State<AnimatedFAB> createState() => _AnimatedFABState();
}

class _AnimatedFABState extends State<AnimatedFAB>
    with TickerProviderStateMixin {
  late AnimationController _scaleController;
  late AnimationController _pulseController;
  late Animation<double> _scaleAnimation;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    
    _scaleController = AnimationController(
      duration: AppAnimations.fast,
      vsync: this,
    );
    
    _pulseController = AnimationController(
      duration: const Duration(seconds: 2),
      vsync: this,
    );

    _scaleAnimation = Tween<double>(
      begin: 1.0,
      end: 0.95,
    ).animate(CurvedAnimation(
      parent: _scaleController,
      curve: AppAnimations.easeInOut,
    ));

    _pulseAnimation = Tween<double>(
      begin: 1.0,
      end: 1.1,
    ).animate(CurvedAnimation(
      parent: _pulseController,
      curve: Curves.easeInOut,
    ));

    if (widget.enablePulseAnimation) {
      _startPulseAnimation();
    }
  }

  @override
  void dispose() {
    _scaleController.dispose();
    _pulseController.dispose();
    super.dispose();
  }

  void _startPulseAnimation() {
    _pulseController.repeat(reverse: true);
  }

  void _stopPulseAnimation() {
    _pulseController.stop();
    _pulseController.reset();
  }

  void _handleTapDown() {
    if (widget.enableScaleAnimation) {
      _scaleController.forward();
    }
    if (widget.enablePulseAnimation) {
      _stopPulseAnimation();
    }
  }

  void _handleTapUp() {
    if (widget.enableScaleAnimation) {
      _scaleController.reverse();
    }
    if (widget.enablePulseAnimation) {
      _startPulseAnimation();
    }
  }

  void _handleTapCancel() {
    if (widget.enableScaleAnimation) {
      _scaleController.reverse();
    }
    if (widget.enablePulseAnimation) {
      _startPulseAnimation();
    }
  }

  @override
  Widget build(BuildContext context) {
    Widget fab = FloatingActionButton(
      onPressed: widget.onPressed,
      backgroundColor: widget.backgroundColor,
      foregroundColor: widget.foregroundColor,
      elevation: widget.elevation,
      heroTag: widget.heroTag,
      tooltip: widget.tooltip,
      mini: widget.mini,
      shape: widget.shape ?? const CircleBorder(),
      child: widget.child,
    );

    if (widget.enableScaleAnimation) {
      fab = AnimatedBuilder(
        animation: _scaleAnimation,
        builder: (context, child) {
          return Transform.scale(
            scale: _scaleAnimation.value,
            child: child,
          );
        },
        child: fab,
      );
    }

    if (widget.enablePulseAnimation) {
      fab = AnimatedBuilder(
        animation: _pulseAnimation,
        builder: (context, child) {
          return Transform.scale(
            scale: _pulseAnimation.value,
            child: child,
          );
        },
        child: fab,
      );
    }

    return GestureDetector(
      onTapDown: (_) => _handleTapDown(),
      onTapUp: (_) => _handleTapUp(),
      onTapCancel: _handleTapCancel,
      child: fab,
    );
  }
}

/// Extended FAB with additional animation options
class AnimatedExtendedFAB extends StatefulWidget {
  const AnimatedExtendedFAB({
    required this.onPressed,
    required this.label,
    this.icon,
    this.backgroundColor,
    this.foregroundColor,
    this.elevation,
    this.heroTag,
    this.tooltip,
    this.shape,
    this.extendedIconLabelSpacing,
    this.extendedPadding,
    this.enableHoverAnimation = true,
    this.enableExtendAnimation = true,
    this.isExtended = true,
    super.key,
  });

  final VoidCallback? onPressed;
  final Widget label;
  final Widget? icon;
  final Color? backgroundColor;
  final Color? foregroundColor;
  final double? elevation;
  final Object? heroTag;
  final String? tooltip;
  final ShapeBorder? shape;
  final double? extendedIconLabelSpacing;
  final EdgeInsetsGeometry? extendedPadding;
  final bool enableHoverAnimation;
  final bool enableExtendAnimation;
  final bool isExtended;

  @override
  State<AnimatedExtendedFAB> createState() => _AnimatedExtendedFABState();
}

class _AnimatedExtendedFABState extends State<AnimatedExtendedFAB>
    with TickerProviderStateMixin {
  late AnimationController _hoverController;
  late Animation<double> _hoverAnimation;
  late Animation<double> _elevationAnimation;

  bool _isHovered = false;

  @override
  void initState() {
    super.initState();
    
    _hoverController = AnimationController(
      duration: AppAnimations.medium,
      vsync: this,
    );

    _hoverAnimation = Tween<double>(
      begin: 1.0,
      end: 1.05,
    ).animate(CurvedAnimation(
      parent: _hoverController,
      curve: AppAnimations.easeOut,
    ));

    _elevationAnimation = Tween<double>(
      begin: widget.elevation ?? 6.0,
      end: (widget.elevation ?? 6.0) + 4.0,
    ).animate(CurvedAnimation(
      parent: _hoverController,
      curve: AppAnimations.easeOut,
    ));
  }

  @override
  void dispose() {
    _hoverController.dispose();
    super.dispose();
  }

  void _handleHover(bool hovering) {
    if (!widget.enableHoverAnimation) return;
    
    setState(() {
      _isHovered = hovering;
    });

    if (hovering) {
      _hoverController.forward();
    } else {
      _hoverController.reverse();
    }
  }

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      onEnter: (_) => _handleHover(true),
      onExit: (_) => _handleHover(false),
      child: AnimatedBuilder(
        animation: _hoverController,
        builder: (context, child) {
          return Transform.scale(
            scale: widget.enableHoverAnimation ? _hoverAnimation.value : 1.0,
            child: FloatingActionButton.extended(
              onPressed: widget.onPressed,
              label: widget.label,
              icon: widget.icon,
              backgroundColor: widget.backgroundColor,
              foregroundColor: widget.foregroundColor,
              elevation: widget.enableHoverAnimation 
                  ? _elevationAnimation.value 
                  : widget.elevation,
              heroTag: widget.heroTag,
              tooltip: widget.tooltip,
              shape: widget.shape,
              extendedIconLabelSpacing: widget.extendedIconLabelSpacing,
              extendedPadding: widget.extendedPadding,
              isExtended: widget.isExtended,
            ),
          );
        },
      ),
    );
  }
}