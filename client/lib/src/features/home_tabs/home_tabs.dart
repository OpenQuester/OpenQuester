import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

@RoutePage()
class HomeTabsScreen extends WatchingWidget {
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
        leading: const ProfileBtn(),
        title: Text(_destionations[index].$2.label),
        scrolledUnderElevation: 0,
        actions: [
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
      floatingActionButton: const _StartGameButton(),
      body: Column(children: [_destionations[index].$1.expand()]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (newIndex) => setState(() => index = newIndex),
        destinations: _destionations.map((e) => e.$2).toList(),
        height: 60,
      ),
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

class _StartGameButton extends StatelessWidget {
  const _StartGameButton();

  @override
  Widget build(BuildContext context) {
    return FloatingActionButton.extended(
      onPressed: () => const CreateGameRoute().push<void>(context),
      label: Text(LocaleKeys.start_game.tr()),
      icon: const Icon(Icons.play_arrow_outlined),
    );
  }
}

class _WideHome extends WatchingWidget {
  const _WideHome();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(leading: const ProfileBtn()),
      body: SafeArea(
        child: Row(
          spacing: 42,
          children: [
            const _WideHomeLeftBar(),
            const _GameList(wideMode: true).expand(),
          ],
        ),
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
      child: const Column(children: [_StartGameButton()]),
    );
  }
}
