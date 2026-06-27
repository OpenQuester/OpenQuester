// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'package_editor_operation_state.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PackageEditorOperationState {
  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is PackageEditorOperationState);
  }

  @override
  int get hashCode => runtimeType.hashCode;

  @override
  String toString() {
    return 'PackageEditorOperationState()';
  }
}

/// @nodoc
class $PackageEditorOperationStateCopyWith<$Res> {
  $PackageEditorOperationStateCopyWith(
    PackageEditorOperationState _,
    $Res Function(PackageEditorOperationState) __,
  );
}

/// Adds pattern-matching-related methods to [PackageEditorOperationState].
extension PackageEditorOperationStatePatterns on PackageEditorOperationState {
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
    TResult Function(PackageEditorOperationIdle value)? idle,
    TResult Function(PackageEditorOperationRunning value)? running,
    TResult Function(PackageEditorOperationCompleted value)? completed,
    TResult Function(PackageEditorOperationFailed value)? failed,
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case PackageEditorOperationIdle() when idle != null:
        return idle(_that);
      case PackageEditorOperationRunning() when running != null:
        return running(_that);
      case PackageEditorOperationCompleted() when completed != null:
        return completed(_that);
      case PackageEditorOperationFailed() when failed != null:
        return failed(_that);
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
    required TResult Function(PackageEditorOperationIdle value) idle,
    required TResult Function(PackageEditorOperationRunning value) running,
    required TResult Function(PackageEditorOperationCompleted value) completed,
    required TResult Function(PackageEditorOperationFailed value) failed,
  }) {
    final _that = this;
    switch (_that) {
      case PackageEditorOperationIdle():
        return idle(_that);
      case PackageEditorOperationRunning():
        return running(_that);
      case PackageEditorOperationCompleted():
        return completed(_that);
      case PackageEditorOperationFailed():
        return failed(_that);
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
    TResult? Function(PackageEditorOperationIdle value)? idle,
    TResult? Function(PackageEditorOperationRunning value)? running,
    TResult? Function(PackageEditorOperationCompleted value)? completed,
    TResult? Function(PackageEditorOperationFailed value)? failed,
  }) {
    final _that = this;
    switch (_that) {
      case PackageEditorOperationIdle() when idle != null:
        return idle(_that);
      case PackageEditorOperationRunning() when running != null:
        return running(_that);
      case PackageEditorOperationCompleted() when completed != null:
        return completed(_that);
      case PackageEditorOperationFailed() when failed != null:
        return failed(_that);
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
    TResult Function()? idle,
    TResult Function(
      PackageEditorOperationPhase phase,
      double? progress,
      String? message,
    )?
    running,
    TResult Function(String? message)? completed,
    TResult Function(Object error, StackTrace? stackTrace)? failed,
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case PackageEditorOperationIdle() when idle != null:
        return idle();
      case PackageEditorOperationRunning() when running != null:
        return running(_that.phase, _that.progress, _that.message);
      case PackageEditorOperationCompleted() when completed != null:
        return completed(_that.message);
      case PackageEditorOperationFailed() when failed != null:
        return failed(_that.error, _that.stackTrace);
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
    required TResult Function() idle,
    required TResult Function(
      PackageEditorOperationPhase phase,
      double? progress,
      String? message,
    )
    running,
    required TResult Function(String? message) completed,
    required TResult Function(Object error, StackTrace? stackTrace) failed,
  }) {
    final _that = this;
    switch (_that) {
      case PackageEditorOperationIdle():
        return idle();
      case PackageEditorOperationRunning():
        return running(_that.phase, _that.progress, _that.message);
      case PackageEditorOperationCompleted():
        return completed(_that.message);
      case PackageEditorOperationFailed():
        return failed(_that.error, _that.stackTrace);
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
    TResult? Function()? idle,
    TResult? Function(
      PackageEditorOperationPhase phase,
      double? progress,
      String? message,
    )?
    running,
    TResult? Function(String? message)? completed,
    TResult? Function(Object error, StackTrace? stackTrace)? failed,
  }) {
    final _that = this;
    switch (_that) {
      case PackageEditorOperationIdle() when idle != null:
        return idle();
      case PackageEditorOperationRunning() when running != null:
        return running(_that.phase, _that.progress, _that.message);
      case PackageEditorOperationCompleted() when completed != null:
        return completed(_that.message);
      case PackageEditorOperationFailed() when failed != null:
        return failed(_that.error, _that.stackTrace);
      case _:
        return null;
    }
  }
}

/// @nodoc

class PackageEditorOperationIdle extends PackageEditorOperationState {
  const PackageEditorOperationIdle() : super._();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is PackageEditorOperationIdle);
  }

  @override
  int get hashCode => runtimeType.hashCode;

  @override
  String toString() {
    return 'PackageEditorOperationState.idle()';
  }
}

/// @nodoc

class PackageEditorOperationRunning extends PackageEditorOperationState {
  const PackageEditorOperationRunning({
    required this.phase,
    this.progress,
    this.message,
  }) : super._();

  final PackageEditorOperationPhase phase;
  final double? progress;
  final String? message;

  /// Create a copy of PackageEditorOperationState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $PackageEditorOperationRunningCopyWith<PackageEditorOperationRunning>
  get copyWith =>
      _$PackageEditorOperationRunningCopyWithImpl<
        PackageEditorOperationRunning
      >(this, _$identity);

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is PackageEditorOperationRunning &&
            (identical(other.phase, phase) || other.phase == phase) &&
            (identical(other.progress, progress) ||
                other.progress == progress) &&
            (identical(other.message, message) || other.message == message));
  }

  @override
  int get hashCode => Object.hash(runtimeType, phase, progress, message);

  @override
  String toString() {
    return 'PackageEditorOperationState.running(phase: $phase, progress: $progress, message: $message)';
  }
}

