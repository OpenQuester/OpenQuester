// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'ffprobe_output.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

/// @nodoc
mixin _$FfprobeOutput {
  List<StreamData> get streams;
  FormatData get format;

  /// Create a copy of FfprobeOutput
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $FfprobeOutputCopyWith<FfprobeOutput> get copyWith =>
      _$FfprobeOutputCopyWithImpl<FfprobeOutput>(
        this as FfprobeOutput,
        _$identity,
      );

  /// Serializes this FfprobeOutput to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is FfprobeOutput &&
            const DeepCollectionEquality().equals(other.streams, streams) &&
            (identical(other.format, format) || other.format == format));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    const DeepCollectionEquality().hash(streams),
    format,
  );

  @override
  String toString() {
    return 'FfprobeOutput(streams: $streams, format: $format)';
  }
}

/// @nodoc
abstract mixin class $FfprobeOutputCopyWith<$Res> {
  factory $FfprobeOutputCopyWith(
    FfprobeOutput value,
    $Res Function(FfprobeOutput) _then,
  ) = _$FfprobeOutputCopyWithImpl;
  @useResult
  $Res call({List<StreamData> streams, FormatData format});

  $FormatDataCopyWith<$Res> get format;
}

/// @nodoc
class _$FfprobeOutputCopyWithImpl<$Res>
    implements $FfprobeOutputCopyWith<$Res> {
  _$FfprobeOutputCopyWithImpl(this._self, this._then);

  final FfprobeOutput _self;
  final $Res Function(FfprobeOutput) _then;

  /// Create a copy of FfprobeOutput
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? streams = null, Object? format = null}) {
    return _then(
      _self.copyWith(
        streams: null == streams
            ? _self.streams
            : streams // ignore: cast_nullable_to_non_nullable
                  as List<StreamData>,
        format: null == format
            ? _self.format
            : format // ignore: cast_nullable_to_non_nullable
                  as FormatData,
      ),
    );
  }

  /// Create a copy of FfprobeOutput
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $FormatDataCopyWith<$Res> get format {
    return $FormatDataCopyWith<$Res>(_self.format, (value) {
      return _then(_self.copyWith(format: value));
    });
  }
}

/// Adds pattern-matching-related methods to [FfprobeOutput].
extension FfprobeOutputPatterns on FfprobeOutput {
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
    TResult Function(_FfprobeOutput value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _FfprobeOutput() when $default != null:
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
    TResult Function(_FfprobeOutput value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _FfprobeOutput():
        return $default(_that);
      case _:
        throw StateError('Unexpected subclass');
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
    TResult? Function(_FfprobeOutput value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _FfprobeOutput() when $default != null:
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
    TResult Function(List<StreamData> streams, FormatData format)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _FfprobeOutput() when $default != null:
        return $default(_that.streams, _that.format);
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
    TResult Function(List<StreamData> streams, FormatData format) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _FfprobeOutput():
        return $default(_that.streams, _that.format);
      case _:
        throw StateError('Unexpected subclass');
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
    TResult? Function(List<StreamData> streams, FormatData format)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _FfprobeOutput() when $default != null:
        return $default(_that.streams, _that.format);
      case _:
        return null;
    }
  }
}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.snake)
class _FfprobeOutput implements FfprobeOutput {
  const _FfprobeOutput({
    required final List<StreamData> streams,
    required this.format,
  }) : _streams = streams;
  factory _FfprobeOutput.fromJson(Map<String, dynamic> json) =>
      _$FfprobeOutputFromJson(json);

  final List<StreamData> _streams;
  @override
  List<StreamData> get streams {
    if (_streams is EqualUnmodifiableListView) return _streams;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_streams);
  }

  @override
  final FormatData format;

  /// Create a copy of FfprobeOutput
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$FfprobeOutputCopyWith<_FfprobeOutput> get copyWith =>
      __$FfprobeOutputCopyWithImpl<_FfprobeOutput>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$FfprobeOutputToJson(this);
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _FfprobeOutput &&
            const DeepCollectionEquality().equals(other._streams, _streams) &&
            (identical(other.format, format) || other.format == format));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    const DeepCollectionEquality().hash(_streams),
    format,
  );

  @override
  String toString() {
    return 'FfprobeOutput(streams: $streams, format: $format)';
  }
}

