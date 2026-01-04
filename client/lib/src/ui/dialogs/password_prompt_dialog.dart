import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

/// Dialog for prompting user to enter a password to join a private game
class PasswordPromptDialog extends StatefulWidget {
  const PasswordPromptDialog({
    required this.gameTitle,
    super.key,
  });

  final String gameTitle;

  @override
  State<PasswordPromptDialog> createState() => _PasswordPromptDialogState();

  /// Shows the password prompt dialog and returns the entered password
  /// Returns null if user cancels
  static Future<String?> show(
    BuildContext context, {
    required String gameTitle,
  }) async {
    return showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (context) => PasswordPromptDialog(gameTitle: gameTitle),
    );
  }
}

class _PasswordPromptDialogState extends State<PasswordPromptDialog> {
  final _formKey = GlobalKey<FormState>();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _passwordController.dispose();
    super.dispose();
  }

  void _submit() {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    Navigator.of(context).pop(_passwordController.text);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Row(
        children: [
          Icon(
            Icons.lock_rounded,
            color: context.theme.colorScheme.primary,
            size: 24,
          ).paddingRight(12),
          Expanded(
            child: Text(
              LocaleKeys.enter_password.tr(),
              style: context.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
      content: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              LocaleKeys.enter_game_password.tr(),
              style: context.textTheme.bodyMedium?.copyWith(
                color: context.theme.colorScheme.onSurface.withValues(
                  alpha: 0.7,
                ),
              ),
            ).paddingBottom(8),
            Container(
              padding: 12.all,
              decoration: BoxDecoration(
                color: context.theme.colorScheme.primaryContainer.withValues(
                  alpha: 0.3,
                ),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.gamepad_rounded,
                    size: 18,
                    color: context.theme.colorScheme.primary,
                  ).paddingRight(8),
                  Expanded(
                    child: Text(
                      widget.gameTitle,
                      style: context.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ).paddingBottom(16),
            TextFormField(
              controller: _passwordController,
              obscureText: _obscurePassword,
              autofocus: true,
              decoration: InputDecoration(
                labelText: LocaleKeys.password.tr(),
                prefixIcon: const Icon(Icons.lock_outline_rounded),
                suffixIcon: IconButton(
                  icon: Icon(
                    _obscurePassword
                        ? Icons.visibility_outlined
                        : Icons.visibility_off_outlined,
                  ),
                  onPressed: () =>
                      setState(() => _obscurePassword = !_obscurePassword),
                  tooltip: _obscurePassword
                      ? LocaleKeys.show_password.tr()
                      : LocaleKeys.hide_password.tr(),
                ),
              ),
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return LocaleKeys.password_required.tr();
                }
                if (value.length > GameValidationConst.maxPasswordLength) {
                  return LocaleKeys.min_length_error.tr(
                    args: [GameValidationConst.maxPasswordLength.toString()],
                  );
                }
                if (!GameValidationConst.passwordRegExp.hasMatch(value)) {
                  return LocaleKeys.password_validation.tr();
                }
                return null;
              },
              onFieldSubmitted: (_) => _submit(),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(LocaleKeys.cancel.tr()),
        ),
        FilledButton(
          onPressed: _submit,
          child: Text(LocaleKeys.join_game.tr()),
        ),
      ],
    );
  }
}
