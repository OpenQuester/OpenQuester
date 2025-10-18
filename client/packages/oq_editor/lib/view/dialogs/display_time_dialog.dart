import 'package:flutter/material.dart';

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
    return AlertDialog(
      title: const Text('Edit Display Time'),
      content: TextField(
        controller: _controller,
        decoration: InputDecoration(
          labelText: 'Display Time (ms)',
          border: const OutlineInputBorder(),
          suffixText: 'ms',
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
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _save,
          child: const Text('Save'),
        ),
      ],
    );
  }

  void _save() {
    final text = _controller.text.trim();
    if (text.isEmpty) {
      setState(() => _error = 'Required');
      return;
    }

    final time = int.tryParse(text);
    if (time == null) {
      setState(() => _error = 'Invalid number');
      return;
    }

    if (time <= 0) {
      setState(() => _error = 'Must be positive');
      return;
    }

    Navigator.pop(context, time);
  }
}
