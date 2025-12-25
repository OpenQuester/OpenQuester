// dart format width=80
// GENERATED CODE - DO NOT MODIFY BY HAND

// **************************************************************************
// AutoRouterGenerator
// **************************************************************************

// ignore_for_file: type=lint
// coverage:ignore-file

// ignore_for_file: no_leading_underscores_for_library_prefixes
import 'package:auto_route/auto_route.dart' as _i8;
import 'package:flutter/material.dart' as _i10;
import 'package:openapi/openapi.dart' as _i9;
import 'package:oq_editor/view/dialogs/question_editor_dialog.dart'
    deferred as _i2;
import 'package:oq_editor/view/screens/package_info_screen.dart'
    deferred as _i1;
import 'package:oq_editor/view/screens/questions_list_screen.dart'
    deferred as _i3;
import 'package:oq_editor/view/screens/round_editor_screen.dart'
    deferred as _i4;
import 'package:oq_editor/view/screens/rounds_list_screen.dart' deferred as _i5;
import 'package:oq_editor/view/screens/theme_editor_screen.dart'
    deferred as _i6;
import 'package:oq_editor/view/screens/themes_grid_screen.dart' deferred as _i7;

/// generated route for
/// [_i1.PackageInfoScreen]
class PackageInfoRoute extends _i8.PageRouteInfo<void> {
  const PackageInfoRoute({List<_i8.PageRouteInfo>? children})
    : super(PackageInfoRoute.name, initialChildren: children);

  static const String name = 'PackageInfoRoute';

  static _i8.PageInfo page = _i8.PageInfo(
    name,
    builder: (data) {
      return _i8.DeferredWidget(_i1.loadLibrary, () => _i1.PackageInfoScreen());
    },
  );
}

/// generated route for
/// [_i2.QuestionEditorDialog]
class QuestionEditorRoute extends _i8.PageRouteInfo<QuestionEditorRouteArgs> {
  QuestionEditorRoute({
    required int roundIndex,
    required int themeIndex,
    required int? questionIndex,
    _i9.PackageQuestionUnion? initialQuestion,
    _i10.Key? key,
    List<_i8.PageRouteInfo>? children,
  }) : super(
         QuestionEditorRoute.name,
         args: QuestionEditorRouteArgs(
           roundIndex: roundIndex,
           themeIndex: themeIndex,
           questionIndex: questionIndex,
           initialQuestion: initialQuestion,
           key: key,
         ),
         rawPathParams: {
           'roundIndex': roundIndex,
           'themeIndex': themeIndex,
           'questionIndex': questionIndex,
         },
         initialChildren: children,
       );

  static const String name = 'QuestionEditorRoute';

  static _i8.PageInfo page = _i8.PageInfo(
    name,
    builder: (data) {
      final pathParams = data.inheritedPathParams;
      final args = data.argsAs<QuestionEditorRouteArgs>(
        orElse: () => QuestionEditorRouteArgs(
          roundIndex: pathParams.getInt('roundIndex'),
          themeIndex: pathParams.getInt('themeIndex'),
          questionIndex: pathParams.optInt('questionIndex'),
        ),
      );
      return _i8.DeferredWidget(
        _i2.loadLibrary,
        () => _i2.QuestionEditorDialog(
          roundIndex: args.roundIndex,
          themeIndex: args.themeIndex,
          questionIndex: args.questionIndex,
          initialQuestion: args.initialQuestion,
          key: args.key,
        ),
      );
    },
  );
}

class QuestionEditorRouteArgs {
  const QuestionEditorRouteArgs({
    required this.roundIndex,
    required this.themeIndex,
    required this.questionIndex,
    this.initialQuestion,
    this.key,
  });

  final int roundIndex;

  final int themeIndex;

  final int? questionIndex;

  final _i9.PackageQuestionUnion? initialQuestion;

  final _i10.Key? key;

  @override
  String toString() {
    return 'QuestionEditorRouteArgs{roundIndex: $roundIndex, themeIndex: $themeIndex, questionIndex: $questionIndex, initialQuestion: $initialQuestion, key: $key}';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    if (other is! QuestionEditorRouteArgs) return false;
    return roundIndex == other.roundIndex &&
        themeIndex == other.themeIndex &&
        questionIndex == other.questionIndex &&
        initialQuestion == other.initialQuestion &&
        key == other.key;
  }

  @override
  int get hashCode =>
      roundIndex.hashCode ^
      themeIndex.hashCode ^
      questionIndex.hashCode ^
      initialQuestion.hashCode ^
      key.hashCode;
}

