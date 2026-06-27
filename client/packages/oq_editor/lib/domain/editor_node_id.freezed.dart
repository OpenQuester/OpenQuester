// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'editor_node_id.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

/// @nodoc
mixin _$EditorNodeId {
  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType && other is EditorNodeId);
  }

  @override
  int get hashCode => runtimeType.hashCode;

  @override
  String toString() {
    return 'EditorNodeId()';
  }
}

/// @nodoc
class $EditorNodeIdCopyWith<$Res> {
  $EditorNodeIdCopyWith(EditorNodeId _, $Res Function(EditorNodeId) __);
}

/// Adds pattern-matching-related methods to [EditorNodeId].
extension EditorNodeIdPatterns on EditorNodeId {
  /// A variant of `map` that fallback to returning `orElse`.
  ///
  /// It is equivalent to doing:
  /// ```dart
  /// switch (sealedClass) {
  ///   case final Subclass value:
  ///     return ...;
  ///   case _:
  ///     return orElse();
  /// }
  /// ```

  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(PackageEditorNodeId value)? package,
    TResult Function(RoundEditorNodeId value)? round,
    TResult Function(ThemeEditorNodeId value)? theme,
    TResult Function(QuestionEditorNodeId value)? question,
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case PackageEditorNodeId() when package != null:
        return package(_that);
      case RoundEditorNodeId() when round != null:
        return round(_that);
      case ThemeEditorNodeId() when theme != null:
        return theme(_that);
      case QuestionEditorNodeId() when question != null:
        return question(_that);
      case _:
        return orElse();
    }
  }

  /// A `switch`-like method, using callbacks.
  ///
  /// Callbacks receives the raw object, upcasted.
  /// It is equivalent to doing:
  /// ```dart
  /// switch (sealedClass) {
  ///   case final Subclass value:
  ///     return ...;
  ///   case final Subclass2 value:
  ///     return ...;
  /// }
  /// ```

  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(PackageEditorNodeId value) package,
    required TResult Function(RoundEditorNodeId value) round,
    required TResult Function(ThemeEditorNodeId value) theme,
    required TResult Function(QuestionEditorNodeId value) question,
  }) {
    final _that = this;
    switch (_that) {
      case PackageEditorNodeId():
        return package(_that);
      case RoundEditorNodeId():
        return round(_that);
      case ThemeEditorNodeId():
        return theme(_that);
      case QuestionEditorNodeId():
        return question(_that);
    }
  }

  /// A variant of `map` that fallback to returning `null`.
  ///
  /// It is equivalent to doing:
  /// ```dart
  /// switch (sealedClass) {
  ///   case final Subclass value:
  ///     return ...;
  ///   case _:
  ///     return null;
  /// }
  /// ```

  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(PackageEditorNodeId value)? package,
    TResult? Function(RoundEditorNodeId value)? round,
    TResult? Function(ThemeEditorNodeId value)? theme,
    TResult? Function(QuestionEditorNodeId value)? question,
  }) {
    final _that = this;
    switch (_that) {
      case PackageEditorNodeId() when package != null:
        return package(_that);
      case RoundEditorNodeId() when round != null:
        return round(_that);
      case ThemeEditorNodeId() when theme != null:
        return theme(_that);
      case QuestionEditorNodeId() when question != null:
        return question(_that);
      case _:
        return null;
    }
  }

  /// A variant of `when` that fallback to an `orElse` callback.
  ///
  /// It is equivalent to doing:
  /// ```dart
  /// switch (sealedClass) {
  ///   case Subclass(:final field):
  ///     return ...;
  ///   case _:
  ///     return orElse();
  /// }
  /// ```

  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function()? package,
    TResult Function(int roundIndex)? round,
    TResult Function(int roundIndex, int themeIndex)? theme,
    TResult Function(int roundIndex, int themeIndex, int questionIndex)?
    question,
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case PackageEditorNodeId() when package != null:
        return package();
      case RoundEditorNodeId() when round != null:
        return round(_that.roundIndex);
      case ThemeEditorNodeId() when theme != null:
        return theme(_that.roundIndex, _that.themeIndex);
      case QuestionEditorNodeId() when question != null:
        return question(
          _that.roundIndex,
          _that.themeIndex,
          _that.questionIndex,
        );
      case _:
        return orElse();
    }
  }

  /// A `switch`-like method, using callbacks.
  ///
  /// As opposed to `map`, this offers destructuring.
  /// It is equivalent to doing:
  /// ```dart
  /// switch (sealedClass) {
  ///   case Subclass(:final field):
  ///     return ...;
  ///   case Subclass2(:final field2):
  ///     return ...;
  /// }
  /// ```

  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function() package,
    required TResult Function(int roundIndex) round,
    required TResult Function(int roundIndex, int themeIndex) theme,
    required TResult Function(int roundIndex, int themeIndex, int questionIndex)
    question,
  }) {
    final _that = this;
    switch (_that) {
      case PackageEditorNodeId():
        return package();
      case RoundEditorNodeId():
        return round(_that.roundIndex);
      case ThemeEditorNodeId():
        return theme(_that.roundIndex, _that.themeIndex);
      case QuestionEditorNodeId():
        return question(
          _that.roundIndex,
          _that.themeIndex,
          _that.questionIndex,
        );
    }
  }

  /// A variant of `when` that fallback to returning `null`
  ///
  /// It is equivalent to doing:
  /// ```dart
  /// switch (sealedClass) {
  ///   case Subclass(:final field):
  ///     return ...;
  ///   case _:
  ///     return null;
  /// }
  /// ```

  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function()? package,
    TResult? Function(int roundIndex)? round,
    TResult? Function(int roundIndex, int themeIndex)? theme,
    TResult? Function(int roundIndex, int themeIndex, int questionIndex)?
    question,
  }) {
    final _that = this;
    switch (_that) {
      case PackageEditorNodeId() when package != null:
        return package();
      case RoundEditorNodeId() when round != null:
        return round(_that.roundIndex);
      case ThemeEditorNodeId() when theme != null:
        return theme(_that.roundIndex, _that.themeIndex);
      case QuestionEditorNodeId() when question != null:
        return question(
          _that.roundIndex,
          _that.themeIndex,
          _that.questionIndex,
        );
      case _:
        return null;
    }
  }
}

