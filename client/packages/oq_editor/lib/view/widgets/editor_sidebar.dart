import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/controllers/editor_navigation_controller.dart';
import 'package:oq_editor/controllers/oq_editor_controller.dart';
import 'package:oq_editor/models/editor_navigation_state.dart';
import 'package:oq_shared/oq_shared.dart';
import 'package:watch_it/watch_it.dart';

/// Sidebar tree navigation showing package structure
class EditorSidebar extends WatchingWidget {
  const EditorSidebar({super.key});

  @override
  Widget build(BuildContext context) {
    final navController = watchIt<EditorNavigationController>();
    final editorController = GetIt.I<OqEditorController>();
    final package = watchValue((OqEditorController c) => c.package);
    final translations = editorController.translations;

    final isWideMode = UiModeUtils.wideModeOn(context);
    final sidebarWidth = navController.sidebarExpanded ? 280.0 : 56.0;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      width: isWideMode ? sidebarWidth : 0,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerLow,
        border: Border(
          right: BorderSide(
            color: Theme.of(context).colorScheme.outlineVariant,
          ),
        ),
      ),
      child: isWideMode
          ? Column(
              children: [
                // Toggle button and header
                _SidebarHeader(
                  isExpanded: navController.sidebarExpanded,
                  onToggle: navController.toggleSidebar,
                  translations: translations,
                ),

                const Divider(height: 1),

                // Tree content
                Expanded(
                  child: navController.sidebarExpanded
                      ? _SidebarContent(
                          package: package,
                          navController: navController,
                          translations: translations,
                        )
                      : _CollapsedSidebar(
                          package: package,
                          navController: navController,
                        ),
                ),
              ],
            )
          : const SizedBox.shrink(),
    );
  }
}

class _SidebarHeader extends StatelessWidget {
  const _SidebarHeader({
    required this.isExpanded,
    required this.onToggle,
    required this.translations,
  });

  final bool isExpanded;
  final VoidCallback onToggle;
  final dynamic translations;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 56,
      padding: EdgeInsets.symmetric(horizontal: isExpanded ? 16 : 8),
      child: Row(
        children: [
          if (isExpanded) ...[
            Icon(
              Icons.account_tree_outlined,
              size: 20,
              color: Theme.of(context).colorScheme.primary,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Package Structure',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ),
          ],
          IconButton(
            icon: Icon(
              isExpanded ? Icons.chevron_left : Icons.chevron_right,
              size: 20,
            ),
            onPressed: onToggle,
            tooltip: isExpanded ? 'Collapse sidebar' : 'Expand sidebar',
          ),
        ],
      ),
    );
  }
}

class _SidebarContent extends StatelessWidget {
  const _SidebarContent({
    required this.package,
    required this.navController,
    required this.translations,
  });

  final OqPackage package;
  final EditorNavigationController navController;
  final dynamic translations;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.symmetric(vertical: 8),
      children: [
        // Dashboard item
        _TreeItem(
          icon: Icons.dashboard_outlined,
          label: 'Dashboard',
          isSelected: navController.location is DashboardLocation,
          onTap: () => navController.navigateTo(const DashboardLocation()),
          level: 0,
        ),

        // Package Info item
        _TreeItem(
          icon: Icons.info_outlined,
          label: translations.packageInfo as String,
          isSelected: navController.location is PackageInfoLocation,
          onTap: () => navController.navigateTo(const PackageInfoLocation()),
          level: 0,
        ),

        const Divider(height: 16),

        // Rounds section header
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              Text(
                translations.rounds as String,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: Theme.of(context).colorScheme.outline,
                      fontWeight: FontWeight.w600,
                    ),
              ),
              const SizedBox(width: 8),
              Text(
                '(${package.rounds.length})',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: Theme.of(context).colorScheme.outline,
                    ),
              ),
            ],
          ),
        ),

        // Rounds tree
        for (var roundIndex = 0;
            roundIndex < package.rounds.length;
            roundIndex++)
          _RoundTreeItem(
            round: package.rounds[roundIndex],
            roundIndex: roundIndex,
            navController: navController,
            translations: translations,
          ),

        if (package.rounds.isEmpty)
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              translations.noRounds as String,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.outline,
                    fontStyle: FontStyle.italic,
                  ),
            ),
          ),
      ],
    );
  }
}

