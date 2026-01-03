import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

@RoutePage()
class HomeTabsScreen extends StatelessWidget {
  const HomeTabsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final isWideModeOn = UiModeUtils.wideModeOn(context);

    return Scaffold(
      body: MaxSizeContainer(
        child: isWideModeOn ? const _WideHome() : const _MobileHome(),
      ),
    );
  }
}

class _MobileHome extends WatchingStatefulWidget {
  const _MobileHome();

  @override
  State<_MobileHome> createState() => _MobileHomeState();
}

class _MobileHomeState extends State<_MobileHome> {
  int index = 0;
  bool showSearch = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const _AppBarLeading(wideMode: false),
        leadingWidth: 120,
        scrolledUnderElevation: 0,
        actions: [
          const ProfileBtn(wideMode: false).paddingRight(8),
          IconButton(
            onPressed: () => setState(() => showSearch = !showSearch),
            icon: Icon(showSearch ? Icons.search_off : Icons.search),
          ),
        ],
        bottom: showSearch
            ? PreferredSize(
                preferredSize: const Size.fromHeight(70),
                child: const GamesSearchBar().paddingAll(8),
              )
            : null,
      ),
      floatingActionButton: const Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.end,
        spacing: 16,
        children: [
          _OpenEditorButton(),
          _StartGameButton(),
        ],
      ),
      body: Column(children: [_destionations[index].$1.expand()]),
    );
  }

  List<(Widget, NavigationDestination)> get _destionations {
    return [
      (
        const _GameList(wideMode: false),
        NavigationDestination(
          label: LocaleKeys.home_tabs_games.tr(),
          icon: const Icon(Icons.games_outlined),
          selectedIcon: const Icon(Icons.games),
        ),
      ),
      (
        const PackagesListScreen(),
        NavigationDestination(
          label: LocaleKeys.home_tabs_packages.tr(),
          icon: const Icon(Icons.folder_outlined),
          selectedIcon: const Icon(Icons.folder),
        ),
      ),
    ];
  }
}

class _AppBarLeading extends StatelessWidget {
  const _AppBarLeading({required this.wideMode});
  final bool wideMode;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      spacing: 8,
      children: [
        IconButton(
          onPressed: () => const SettingsRoute().push<void>(context),
          tooltip: LocaleKeys.settings_title.tr(),
          icon: const Icon(Icons.settings_outlined),
        ),
        const _AdminDashboardIconButton(),
      ],
    ).paddingAll(8);
  }
}

class _AdminDashboardIconButton extends WatchingWidget {
  const _AdminDashboardIconButton();

  @override
  Widget build(BuildContext context) {
    final user = watchValue((ProfileController e) => e.user);
    final hasAdminAccess = user.havePermission(PermissionName.adminPanelAccess);

    if (!hasAdminAccess) return const SizedBox.shrink();

    return IconButton(
      onPressed: () => const AdminDashboardRoute().push<void>(context),
      tooltip: LocaleKeys.admin_dashboard.tr(),
      icon: const Icon(Icons.admin_panel_settings_outlined),
    );
  }
}

class _StartGameButton extends StatelessWidget {
  const _StartGameButton();

  @override
  Widget build(BuildContext context) {
    return FloatingActionButton.extended(
      heroTag: 'start_game',
      onPressed: () => const CreateGameRoute().push<void>(context),
      label: Text(LocaleKeys.start_game.tr()),
      icon: const Icon(Icons.play_arrow_outlined),
    );
  }
}

class _OpenEditorButton extends StatelessWidget {
  const _OpenEditorButton();

  @override
  Widget build(BuildContext context) {
    return FloatingActionButton.extended(
      heroTag: 'open_package_editor',
      foregroundColor: context.theme.colorScheme.onSecondaryContainer,
      backgroundColor: context.theme.colorScheme.secondaryContainer,
      onPressed: () => const PackageEditorRoute().push<void>(context),
      label: Text(LocaleKeys.package_editor.tr()),
      icon: const Icon(Icons.edit),
    );
  }
}

class _WideHome extends WatchingWidget {
  const _WideHome();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const _AppBarLeading(
          wideMode: true,
        ),
        leadingWidth: 200,
        actions: [
          const ProfileBtn(wideMode: true).paddingRight(12),
        ],
      ),
      body: SafeArea(
        child: Row(
          spacing: 42,
          children: [
            const _WideHomeLeftBar(),
            const _GameList(wideMode: true).expand(),
          ],
        ).paddingTop(16),
      ),
    );
  }
}

class _GameList extends StatelessWidget {
  const _GameList({required this.wideMode});
  final bool wideMode;

  @override
  Widget build(BuildContext context) {
    return Column(
      spacing: 16,
      children: [
        if (wideMode)
          Row(
            spacing: 8,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                LocaleKeys.games_list.tr(),
                style: context.textTheme.headlineMedium,
              ),
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 360, minHeight: 56),
                child: const GamesSearchBar(),
              ).flexible(),
            ],
          ).paddingSymmetric(horizontal: 16),
        const GamesListScreen().expand(),
      ],
    );
  }
}

class GamesSearchBar extends StatelessWidget {
  const GamesSearchBar({super.key});

  @override
  Widget build(BuildContext context) {
    return SearchBar(
      hintText: LocaleKeys.type_to_find_games.tr(),
      onChanged: getIt<GamesListController>().search,
      trailing: const [Icon(Icons.search)],
      padding: WidgetStatePropertyAll(16.horizontal),
    );
  }
}

class _WideHomeLeftBar extends StatelessWidget {
  const _WideHomeLeftBar();

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints.tightFor(width: 220),
      padding: 35.top,
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: 16,
        children: [
          _StartGameButton(),
          _OpenEditorButton(),
        ],
      ).paddingLeft(16),
    );
  }
}
