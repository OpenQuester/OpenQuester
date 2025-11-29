// dart format width=80
// GENERATED CODE - DO NOT MODIFY BY HAND

// **************************************************************************
// AutoRouterGenerator
// **************************************************************************

// ignore_for_file: type=lint
// coverage:ignore-file

// ignore_for_file: no_leading_underscores_for_library_prefixes
import 'package:auto_route/auto_route.dart' as _i7;
import 'package:flutter/material.dart' as _i8;
import 'package:oq_editor/view/screens/package_info_screen.dart'
    deferred as _i1;
import 'package:oq_editor/view/screens/questions_list_screen.dart'
    deferred as _i2;
import 'package:oq_editor/view/screens/round_editor_screen.dart'
    deferred as _i3;
import 'package:oq_editor/view/screens/rounds_list_screen.dart' deferred as _i4;
import 'package:oq_editor/view/screens/theme_editor_screen.dart'
    deferred as _i5;
import 'package:oq_editor/view/screens/themes_grid_screen.dart' deferred as _i6;

/// generated route for
/// [_i1.PackageInfoScreen]
class PackageInfoRoute extends _i7.PageRouteInfo<void> {
  const PackageInfoRoute({List<_i7.PageRouteInfo>? children})
    : super(PackageInfoRoute.name, initialChildren: children);

  static const String name = 'PackageInfoRoute';

  static _i7.PageInfo page = _i7.PageInfo(
    name,
    builder: (data) {
      return _i7.DeferredWidget(_i1.loadLibrary, () => _i1.PackageInfoScreen());
    },
  );
}

/// generated route for
/// [_i2.QuestionsListScreen]
class QuestionsListRoute extends _i7.PageRouteInfo<QuestionsListRouteArgs> {
  QuestionsListRoute({
    required int roundIndex,
    required int themeIndex,
    _i8.Key? key,
    List<_i7.PageRouteInfo>? children,
  }) : super(
         QuestionsListRoute.name,
         args: QuestionsListRouteArgs(
           roundIndex: roundIndex,
           themeIndex: themeIndex,
           key: key,
         ),
         rawPathParams: {'roundIndex': roundIndex, 'themeIndex': themeIndex},
         initialChildren: children,
       );

  static const String name = 'QuestionsListRoute';

  static _i7.PageInfo page = _i7.PageInfo(
    name,
    builder: (data) {
      final pathParams = data.inheritedPathParams;
      final args = data.argsAs<QuestionsListRouteArgs>(
        orElse: () => QuestionsListRouteArgs(
          roundIndex: pathParams.getInt('roundIndex'),
          themeIndex: pathParams.getInt('themeIndex'),
        ),
      );
      return _i7.DeferredWidget(
        _i2.loadLibrary,
        () => _i2.QuestionsListScreen(
          roundIndex: args.roundIndex,
          themeIndex: args.themeIndex,
          key: args.key,
        ),
      );
    },
  );
}

class QuestionsListRouteArgs {
  const QuestionsListRouteArgs({
    required this.roundIndex,
    required this.themeIndex,
    this.key,
  });

  final int roundIndex;

  final int themeIndex;

  final _i8.Key? key;

  @override
  String toString() {
    return 'QuestionsListRouteArgs{roundIndex: $roundIndex, themeIndex: $themeIndex, key: $key}';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    if (other is! QuestionsListRouteArgs) return false;
    return roundIndex == other.roundIndex &&
        themeIndex == other.themeIndex &&
        key == other.key;
  }

  @override
  int get hashCode => roundIndex.hashCode ^ themeIndex.hashCode ^ key.hashCode;
}

/// generated route for
/// [_i3.RoundEditorScreen]
class RoundEditorRoute extends _i7.PageRouteInfo<RoundEditorRouteArgs> {
  RoundEditorRoute({
    required int roundIndex,
    _i8.Key? key,
    List<_i7.PageRouteInfo>? children,
  }) : super(
         RoundEditorRoute.name,
         args: RoundEditorRouteArgs(roundIndex: roundIndex, key: key),
         rawPathParams: {'roundIndex': roundIndex},
         initialChildren: children,
       );

  static const String name = 'RoundEditorRoute';

  static _i7.PageInfo page = _i7.PageInfo(
    name,
    builder: (data) {
      final pathParams = data.inheritedPathParams;
      final args = data.argsAs<RoundEditorRouteArgs>(
        orElse: () =>
            RoundEditorRouteArgs(roundIndex: pathParams.getInt('roundIndex')),
      );
      return _i7.DeferredWidget(
        _i3.loadLibrary,
        () => _i3.RoundEditorScreen(roundIndex: args.roundIndex, key: args.key),
      );
    },
  );
}

