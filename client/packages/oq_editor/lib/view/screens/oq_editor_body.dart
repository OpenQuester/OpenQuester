import 'dart:async';

import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/controllers/oq_editor_controller.dart';
import 'package:oq_editor/domain/editor_node_id.dart';
import 'package:oq_editor/domain/package_editor_operation_state.dart';
import 'package:oq_editor/router/router.gr.dart';
import 'package:oq_editor/view/widgets/package_size_indicator.dart';
import 'package:oq_shared/ui/max_size_container.dart';
import 'package:watch_it/watch_it.dart';

class OqEditorBody extends WatchingWidget {
  const OqEditorBody({
    required this.controller,
    required this.child,
    super.key,
  });

  final OqEditorController controller;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final operation = watch(controller.operationState).value;
    final hasLogs = watch(controller.operationLogs).value.isNotEmpty;
    final outlinePanelVisible = watch(controller.outlinePanelVisible).value;
    final previewPanelVisible = watch(controller.previewPanelVisible).value;
    final isRunning = operation.isRunning;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        unawaited(_handleBack(context));
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(controller.translations.editorTitle),
          leading: BackButton(onPressed: () => _handleBack(context)),
          actions: [
            Builder(
              builder: (context) {
                final isCompact = MediaQuery.sizeOf(context).width < 900;
                if (!isCompact) return const SizedBox.shrink();

                return IconButton(
                  icon: const Icon(Icons.account_tree_outlined),
                  onPressed: () => Scaffold.of(context).openDrawer(),
                  tooltip: controller.translations.packageInfo,
                );
              },
            ),
            Builder(
              builder: (context) {
                final isCompact = MediaQuery.sizeOf(context).width < 900;
                if (isCompact) return const SizedBox.shrink();

                return IconButton(
                  icon: Icon(
                    outlinePanelVisible
                        ? Icons.view_sidebar_outlined
                        : Icons.view_sidebar,
                  ),
                  onPressed: () {
                    controller.outlinePanelVisible.value = !outlinePanelVisible;
                  },
                  tooltip: controller.translations.packageInfo,
                );
              },
            ),
            Builder(
              builder: (context) {
                final isCompact = MediaQuery.sizeOf(context).width < 900;
                if (isCompact) return const SizedBox.shrink();

                return IconButton(
                  icon: Icon(
                    previewPanelVisible
                        ? Icons.preview_outlined
                        : Icons.preview,
                  ),
                  onPressed: () {
                    controller.previewPanelVisible.value = !previewPanelVisible;
                  },
                  tooltip: controller.translations.preview,
                );
              },
            ),
            IconButton(
              icon: const Icon(Icons.upload_file),
              onPressed: isRunning ? null : () => _runImportAction(context),
              tooltip: controller.translations.importPackageTooltip,
            ),
            IconButton(
              icon: const Icon(Icons.download),
              onPressed: isRunning
                  ? null
                  : () => _runToolbarAction(
                      context,
                      controller.exportPackage,
                    ),
              tooltip: controller.translations.exportPackageTooltip,
            ),
            IconButton(
              icon: const Icon(Icons.save),
              onPressed: isRunning ? null : () => _openUploadPage(context),
              tooltip: controller.translations.saveButton,
            ),
            if (hasLogs)
              IconButton(
                icon: const Icon(Icons.receipt_long_outlined),
                onPressed: () => _showProcessLogs(context),
                tooltip: controller.translations.showProcessLogs,
              ),
          ],
        ),
        drawer: _EditorDrawer(
          controller: controller,
          onNodeSelected: (node) => _navigateToNode(context, node),
          onImport: () => _runImportAction(context),
        ),
        body: MaxSizeContainer(
          child: Column(
            children: [
              PackageSizeIndicator(controller: controller),
              _OperationBanner(
                operation: operation,
                controller: controller,
              ),
              Expanded(
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final isCompact = constraints.maxWidth < 900;
                    if (isCompact) {
                      return _CompactEditorLayout(
                        controller: controller,
                        child: child,
                      );
                    }

                    return _DesktopEditorLayout(
                      controller: controller,
                      child: child,
                      onNodeSelected: (node) => _navigateToNode(context, node),
                      onImport: () => _runImportAction(context),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _handleBack(BuildContext context) async {
    final router = context.router;
    if (router.pageCount > 1) {
      await router.maybePop();
      return;
    }

    if (!controller.hasUnsavedChanges.value) {
      await router.parent()?.maybePop();
      return;
    }

    final exit = await showDialog<bool>(
      context: context,
      useRootNavigator: false,
      builder: (context) => AlertDialog(
        title: Text(controller.translations.leaveWarning),
        content: Text(controller.translations.unsavedChangesWarning),
        actions: [
          TextButton(
            onPressed: () => context.router.pop(false),
            child: Text(controller.translations.continueEditing),
          ),
          TextButton(
            onPressed: () => context.router.pop(true),
            style: TextButton.styleFrom(
              foregroundColor: Theme.of(context).colorScheme.error,
            ),
            child: Text(controller.translations.leave),
          ),
          TextButton(
            onPressed: controller.operationState.value.isRunning
                ? null
                : () async {
                    await controller.exportPackage();
                    if (context.mounted) await context.router.maybePop(true);
                  },
            child: Text(controller.translations.saveAsFile),
          ),
          FilledButton(
            onPressed: controller.operationState.value.isRunning
                ? null
                : () async {
                    await context.router.maybePop(false);
                    if (context.mounted) await _openUploadPage(context);
                  },
            child: Text(controller.translations.saveToServer),
          ),
        ],
      ),
    );

    if ((exit ?? false) && context.mounted) {
      await router.parent()?.maybePop();
    }
  }

  Future<void> _runToolbarAction(
    BuildContext context,
    Future<void> Function() action,
  ) async {
    try {
      await action();
      if (!context.mounted) return;

      final operation = controller.operationState.value;
      final message = operation.mapOrNull(
        completed: (state) => state.message,
      );
      if (message == null) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor: Colors.green,
        ),
      );
    } catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(controller.userFacingError(error)),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    }
  }

  Future<void> _runImportAction(BuildContext context) async {
    if (controller.hasUnsavedChanges.value) {
      final confirmed = await _confirmImportReplace(context);
      if (!confirmed) return;
      if (!context.mounted) return;
    }

    controller.clearOperationLogs();
    await _runToolbarAction(context, controller.importPickedPackage);
  }

  Future<bool> _confirmImportReplace(BuildContext context) async {
    final result = await showDialog<bool>(
      context: context,
      useRootNavigator: false,
      builder: (context) => AlertDialog(
        title: Text(controller.translations.importReplaceTitle),
        content: Text(controller.translations.importReplaceMessage),
        actions: [
          TextButton(
            onPressed: () => context.router.pop(false),
            child: Text(controller.translations.cancelButton),
          ),
          FilledButton(
            onPressed: () => context.router.pop(true),
            child: Text(controller.translations.importPackage),
          ),
        ],
      ),
    );

    return result ?? false;
  }

  Future<void> _openUploadPage(BuildContext context) async {
    final valid = controller.refreshValidationIssues();
    if (!valid) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(controller.translations.fixIssuesBeforeSaving),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
      final issueNodes = controller.validationIssues.value.keys;
      final firstNode = issueNodes.isEmpty ? null : issueNodes.first;
      if (firstNode != null) {
        await _navigateToNode(context, firstNode);
      }
      return;
    }

    controller.clearOperationLogs();
    await context.router.push(const UploadProgressRoute());
  }

  Future<void> _showProcessLogs(BuildContext context) async {
    await showDialog<void>(
      context: context,
      useRootNavigator: false,
      builder: (context) => AlertDialog(
        title: Text(controller.translations.processLogs),
        content: SizedBox(
          width: 640,
          child: SingleChildScrollView(
            child: SelectableText(controller.operationLogText),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => context.router.pop(),
            child: Text(controller.translations.closeButton),
          ),
        ],
      ),
    );
  }

  Future<void> _navigateToNode(BuildContext context, EditorNodeId node) async {
    controller.selectNode(node);

    final route = node.map<PageRouteInfo>(
      package: (_) => const PackageInfoRoute(),
      round: (node) => RoundEditorRoute(roundIndex: node.roundIndex),
      theme: (node) => ThemeEditorRoute(
        roundIndex: node.roundIndex,
        themeIndex: node.themeIndex,
      ),
      question: (node) => QuestionEditorRoute(
        roundIndex: node.roundIndex,
        themeIndex: node.themeIndex,
        questionIndex: node.questionIndex,
      ),
    );

    await context.router.push(route);
  }
}