class _CollapsedSidebar extends StatelessWidget {
  const _CollapsedSidebar({
    required this.package,
    required this.navController,
  });

  final OqPackage package;
  final EditorNavigationController navController;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.symmetric(vertical: 8),
      children: [
        _CollapsedItem(
          icon: Icons.dashboard_outlined,
          tooltip: 'Dashboard',
          isSelected: navController.location is DashboardLocation,
          onTap: () => navController.navigateTo(const DashboardLocation()),
        ),
        _CollapsedItem(
          icon: Icons.info_outlined,
          tooltip: 'Package Info',
          isSelected: navController.location is PackageInfoLocation,
          onTap: () => navController.navigateTo(const PackageInfoLocation()),
        ),
        const Divider(height: 16),
        _CollapsedItem(
          icon: Icons.layers_outlined,
          tooltip: 'Rounds (${package.rounds.length})',
          isSelected: navController.location is RoundsListLocation,
          onTap: () => navController.navigateTo(const RoundsListLocation()),
          badge: package.rounds.length,
        ),
      ],
    );
  }
}

class _CollapsedItem extends StatelessWidget {
  const _CollapsedItem({
    required this.icon,
    required this.tooltip,
    required this.isSelected,
    required this.onTap,
    this.badge,
  });

  final IconData icon;
  final String tooltip;
  final bool isSelected;
  final VoidCallback onTap;
  final int? badge;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onTap,
        child: Container(
          height: 48,
          margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
          decoration: BoxDecoration(
            color: isSelected
                ? Theme.of(context).colorScheme.primaryContainer
                : null,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Stack(
            alignment: Alignment.center,
            children: [
              Icon(
                icon,
                size: 20,
                color: isSelected
                    ? Theme.of(context).colorScheme.onPrimaryContainer
                    : Theme.of(context).colorScheme.onSurfaceVariant,
              ),
              if (badge != null && badge! > 0)
                Positioned(
                  top: 8,
                  right: 8,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.primary,
                      shape: BoxShape.circle,
                    ),
                    child: Text(
                      badge! > 99 ? '99+' : badge.toString(),
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: Theme.of(context).colorScheme.onPrimary,
                            fontSize: 10,
                          ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RoundTreeItem extends StatefulWidget {
  const _RoundTreeItem({
    required this.round,
    required this.roundIndex,
    required this.navController,
    required this.translations,
  });

  final PackageRound round;
  final int roundIndex;
  final EditorNavigationController navController;
  final dynamic translations;

  @override
  State<_RoundTreeItem> createState() => _RoundTreeItemState();
}

class _RoundTreeItemState extends State<_RoundTreeItem> {
  bool _isExpanded = false;

  @override
  void initState() {
    super.initState();
    // Auto-expand if current location is within this round
    _checkAutoExpand();
  }

  @override
  void didUpdateWidget(_RoundTreeItem oldWidget) {
    super.didUpdateWidget(oldWidget);
    _checkAutoExpand();
  }

  void _checkAutoExpand() {
    final location = widget.navController.location;
    final roundIndex = switch (location) {
      RoundEditorLocation l => l.roundIndex,
      ThemesGridLocation l => l.roundIndex,
      ThemeEditorLocation l => l.roundIndex,
      QuestionsListLocation l => l.roundIndex,
      QuestionEditorLocation l => l.roundIndex,
      _ => -1,
    };

    if (roundIndex == widget.roundIndex && !_isExpanded) {
      setState(() => _isExpanded = true);
    }
  }

  bool _isRoundSelected() {
    final location = widget.navController.location;
    return switch (location) {
      RoundEditorLocation l => l.roundIndex == widget.roundIndex,
      ThemesGridLocation l => l.roundIndex == widget.roundIndex,
      _ => false,
    };
  }

  @override
  Widget build(BuildContext context) {
    final themesCount = widget.round.themes.length;
    final questionsCount = widget.round.themes.fold<int>(
      0,
      (sum, theme) => sum + theme.questions.length,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _TreeItem(
          icon: Icons.folder_outlined,
          label: widget.round.name,
          isSelected: _isRoundSelected(),
          onTap: () => widget.navController.navigateTo(
            ThemesGridLocation(roundIndex: widget.roundIndex),
          ),
          level: 0,
          trailingText: '$themesCount themes • $questionsCount Q',
          isExpandable: themesCount > 0,
          isExpanded: _isExpanded,
          onExpandToggle: () => setState(() => _isExpanded = !_isExpanded),
        ),

        // Themes (when expanded)
        if (_isExpanded)
          for (var themeIndex = 0;
              themeIndex < widget.round.themes.length;
              themeIndex++)
            _ThemeTreeItem(
              theme: widget.round.themes[themeIndex],
              roundIndex: widget.roundIndex,
              themeIndex: themeIndex,
              navController: widget.navController,
              translations: widget.translations,
            ),
      ],
    );
  }
}

class _ThemeTreeItem extends StatelessWidget {
  const _ThemeTreeItem({
    required this.theme,
    required this.roundIndex,
    required this.themeIndex,
    required this.navController,
    required this.translations,
  });

  final PackageTheme theme;
  final int roundIndex;
  final int themeIndex;
  final EditorNavigationController navController;
  final dynamic translations;

  bool _isSelected() {
    final location = navController.location;
    return switch (location) {
      ThemeEditorLocation l =>
        l.roundIndex == roundIndex && l.themeIndex == themeIndex,
      QuestionsListLocation l =>
        l.roundIndex == roundIndex && l.themeIndex == themeIndex,
      QuestionEditorLocation l =>
        l.roundIndex == roundIndex && l.themeIndex == themeIndex,
      _ => false,
    };
  }

  @override
  Widget build(BuildContext context) {
    return _TreeItem(
      icon: Icons.category_outlined,
      label: theme.name,
      isSelected: _isSelected(),
      onTap: () => navController.navigateTo(
        QuestionsListLocation(roundIndex: roundIndex, themeIndex: themeIndex),
      ),
      level: 1,
      trailingText: '${theme.questions.length} Q',
    );
  }
}

class _TreeItem extends StatelessWidget {
  const _TreeItem({
    required this.icon,
    required this.label,
    required this.isSelected,
    required this.onTap,
    required this.level,
    this.trailingText,
    this.isExpandable = false,
    this.isExpanded = false,
    this.onExpandToggle,
  });

  final IconData icon;
  final String label;
  final bool isSelected;
  final VoidCallback onTap;
  final int level;
  final String? trailingText;
  final bool isExpandable;
  final bool isExpanded;
  final VoidCallback? onExpandToggle;

  @override
  Widget build(BuildContext context) {
    final indent = 16.0 + (level * 16.0);

    return InkWell(
      onTap: onTap,
      child: Container(
        height: 44,
        padding: EdgeInsets.only(left: indent, right: 16),
        decoration: BoxDecoration(
          color: isSelected
              ? Theme.of(context).colorScheme.primaryContainer
              : null,
          border: isSelected
              ? Border(
                  left: BorderSide(
                    color: Theme.of(context).colorScheme.primary,
                    width: 3,
                  ),
                )
              : null,
        ),
        child: Row(
          children: [
            if (isExpandable)
              GestureDetector(
                onTap: onExpandToggle,
                child: Padding(
                  padding: const EdgeInsets.only(right: 4),
                  child: Icon(
                    isExpanded ? Icons.expand_more : Icons.chevron_right,
                    size: 18,
                    color: Theme.of(context).colorScheme.outline,
                  ),
                ),
              ),
            Icon(
              icon,
              size: 18,
              color: isSelected
                  ? Theme.of(context).colorScheme.onPrimaryContainer
                  : Theme.of(context).colorScheme.onSurfaceVariant,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                label,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontWeight: isSelected ? FontWeight.w600 : null,
                      color: isSelected
                          ? Theme.of(context).colorScheme.onPrimaryContainer
                          : null,
                    ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (trailingText != null)
              Text(
                trailingText!,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: Theme.of(context).colorScheme.outline,
                    ),
              ),
          ],
        ),
      ),
    );
  }
}