class RoundEditorRouteArgs {
  const RoundEditorRouteArgs({required this.roundIndex, this.key});

  final int roundIndex;

  final _i8.Key? key;

  @override
  String toString() {
    return 'RoundEditorRouteArgs{roundIndex: $roundIndex, key: $key}';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    if (other is! RoundEditorRouteArgs) return false;
    return roundIndex == other.roundIndex && key == other.key;
  }

  @override
  int get hashCode => roundIndex.hashCode ^ key.hashCode;
}

/// generated route for
/// [_i4.RoundsListScreen]
class RoundsListRoute extends _i7.PageRouteInfo<void> {
  const RoundsListRoute({List<_i7.PageRouteInfo>? children})
    : super(RoundsListRoute.name, initialChildren: children);

  static const String name = 'RoundsListRoute';

  static _i7.PageInfo page = _i7.PageInfo(
    name,
    builder: (data) {
      return _i7.DeferredWidget(_i4.loadLibrary, () => _i4.RoundsListScreen());
    },
  );
}

/// generated route for
/// [_i5.ThemeEditorScreen]
class ThemeEditorRoute extends _i7.PageRouteInfo<ThemeEditorRouteArgs> {
  ThemeEditorRoute({
    required int roundIndex,
    required int themeIndex,
    _i8.Key? key,
    List<_i7.PageRouteInfo>? children,
  }) : super(
         ThemeEditorRoute.name,
         args: ThemeEditorRouteArgs(
           roundIndex: roundIndex,
           themeIndex: themeIndex,
           key: key,
         ),
         rawPathParams: {'roundIndex': roundIndex, 'themeIndex': themeIndex},
         initialChildren: children,
       );

  static const String name = 'ThemeEditorRoute';

  static _i7.PageInfo page = _i7.PageInfo(
    name,
    builder: (data) {
      final pathParams = data.inheritedPathParams;
      final args = data.argsAs<ThemeEditorRouteArgs>(
        orElse: () => ThemeEditorRouteArgs(
          roundIndex: pathParams.getInt('roundIndex'),
          themeIndex: pathParams.getInt('themeIndex'),
        ),
      );
      return _i7.DeferredWidget(
        _i5.loadLibrary,
        () => _i5.ThemeEditorScreen(
          roundIndex: args.roundIndex,
          themeIndex: args.themeIndex,
          key: args.key,
        ),
      );
    },
  );
}

class ThemeEditorRouteArgs {
  const ThemeEditorRouteArgs({
    required this.roundIndex,
    required this.themeIndex,
    this.key,
  });

  final int roundIndex;

  final int themeIndex;

  final _i8.Key? key;

  @override
  String toString() {
    return 'ThemeEditorRouteArgs{roundIndex: $roundIndex, themeIndex: $themeIndex, key: $key}';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    if (other is! ThemeEditorRouteArgs) return false;
    return roundIndex == other.roundIndex &&
        themeIndex == other.themeIndex &&
        key == other.key;
  }

  @override
  int get hashCode => roundIndex.hashCode ^ themeIndex.hashCode ^ key.hashCode;
}

/// generated route for
/// [_i6.ThemesGridScreen]
class ThemesGridRoute extends _i7.PageRouteInfo<ThemesGridRouteArgs> {
  ThemesGridRoute({
    required int roundIndex,
    _i8.Key? key,
    List<_i7.PageRouteInfo>? children,
  }) : super(
         ThemesGridRoute.name,
         args: ThemesGridRouteArgs(roundIndex: roundIndex, key: key),
         rawPathParams: {'roundIndex': roundIndex},
         initialChildren: children,
       );

  static const String name = 'ThemesGridRoute';

  static _i7.PageInfo page = _i7.PageInfo(
    name,
    builder: (data) {
      final pathParams = data.inheritedPathParams;
      final args = data.argsAs<ThemesGridRouteArgs>(
        orElse: () =>
            ThemesGridRouteArgs(roundIndex: pathParams.getInt('roundIndex')),
      );
      return _i7.DeferredWidget(
        _i6.loadLibrary,
        () => _i6.ThemesGridScreen(roundIndex: args.roundIndex, key: args.key),
      );
    },
  );
}

class ThemesGridRouteArgs {
  const ThemesGridRouteArgs({required this.roundIndex, this.key});

  final int roundIndex;

  final _i8.Key? key;

  @override
  String toString() {
    return 'ThemesGridRouteArgs{roundIndex: $roundIndex, key: $key}';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    if (other is! ThemesGridRouteArgs) return false;
    return roundIndex == other.roundIndex && key == other.key;
  }

  @override
  int get hashCode => roundIndex.hashCode ^ key.hashCode;
}
