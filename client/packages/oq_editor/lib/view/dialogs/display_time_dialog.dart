import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:oq_editor/controllers/oq_editor_controller.dart';

/// Dialog for editing media display time
class DisplayTimeDialog extends StatefulWidget {
  const DisplayTimeDialog({
    required this.initialValue,
    super.key,
  });

  final int initialValue;

  @override
  State<DisplayTimeDialog> createState() => _DisplayTimeDialogState();

  /// Show the display time dialog
  static Future<int?> show(BuildContext context, int initialValue) {
    return showDialog<int>(
      context: context,
      builder: (context) => DisplayTimeDialog(initialValue: initialValue),
    );
  }
}

class _DisplayTimeDialogState extends State<DisplayTimeDialog> {
  late final TextEditingController _controller;
  String? _error;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialValue.toString());
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = GetIt.I<OqEditorController>();
    final translations = controller.translations;

    return AlertDialog(
      title: Text(translations.editDisplayTime),
      content: TextField(
        controller: _controller,
        decoration: InputDecoration(
          labelText: '${translations.displayTime} (${translations.ms})',
          border: const OutlineInputBorder(),
          suffixText: translations.ms,
          errorText: _error,
        ),
        keyboardType: TextInputType.number,
        autofocus: true,
        onChanged: (_) {
          if (_error != null) {
            setState(() => _error = null);
          }
        },
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text(translations.cancelButton),
        ),
        FilledButton(
          onPressed: _save,
          child: Text(translations.saveButton),
        ),
      ],
    );
  }

  void _save() {
    final controller = GetIt.I<OqEditorController>();
    final translations = controller.translations;

    final text = _controller.text.trim();
    if (text.isEmpty) {
      setState(() => _error = translations.required);
      return;
    }

    final time = int.tryParse(text);
    if (time == null) {
      setState(() => _error = translations.invalidNumber);
      return;
    }

    if (time <= 0) {
      setState(() => _error = translations.mustBePositive);
      return;
    }

    Navigator.pop(context, time);
  }
}