/// @nodoc
abstract mixin class _$FfprobeOutputCopyWith<$Res>
    implements $FfprobeOutputCopyWith<$Res> {
  factory _$FfprobeOutputCopyWith(
    _FfprobeOutput value,
    $Res Function(_FfprobeOutput) _then,
  ) = __$FfprobeOutputCopyWithImpl;
  @override
  @useResult
  $Res call({List<StreamData> streams, FormatData format});

  @override
  $FormatDataCopyWith<$Res> get format;
}

/// @nodoc
class __$FfprobeOutputCopyWithImpl<$Res>
    implements _$FfprobeOutputCopyWith<$Res> {
  __$FfprobeOutputCopyWithImpl(this._self, this._then);

  final _FfprobeOutput _self;
  final $Res Function(_FfprobeOutput) _then;

  /// Create a copy of FfprobeOutput
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({Object? streams = null, Object? format = null}) {
    return _then(
      _FfprobeOutput(
        streams: null == streams
            ? _self._streams
            : streams // ignore: cast_nullable_to_non_nullable
                  as List<StreamData>,
        format: null == format
            ? _self.format
            : format // ignore: cast_nullable_to_non_nullable
                  as FormatData,
      ),
    );
  }

  /// Create a copy of FfprobeOutput
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $FormatDataCopyWith<$Res> get format {
    return $FormatDataCopyWith<$Res>(_self.format, (value) {
      return _then(_self.copyWith(format: value));
    });
  }
}

/// @nodoc
mixin _$StreamData {
  int get index;
  String? get codecName;
  String? get codecLongName;
  @JsonKey(unknownEnumValue: JsonKey.nullForUndefinedEnumValue)
  CodecType? get codecType;
  String? get profile;
  int? get width;
  int? get height;
  int? get codedWidth;
  int? get codedHeight;
  String? get displayAspectRatio;
  String? get pixFmt;
  int? get level;
  @JsonKey(fromJson: _sampleFormatFromString, toJson: _sampleFormatToString)
  SampleFormat? get sampleFmt;
  String? get sampleRate;
  int? get channels;
  String? get channelLayout;
  String? get nbFrames;

  /// Create a copy of StreamData
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $StreamDataCopyWith<StreamData> get copyWith =>
      _$StreamDataCopyWithImpl<StreamData>(this as StreamData, _$identity);

  /// Serializes this StreamData to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is StreamData &&
            (identical(other.index, index) || other.index == index) &&
            (identical(other.codecName, codecName) ||
                other.codecName == codecName) &&
            (identical(other.codecLongName, codecLongName) ||
                other.codecLongName == codecLongName) &&
            (identical(other.codecType, codecType) ||
                other.codecType == codecType) &&
            (identical(other.profile, profile) || other.profile == profile) &&
            (identical(other.width, width) || other.width == width) &&
            (identical(other.height, height) || other.height == height) &&
            (identical(other.codedWidth, codedWidth) ||
                other.codedWidth == codedWidth) &&
            (identical(other.codedHeight, codedHeight) ||
                other.codedHeight == codedHeight) &&
            (identical(other.displayAspectRatio, displayAspectRatio) ||
                other.displayAspectRatio == displayAspectRatio) &&
            (identical(other.pixFmt, pixFmt) || other.pixFmt == pixFmt) &&
            (identical(other.level, level) || other.level == level) &&
            (identical(other.sampleFmt, sampleFmt) ||
                other.sampleFmt == sampleFmt) &&
            (identical(other.sampleRate, sampleRate) ||
                other.sampleRate == sampleRate) &&
            (identical(other.channels, channels) ||
                other.channels == channels) &&
            (identical(other.channelLayout, channelLayout) ||
                other.channelLayout == channelLayout) &&
            (identical(other.nbFrames, nbFrames) ||
                other.nbFrames == nbFrames));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    index,
    codecName,
    codecLongName,
    codecType,
    profile,
    width,
    height,
    codedWidth,
    codedHeight,
    displayAspectRatio,
    pixFmt,
    level,
    sampleFmt,
    sampleRate,
    channels,
    channelLayout,
    nbFrames,
  );

  @override
  String toString() {
    return 'StreamData(index: $index, codecName: $codecName, codecLongName: $codecLongName, codecType: $codecType, profile: $profile, width: $width, height: $height, codedWidth: $codedWidth, codedHeight: $codedHeight, displayAspectRatio: $displayAspectRatio, pixFmt: $pixFmt, level: $level, sampleFmt: $sampleFmt, sampleRate: $sampleRate, channels: $channels, channelLayout: $channelLayout, nbFrames: $nbFrames)';
  }
}

