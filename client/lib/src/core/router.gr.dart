// dart format width=80
// GENERATED CODE - DO NOT MODIFY BY HAND

// **************************************************************************
// AutoRouterGenerator
// **************************************************************************

// ignore_for_file: type=lint
// coverage:ignore-file

// ignore_for_file: no_leading_underscores_for_library_prefixes
import 'package:auto_route/auto_route.dart' as _i8;
import 'package:flutter/material.dart' as _i9;
import 'package:openquester/openquester.dart' as _i10;
import 'package:openquester/src/features/clicker/clicker_page.dart'
    deferred as _i1;
import 'package:openquester/src/features/create_game/view/create_game_dialog.dart'
    as _i2;
import 'package:openquester/src/features/game_lobby/view/game_lobby_screen.dart'
    deferred as _i3;
import 'package:openquester/src/features/game_preview/view/game_preview.dart'
    as _i4;
import 'package:openquester/src/features/home_tabs/home_tabs.dart'
    deferred as _i5;
import 'package:openquester/src/features/profile/view/profile_screen.dart'
    deferred as _i6;
import 'package:openquester/src/features/test/test_screen.dart' deferred as _i7;

/// generated route for
/// [_i1.ClickerPage]
class ClickerRoute extends _i8.PageRouteInfo<void> {
  const ClickerRoute({List<_i8.PageRouteInfo>? children})
    : super(ClickerRoute.name, initialChildren: children);

  static const String name = 'ClickerRoute';

  static _i8.PageInfo page = _i8.PageInfo(
    name,
    builder: (data) {
      return _i8.DeferredWidget(_i1.loadLibrary, () => _i1.ClickerPage());
    },
  );
}

/// generated route for
/// [_i2.CreateGameDialog]
class CreateGameRoute extends _i8.PageRouteInfo<void> {
  const CreateGameRoute({List<_i8.PageRouteInfo>? children})
    : super(CreateGameRoute.name, initialChildren: children);

  static const String name = 'CreateGameRoute';

  static _i8.PageInfo page = _i8.PageInfo(
    name,
    builder: (data) {
      return const _i2.CreateGameDialog();
    },
  );
}

/// generated route for
/// [_i3.GameLobbyScreen]
class GameLobbyRoute extends _i8.PageRouteInfo<GameLobbyRouteArgs> {
  GameLobbyRoute({
    required String gameId,
    _i9.Key? key,
    List<_i8.PageRouteInfo>? children,
  }) : super(
         GameLobbyRoute.name,
         args: GameLobbyRouteArgs(gameId: gameId, key: key),
         rawPathParams: {'gameId': gameId},
         initialChildren: children,
       );

  static const String name = 'GameLobbyRoute';

  static _i8.PageInfo page = _i8.PageInfo(
    name,
    builder: (data) {
      final pathParams = data.inheritedPathParams;
      final args = data.argsAs<GameLobbyRouteArgs>(
        orElse: () =>
            GameLobbyRouteArgs(gameId: pathParams.getString('gameId')),
      );
      return _i8.DeferredWidget(
        _i3.loadLibrary,
        () => _i3.GameLobbyScreen(gameId: args.gameId, key: args.key),
      );
    },
  );
}

class GameLobbyRouteArgs {
  const GameLobbyRouteArgs({required this.gameId, this.key});

  final String gameId;

  final _i9.Key? key;

  @override
  String toString() {
    return 'GameLobbyRouteArgs{gameId: $gameId, key: $key}';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    if (other is! GameLobbyRouteArgs) return false;
    return gameId == other.gameId && key == other.key;
  }

  @override
  int get hashCode => gameId.hashCode ^ key.hashCode;
}

/// generated route for
/// [_i4.GamePreviewScreen]
class GamePreviewRoute extends _i8.PageRouteInfo<GamePreviewRouteArgs> {
  GamePreviewRoute({
    required String gameId,
    (_i10.GameListItem, _i9.Size)? item,
    _i9.Key? key,
    List<_i8.PageRouteInfo>? children,
  }) : super(
         GamePreviewRoute.name,
         args: GamePreviewRouteArgs(gameId: gameId, item: item, key: key),
         rawPathParams: {'gameId': gameId},
         initialChildren: children,
       );

  static const String name = 'GamePreviewRoute';

  static _i8.PageInfo page = _i8.PageInfo(
    name,
    builder: (data) {
      final pathParams = data.inheritedPathParams;
      final args = data.argsAs<GamePreviewRouteArgs>(
        orElse: () =>
            GamePreviewRouteArgs(gameId: pathParams.getString('gameId')),
      );
      return _i4.GamePreviewScreen(
        gameId: args.gameId,
        item: args.item,
        key: args.key,
      );
    },
  );
}

class GamePreviewRouteArgs {
  const GamePreviewRouteArgs({required this.gameId, this.item, this.key});

  final String gameId;

  final (_i10.GameListItem, _i9.Size)? item;

  final _i9.Key? key;

  @override
  String toString() {
    return 'GamePreviewRouteArgs{gameId: $gameId, item: $item, key: $key}';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    if (other is! GamePreviewRouteArgs) return false;
    return gameId == other.gameId && item == other.item && key == other.key;
  }

  @override
  int get hashCode => gameId.hashCode ^ item.hashCode ^ key.hashCode;
}

/// generated route for
/// [_i5.HomeTabsScreen]
class HomeTabsRoute extends _i8.PageRouteInfo<void> {
  const HomeTabsRoute({List<_i8.PageRouteInfo>? children})
    : super(HomeTabsRoute.name, initialChildren: children);

  static const String name = 'HomeTabsRoute';

  static _i8.PageInfo page = _i8.PageInfo(
    name,
    builder: (data) {
      return _i8.DeferredWidget(_i5.loadLibrary, () => _i5.HomeTabsScreen());
    },
  );
}

/// generated route for
/// [_i6.ProfileScreen]
class ProfileRoute extends _i8.PageRouteInfo<void> {
  const ProfileRoute({List<_i8.PageRouteInfo>? children})
    : super(ProfileRoute.name, initialChildren: children);

  static const String name = 'ProfileRoute';

  static _i8.PageInfo page = _i8.PageInfo(
    name,
    builder: (data) {
      return _i8.DeferredWidget(_i6.loadLibrary, () => _i6.ProfileScreen());
    },
  );
}

/// generated route for
/// [_i7.TestScreen]
class TestScreenRoute extends _i8.PageRouteInfo<void> {
  const TestScreenRoute({List<_i8.PageRouteInfo>? children})
    : super(TestScreenRoute.name, initialChildren: children);

  static const String name = 'TestScreenRoute';

  static _i8.PageInfo page = _i8.PageInfo(
    name,
    builder: (data) {
      return _i8.DeferredWidget(_i7.loadLibrary, () => _i7.TestScreen());
    },
  );
}