class _EditorDrawer extends StatelessWidget {
  const _EditorDrawer({
    required this.controller,
    required this.onNodeSelected,
    required this.onImport,
  });

  final OqEditorController controller;
  final Future<void> Function(EditorNodeId node) onNodeSelected;
  final Future<void> Function() onImport;

  @override
  Widget build(BuildContext context) {
    return Drawer(
      child: SafeArea(
        child: _EditorOutline(
          controller: controller,
          onImport: onImport,
          onNodeSelected: (node) async {
            Navigator.of(context).pop();
            await onNodeSelected(node);
          },
        ),
      ),
    );
  }
}

class _DesktopEditorLayout extends WatchingWidget {
  const _DesktopEditorLayout({
    required this.controller,
    required this.child,
    required this.onNodeSelected,
    required this.onImport,
  });

  final OqEditorController controller;
  final Widget child;
  final Future<void> Function(EditorNodeId node) onNodeSelected;
  final Future<void> Function() onImport;

  @override
  Widget build(BuildContext context) {
    final outlineVisible = watch(controller.outlinePanelVisible).value;
    final previewVisible = watch(controller.previewPanelVisible).value;
    final outlineWidth = watch(controller.outlinePanelWidth).value;
    final previewWidth = watch(controller.previewPanelWidth).value;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (outlineVisible) ...[
          SizedBox(
            width: outlineWidth,
            child: _EditorPanelChrome(
              title: controller.translations.packageInfo,
              icon: Icons.account_tree_outlined,
              onClose: () => controller.outlinePanelVisible.value = false,
              child: _EditorOutline(
                controller: controller,
                onImport: onImport,
                onNodeSelected: onNodeSelected,
              ),
            ),
          ),
          _ResizeHandle(
            onDrag: (delta) {
              controller.outlinePanelWidth.value =
                  (controller.outlinePanelWidth.value + delta).clamp(
                    260,
                    520,
                  );
            },
          ),
        ],
        Expanded(
          child: _EditorContentFrame(child: child),
        ),
        if (previewVisible) ...[
          _ResizeHandle(
            onDrag: (delta) {
              controller.previewPanelWidth.value =
                  (controller.previewPanelWidth.value - delta).clamp(
                    280,
                    560,
                  );
            },
          ),
          SizedBox(
            width: previewWidth,
            child: _EditorPanelChrome(
              title: controller.translations.preview,
              icon: Icons.preview_outlined,
              onClose: () => controller.previewPanelVisible.value = false,
              child: _EditorPreviewPanel(controller: controller),
            ),
          ),
        ],
      ],
    );
  }
}

