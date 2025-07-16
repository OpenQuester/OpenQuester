import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

/// An animated card widget with hover effects and smooth interactions
class AnimatedCard extends StatefulWidget {
  const AnimatedCard({
    required this.child,
    this.onTap,
    this.elevation,
    this.borderRadius,
    this.padding,
    this.margin,
    this.backgroundColor,
    this.enableHoverEffect = true,
    this.enableTapAnimation = true,
    super.key,
  });

  final Widget child;
  final VoidCallback? onTap;
  final double? elevation;
  final BorderRadius? borderRadius;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final Color? backgroundColor;
  final bool enableHoverEffect;
  final bool enableTapAnimation;

  @override
  State<AnimatedCard> createState() => _AnimatedCardState();
}

class _AnimatedCardState extends State<AnimatedCard>
    with TickerProviderStateMixin {
  late AnimationController _hoverController;
  late AnimationController _tapController;
  late Animation<double> _hoverAnimation;
  late Animation<double> _tapAnimation;
  late Animation<double> _elevationAnimation;

  bool _isHovered = false;

  @override
  void initState() {
    super.initState();
    
    _hoverController = AnimationController(
      duration: const Duration(milliseconds: 200),
      vsync: this,
    );
    
    _tapController = AnimationController(
      duration: const Duration(milliseconds: 100),
      vsync: this,
    );

    _hoverAnimation = Tween<double>(
      begin: 1.0,
      end: 1.02,
    ).animate(CurvedAnimation(
      parent: _hoverController,
      curve: Curves.easeOut,
    ));

    _tapAnimation = Tween<double>(
      begin: 1.0,
      end: 0.98,
    ).animate(CurvedAnimation(
      parent: _tapController,
      curve: Curves.easeInOut,
    ));

    _elevationAnimation = Tween<double>(
      begin: widget.elevation ?? 2.0,
      end: (widget.elevation ?? 2.0) + 4.0,
    ).animate(CurvedAnimation(
      parent: _hoverController,
      curve: Curves.easeOut,
    ));
  }

  @override
  void dispose() {
    _hoverController.dispose();
    _tapController.dispose();
    super.dispose();
  }

  void _handleHover(bool hovering) {
    if (!widget.enableHoverEffect) return;
    
    setState(() {
      _isHovered = hovering;
    });

    if (hovering) {
      _hoverController.forward();
    } else {
      _hoverController.reverse();
    }
  }

  void _handleTapDown() {
    if (!widget.enableTapAnimation) return;
    _tapController.forward();
  }

  void _handleTapUp() {
    if (!widget.enableTapAnimation) return;
    _tapController.reverse();
  }

  void _handleTapCancel() {
    if (!widget.enableTapAnimation) return;
    _tapController.reverse();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: widget.margin,
      child: MouseRegion(
        onEnter: (_) => _handleHover(true),
        onExit: (_) => _handleHover(false),
        child: GestureDetector(
          onTap: widget.onTap,
          onTapDown: (_) => _handleTapDown(),
          onTapUp: (_) => _handleTapUp(),
          onTapCancel: _handleTapCancel,
          child: AnimatedBuilder(
            animation: Listenable.merge([_hoverAnimation, _tapAnimation]),
            builder: (context, child) {
              return Transform.scale(
                scale: _hoverAnimation.value * _tapAnimation.value,
                child: AnimatedBuilder(
                  animation: _elevationAnimation,
                  builder: (context, child) {
                    return Card(
                      elevation: _elevationAnimation.value,
                      color: widget.backgroundColor,
                      shape: RoundedRectangleBorder(
                        borderRadius: widget.borderRadius ?? BorderRadius.circular(12),
                      ),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        padding: widget.padding,
                        decoration: BoxDecoration(
                          borderRadius: widget.borderRadius ?? BorderRadius.circular(12),
                          border: _isHovered
                              ? Border.all(
                                  color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.2),
                                  width: 1,
                                )
                              : null,
                        ),
                        child: widget.child,
                      ),
                    );
                  },
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}