import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

class OneFieldDialog extends StatefulWidget {
  const OneFieldDialog({
    this.title,
    this.subtitle,
    this.hintText,
    this.initText,
    this.validator,
    this.maxLength,
    super.key,
  });

  final String? title;
  final String? subtitle;
  final String? hintText;
  final String? initText;
  final String? Function(String?)? validator;
  final int? maxLength;

  Future<String?> show(BuildContext context) async {
    return showDialog<String>(
      context: context,
      builder: (context) => this,
    );
  }

  @override
  State<OneFieldDialog> createState() => _OneFieldDialogState();
}

class _OneFieldDialogState extends State<OneFieldDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController controller;

  @override
  void initState() {
    super.initState();
    controller = TextEditingController(text: widget.initText);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: widget.title == null ? null : Text(widget.title!),
      content: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          spacing: 8,
          children: [
            if (widget.subtitle != null) Text(widget.subtitle!),
            TextFormField(
              initialValue: widget.initText,
              controller: controller,
              autofocus: true,
              validator: widget.validator,
              maxLength: widget.maxLength,
              decoration: InputDecoration(
                border: const OutlineInputBorder(),
                hintText: widget.hintText,
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(LocaleKeys.cancel.tr()),
        ),
        ElevatedButton(
          onPressed: () {
            if (_formKey.currentState?.validate() ?? false) {
              Navigator.of(context).pop(controller.text);
            }
          },
          child: Text(LocaleKeys.ok.tr()),
        ),
      ],
    );
  }
}
