import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

/// Reusable layout for question display with text and media
class GameQuestionLayout extends WatchingWidget {
  const GameQuestionLayout({
    required this.text,
    required this.file,
    required this.bottomContent,
    super.key,
  });

  final String? text;
  final PackageQuestionFile? file;
  final Widget? bottomContent;

  @override
  Widget build(BuildContext context) {
    final questionMediaOnLeft = GameLobbyStyles.questionMediaOnLeft(context);

    final scrollController = createOnce(
      ScrollController.new,
      dispose: (controller) => controller.dispose(),
    );
    final questionTextWidget = _buildQuestionText(
      context: context,
      text: text,
      file: file,
      scrollController: scrollController,
    );

    return ConditionalScrollBuilder(
      minHeightThreshold: 600,
      child: Column(
        spacing: 16,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const GameQuestionTimer(),
          Flex(
            spacing: 16,
            mainAxisAlignment: MainAxisAlignment.center,
            direction: questionMediaOnLeft ? Axis.horizontal : Axis.vertical,
            children: [
              if (!questionMediaOnLeft && questionTextWidget != null)
                questionTextWidget.flexible(flex: file != null ? 0 : 1),
              if (file != null) GameQuestionMediaWidget(file: file!).expand(),
              if (questionMediaOnLeft && questionTextWidget != null)
                ConstrainedBox(
                  constraints: BoxConstraints(
                    maxWidth: file == null ? double.infinity : 150,
                    maxHeight: file == null ? double.infinity : 300,
                  ),
                  child: questionTextWidget,
                ).expand(),
              if (questionMediaOnLeft && bottomContent != null)
                SizedBox(width: 250, child: bottomContent).flexible(),
            ],
          ).expand(),
          if (!questionMediaOnLeft) ?bottomContent,
        ],
      ),
    );
  }

  Widget? _buildQuestionText({
    required BuildContext context,
    required ScrollController scrollController,
    required String? text,
    required PackageQuestionFile? file,
  }) {
    if (text.isEmptyOrNull) return null;

    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 50, minWidth: 250),
      child: Scrollbar(
        trackVisibility: true,
        thumbVisibility: true,
        controller: scrollController,
        child: Row(
          children: [
            ListView(
              shrinkWrap: true,
              controller: scrollController,
              children: [
                Text(
                  text ?? '',
                  style: file != null
                      ? context.textTheme.bodyLarge
                      : context.textTheme.headlineLarge,
                  textAlign: TextAlign.center,
                ),
              ],
            ).expand(),
          ],
        ),
      ),
    );
  }
}

/// Widget for displaying question text
class GameQuestionText extends WatchingWidget {
  const GameQuestionText({
    required this.text,
    required this.file,
    super.key,
  });

  final String? text;
  final PackageQuestionFile? file;

  @override
  Widget build(BuildContext context) {
    if (text.isEmptyOrNull) return const SizedBox.shrink();

    final scrollController = createOnce(
      ScrollController.new,
      dispose: (controller) => controller.dispose(),
    );

    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 50, minWidth: 250),
      child: Scrollbar(
        trackVisibility: true,
        thumbVisibility: true,
        controller: scrollController,
        child: Row(
          children: [
            ListView(
              shrinkWrap: true,
              controller: scrollController,
              children: [
                Text(
                  text ?? '',
                  style: file != null
                      ? context.textTheme.bodyLarge
                      : context.textTheme.headlineLarge,
                  textAlign: TextAlign.center,
                ),
              ],
            ).expand(),
          ],
        ),
      ),
    );
  }
}
