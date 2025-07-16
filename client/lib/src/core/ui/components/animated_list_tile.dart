import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

/// An enhanced list tile with smooth animations and improved UX
class AnimatedListTile extends StatefulWidget {
  const AnimatedListTile({
    required this.title,
    this.subtitle,
    this.leading,
    this.trailing,
    this.onTap,
    this.onLongPress,
    this.contentPadding,
    this.backgroundColor,
    this.selectedColor,
    this.isSelected = false,
    this.enableAnimations = true,
    super.key,
  });

  final Widget title;
  final Widget? subtitle;
  final Widget? leading;
  final Widget? trailing;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final EdgeInsetsGeometry? contentPadding;
  final Color? backgroundColor;
  final Color? selectedColor;
  final bool isSelected;
  final bool enableAnimations;

  @override
  State<AnimatedListTile> createState() => _AnimatedListTileState();
}

class _AnimatedListTileState extends State<AnimatedListTile>
    with TickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;
  late Animation<Color?> _colorAnimation;
  
  bool _isPressed = false;

  @override
  void initState() {
    super.initState();
    
    _controller = AnimationController(
      duration: const Duration(milliseconds: 150),
      vsync: this,
    );

    _scaleAnimation = Tween<double>(
      begin: 1.0,
      end: 0.98,
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: Curves.easeInOut,
    ));
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    
    _colorAnimation = ColorTween(
      begin: widget.backgroundColor ?? Colors.transparent,
      end: widget.selectedColor ?? 
           Theme.of(context).colorScheme.primaryContainer.withValues(alpha: 0.1),
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

  void _handleTapDown() {
    if (!widget.enableAnimations) return;
    
    setState(() {
      _isPressed = true;
    });
    _controller.forward();
  }

  void _handleTapUp() {
    if (!widget.enableAnimations) return;
    
    setState(() {
      _isPressed = false;
    });
    _controller.reverse();
  }

  void _handleTapCancel() {
    if (!widget.enableAnimations) return;
    
    setState(() {
      _isPressed = false;
    });
    _controller.reverse();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.onTap,
      onLongPress: widget.onLongPress,
      onTapDown: (_) => _handleTapDown(),
      onTapUp: (_) => _handleTapUp(),
      onTapCancel: _handleTapCancel,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) {
          return Transform.scale(
            scale: widget.enableAnimations ? _scaleAnimation.value : 1.0,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              decoration: BoxDecoration(
                color: widget.isSelected 
                    ? (widget.selectedColor ?? 
                       Theme.of(context).colorScheme.primaryContainer.withValues(alpha: 0.1))
                    : (_isPressed ? _colorAnimation.value : widget.backgroundColor),
                borderRadius: BorderRadius.circular(8),
              ),
              child: ListTile(
                title: widget.title,
                subtitle: widget.subtitle,
                leading: widget.leading,
                trailing: widget.trailing,
                contentPadding: widget.contentPadding ?? 
                               const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                onTap: null, // We handle taps in the GestureDetector above
                onLongPress: null,
              ),
            ),
          );
        },
      ),
    );
  }
}