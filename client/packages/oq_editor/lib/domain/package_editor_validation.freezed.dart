// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'package_editor_validation.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PackageEditorValidationResult {
  List<String> get errors;

  /// Create a copy of PackageEditorValidationResult
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $PackageEditorValidationResultCopyWith<PackageEditorValidationResult>
  get copyWith =>
      _$PackageEditorValidationResultCopyWithImpl<
        PackageEditorValidationResult
      >(this as PackageEditorValidationResult, _$identity);

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is PackageEditorValidationResult &&
            const DeepCollectionEquality().equals(other.errors, errors));
  }

  @override
  int get hashCode =>
      Object.hash(runtimeType, const DeepCollectionEquality().hash(errors));

  @override
  String toString() {
    return 'PackageEditorValidationResult(errors: $errors)';
  }
}

/// @nodoc
abstract mixin class $PackageEditorValidationResultCopyWith<$Res> {
  factory $PackageEditorValidationResultCopyWith(
    PackageEditorValidationResult value,
    $Res Function(PackageEditorValidationResult) _then,
  ) = _$PackageEditorValidationResultCopyWithImpl;
  @useResult
  $Res call({List<String> errors});
}

/// @nodoc
class _$PackageEditorValidationResultCopyWithImpl<$Res>
    implements $PackageEditorValidationResultCopyWith<$Res> {
  _$PackageEditorValidationResultCopyWithImpl(this._self, this._then);

  final PackageEditorValidationResult _self;
  final $Res Function(PackageEditorValidationResult) _then;

  /// Create a copy of PackageEditorValidationResult
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? errors = null}) {
    return _then(
      _self.copyWith(
        errors: null == errors
            ? _self.errors
            : errors // ignore: cast_nullable_to_non_nullable
                  as List<String>,
      ),
    );
  }
}

/// Adds pattern-matching-related methods to [PackageEditorValidationResult].
extension PackageEditorValidationResultPatterns
    on PackageEditorValidationResult {
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
  TResult maybeMap<TResult extends Object?>(
    TResult Function(_PackageEditorValidationResult value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _PackageEditorValidationResult() when $default != null:
        return $default(_that);
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
  TResult map<TResult extends Object?>(
    TResult Function(_PackageEditorValidationResult value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _PackageEditorValidationResult():
        return $default(_that);
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
  TResult? mapOrNull<TResult extends Object?>(
    TResult? Function(_PackageEditorValidationResult value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _PackageEditorValidationResult() when $default != null:
        return $default(_that);
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
  TResult maybeWhen<TResult extends Object?>(
    TResult Function(List<String> errors)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _PackageEditorValidationResult() when $default != null:
        return $default(_that.errors);
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
  TResult when<TResult extends Object?>(
    TResult Function(List<String> errors) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _PackageEditorValidationResult():
        return $default(_that.errors);
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
  TResult? whenOrNull<TResult extends Object?>(
    TResult? Function(List<String> errors)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _PackageEditorValidationResult() when $default != null:
        return $default(_that.errors);
      case _:
        return null;
    }
  }
}

/// @nodoc

class _PackageEditorValidationResult extends PackageEditorValidationResult {
  const _PackageEditorValidationResult({
    final List<String> errors = const <String>[],
  }) : _errors = errors,
       super._();

  final List<String> _errors;
  @override
  @JsonKey()
  List<String> get errors {
    if (_errors is EqualUnmodifiableListView) return _errors;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_errors);
  }

  /// Create a copy of PackageEditorValidationResult
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$PackageEditorValidationResultCopyWith<_PackageEditorValidationResult>
  get copyWith =>
      __$PackageEditorValidationResultCopyWithImpl<
        _PackageEditorValidationResult
      >(this, _$identity);

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _PackageEditorValidationResult &&
            const DeepCollectionEquality().equals(other._errors, _errors));
  }

  @override
  int get hashCode =>
      Object.hash(runtimeType, const DeepCollectionEquality().hash(_errors));

  @override
  String toString() {
    return 'PackageEditorValidationResult(errors: $errors)';
  }
}

/// @nodoc
abstract mixin class _$PackageEditorValidationResultCopyWith<$Res>
    implements $PackageEditorValidationResultCopyWith<$Res> {
  factory _$PackageEditorValidationResultCopyWith(
    _PackageEditorValidationResult value,
    $Res Function(_PackageEditorValidationResult) _then,
  ) = __$PackageEditorValidationResultCopyWithImpl;
  @override
  @useResult
  $Res call({List<String> errors});
}

/// @nodoc
class __$PackageEditorValidationResultCopyWithImpl<$Res>
    implements _$PackageEditorValidationResultCopyWith<$Res> {
  __$PackageEditorValidationResultCopyWithImpl(this._self, this._then);

  final _PackageEditorValidationResult _self;
  final $Res Function(_PackageEditorValidationResult) _then;

  /// Create a copy of PackageEditorValidationResult
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({Object? errors = null}) {
    return _then(
      _PackageEditorValidationResult(
        errors: null == errors
            ? _self._errors
            : errors // ignore: cast_nullable_to_non_nullable
                  as List<String>,
      ),
    );
  }
}