class _CompactEditorLayout extends StatelessWidget {
  const _CompactEditorLayout({
    required this.controller,
    required this.child,
  });

  final OqEditorController controller;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Column(
        children: [
          TabBar(
            tabs: [
              Tab(text: controller.translations.editorTitle),
              Tab(text: controller.translations.preview),
            ],
          ),
          Expanded(
            child: TabBarView(
              children: [
                _EditorContentFrame(child: child),
                _EditorContentFrame(
                  child: _EditorPreviewPanel(controller: controller),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _EditorContentFrame extends StatelessWidget {
  const _EditorContentFrame({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: ClipRect(child: child),
    );
  }
}

class _EditorPanelChrome extends StatelessWidget {
  const _EditorPanelChrome({
    required this.title,
    required this.icon,
    required this.onClose,
    required this.child,
  });

  final String title;
  final IconData icon;
  final VoidCallback onClose;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerLowest,
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 8, 6),
            child: Row(
              children: [
                Icon(icon, size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: onClose,
                  tooltip: MaterialLocalizations.of(context).closeButtonTooltip,
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(child: child),
        ],
      ),
    );
  }
}

class _ResizeHandle extends StatelessWidget {
  const _ResizeHandle({required this.onDrag});

  final void Function(double delta) onDrag;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      cursor: SystemMouseCursors.resizeColumn,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onHorizontalDragUpdate: (details) => onDrag(details.delta.dx),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: Theme.of(context).dividerColor.withValues(alpha: 0.45),
          ),
          child: const SizedBox(width: 6),
        ),
      ),
    );
  }
}

