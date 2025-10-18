import 'package:flutter/material.dart';
import 'package:oq_editor/controllers/oq_editor_controller.dart';
import 'package:oq_editor/models/editor_step.dart';
import 'package:oq_editor/view/screens/package_info_screen.dart';
import 'package:oq_editor/view/screens/questions_list_screen.dart';
import 'package:oq_editor/view/screens/round_editor_screen.dart';
import 'package:oq_editor/view/screens/rounds_list_screen.dart';
import 'package:oq_editor/view/screens/theme_editor_screen.dart';
import 'package:oq_editor/view/screens/themes_grid_screen.dart';
import 'package:oq_shared/oq_shared.dart';
import 'package:watch_it/watch_it.dart';

class OqEditorScreen extends WatchingWidget {
  const OqEditorScreen({required this.controller, super.key});
  final OqEditorController controller;

  @override
  Widget build(BuildContext context) {
    callOnce(
      (context) => GetIt.I.registerSingleton<OqEditorController>(controller),
      dispose: () =>
          GetIt.I.unregister<OqEditorController>(instance: controller),
    );

    final currentStep = watchValue((OqEditorController c) => c.currentStep);

    return Scaffold(
      body: MaxSizeContainer(
        child: Scaffold(
          appBar: AppBar(
            title: Text(controller.translations.editorTitle),
            actions: [
              // Save button (placeholder for now)
              IconButton(
                icon: const Icon(Icons.save),
                onPressed: () {
                  // TODO: Implement save functionality
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Save functionality coming soon'),
                    ),
                  );
                },
                tooltip: controller.translations.saveButton,
              ),
            ],
          ),
          body: AnimatedSwitcher(
            duration: const Duration(milliseconds: 300),
            switchInCurve: Curves.easeInOut,
            switchOutCurve: Curves.easeInOut,
            transitionBuilder: (child, animation) {
              return FadeTransition(
                opacity: animation,
                child: SlideTransition(
                  position: Tween<Offset>(
                    begin: const Offset(0.1, 0),
                    end: Offset.zero,
                  ).animate(animation),
                  child: child,
                ),
              );
            },
            child: _buildCurrentScreen(currentStep),
          ),
        ),
      ),
    );
  }

  Widget _buildCurrentScreen(EditorStep step) {
    // Use different keys to force AnimatedSwitcher to animate
    switch (step) {
      case EditorStep.packageInfo:
        return const PackageInfoScreen(key: ValueKey('package_info'));
      case EditorStep.roundsList:
        return const RoundsListScreen(key: ValueKey('rounds_list'));
      case EditorStep.roundEditor:
        return const RoundEditorScreen(key: ValueKey('round_editor'));
      case EditorStep.themesGrid:
        return const ThemesGridScreen(key: ValueKey('themes_grid'));
      case EditorStep.themeEditor:
        return const ThemeEditorScreen(key: ValueKey('theme_editor'));
      case EditorStep.questionsList:
        return const QuestionsListScreen(key: ValueKey('questions_list'));
    }
  }
}