/// @nodoc
abstract mixin class $StreamDataCopyWith<$Res> {
  factory $StreamDataCopyWith(
    StreamData value,
    $Res Function(StreamData) _then,
  ) = _$StreamDataCopyWithImpl;
  @useResult
  $Res call({
    int index,
    String? codecName,
    String? codecLongName,
    @JsonKey(unknownEnumValue: JsonKey.nullForUndefinedEnumValue)
    CodecType? codecType,
    String? profile,
    int? width,
    int? height,
    int? codedWidth,
    int? codedHeight,
    String? displayAspectRatio,
    String? pixFmt,
    int? level,
    @JsonKey(fromJson: _sampleFormatFromString, toJson: _sampleFormatToString)
    SampleFormat? sampleFmt,
    String? sampleRate,
    int? channels,
    String? channelLayout,
    String? nbFrames,
  });
}

/// @nodoc
class _$StreamDataCopyWithImpl<$Res> implements $StreamDataCopyWith<$Res> {
  _$StreamDataCopyWithImpl(this._self, this._then);

  final StreamData _self;
  final $Res Function(StreamData) _then;

  /// Create a copy of StreamData
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? index = null,
    Object? codecName = freezed,
    Object? codecLongName = freezed,
    Object? codecType = freezed,
    Object? profile = freezed,
    Object? width = freezed,
    Object? height = freezed,
    Object? codedWidth = freezed,
    Object? codedHeight = freezed,
    Object? displayAspectRatio = freezed,
    Object? pixFmt = freezed,
    Object? level = freezed,
    Object? sampleFmt = freezed,
    Object? sampleRate = freezed,
    Object? channels = freezed,
    Object? channelLayout = freezed,
    Object? nbFrames = freezed,
  }) {
    return _then(
      _self.copyWith(
        index: null == index
            ? _self.index
            : index // ignore: cast_nullable_to_non_nullable
                  as int,
        codecName: freezed == codecName
            ? _self.codecName
            : codecName // ignore: cast_nullable_to_non_nullable
                  as String?,
        codecLongName: freezed == codecLongName
            ? _self.codecLongName
            : codecLongName // ignore: cast_nullable_to_non_nullable
                  as String?,
        codecType: freezed == codecType
            ? _self.codecType
            : codecType // ignore: cast_nullable_to_non_nullable
                  as CodecType?,
        profile: freezed == profile
            ? _self.profile
            : profile // ignore: cast_nullable_to_non_nullable
                  as String?,
        width: freezed == width
            ? _self.width
            : width // ignore: cast_nullable_to_non_nullable
                  as int?,
        height: freezed == height
            ? _self.height
            : height // ignore: cast_nullable_to_non_nullable
                  as int?,
        codedWidth: freezed == codedWidth
            ? _self.codedWidth
            : codedWidth // ignore: cast_nullable_to_non_nullable
                  as int?,
        codedHeight: freezed == codedHeight
            ? _self.codedHeight
            : codedHeight // ignore: cast_nullable_to_non_nullable
                  as int?,
        displayAspectRatio: freezed == displayAspectRatio
            ? _self.displayAspectRatio
            : displayAspectRatio // ignore: cast_nullable_to_non_nullable
                  as String?,
        pixFmt: freezed == pixFmt
            ? _self.pixFmt
            : pixFmt // ignore: cast_nullable_to_non_nullable
                  as String?,
        level: freezed == level
            ? _self.level
            : level // ignore: cast_nullable_to_non_nullable
                  as int?,
        sampleFmt: freezed == sampleFmt
            ? _self.sampleFmt
            : sampleFmt // ignore: cast_nullable_to_non_nullable
                  as SampleFormat?,
        sampleRate: freezed == sampleRate
            ? _self.sampleRate
            : sampleRate // ignore: cast_nullable_to_non_nullable
                  as String?,
        channels: freezed == channels
            ? _self.channels
            : channels // ignore: cast_nullable_to_non_nullable
                  as int?,
        channelLayout: freezed == channelLayout
            ? _self.channelLayout
            : channelLayout // ignore: cast_nullable_to_non_nullable
                  as String?,
        nbFrames: freezed == nbFrames
            ? _self.nbFrames
            : nbFrames // ignore: cast_nullable_to_non_nullable
                  as String?,
      ),
    );
  }
}

