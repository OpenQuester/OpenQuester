import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

class GameLobbyTheme extends StatelessWidget {
  const GameLobbyTheme({required this.theme, super.key});
  final SocketIoGameStateThemeData theme;

  @override
  Widget build(BuildContext context) {
    final questions = theme.sortedQuestions();
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              theme.name,
              style: context.textTheme.headlineMedium,
            ).flexible(),
            if (!theme.description.isEmptyOrNull)
              Tooltip(
                triggerMode: TooltipTriggerMode.tap,
                message: theme.description,
                child: const Icon(Icons.info),
              ).paddingLeft(8),
          ],
        ),
        const Divider(),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final question in questions) GameQuestion(question: question),
          ],
        ),
      ],
    ).paddingSymmetric(horizontal: 16);
  }
}
