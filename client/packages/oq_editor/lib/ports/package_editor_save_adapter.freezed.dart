// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'package_editor_save_adapter.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PackageEditorSaveRequest {
  OqPackage get package;
  Map<String, MediaFileReference> get mediaFilesByHash;

  /// Create a copy of PackageEditorSaveRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $PackageEditorSaveRequestCopyWith<PackageEditorSaveRequest> get copyWith =>
      _$PackageEditorSaveRequestCopyWithImpl<PackageEditorSaveRequest>(
        this as PackageEditorSaveRequest,
        _$identity,
      );

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is PackageEditorSaveRequest &&
            (identical(other.package, package) || other.package == package) &&
            const DeepCollectionEquality().equals(
              other.mediaFilesByHash,
              mediaFilesByHash,
            ));
  }

  @override
  int get hashCode => Object.hash(
    runtimeType,
    package,
    const DeepCollectionEquality().hash(mediaFilesByHash),
  );

  @override
  String toString() {
    return 'PackageEditorSaveRequest(package: $package, mediaFilesByHash: $mediaFilesByHash)';
  }
}

/// @nodoc
abstract mixin class $PackageEditorSaveRequestCopyWith<$Res> {
  factory $PackageEditorSaveRequestCopyWith(
    PackageEditorSaveRequest value,
    $Res Function(PackageEditorSaveRequest) _then,
  ) = _$PackageEditorSaveRequestCopyWithImpl;
  @useResult
  $Res call({
    OqPackage package,
    Map<String, MediaFileReference> mediaFilesByHash,
  });

  $OqPackageCopyWith<$Res> get package;
}

/// @nodoc
class _$PackageEditorSaveRequestCopyWithImpl<$Res>
    implements $PackageEditorSaveRequestCopyWith<$Res> {
  _$PackageEditorSaveRequestCopyWithImpl(this._self, this._then);

  final PackageEditorSaveRequest _self;
  final $Res Function(PackageEditorSaveRequest) _then;

  /// Create a copy of PackageEditorSaveRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? package = null, Object? mediaFilesByHash = null}) {
    return _then(
      _self.copyWith(
        package: null == package
            ? _self.package
            : package // ignore: cast_nullable_to_non_nullable
                  as OqPackage,
        mediaFilesByHash: null == mediaFilesByHash
            ? _self.mediaFilesByHash
            : mediaFilesByHash // ignore: cast_nullable_to_non_nullable
                  as Map<String, MediaFileReference>,
      ),
    );
  }

  /// Create a copy of PackageEditorSaveRequest
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $OqPackageCopyWith<$Res> get package {
    return $OqPackageCopyWith<$Res>(_self.package, (value) {
      return _then(_self.copyWith(package: value));
    });
  }
}