/// Adds pattern-matching-related methods to [StreamData].
extension StreamDataPatterns on StreamData {
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
    TResult Function(_StreamData value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _StreamData() when $default != null:
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
    TResult Function(_StreamData value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _StreamData():
        return $default(_that);
      case _:
        throw StateError('Unexpected subclass');
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
    TResult? Function(_StreamData value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _StreamData() when $default != null:
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
      int index,
      String? codecName,
      String? codecLongName,
      @JsonKey(unknownEnumValue: JsonKey.nullForUndefinedEnumValue)
      CodecType? codecType,
      String? profile,
      int? width,
      int? height,
      int? codedWidth,
      int? codedHeight,
      String? displayAspectRatio,
      String? pixFmt,
      int? level,
      @JsonKey(fromJson: _sampleFormatFromString, toJson: _sampleFormatToString)
      SampleFormat? sampleFmt,
      String? sampleRate,
      int? channels,
      String? channelLayout,
      String? nbFrames,
    )?
    $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _StreamData() when $default != null:
        return $default(
          _that.index,
          _that.codecName,
          _that.codecLongName,
          _that.codecType,
          _that.profile,
          _that.width,
          _that.height,
          _that.codedWidth,
          _that.codedHeight,
          _that.displayAspectRatio,
          _that.pixFmt,
          _that.level,
          _that.sampleFmt,
          _that.sampleRate,
          _that.channels,
          _that.channelLayout,
          _that.nbFrames,
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
  TResult when<TResult extends Object?>(
    TResult Function(
      int index,
      String? codecName,
      String? codecLongName,
      @JsonKey(unknownEnumValue: JsonKey.nullForUndefinedEnumValue)
      CodecType? codecType,
      String? profile,
      int? width,
      int? height,
      int? codedWidth,
      int? codedHeight,
      String? displayAspectRatio,
      String? pixFmt,
      int? level,
      @JsonKey(fromJson: _sampleFormatFromString, toJson: _sampleFormatToString)
      SampleFormat? sampleFmt,
      String? sampleRate,
      int? channels,
      String? channelLayout,
      String? nbFrames,
    )
    $default,
  ) {
    final _that = this;
    switch (_that) {
      case _StreamData():
        return $default(
          _that.index,
          _that.codecName,
          _that.codecLongName,
          _that.codecType,
          _that.profile,
          _that.width,
          _that.height,
          _that.codedWidth,
          _that.codedHeight,
          _that.displayAspectRatio,
          _that.pixFmt,
          _that.level,
          _that.sampleFmt,
          _that.sampleRate,
          _that.channels,
          _that.channelLayout,
          _that.nbFrames,
        );
      case _:
        throw StateError('Unexpected subclass');
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
      int index,
      String? codecName,
      String? codecLongName,
      @JsonKey(unknownEnumValue: JsonKey.nullForUndefinedEnumValue)
      CodecType? codecType,
      String? profile,
      int? width,
      int? height,
      int? codedWidth,
      int? codedHeight,
      String? displayAspectRatio,
      String? pixFmt,
      int? level,
      @JsonKey(fromJson: _sampleFormatFromString, toJson: _sampleFormatToString)
      SampleFormat? sampleFmt,
      String? sampleRate,
      int? channels,
      String? channelLayout,
      String? nbFrames,
    )?
    $default,
  ) {
    final _that = this;
    switch (_that) {
      case _StreamData() when $default != null:
        return $default(
          _that.index,
          _that.codecName,
          _that.codecLongName,
          _that.codecType,
          _that.profile,
          _that.width,
          _that.height,
          _that.codedWidth,
          _that.codedHeight,
          _that.displayAspectRatio,
          _that.pixFmt,
          _that.level,
          _that.sampleFmt,
          _that.sampleRate,
          _that.channels,
          _that.channelLayout,
          _that.nbFrames,
        );
      case _:
        return null;
    }
  }
}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.snake)
class _StreamData implements StreamData {
  const _StreamData({
    required this.index,
    this.codecName,
    this.codecLongName,
    @JsonKey(unknownEnumValue: JsonKey.nullForUndefinedEnumValue)
    this.codecType,
    this.profile,
    this.width,
    this.height,
    this.codedWidth,
    this.codedHeight,
    this.displayAspectRatio,
    this.pixFmt,
    this.level,
    @JsonKey(fromJson: _sampleFormatFromString, toJson: _sampleFormatToString)
    this.sampleFmt,
    this.sampleRate,
    this.channels,
    this.channelLayout,
    this.nbFrames,
  });
  factory _StreamData.fromJson(Map<String, dynamic> json) =>
      _$StreamDataFromJson(json);

  @override
  final int index;
  @override
  final String? codecName;
  @override
  final String? codecLongName;
  @override
  @JsonKey(unknownEnumValue: JsonKey.nullForUndefinedEnumValue)
  final CodecType? codecType;
  @override
  final String? profile;
  @override
  final int? width;
  @override
  final int? height;
  @override
  final int? codedWidth;
  @override
  final int? codedHeight;
  @override
  final String? displayAspectRatio;
  @override
  final String? pixFmt;
  @override
  final int? level;
  @override
  @JsonKey(fromJson: _sampleFormatFromString, toJson: _sampleFormatToString)
  final SampleFormat? sampleFmt;
  @override
  final String? sampleRate;
  @override
  final int? channels;
  @override
  final String? channelLayout;
  @override
  final String? nbFrames;

  /// Create a copy of StreamData
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$StreamDataCopyWith<_StreamData> get copyWith =>
      __$StreamDataCopyWithImpl<_StreamData>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$StreamDataToJson(this);
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _StreamData &&
            (identical(other.index, index) || other.index == index) &&
            (identical(other.codecName, codecName) ||
                other.codecName == codecName) &&
            (identical(other.codecLongName, codecLongName) ||
                other.codecLongName == codecLongName) &&
            (identical(other.codecType, codecType) ||
                other.codecType == codecType) &&
            (identical(other.profile, profile) || other.profile == profile) &&
            (identical(other.width, width) || other.width == width) &&
            (identical(other.height, height) || other.height == height) &&
            (identical(other.codedWidth, codedWidth) ||
                other.codedWidth == codedWidth) &&
            (identical(other.codedHeight, codedHeight) ||
                other.codedHeight == codedHeight) &&
            (identical(other.displayAspectRatio, displayAspectRatio) ||
                other.displayAspectRatio == displayAspectRatio) &&
            (identical(other.pixFmt, pixFmt) || other.pixFmt == pixFmt) &&
            (identical(other.level, level) || other.level == level) &&
            (identical(other.sampleFmt, sampleFmt) ||
                other.sampleFmt == sampleFmt) &&
            (identical(other.sampleRate, sampleRate) ||
                other.sampleRate == sampleRate) &&
            (identical(other.channels, channels) ||
                other.channels == channels) &&
            (identical(other.channelLayout, channelLayout) ||
                other.channelLayout == channelLayout) &&
            (identical(other.nbFrames, nbFrames) ||
                other.nbFrames == nbFrames));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    index,
    codecName,
    codecLongName,
    codecType,
    profile,
    width,
    height,
    codedWidth,
    codedHeight,
    displayAspectRatio,
    pixFmt,
    level,
    sampleFmt,
    sampleRate,
    channels,
    channelLayout,
    nbFrames,
  );