class _EditorOutline extends WatchingWidget {
  const _EditorOutline({
    required this.controller,
    required this.onImport,
    required this.onNodeSelected,
  });

  final OqEditorController controller;
  final Future<void> Function() onImport;
  final Future<void> Function(EditorNodeId node) onNodeSelected;

  @override
  Widget build(BuildContext context) {
    final package = watch(controller.package).value;
    final selectedNode = watch(controller.selectedNode).value;
    final validationIssues = watch(controller.validationIssues).value;

    return ListView(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 16),
      children: [
        _OutlineToolbar(
          controller: controller,
          onImport: onImport,
        ),
        if (validationIssues.isNotEmpty) ...[
          const SizedBox(height: 8),
          _ValidationSummary(
            controller: controller,
            issues: validationIssues,
            onNodeSelected: onNodeSelected,
          ),
        ],
        const SizedBox(height: 8),
        _OutlineTile(
          icon: Icons.inventory_2_outlined,
          title: package.title.trim().isEmpty
              ? controller.translations.packageInfo
              : package.title,
          selected: selectedNode == const EditorNodeId.package(),
          validationCount: _issueCountForNode(
            validationIssues,
            const EditorNodeId.package(),
          ),
          validationTooltip: _issueTooltip(
            validationIssues,
            const EditorNodeId.package(),
          ),
          onTap: () => onNodeSelected(const EditorNodeId.package()),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(8, 8, 8, 4),
          child: FilledButton.tonalIcon(
            icon: const Icon(Icons.add),
            label: Text(controller.translations.addRound),
            onPressed: () async {
              controller.createRound();
              await onNodeSelected(controller.selectedNode.value);
            },
          ),
        ),
        for (
          var roundIndex = 0;
          roundIndex < package.rounds.length;
          roundIndex++
        )
          _RoundOutlineSection(
            controller: controller,
            round: package.rounds[roundIndex],
            roundIndex: roundIndex,
            selectedNode: selectedNode,
            validationIssues: validationIssues,
            onNodeSelected: onNodeSelected,
          ),
      ],
    );
  }
}

class _OutlineToolbar extends StatelessWidget {
  const _OutlineToolbar({
    required this.controller,
    required this.onImport,
  });

  final OqEditorController controller;
  final Future<void> Function() onImport;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        FilledButton.icon(
          icon: const Icon(Icons.folder_open_outlined),
          label: Text(controller.translations.importPackage),
          onPressed: onImport,
        ),
      ],
    );
  }
}

class _RoundOutlineSection extends StatelessWidget {
  const _RoundOutlineSection({
    required this.controller,
    required this.round,
    required this.roundIndex,
    required this.selectedNode,
    required this.validationIssues,
    required this.onNodeSelected,
  });

  final OqEditorController controller;
  final PackageRound round;
  final int roundIndex;
  final EditorNodeId selectedNode;
  final Map<EditorNodeId, List<String>> validationIssues;
  final Future<void> Function(EditorNodeId node) onNodeSelected;