/// Adds pattern-matching-related methods to [PackageEditorSaveRequest].
extension PackageEditorSaveRequestPatterns on PackageEditorSaveRequest {
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
    TResult Function(_PackageEditorSaveRequest value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _PackageEditorSaveRequest() when $default != null:
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
    TResult Function(_PackageEditorSaveRequest value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _PackageEditorSaveRequest():
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
    TResult? Function(_PackageEditorSaveRequest value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _PackageEditorSaveRequest() when $default != null:
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
    TResult Function(
      OqPackage package,
      Map<String, MediaFileReference> mediaFilesByHash,
    )?
    $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _PackageEditorSaveRequest() when $default != null:
        return $default(_that.package, _that.mediaFilesByHash);
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
    TResult Function(
      OqPackage package,
      Map<String, MediaFileReference> mediaFilesByHash,
    )
    $default,
  ) {
    final _that = this;
    switch (_that) {
      case _PackageEditorSaveRequest():
        return $default(_that.package, _that.mediaFilesByHash);
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
    TResult? Function(
      OqPackage package,
      Map<String, MediaFileReference> mediaFilesByHash,
    )?
    $default,
  ) {
    final _that = this;
    switch (_that) {
      case _PackageEditorSaveRequest() when $default != null:
        return $default(_that.package, _that.mediaFilesByHash);
      case _:
        return null;
    }
  }
}

/// @nodoc

class _PackageEditorSaveRequest implements PackageEditorSaveRequest {
  const _PackageEditorSaveRequest({
    required this.package,
    required final Map<String, MediaFileReference> mediaFilesByHash,
  }) : _mediaFilesByHash = mediaFilesByHash;

  @override
  final OqPackage package;
  final Map<String, MediaFileReference> _mediaFilesByHash;
  @override
  Map<String, MediaFileReference> get mediaFilesByHash {
    if (_mediaFilesByHash is EqualUnmodifiableMapView) return _mediaFilesByHash;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(_mediaFilesByHash);
  }

  /// Create a copy of PackageEditorSaveRequest
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$PackageEditorSaveRequestCopyWith<_PackageEditorSaveRequest> get copyWith =>
      __$PackageEditorSaveRequestCopyWithImpl<_PackageEditorSaveRequest>(
        this,
        _$identity,
      );

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _PackageEditorSaveRequest &&
            (identical(other.package, package) || other.package == package) &&
            const DeepCollectionEquality().equals(
              other._mediaFilesByHash,
              _mediaFilesByHash,
            ));
  }

  @override
  int get hashCode => Object.hash(
    runtimeType,
    package,
    const DeepCollectionEquality().hash(_mediaFilesByHash),
  );

  @override
  String toString() {
    return 'PackageEditorSaveRequest(package: $package, mediaFilesByHash: $mediaFilesByHash)';
  }
}

/// @nodoc
abstract mixin class _$PackageEditorSaveRequestCopyWith<$Res>
    implements $PackageEditorSaveRequestCopyWith<$Res> {
  factory _$PackageEditorSaveRequestCopyWith(
    _PackageEditorSaveRequest value,
    $Res Function(_PackageEditorSaveRequest) _then,
  ) = __$PackageEditorSaveRequestCopyWithImpl;
  @override
  @useResult
  $Res call({
    OqPackage package,
    Map<String, MediaFileReference> mediaFilesByHash,
  });

  @override
  $OqPackageCopyWith<$Res> get package;
}

/// @nodoc
class __$PackageEditorSaveRequestCopyWithImpl<$Res>
    implements _$PackageEditorSaveRequestCopyWith<$Res> {
  __$PackageEditorSaveRequestCopyWithImpl(this._self, this._then);

  final _PackageEditorSaveRequest _self;
  final $Res Function(_PackageEditorSaveRequest) _then;

  /// Create a copy of PackageEditorSaveRequest
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({Object? package = null, Object? mediaFilesByHash = null}) {
    return _then(
      _PackageEditorSaveRequest(
        package: null == package
            ? _self.package
            : package // ignore: cast_nullable_to_non_nullable
                  as OqPackage,
        mediaFilesByHash: null == mediaFilesByHash
            ? _self._mediaFilesByHash
            : mediaFilesByHash // ignore: cast_nullable_to_non_nullable
                  as Map<String, MediaFileReference>,
      ),
    );
  }

  /// Create a copy of PackageEditorSaveRequest
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $OqPackageCopyWith<$Res> get package {
    return $OqPackageCopyWith<$Res>(_self.package, (value) {
      return _then(_self.copyWith(package: value));
    });
  }
}

/// @nodoc
mixin _$PackageEditorOperationEvent {
  String? get message;

  /// Create a copy of PackageEditorOperationEvent
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $PackageEditorOperationEventCopyWith<PackageEditorOperationEvent>
  get copyWith =>
      _$PackageEditorOperationEventCopyWithImpl<PackageEditorOperationEvent>(
        this as PackageEditorOperationEvent,
        _$identity,
      );

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is PackageEditorOperationEvent &&
            (identical(other.message, message) || other.message == message));
  }

  @override
  int get hashCode => Object.hash(runtimeType, message);

  @override
  String toString() {
    return 'PackageEditorOperationEvent(message: $message)';
  }
}