  @override
  String toString() {
    return 'StreamData(index: $index, codecName: $codecName, codecLongName: $codecLongName, codecType: $codecType, profile: $profile, width: $width, height: $height, codedWidth: $codedWidth, codedHeight: $codedHeight, displayAspectRatio: $displayAspectRatio, pixFmt: $pixFmt, level: $level, sampleFmt: $sampleFmt, sampleRate: $sampleRate, channels: $channels, channelLayout: $channelLayout, nbFrames: $nbFrames)';
  }
}

/// @nodoc
abstract mixin class _$StreamDataCopyWith<$Res>
    implements $StreamDataCopyWith<$Res> {
  factory _$StreamDataCopyWith(
    _StreamData value,
    $Res Function(_StreamData) _then,
  ) = __$StreamDataCopyWithImpl;
  @override
  @useResult
  $Res call({
    int index,
    String? codecName,
    String? codecLongName,
    @JsonKey(unknownEnumValue: JsonKey.nullForUndefinedEnumValue)
    CodecType? codecType,
    String? profile,
    int? width,
    int? height,
    int? codedWidth,
    int? codedHeight,
    String? displayAspectRatio,
    String? pixFmt,
    int? level,
    @JsonKey(fromJson: _sampleFormatFromString, toJson: _sampleFormatToString)
    SampleFormat? sampleFmt,
    String? sampleRate,
    int? channels,
    String? channelLayout,
    String? nbFrames,
  });
}

