import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

class ConfirmDialog extends StatelessWidget {
  const ConfirmDialog({required this.title, super.key});
  final String title;

  Future<bool> show(BuildContext context) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => this,
    );
    return result ?? false;
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(
        title,
        style: context.textTheme.titleMedium,
        textAlign: TextAlign.center,
      ),
      insetPadding: 8.all,
      actions: <Widget>[
        Row(
          spacing: 16,
          children: [
            OutlinedButton(
              child: Text(LocaleKeys.no.tr()),
              onPressed: () => Navigator.of(context).pop(false),
            ).expand(),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: Text(LocaleKeys.yes.tr()),
            ).expand(),
          ],
        ),
      ],
    );
  }
}