  @override
  Widget build(BuildContext context) {
    return ExpansionTile(
      initiallyExpanded: selectedNode.roundIndex == roundIndex,
      leading: const Icon(Icons.layers_outlined),
      title: Row(
        children: [
          Expanded(
            child: Text(
              round.name.trim().isEmpty
                  ? '${controller.translations.rounds} ${roundIndex + 1}'
                  : round.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          _ValidationBadge(
            count: _issueCountForNode(
              validationIssues,
              EditorNodeId.round(roundIndex),
            ),
            tooltip: _issueTooltip(
              validationIssues,
              EditorNodeId.round(roundIndex),
            ),
          ),
        ],
      ),
      trailing: IconButton(
        icon: const Icon(Icons.edit_outlined),
        tooltip: controller.translations.editRound,
        onPressed: () => onNodeSelected(EditorNodeId.round(roundIndex)),
      ),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(56, 4, 8, 8),
          child: Align(
            alignment: Alignment.centerLeft,
            child: OutlinedButton.icon(
              icon: const Icon(Icons.add),
              label: Text(controller.translations.addTheme),
              onPressed: () async {
                controller.createTheme(roundIndex);
                await onNodeSelected(controller.selectedNode.value);
              },
            ),
          ),
        ),
        for (var themeIndex = 0; themeIndex < round.themes.length; themeIndex++)
          _ThemeOutlineSection(
            controller: controller,
            theme: round.themes[themeIndex],
            roundIndex: roundIndex,
            themeIndex: themeIndex,
            selectedNode: selectedNode,
            validationIssues: validationIssues,
            onNodeSelected: onNodeSelected,
          ),
      ],
    );
  }
}

class _ThemeOutlineSection extends StatelessWidget {
  const _ThemeOutlineSection({
    required this.controller,
    required this.theme,
    required this.roundIndex,
    required this.themeIndex,
    required this.selectedNode,
    required this.validationIssues,
    required this.onNodeSelected,
  });

  final OqEditorController controller;
  final PackageTheme theme;
  final int roundIndex;
  final int themeIndex;
  final EditorNodeId selectedNode;
  final Map<EditorNodeId, List<String>> validationIssues;
  final Future<void> Function(EditorNodeId node) onNodeSelected;

  @override
  Widget build(BuildContext context) {
    return ExpansionTile(
      initiallyExpanded:
          selectedNode.roundIndex == roundIndex &&
          selectedNode.themeIndex == themeIndex,
      leading: const SizedBox(width: 24),
      title: Row(
        children: [
          Expanded(
            child: Text(
              theme.name.trim().isEmpty
                  ? '${controller.translations.themes} ${themeIndex + 1}'
                  : theme.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          _ValidationBadge(
            count: _issueCountForNode(
              validationIssues,
              EditorNodeId.theme(roundIndex, themeIndex),
            ),
            tooltip: _issueTooltip(
              validationIssues,
              EditorNodeId.theme(roundIndex, themeIndex),
            ),
          ),
        ],
      ),
      trailing: IconButton(
        icon: const Icon(Icons.edit_outlined),
        tooltip: controller.translations.editTheme,
        onPressed: () => onNodeSelected(
          EditorNodeId.theme(roundIndex, themeIndex),
        ),
      ),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(72, 4, 8, 8),
          child: Align(
            alignment: Alignment.centerLeft,
            child: OutlinedButton.icon(
              icon: const Icon(Icons.add),
              label: Text(controller.translations.addQuestion),
              onPressed: () async {
                controller.createQuestion(roundIndex, themeIndex);
                await onNodeSelected(controller.selectedNode.value);
              },
            ),
          ),
        ),
        for (
          var questionIndex = 0;
          questionIndex < theme.questions.length;
          questionIndex++
        )
          _OutlineTile(
            inset: 56,
            icon: Icons.quiz_outlined,
            title: _questionTitle(
              theme.questions[questionIndex],
              questionIndex,
            ),
            selected:
                selectedNode ==
                EditorNodeId.question(
                  roundIndex,
                  themeIndex,
                  questionIndex,
                ),
            validationCount: _issueCountForNode(
              validationIssues,
              EditorNodeId.question(
                roundIndex,
                themeIndex,
                questionIndex,
              ),
            ),
            validationTooltip: _issueTooltip(
              validationIssues,
              EditorNodeId.question(
                roundIndex,
                themeIndex,
                questionIndex,
              ),
            ),
            onTap: () => onNodeSelected(
              EditorNodeId.question(roundIndex, themeIndex, questionIndex),
            ),
            trailing: IconButton(
              icon: const Icon(Icons.copy_all_outlined),
              tooltip: controller.translations.duplicateQuestion,
              onPressed: () async {
                controller.copyQuestion(roundIndex, themeIndex, questionIndex);
                await onNodeSelected(controller.selectedNode.value);
              },
            ),
          ),
      ],
    );
  }

