import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

class ConfirmDialog extends StatelessWidget {
  const ConfirmDialog({
    required this.title,
    this.content,
    this.confirmText,
    this.cancelText,
    this.isDestructive = false,
    super.key,
  });
  
  final String title;
  final String? content;
  final String? confirmText;
  final String? cancelText;
  final bool isDestructive;

  Future<bool> show(BuildContext context) async {
    final result = await Navigator.of(context).push<bool>(
      PageRouteBuilder<bool>(
        pageBuilder: (context, animation, _) => AdaptiveDialog(
          builder: (context) => this,
        ),
        transitionDuration: AppAnimations.modalEntry,
        reverseTransitionDuration: AppAnimations.modalExit,
        transitionsBuilder: (context, animation, _, child) {
          return FadeTransition(
            opacity: animation,
            child: child,
          );
        },
        opaque: false,
        barrierDismissible: true,
        barrierColor: Colors.black54,
      ),
    );
    return result ?? false;
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedCard(
      elevation: 24,
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(24),
      enableHoverEffect: false,
      enableTapAnimation: false,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isDestructive ? Icons.warning_rounded : Icons.help_outline_rounded,
            size: 48,
            color: isDestructive 
                ? Theme.of(context).extension<ExtraColors>()?.warning
                : Theme.of(context).colorScheme.primary,
          ),
          const SizedBox(height: 16),
          Text(
            title,
            style: context.textTheme.titleLarge,
            textAlign: TextAlign.center,
          ),
          if (content != null) ...[
            const SizedBox(height: 12),
            Text(
              content!,
              style: context.textTheme.bodyMedium?.copyWith(
                color: context.textTheme.bodySmall?.color,
              ),
              textAlign: TextAlign.center,
            ),
          ],
          const SizedBox(height: 24),
          Row(
            spacing: 16,
            children: [
              OutlinedButton(
                child: Text(cancelText ?? LocaleKeys.no.tr()),
                onPressed: () => Navigator.of(context).pop(false),
              ).expand(),
              FilledButton(
                style: isDestructive
                    ? FilledButton.styleFrom(
                        backgroundColor: Theme.of(context).colorScheme.error,
                        foregroundColor: Theme.of(context).colorScheme.onError,
                      )
                    : null,
                onPressed: () => Navigator.of(context).pop(true),
                child: Text(confirmText ?? LocaleKeys.yes.tr()),
              ).expand(),
            ],
          ),
        ],
      ),
    );
  }
}

/// Extension for easier dialog usage
extension DialogExtension on BuildContext {
  Future<bool> showConfirmDialog({
    required String title,
    String? content,
    String? confirmText,
    String? cancelText,
    bool isDestructive = false,
  }) {
    return ConfirmDialog(
      title: title,
      content: content,
      confirmText: confirmText,
      cancelText: cancelText,
      isDestructive: isDestructive,
    ).show(this);
  }
}