/// @nodoc

class PackageEditorNodeId extends EditorNodeId {
  const PackageEditorNodeId() : super._();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType && other is PackageEditorNodeId);
  }

  @override
  int get hashCode => runtimeType.hashCode;

  @override
  String toString() {
    return 'EditorNodeId.package()';
  }
}

/// @nodoc

class RoundEditorNodeId extends EditorNodeId {
  const RoundEditorNodeId(this.roundIndex) : super._();

  final int roundIndex;

  /// Create a copy of EditorNodeId
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $RoundEditorNodeIdCopyWith<RoundEditorNodeId> get copyWith =>
      _$RoundEditorNodeIdCopyWithImpl<RoundEditorNodeId>(this, _$identity);

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is RoundEditorNodeId &&
            (identical(other.roundIndex, roundIndex) ||
                other.roundIndex == roundIndex));
  }

  @override
  int get hashCode => Object.hash(runtimeType, roundIndex);

  @override
  String toString() {
    return 'EditorNodeId.round(roundIndex: $roundIndex)';
  }
}

/// @nodoc
abstract mixin class $RoundEditorNodeIdCopyWith<$Res>
    implements $EditorNodeIdCopyWith<$Res> {
  factory $RoundEditorNodeIdCopyWith(
    RoundEditorNodeId value,
    $Res Function(RoundEditorNodeId) _then,
  ) = _$RoundEditorNodeIdCopyWithImpl;
  @useResult
  $Res call({int roundIndex});
}

/// @nodoc
class _$RoundEditorNodeIdCopyWithImpl<$Res>
    implements $RoundEditorNodeIdCopyWith<$Res> {
  _$RoundEditorNodeIdCopyWithImpl(this._self, this._then);

  final RoundEditorNodeId _self;
  final $Res Function(RoundEditorNodeId) _then;

  /// Create a copy of EditorNodeId
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  $Res call({Object? roundIndex = null}) {
    return _then(
      RoundEditorNodeId(
        null == roundIndex
            ? _self.roundIndex
            : roundIndex // ignore: cast_nullable_to_non_nullable
                  as int,
      ),
    );
  }
}

/// @nodoc

class ThemeEditorNodeId extends EditorNodeId {
  const ThemeEditorNodeId(this.roundIndex, this.themeIndex) : super._();

  final int roundIndex;
  final int themeIndex;