  String _questionTitle(PackageQuestionUnion question, int questionIndex) {
    final text = question.map(
      simple: (question) => question.text,
      stake: (question) => question.text,
      secret: (question) => question.text,
      noRisk: (question) => question.text,
      choice: (question) => question.text,
      hidden: (question) => question.text,
    );

    if (text != null && text.trim().isNotEmpty) return text;
    return '${controller.translations.questions} ${questionIndex + 1}';
  }
}

class _OutlineTile extends StatelessWidget {
  const _OutlineTile({
    required this.icon,
    required this.title,
    required this.selected,
    required this.onTap,
    this.validationCount = 0,
    this.validationTooltip,
    this.trailing,
    this.inset = 16,
  });

  final IconData icon;
  final String title;
  final bool selected;
  final VoidCallback onTap;
  final int validationCount;
  final String? validationTooltip;
  final Widget? trailing;
  final double inset;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsetsDirectional.only(start: inset, end: 12),
      leading: Icon(icon),
      title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _ValidationBadge(
            count: validationCount,
            tooltip: validationTooltip,
          ),
          ?trailing,
        ],
      ),
      selected: selected,
      onTap: onTap,
    );
  }
}

class _ValidationSummary extends StatelessWidget {
  const _ValidationSummary({
    required this.controller,
    required this.issues,
    required this.onNodeSelected,
  });

  final OqEditorController controller;
  final Map<EditorNodeId, List<String>> issues;
  final Future<void> Function(EditorNodeId node) onNodeSelected;

  @override
  Widget build(BuildContext context) {
    final entries = <({EditorNodeId node, String message})>[];
    for (final entry in issues.entries) {
      for (final message in entry.value) {
        entries.add((node: entry.key, message: message));
      }
    }

    return Card(
      color: Theme.of(context).colorScheme.errorContainer.withValues(alpha: .4),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Icon(
                  Icons.error_outline,
                  size: 18,
                  color: Theme.of(context).colorScheme.error,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    controller.translations.validationIssues,
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                ),
                Text(
                  controller.translations.validationIssueCount(entries.length),
                  style: Theme.of(context).textTheme.labelSmall,
                ),
              ],
            ),
            const SizedBox(height: 8),
            for (final entry in entries.take(5))
              TextButton(
                onPressed: () => onNodeSelected(entry.node),
                style: TextButton.styleFrom(
                  alignment: Alignment.centerLeft,
                  padding: EdgeInsets.zero,
                ),
                child: Text(
                  entry.message,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _ValidationBadge extends StatelessWidget {
  const _ValidationBadge({
    required this.count,
    this.tooltip,
  });

  final int count;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    if (count == 0) return const SizedBox.shrink();

    final badge = Container(
      constraints: const BoxConstraints(minWidth: 22, minHeight: 22),
      padding: const EdgeInsets.symmetric(horizontal: 6),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.error,
        borderRadius: BorderRadius.circular(999),
      ),
      alignment: Alignment.center,
      child: Text(
        count.toString(),
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: Theme.of(context).colorScheme.onError,
          fontWeight: FontWeight.w700,
        ),
      ),
    );

    final tooltipText = tooltip;
    if (tooltipText == null || tooltipText.isEmpty) return badge;
    return Tooltip(message: tooltipText, child: badge);
  }
}

class _EditorPreviewPanel extends WatchingWidget {
  const _EditorPreviewPanel({required this.controller});

  final OqEditorController controller;