/// @nodoc
abstract mixin class $PackageEditorOperationEventCopyWith<$Res> {
  factory $PackageEditorOperationEventCopyWith(
    PackageEditorOperationEvent value,
    $Res Function(PackageEditorOperationEvent) _then,
  ) = _$PackageEditorOperationEventCopyWithImpl;
  @useResult
  $Res call({String? message});
}

/// @nodoc
class _$PackageEditorOperationEventCopyWithImpl<$Res>
    implements $PackageEditorOperationEventCopyWith<$Res> {
  _$PackageEditorOperationEventCopyWithImpl(this._self, this._then);

  final PackageEditorOperationEvent _self;
  final $Res Function(PackageEditorOperationEvent) _then;

  /// Create a copy of PackageEditorOperationEvent
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? message = freezed}) {
    return _then(
      _self.copyWith(
        message: freezed == message
            ? _self.message
            : message // ignore: cast_nullable_to_non_nullable
                  as String?,
      ),
    );
  }
}

/// Adds pattern-matching-related methods to [PackageEditorOperationEvent].
extension PackageEditorOperationEventPatterns on PackageEditorOperationEvent {
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
    TResult Function(PackageEditorOperationRunningEvent value)? running,
    TResult Function(PackageEditorOperationCompletedEvent value)? completed,
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case PackageEditorOperationRunningEvent() when running != null:
        return running(_that);
      case PackageEditorOperationCompletedEvent() when completed != null:
        return completed(_that);
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
    required TResult Function(PackageEditorOperationRunningEvent value) running,
    required TResult Function(PackageEditorOperationCompletedEvent value)
    completed,
  }) {
    final _that = this;
    switch (_that) {
      case PackageEditorOperationRunningEvent():
        return running(_that);
      case PackageEditorOperationCompletedEvent():
        return completed(_that);
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
    TResult? Function(PackageEditorOperationRunningEvent value)? running,
    TResult? Function(PackageEditorOperationCompletedEvent value)? completed,
  }) {
    final _that = this;
    switch (_that) {
      case PackageEditorOperationRunningEvent() when running != null:
        return running(_that);
      case PackageEditorOperationCompletedEvent() when completed != null:
        return completed(_that);
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
    TResult Function(
      PackageEditorOperationPhase phase,
      double? progress,
      String? message,
    )?
    running,
    TResult Function(OqPackage package, String? message)? completed,
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case PackageEditorOperationRunningEvent() when running != null:
        return running(_that.phase, _that.progress, _that.message);
      case PackageEditorOperationCompletedEvent() when completed != null:
        return completed(_that.package, _that.message);
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
    required TResult Function(
      PackageEditorOperationPhase phase,
      double? progress,
      String? message,
    )
    running,
    required TResult Function(OqPackage package, String? message) completed,
  }) {
    final _that = this;
    switch (_that) {
      case PackageEditorOperationRunningEvent():
        return running(_that.phase, _that.progress, _that.message);
      case PackageEditorOperationCompletedEvent():
        return completed(_that.package, _that.message);
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
    TResult? Function(
      PackageEditorOperationPhase phase,
      double? progress,
      String? message,
    )?
    running,
    TResult? Function(OqPackage package, String? message)? completed,
  }) {
    final _that = this;
    switch (_that) {
      case PackageEditorOperationRunningEvent() when running != null:
        return running(_that.phase, _that.progress, _that.message);
      case PackageEditorOperationCompletedEvent() when completed != null:
        return completed(_that.package, _that.message);
      case _:
        return null;
    }
  }
}

/// @nodoc

class PackageEditorOperationRunningEvent extends PackageEditorOperationEvent {
  const PackageEditorOperationRunningEvent({
    required this.phase,
    this.progress,
    this.message,
  }) : super._();

  final PackageEditorOperationPhase phase;
  final double? progress;
  @override
  final String? message;

  /// Create a copy of PackageEditorOperationEvent
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $PackageEditorOperationRunningEventCopyWith<
    PackageEditorOperationRunningEvent
  >
  get copyWith =>
      _$PackageEditorOperationRunningEventCopyWithImpl<
        PackageEditorOperationRunningEvent
      >(this, _$identity);

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is PackageEditorOperationRunningEvent &&
            (identical(other.phase, phase) || other.phase == phase) &&
            (identical(other.progress, progress) ||
                other.progress == progress) &&
            (identical(other.message, message) || other.message == message));
  }

  @override
  int get hashCode => Object.hash(runtimeType, phase, progress, message);

  @override
  String toString() {
    return 'PackageEditorOperationEvent.running(phase: $phase, progress: $progress, message: $message)';
  }
}

