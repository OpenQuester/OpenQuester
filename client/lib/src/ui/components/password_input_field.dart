import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

/// Reusable password input field with show/hide toggle
class PasswordInputField extends StatefulWidget {
  const PasswordInputField({
    required this.onChanged,
    this.initialValue,
    this.controller,
    this.labelText,
    this.hintText,
    this.validator,
    this.autofocus = false,
    this.onFieldSubmitted,
    this.maxLength,
    super.key,
  });

  final String? initialValue;
  final TextEditingController? controller;
  final String? labelText;
  final String? hintText;
  final ValueChanged<String>? onChanged;
  final FormFieldValidator<String>? validator;
  final bool autofocus;
  final ValueChanged<String>? onFieldSubmitted;
  final int? maxLength;

  @override
  State<PasswordInputField> createState() => _PasswordInputFieldState();
}

class _PasswordInputFieldState extends State<PasswordInputField> {
  bool _obscurePassword = true;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      initialValue: widget.initialValue,
      controller: widget.controller,
      onChanged: widget.onChanged,
      obscureText: _obscurePassword,
      autofocus: widget.autofocus,
      decoration: InputDecoration(
        labelText: widget.labelText,
        hintText: widget.hintText,
        prefixIcon: const Icon(Icons.lock_outline_rounded),
        suffixIcon: IconButton(
          icon: Icon(
            _obscurePassword
                ? Icons.visibility_outlined
                : Icons.visibility_off_outlined,
          ),
          onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
          tooltip: _obscurePassword
              ? LocaleKeys.show_password.tr()
              : LocaleKeys.hide_password.tr(),
        ),
      ),
      validator: widget.validator,
      onFieldSubmitted: widget.onFieldSubmitted,
      maxLength: widget.maxLength,
    );
  }
}