/// @nodoc
class __$StreamDataCopyWithImpl<$Res> implements _$StreamDataCopyWith<$Res> {
  __$StreamDataCopyWithImpl(this._self, this._then);

  final _StreamData _self;
  final $Res Function(_StreamData) _then;

  /// Create a copy of StreamData
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? index = null,
    Object? codecName = freezed,
    Object? codecLongName = freezed,
    Object? codecType = freezed,
    Object? profile = freezed,
    Object? width = freezed,
    Object? height = freezed,
    Object? codedWidth = freezed,
    Object? codedHeight = freezed,
    Object? displayAspectRatio = freezed,
    Object? pixFmt = freezed,
    Object? level = freezed,
    Object? sampleFmt = freezed,
    Object? sampleRate = freezed,
    Object? channels = freezed,
    Object? channelLayout = freezed,
    Object? nbFrames = freezed,
  }) {
    return _then(
      _StreamData(
        index: null == index
            ? _self.index
            : index // ignore: cast_nullable_to_non_nullable
                  as int,
        codecName: freezed == codecName
            ? _self.codecName
            : codecName // ignore: cast_nullable_to_non_nullable
                  as String?,
        codecLongName: freezed == codecLongName
            ? _self.codecLongName
            : codecLongName // ignore: cast_nullable_to_non_nullable
                  as String?,
        codecType: freezed == codecType
            ? _self.codecType
            : codecType // ignore: cast_nullable_to_non_nullable
                  as CodecType?,
        profile: freezed == profile
            ? _self.profile
            : profile // ignore: cast_nullable_to_non_nullable
                  as String?,
        width: freezed == width
            ? _self.width
            : width // ignore: cast_nullable_to_non_nullable
                  as int?,
        height: freezed == height
            ? _self.height
            : height // ignore: cast_nullable_to_non_nullable
                  as int?,
        codedWidth: freezed == codedWidth
            ? _self.codedWidth
            : codedWidth // ignore: cast_nullable_to_non_nullable
                  as int?,
        codedHeight: freezed == codedHeight
            ? _self.codedHeight
            : codedHeight // ignore: cast_nullable_to_non_nullable
                  as int?,
        displayAspectRatio: freezed == displayAspectRatio
            ? _self.displayAspectRatio
            : displayAspectRatio // ignore: cast_nullable_to_non_nullable
                  as String?,
        pixFmt: freezed == pixFmt
            ? _self.pixFmt
            : pixFmt // ignore: cast_nullable_to_non_nullable
                  as String?,
        level: freezed == level
            ? _self.level
            : level // ignore: cast_nullable_to_non_nullable
                  as int?,
        sampleFmt: freezed == sampleFmt
            ? _self.sampleFmt
            : sampleFmt // ignore: cast_nullable_to_non_nullable
                  as SampleFormat?,
        sampleRate: freezed == sampleRate
            ? _self.sampleRate
            : sampleRate // ignore: cast_nullable_to_non_nullable
                  as String?,
        channels: freezed == channels
            ? _self.channels
            : channels // ignore: cast_nullable_to_non_nullable
                  as int?,
        channelLayout: freezed == channelLayout
            ? _self.channelLayout
            : channelLayout // ignore: cast_nullable_to_non_nullable
                  as String?,
        nbFrames: freezed == nbFrames
            ? _self.nbFrames
            : nbFrames // ignore: cast_nullable_to_non_nullable
                  as String?,
      ),
    );
  }
}