/// generated route for
/// [_i3.QuestionsListScreen]
class QuestionsListRoute extends _i8.PageRouteInfo<QuestionsListRouteArgs> {
  QuestionsListRoute({
    required int roundIndex,
    required int themeIndex,
    _i10.Key? key,
    List<_i8.PageRouteInfo>? children,
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

  static _i8.PageInfo page = _i8.PageInfo(
    name,
    builder: (data) {
      final pathParams = data.inheritedPathParams;
      final args = data.argsAs<QuestionsListRouteArgs>(
        orElse: () => QuestionsListRouteArgs(
          roundIndex: pathParams.getInt('roundIndex'),
          themeIndex: pathParams.getInt('themeIndex'),
        ),
      );
      return _i8.DeferredWidget(
        _i3.loadLibrary,
        () => _i3.QuestionsListScreen(
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

  final _i10.Key? key;

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
/// [_i4.RoundEditorScreen]
class RoundEditorRoute extends _i8.PageRouteInfo<RoundEditorRouteArgs> {
  RoundEditorRoute({
    required int roundIndex,
    _i10.Key? key,
    List<_i8.PageRouteInfo>? children,
  }) : super(
         RoundEditorRoute.name,
         args: RoundEditorRouteArgs(roundIndex: roundIndex, key: key),
         rawPathParams: {'roundIndex': roundIndex},
         initialChildren: children,
       );

  static const String name = 'RoundEditorRoute';

  static _i8.PageInfo page = _i8.PageInfo(
    name,
    builder: (data) {
      final pathParams = data.inheritedPathParams;
      final args = data.argsAs<RoundEditorRouteArgs>(
        orElse: () =>
            RoundEditorRouteArgs(roundIndex: pathParams.getInt('roundIndex')),
      );
      return _i8.DeferredWidget(
        _i4.loadLibrary,
        () => _i4.RoundEditorScreen(roundIndex: args.roundIndex, key: args.key),
      );
    },
  );
}

class RoundEditorRouteArgs {
  const RoundEditorRouteArgs({required this.roundIndex, this.key});

  final int roundIndex;

  final _i10.Key? key;

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
/// [_i5.RoundsListScreen]
class RoundsListRoute extends _i8.PageRouteInfo<void> {
  const RoundsListRoute({List<_i8.PageRouteInfo>? children})
    : super(RoundsListRoute.name, initialChildren: children);

  static const String name = 'RoundsListRoute';

  static _i8.PageInfo page = _i8.PageInfo(
    name,
    builder: (data) {
      return _i8.DeferredWidget(_i5.loadLibrary, () => _i5.RoundsListScreen());
    },
  );
}

/// generated route for
/// [_i6.ThemeEditorScreen]
class ThemeEditorRoute extends _i8.PageRouteInfo<ThemeEditorRouteArgs> {
  ThemeEditorRoute({
    required int roundIndex,
    required int themeIndex,
    _i10.Key? key,
    List<_i8.PageRouteInfo>? children,
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

  static _i8.PageInfo page = _i8.PageInfo(
    name,
    builder: (data) {
      final pathParams = data.inheritedPathParams;
      final args = data.argsAs<ThemeEditorRouteArgs>(
        orElse: () => ThemeEditorRouteArgs(
          roundIndex: pathParams.getInt('roundIndex'),
          themeIndex: pathParams.getInt('themeIndex'),
        ),
      );
      return _i8.DeferredWidget(
        _i6.loadLibrary,
        () => _i6.ThemeEditorScreen(
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

  final _i10.Key? key;

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
/// [_i7.ThemesGridScreen]
class ThemesGridRoute extends _i8.PageRouteInfo<ThemesGridRouteArgs> {
  ThemesGridRoute({
    required int roundIndex,
    _i10.Key? key,
    List<_i8.PageRouteInfo>? children,
  }) : super(
         ThemesGridRoute.name,
         args: ThemesGridRouteArgs(roundIndex: roundIndex, key: key),
         rawPathParams: {'roundIndex': roundIndex},
         initialChildren: children,
       );

  static const String name = 'ThemesGridRoute';

  static _i8.PageInfo page = _i8.PageInfo(
    name,
    builder: (data) {
      final pathParams = data.inheritedPathParams;
      final args = data.argsAs<ThemesGridRouteArgs>(
        orElse: () =>
            ThemesGridRouteArgs(roundIndex: pathParams.getInt('roundIndex')),
      );
      return _i8.DeferredWidget(
        _i7.loadLibrary,
        () => _i7.ThemesGridScreen(roundIndex: args.roundIndex, key: args.key),
      );
    },
  );
}

class ThemesGridRouteArgs {
  const ThemesGridRouteArgs({required this.roundIndex, this.key});

  final int roundIndex;

  final _i10.Key? key;

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