  @override
  Widget build(BuildContext context) {
    final package = watch(controller.package).value;
    final selectedNode = watch(controller.selectedNode).value;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          controller.translations.preview,
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 16),
        ..._previewRows(package, selectedNode),
      ],
    );
  }

  List<Widget> _previewRows(OqPackage package, EditorNodeId selectedNode) {
    return selectedNode.map(
      package: (_) => [
        _PreviewRow(controller.translations.packageTitle, package.title),
        _PreviewRow(
          controller.translations.rounds,
          package.rounds.length.toString(),
        ),
        _PreviewRow(controller.translations.packageLanguage, package.language),
      ],
      round: (node) {
        final round = package.rounds[node.roundIndex];
        return [
          _PreviewRow(controller.translations.roundName, round.name),
          _PreviewRow(
            controller.translations.themes,
            round.themes.length.toString(),
          ),
        ];
      },
      theme: (node) {
        final theme = package.rounds[node.roundIndex].themes[node.themeIndex];
        return [
          _PreviewRow(controller.translations.themeName, theme.name),
          _PreviewRow(
            controller.translations.questions,
            theme.questions.length.toString(),
          ),
        ];
      },
      question: (node) {
        final question = package
            .rounds[node.roundIndex]
            .themes[node.themeIndex]
            .questions[node.questionIndex];
        return [
          _PreviewRow(
            controller.translations.questionTypeLabel,
            _type(question),
          ),
          _PreviewRow(controller.translations.questionText, _text(question)),
        ];
      },
    );
  }

  String _type(PackageQuestionUnion question) {
    return question.map(
      simple: (_) => controller.translations.questionTypeSimple,
      stake: (_) => controller.translations.questionTypeStake,
      secret: (_) => controller.translations.questionTypeSecret,
      noRisk: (_) => controller.translations.questionTypeNoRisk,
      choice: (_) => controller.translations.questionTypeChoice,
      hidden: (_) => controller.translations.questionTypeHidden,
    );
  }

  String _text(PackageQuestionUnion question) {
    return question.map(
          simple: (question) => question.text,
          stake: (question) => question.text,
          secret: (question) => question.text,
          noRisk: (question) => question.text,
          choice: (question) => question.text,
          hidden: (question) => question.text,
        ) ??
        controller.translations.untitledQuestion;
  }
}

class _PreviewRow extends StatelessWidget {
  const _PreviewRow(this.label, this.value);

  final String label;
  final String? value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            (value == null || value!.trim().isEmpty) ? '-' : value!,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
        ],
      ),
    );
  }
}

int _issueCountForNode(
  Map<EditorNodeId, List<String>> issues,
  EditorNodeId node,
) {
  var count = 0;
  for (final entry in issues.entries) {
    if (_nodeContains(node, entry.key)) {
      count += entry.value.length;
    }
  }
  return count;
}

String? _issueTooltip(
  Map<EditorNodeId, List<String>> issues,
  EditorNodeId node,
) {
  final messages = <String>[];
  for (final entry in issues.entries) {
    if (_nodeContains(node, entry.key)) {
      messages.addAll(entry.value);
    }
  }
  if (messages.isEmpty) return null;
  return messages.take(4).join('\n');
}

bool _nodeContains(EditorNodeId parent, EditorNodeId child) {
  switch (parent.kind) {
    case EditorNodeKind.package:
      return true;
    case EditorNodeKind.round:
      return child.roundIndex == parent.roundIndex;
    case EditorNodeKind.theme:
      return child.roundIndex == parent.roundIndex &&
          child.themeIndex == parent.themeIndex;
    case EditorNodeKind.question:
      return child == parent;
  }
}

class _OperationBanner extends StatelessWidget {
  const _OperationBanner({
    required this.operation,
    required this.controller,
  });

  final PackageEditorOperationState operation;
  final OqEditorController controller;

  @override
  Widget build(BuildContext context) {
    return operation.map(
      idle: (_) => const SizedBox.shrink(),
      completed: (_) => const SizedBox.shrink(),
      running: (state) => LinearProgressIndicator(
        value: state.progress,
        minHeight: 3,
      ),
      failed: (state) => MaterialBanner(
        content: Text(state.error.toString()),
        actions: [
          TextButton(
            onPressed: () => _showLogs(context),
            child: Text(controller.translations.showProcessLogs),
          ),
          TextButton(
            onPressed: () {
              controller.operationState.value =
                  const PackageEditorOperationState.idle();
            },
            child: Text(controller.translations.closeButton),
          ),
        ],
      ),
    );
  }

  Future<void> _showLogs(BuildContext context) async {
    await showDialog<void>(
      context: context,
      useRootNavigator: false,
      builder: (context) => AlertDialog(
        title: Text(controller.translations.processLogs),
        content: SizedBox(
          width: 640,
          child: SingleChildScrollView(
            child: SelectableText(controller.operationLogText),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => context.router.pop(),
            child: Text(controller.translations.closeButton),
          ),
        ],
      ),
    );
  }
}