/// @nodoc
abstract mixin class $PackageEditorOperationRunningEventCopyWith<$Res>
    implements $PackageEditorOperationEventCopyWith<$Res> {
  factory $PackageEditorOperationRunningEventCopyWith(
    PackageEditorOperationRunningEvent value,
    $Res Function(PackageEditorOperationRunningEvent) _then,
  ) = _$PackageEditorOperationRunningEventCopyWithImpl;
  @override
  @useResult
  $Res call({
    PackageEditorOperationPhase phase,
    double? progress,
    String? message,
  });
}

/// @nodoc
class _$PackageEditorOperationRunningEventCopyWithImpl<$Res>
    implements $PackageEditorOperationRunningEventCopyWith<$Res> {
  _$PackageEditorOperationRunningEventCopyWithImpl(this._self, this._then);

  final PackageEditorOperationRunningEvent _self;
  final $Res Function(PackageEditorOperationRunningEvent) _then;

  /// Create a copy of PackageEditorOperationEvent
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? phase = null,
    Object? progress = freezed,
    Object? message = freezed,
  }) {
    return _then(
      PackageEditorOperationRunningEvent(
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

class PackageEditorOperationCompletedEvent extends PackageEditorOperationEvent {
  const PackageEditorOperationCompletedEvent({
    required this.package,
    this.message,
  }) : super._();

  final OqPackage package;
  @override
  final String? message;

  /// Create a copy of PackageEditorOperationEvent
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $PackageEditorOperationCompletedEventCopyWith<
    PackageEditorOperationCompletedEvent
  >
  get copyWith =>
      _$PackageEditorOperationCompletedEventCopyWithImpl<
        PackageEditorOperationCompletedEvent
      >(this, _$identity);

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is PackageEditorOperationCompletedEvent &&
            (identical(other.package, package) || other.package == package) &&
            (identical(other.message, message) || other.message == message));
  }

  @override
  int get hashCode => Object.hash(runtimeType, package, message);

  @override
  String toString() {
    return 'PackageEditorOperationEvent.completed(package: $package, message: $message)';
  }
}

/// @nodoc
abstract mixin class $PackageEditorOperationCompletedEventCopyWith<$Res>
    implements $PackageEditorOperationEventCopyWith<$Res> {
  factory $PackageEditorOperationCompletedEventCopyWith(
    PackageEditorOperationCompletedEvent value,
    $Res Function(PackageEditorOperationCompletedEvent) _then,
  ) = _$PackageEditorOperationCompletedEventCopyWithImpl;
  @override
  @useResult
  $Res call({OqPackage package, String? message});

  $OqPackageCopyWith<$Res> get package;
}

/// @nodoc
class _$PackageEditorOperationCompletedEventCopyWithImpl<$Res>
    implements $PackageEditorOperationCompletedEventCopyWith<$Res> {
  _$PackageEditorOperationCompletedEventCopyWithImpl(this._self, this._then);

  final PackageEditorOperationCompletedEvent _self;
  final $Res Function(PackageEditorOperationCompletedEvent) _then;

  /// Create a copy of PackageEditorOperationEvent
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({Object? package = null, Object? message = freezed}) {
    return _then(
      PackageEditorOperationCompletedEvent(
        package: null == package
            ? _self.package
            : package // ignore: cast_nullable_to_non_nullable
                  as OqPackage,
        message: freezed == message
            ? _self.message
            : message // ignore: cast_nullable_to_non_nullable
                  as String?,
      ),
    );
  }

  /// Create a copy of PackageEditorOperationEvent
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $OqPackageCopyWith<$Res> get package {
    return $OqPackageCopyWith<$Res>(_self.package, (value) {
      return _then(_self.copyWith(package: value));
    });
  }
}