  /// Create a copy of EditorNodeId
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $ThemeEditorNodeIdCopyWith<ThemeEditorNodeId> get copyWith =>
      _$ThemeEditorNodeIdCopyWithImpl<ThemeEditorNodeId>(this, _$identity);

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is ThemeEditorNodeId &&
            (identical(other.roundIndex, roundIndex) ||
                other.roundIndex == roundIndex) &&
            (identical(other.themeIndex, themeIndex) ||
                other.themeIndex == themeIndex));
  }

  @override
  int get hashCode => Object.hash(runtimeType, roundIndex, themeIndex);

  @override
  String toString() {
    return 'EditorNodeId.theme(roundIndex: $roundIndex, themeIndex: $themeIndex)';
  }
}

/// @nodoc
abstract mixin class $ThemeEditorNodeIdCopyWith<$Res>
    implements $EditorNodeIdCopyWith<$Res> {
  factory $ThemeEditorNodeIdCopyWith(
    ThemeEditorNodeId value,
    $Res Function(ThemeEditorNodeId) _then,
  ) = _$ThemeEditorNodeIdCopyWithImpl;
  @useResult
  $Res call({int roundIndex, int themeIndex});
}

/// @nodoc
class _$ThemeEditorNodeIdCopyWithImpl<$Res>
    implements $ThemeEditorNodeIdCopyWith<$Res> {
  _$ThemeEditorNodeIdCopyWithImpl(this._self, this._then);

  final ThemeEditorNodeId _self;
  final $Res Function(ThemeEditorNodeId) _then;

  /// Create a copy of EditorNodeId
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  $Res call({Object? roundIndex = null, Object? themeIndex = null}) {
    return _then(
      ThemeEditorNodeId(
        null == roundIndex
            ? _self.roundIndex
            : roundIndex // ignore: cast_nullable_to_non_nullable
                  as int,
        null == themeIndex
            ? _self.themeIndex
            : themeIndex // ignore: cast_nullable_to_non_nullable
                  as int,
      ),
    );
  }
}

/// @nodoc

class QuestionEditorNodeId extends EditorNodeId {
  const QuestionEditorNodeId(
    this.roundIndex,
    this.themeIndex,
    this.questionIndex,
  ) : super._();

  final int roundIndex;
  final int themeIndex;
  final int questionIndex;

  /// Create a copy of EditorNodeId
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $QuestionEditorNodeIdCopyWith<QuestionEditorNodeId> get copyWith =>
      _$QuestionEditorNodeIdCopyWithImpl<QuestionEditorNodeId>(
        this,
        _$identity,
      );

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is QuestionEditorNodeId &&
            (identical(other.roundIndex, roundIndex) ||
                other.roundIndex == roundIndex) &&
            (identical(other.themeIndex, themeIndex) ||
                other.themeIndex == themeIndex) &&
            (identical(other.questionIndex, questionIndex) ||
                other.questionIndex == questionIndex));
  }

  @override
  int get hashCode =>
      Object.hash(runtimeType, roundIndex, themeIndex, questionIndex);

  @override
  String toString() {
    return 'EditorNodeId.question(roundIndex: $roundIndex, themeIndex: $themeIndex, questionIndex: $questionIndex)';
  }
}

/// @nodoc
abstract mixin class $QuestionEditorNodeIdCopyWith<$Res>
    implements $EditorNodeIdCopyWith<$Res> {
  factory $QuestionEditorNodeIdCopyWith(
    QuestionEditorNodeId value,
    $Res Function(QuestionEditorNodeId) _then,
  ) = _$QuestionEditorNodeIdCopyWithImpl;
  @useResult
  $Res call({int roundIndex, int themeIndex, int questionIndex});
}

/// @nodoc
class _$QuestionEditorNodeIdCopyWithImpl<$Res>
    implements $QuestionEditorNodeIdCopyWith<$Res> {
  _$QuestionEditorNodeIdCopyWithImpl(this._self, this._then);

  final QuestionEditorNodeId _self;
  final $Res Function(QuestionEditorNodeId) _then;

  /// Create a copy of EditorNodeId
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  $Res call({
    Object? roundIndex = null,
    Object? themeIndex = null,
    Object? questionIndex = null,
  }) {
    return _then(
      QuestionEditorNodeId(
        null == roundIndex
            ? _self.roundIndex
            : roundIndex // ignore: cast_nullable_to_non_nullable
                  as int,
        null == themeIndex
            ? _self.themeIndex
            : themeIndex // ignore: cast_nullable_to_non_nullable
                  as int,
        null == questionIndex
            ? _self.questionIndex
            : questionIndex // ignore: cast_nullable_to_non_nullable
                  as int,
      ),
    );
  }
}