/// @nodoc
mixin _$FormatData {
  String get filename;
  String get formatName;
  String get formatLongName;
  String get size;
  String? get bitRate;
  String? get duration;
  String? get startTime;

  /// Create a copy of FormatData
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  $FormatDataCopyWith<FormatData> get copyWith =>
      _$FormatDataCopyWithImpl<FormatData>(this as FormatData, _$identity);

  /// Serializes this FormatData to a JSON map.
  Map<String, dynamic> toJson();

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is FormatData &&
            (identical(other.filename, filename) ||
                other.filename == filename) &&
            (identical(other.formatName, formatName) ||
                other.formatName == formatName) &&
            (identical(other.formatLongName, formatLongName) ||
                other.formatLongName == formatLongName) &&
            (identical(other.size, size) || other.size == size) &&
            (identical(other.bitRate, bitRate) || other.bitRate == bitRate) &&
            (identical(other.duration, duration) ||
                other.duration == duration) &&
            (identical(other.startTime, startTime) ||
                other.startTime == startTime));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    filename,
    formatName,
    formatLongName,
    size,
    bitRate,
    duration,
    startTime,
  );

  @override
  String toString() {
    return 'FormatData(filename: $filename, formatName: $formatName, formatLongName: $formatLongName, size: $size, bitRate: $bitRate, duration: $duration, startTime: $startTime)';
  }
}

/// @nodoc
abstract mixin class $FormatDataCopyWith<$Res> {
  factory $FormatDataCopyWith(
    FormatData value,
    $Res Function(FormatData) _then,
  ) = _$FormatDataCopyWithImpl;
  @useResult
  $Res call({
    String filename,
    String formatName,
    String formatLongName,
    String size,
    String? bitRate,
    String? duration,
    String? startTime,
  });
}

/// @nodoc
class _$FormatDataCopyWithImpl<$Res> implements $FormatDataCopyWith<$Res> {
  _$FormatDataCopyWithImpl(this._self, this._then);

  final FormatData _self;
  final $Res Function(FormatData) _then;

  /// Create a copy of FormatData
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? filename = null,
    Object? formatName = null,
    Object? formatLongName = null,
    Object? size = null,
    Object? bitRate = freezed,
    Object? duration = freezed,
    Object? startTime = freezed,
  }) {
    return _then(
      _self.copyWith(
        filename: null == filename
            ? _self.filename
            : filename // ignore: cast_nullable_to_non_nullable
                  as String,
        formatName: null == formatName
            ? _self.formatName
            : formatName // ignore: cast_nullable_to_non_nullable
                  as String,
        formatLongName: null == formatLongName
            ? _self.formatLongName
            : formatLongName // ignore: cast_nullable_to_non_nullable
                  as String,
        size: null == size
            ? _self.size
            : size // ignore: cast_nullable_to_non_nullable
                  as String,
        bitRate: freezed == bitRate
            ? _self.bitRate
            : bitRate // ignore: cast_nullable_to_non_nullable
                  as String?,
        duration: freezed == duration
            ? _self.duration
            : duration // ignore: cast_nullable_to_non_nullable
                  as String?,
        startTime: freezed == startTime
            ? _self.startTime
            : startTime // ignore: cast_nullable_to_non_nullable
                  as String?,
      ),
    );
  }
}