/// @nodoc
abstract mixin class $PackageEditorOperationRunningCopyWith<$Res>
    implements $PackageEditorOperationStateCopyWith<$Res> {
  factory $PackageEditorOperationRunningCopyWith(
    PackageEditorOperationRunning value,
    $Res Function(PackageEditorOperationRunning) _then,
  ) = _$PackageEditorOperationRunningCopyWithImpl;
  @useResult
  $Res call({
    PackageEditorOperationPhase phase,
    double? progress,
    String? message,
  });
}

/// @nodoc
class _$PackageEditorOperationRunningCopyWithImpl<$Res>
    implements $PackageEditorOperationRunningCopyWith<$Res> {
  _$PackageEditorOperationRunningCopyWithImpl(this._self, this._then);

  final PackageEditorOperationRunning _self;
  final $Res Function(PackageEditorOperationRunning) _then;

  /// Create a copy of PackageEditorOperationState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  $Res call({
    Object? phase = null,
    Object? progress = freezed,
    Object? message = freezed,
  }) {
    return _then(
      PackageEditorOperationRunning(
        phase: null == phase
            ? _self.phase
            : phase // ignore: cast_nullable_to_non_nullable
                  as PackageEditorOperationPhase,
        progress: freezed == progress
            ? _self.progress
            : progress // ignore: cast_nullable_to_non_nullable
                  as double?,
        message: freezed == message
            ? _self.message
            : message // ignore: cast_nullable_to_non_nullable
                  as String?,
      ),
    );
  }
}

/// @nodoc

class PackageEditorOperationCompleted extends PackageEditorOperationState {
  const PackageEditorOperationCompleted({this.message}) : super._();

  final String? message;

  /// Create a copy of PackageEditorOperationState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $PackageEditorOperationCompletedCopyWith<PackageEditorOperationCompleted>
  get copyWith =>
      _$PackageEditorOperationCompletedCopyWithImpl<
        PackageEditorOperationCompleted
      >(this, _$identity);

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is PackageEditorOperationCompleted &&
            (identical(other.message, message) || other.message == message));
  }

  @override
  int get hashCode => Object.hash(runtimeType, message);

  @override
  String toString() {
    return 'PackageEditorOperationState.completed(message: $message)';
  }
}

/// @nodoc
abstract mixin class $PackageEditorOperationCompletedCopyWith<$Res>
    implements $PackageEditorOperationStateCopyWith<$Res> {
  factory $PackageEditorOperationCompletedCopyWith(
    PackageEditorOperationCompleted value,
    $Res Function(PackageEditorOperationCompleted) _then,
  ) = _$PackageEditorOperationCompletedCopyWithImpl;
  @useResult
  $Res call({String? message});
}

/// @nodoc
class _$PackageEditorOperationCompletedCopyWithImpl<$Res>
    implements $PackageEditorOperationCompletedCopyWith<$Res> {
  _$PackageEditorOperationCompletedCopyWithImpl(this._self, this._then);

  final PackageEditorOperationCompleted _self;
  final $Res Function(PackageEditorOperationCompleted) _then;

  /// Create a copy of PackageEditorOperationState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  $Res call({Object? message = freezed}) {
    return _then(
      PackageEditorOperationCompleted(
        message: freezed == message
            ? _self.message
            : message // ignore: cast_nullable_to_non_nullable
                  as String?,
      ),
    );
  }
}

/// @nodoc

class PackageEditorOperationFailed extends PackageEditorOperationState {
  const PackageEditorOperationFailed({required this.error, this.stackTrace})
    : super._();

  final Object error;
  final StackTrace? stackTrace;

  /// Create a copy of PackageEditorOperationState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $PackageEditorOperationFailedCopyWith<PackageEditorOperationFailed>
  get copyWith =>
      _$PackageEditorOperationFailedCopyWithImpl<PackageEditorOperationFailed>(
        this,
        _$identity,
      );

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is PackageEditorOperationFailed &&
            const DeepCollectionEquality().equals(other.error, error) &&
            (identical(other.stackTrace, stackTrace) ||
                other.stackTrace == stackTrace));
  }

  @override
  int get hashCode => Object.hash(
    runtimeType,
    const DeepCollectionEquality().hash(error),
    stackTrace,
  );

  @override
  String toString() {
    return 'PackageEditorOperationState.failed(error: $error, stackTrace: $stackTrace)';
  }
}

/// @nodoc
abstract mixin class $PackageEditorOperationFailedCopyWith<$Res>
    implements $PackageEditorOperationStateCopyWith<$Res> {
  factory $PackageEditorOperationFailedCopyWith(
    PackageEditorOperationFailed value,
    $Res Function(PackageEditorOperationFailed) _then,
  ) = _$PackageEditorOperationFailedCopyWithImpl;
  @useResult
  $Res call({Object error, StackTrace? stackTrace});
}

/// @nodoc
class _$PackageEditorOperationFailedCopyWithImpl<$Res>
    implements $PackageEditorOperationFailedCopyWith<$Res> {
  _$PackageEditorOperationFailedCopyWithImpl(this._self, this._then);

  final PackageEditorOperationFailed _self;
  final $Res Function(PackageEditorOperationFailed) _then;

  /// Create a copy of PackageEditorOperationState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  $Res call({Object? error = null, Object? stackTrace = freezed}) {
    return _then(
      PackageEditorOperationFailed(
        error: null == error ? _self.error : error,
        stackTrace: freezed == stackTrace
            ? _self.stackTrace
            : stackTrace // ignore: cast_nullable_to_non_nullable
                  as StackTrace?,
      ),
    );
  }
}
