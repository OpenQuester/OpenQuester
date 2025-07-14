// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'theme_eliminate_output.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$ThemeEliminateOutput {

/// ID of the eliminated theme
 int get themeId;/// ID of the player who eliminated the theme
 int get eliminatedBy;/// Next player to pick theme, null if elimination complete
 int? get nextPlayerId;
/// Create a copy of ThemeEliminateOutput
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ThemeEliminateOutputCopyWith<ThemeEliminateOutput> get copyWith => _$ThemeEliminateOutputCopyWithImpl<ThemeEliminateOutput>(this as ThemeEliminateOutput, _$identity);

  /// Serializes this ThemeEliminateOutput to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ThemeEliminateOutput&&(identical(other.themeId, themeId) || other.themeId == themeId)&&(identical(other.eliminatedBy, eliminatedBy) || other.eliminatedBy == eliminatedBy)&&(identical(other.nextPlayerId, nextPlayerId) || other.nextPlayerId == nextPlayerId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,themeId,eliminatedBy,nextPlayerId);

@override
String toString() {
  return 'ThemeEliminateOutput(themeId: $themeId, eliminatedBy: $eliminatedBy, nextPlayerId: $nextPlayerId)';
}


}

/// @nodoc
abstract mixin class $ThemeEliminateOutputCopyWith<$Res>  {
  factory $ThemeEliminateOutputCopyWith(ThemeEliminateOutput value, $Res Function(ThemeEliminateOutput) _then) = _$ThemeEliminateOutputCopyWithImpl;
@useResult
$Res call({
 int themeId, int eliminatedBy, int? nextPlayerId
});




}
/// @nodoc
class _$ThemeEliminateOutputCopyWithImpl<$Res>
    implements $ThemeEliminateOutputCopyWith<$Res> {
  _$ThemeEliminateOutputCopyWithImpl(this._self, this._then);

  final ThemeEliminateOutput _self;
  final $Res Function(ThemeEliminateOutput) _then;

/// Create a copy of ThemeEliminateOutput
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? themeId = null,Object? eliminatedBy = null,Object? nextPlayerId = freezed,}) {
  return _then(_self.copyWith(
themeId: null == themeId ? _self.themeId : themeId // ignore: cast_nullable_to_non_nullable
as int,eliminatedBy: null == eliminatedBy ? _self.eliminatedBy : eliminatedBy // ignore: cast_nullable_to_non_nullable
as int,nextPlayerId: freezed == nextPlayerId ? _self.nextPlayerId : nextPlayerId // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}

}


/// Adds pattern-matching-related methods to [ThemeEliminateOutput].
extension ThemeEliminateOutputPatterns on ThemeEliminateOutput {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ThemeEliminateOutput value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ThemeEliminateOutput() when $default != null:
return $default(_that);case _:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ThemeEliminateOutput value)  $default,){
final _that = this;
switch (_that) {
case _ThemeEliminateOutput():
return $default(_that);case _:
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ThemeEliminateOutput value)?  $default,){
final _that = this;
switch (_that) {
case _ThemeEliminateOutput() when $default != null:
return $default(_that);case _:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int themeId,  int eliminatedBy,  int? nextPlayerId)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ThemeEliminateOutput() when $default != null:
return $default(_that.themeId,_that.eliminatedBy,_that.nextPlayerId);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int themeId,  int eliminatedBy,  int? nextPlayerId)  $default,) {final _that = this;
switch (_that) {
case _ThemeEliminateOutput():
return $default(_that.themeId,_that.eliminatedBy,_that.nextPlayerId);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int themeId,  int eliminatedBy,  int? nextPlayerId)?  $default,) {final _that = this;
switch (_that) {
case _ThemeEliminateOutput() when $default != null:
return $default(_that.themeId,_that.eliminatedBy,_that.nextPlayerId);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ThemeEliminateOutput implements ThemeEliminateOutput {
  const _ThemeEliminateOutput({required this.themeId, required this.eliminatedBy, required this.nextPlayerId});
  factory _ThemeEliminateOutput.fromJson(Map<String, dynamic> json) => _$ThemeEliminateOutputFromJson(json);

/// ID of the eliminated theme
@override final  int themeId;
/// ID of the player who eliminated the theme
@override final  int eliminatedBy;
/// Next player to pick theme, null if elimination complete
@override final  int? nextPlayerId;

/// Create a copy of ThemeEliminateOutput
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ThemeEliminateOutputCopyWith<_ThemeEliminateOutput> get copyWith => __$ThemeEliminateOutputCopyWithImpl<_ThemeEliminateOutput>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ThemeEliminateOutputToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ThemeEliminateOutput&&(identical(other.themeId, themeId) || other.themeId == themeId)&&(identical(other.eliminatedBy, eliminatedBy) || other.eliminatedBy == eliminatedBy)&&(identical(other.nextPlayerId, nextPlayerId) || other.nextPlayerId == nextPlayerId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,themeId,eliminatedBy,nextPlayerId);

@override
String toString() {
  return 'ThemeEliminateOutput(themeId: $themeId, eliminatedBy: $eliminatedBy, nextPlayerId: $nextPlayerId)';
}


}

/// @nodoc
abstract mixin class _$ThemeEliminateOutputCopyWith<$Res> implements $ThemeEliminateOutputCopyWith<$Res> {
  factory _$ThemeEliminateOutputCopyWith(_ThemeEliminateOutput value, $Res Function(_ThemeEliminateOutput) _then) = __$ThemeEliminateOutputCopyWithImpl;
@override @useResult
$Res call({
 int themeId, int eliminatedBy, int? nextPlayerId
});




}
/// @nodoc
class __$ThemeEliminateOutputCopyWithImpl<$Res>
    implements _$ThemeEliminateOutputCopyWith<$Res> {
  __$ThemeEliminateOutputCopyWithImpl(this._self, this._then);

  final _ThemeEliminateOutput _self;
  final $Res Function(_ThemeEliminateOutput) _then;

/// Create a copy of ThemeEliminateOutput
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? themeId = null,Object? eliminatedBy = null,Object? nextPlayerId = freezed,}) {
  return _then(_ThemeEliminateOutput(
themeId: null == themeId ? _self.themeId : themeId // ignore: cast_nullable_to_non_nullable
as int,eliminatedBy: null == eliminatedBy ? _self.eliminatedBy : eliminatedBy // ignore: cast_nullable_to_non_nullable
as int,nextPlayerId: freezed == nextPlayerId ? _self.nextPlayerId : nextPlayerId // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}


}

// dart format on