/// Adds pattern-matching-related methods to [FormatData].
extension FormatDataPatterns on FormatData {
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
    TResult Function(_FormatData value)? $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _FormatData() when $default != null:
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
    TResult Function(_FormatData value) $default,
  ) {
    final _that = this;
    switch (_that) {
      case _FormatData():
        return $default(_that);
      case _:
        throw StateError('Unexpected subclass');
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
    TResult? Function(_FormatData value)? $default,
  ) {
    final _that = this;
    switch (_that) {
      case _FormatData() when $default != null:
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
      String filename,
      String formatName,
      String formatLongName,
      String size,
      String? bitRate,
      String? duration,
      String? startTime,
    )?
    $default, {
    required TResult orElse(),
  }) {
    final _that = this;
    switch (_that) {
      case _FormatData() when $default != null:
        return $default(
          _that.filename,
          _that.formatName,
          _that.formatLongName,
          _that.size,
          _that.bitRate,
          _that.duration,
          _that.startTime,
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
  TResult when<TResult extends Object?>(
    TResult Function(
      String filename,
      String formatName,
      String formatLongName,
      String size,
      String? bitRate,
      String? duration,
      String? startTime,
    )
    $default,
  ) {
    final _that = this;
    switch (_that) {
      case _FormatData():
        return $default(
          _that.filename,
          _that.formatName,
          _that.formatLongName,
          _that.size,
          _that.bitRate,
          _that.duration,
          _that.startTime,
        );
      case _:
        throw StateError('Unexpected subclass');
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
      String filename,
      String formatName,
      String formatLongName,
      String size,
      String? bitRate,
      String? duration,
      String? startTime,
    )?
    $default,
  ) {
    final _that = this;
    switch (_that) {
      case _FormatData() when $default != null:
        return $default(
          _that.filename,
          _that.formatName,
          _that.formatLongName,
          _that.size,
          _that.bitRate,
          _that.duration,
          _that.startTime,
        );
      case _:
        return null;
    }
  }
}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.snake)
class _FormatData implements FormatData {
  const _FormatData({
    required this.filename,
    required this.formatName,
    required this.formatLongName,
    required this.size,
    this.bitRate,
    this.duration,
    this.startTime,
  });
  factory _FormatData.fromJson(Map<String, dynamic> json) =>
      _$FormatDataFromJson(json);

  @override
  final String filename;
  @override
  final String formatName;
  @override
  final String formatLongName;
  @override
  final String size;
  @override
  final String? bitRate;
  @override
  final String? duration;
  @override
  final String? startTime;

  /// Create a copy of FormatData
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  @pragma('vm:prefer-inline')
  _$FormatDataCopyWith<_FormatData> get copyWith =>
      __$FormatDataCopyWithImpl<_FormatData>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$FormatDataToJson(this);
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _FormatData &&
            (identical(other.filename, filename) ||
                other.filename == filename) &&
            (identical(other.formatName, formatName) ||
                other.formatName == formatName) &&
            (identical(other.formatLongName, formatLongName) ||
                other.formatLongName == formatLongName) &&
            (identical(other.size, size) || other.size == size) &&
            (identical(other.bitRate, bitRate) || other.bitRate == bitRate) &&
            (identical(other.duration, duration) ||
                other.duration == duration) &&
            (identical(other.startTime, startTime) ||
                other.startTime == startTime));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    filename,
    formatName,
    formatLongName,
    size,
    bitRate,
    duration,
    startTime,
  );

  @override
  String toString() {
    return 'FormatData(filename: $filename, formatName: $formatName, formatLongName: $formatLongName, size: $size, bitRate: $bitRate, duration: $duration, startTime: $startTime)';
  }
}

/// @nodoc
abstract mixin class _$FormatDataCopyWith<$Res>
    implements $FormatDataCopyWith<$Res> {
  factory _$FormatDataCopyWith(
    _FormatData value,
    $Res Function(_FormatData) _then,
  ) = __$FormatDataCopyWithImpl;
  @override
  @useResult
  $Res call({
    String filename,
    String formatName,
    String formatLongName,
    String size,
    String? bitRate,
    String? duration,
    String? startTime,
  });
}

/// @nodoc
class __$FormatDataCopyWithImpl<$Res> implements _$FormatDataCopyWith<$Res> {
  __$FormatDataCopyWithImpl(this._self, this._then);

  final _FormatData _self;
  final $Res Function(_FormatData) _then;

  /// Create a copy of FormatData
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Res call({
    Object? filename = null,
    Object? formatName = null,
    Object? formatLongName = null,
    Object? size = null,
    Object? bitRate = freezed,
    Object? duration = freezed,
    Object? startTime = freezed,
  }) {
    return _then(
      _FormatData(
        filename: null == filename
            ? _self.filename
            : filename // ignore: cast_nullable_to_non_nullable
                  as String,
        formatName: null == formatName
            ? _self.formatName
            : formatName // ignore: cast_nullable_to_non_nullable
                  as String,
        formatLongName: null == formatLongName
            ? _self.formatLongName
            : formatLongName // ignore: cast_nullable_to_non_nullable
                  as String,
        size: null == size
            ? _self.size
            : size // ignore: cast_nullable_to_non_nullable
                  as String,
        bitRate: freezed == bitRate
            ? _self.bitRate
            : bitRate // ignore: cast_nullable_to_non_nullable
                  as String?,
        duration: freezed == duration
            ? _self.duration
            : duration // ignore: cast_nullable_to_non_nullable
                  as String?,
        startTime: freezed == startTime
            ? _self.startTime
            : startTime // ignore: cast_nullable_to_non_nullable
                  as String?,
      ),
    );
  }
}
