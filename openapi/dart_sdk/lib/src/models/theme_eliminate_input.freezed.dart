// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'theme_eliminate_input.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$ThemeEliminateInput {

/// ID of the theme to eliminate
 int get themeId;
/// Create a copy of ThemeEliminateInput
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ThemeEliminateInputCopyWith<ThemeEliminateInput> get copyWith => _$ThemeEliminateInputCopyWithImpl<ThemeEliminateInput>(this as ThemeEliminateInput, _$identity);

  /// Serializes this ThemeEliminateInput to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ThemeEliminateInput&&(identical(other.themeId, themeId) || other.themeId == themeId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,themeId);

@override
String toString() {
  return 'ThemeEliminateInput(themeId: $themeId)';
}


}

/// @nodoc
abstract mixin class $ThemeEliminateInputCopyWith<$Res>  {
  factory $ThemeEliminateInputCopyWith(ThemeEliminateInput value, $Res Function(ThemeEliminateInput) _then) = _$ThemeEliminateInputCopyWithImpl;
@useResult
$Res call({
 int themeId
});




}
/// @nodoc
class _$ThemeEliminateInputCopyWithImpl<$Res>
    implements $ThemeEliminateInputCopyWith<$Res> {
  _$ThemeEliminateInputCopyWithImpl(this._self, this._then);

  final ThemeEliminateInput _self;
  final $Res Function(ThemeEliminateInput) _then;

/// Create a copy of ThemeEliminateInput
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? themeId = null,}) {
  return _then(_self.copyWith(
themeId: null == themeId ? _self.themeId : themeId // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [ThemeEliminateInput].
extension ThemeEliminateInputPatterns on ThemeEliminateInput {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ThemeEliminateInput value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ThemeEliminateInput() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ThemeEliminateInput value)  $default,){
final _that = this;
switch (_that) {
case _ThemeEliminateInput():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ThemeEliminateInput value)?  $default,){
final _that = this;
switch (_that) {
case _ThemeEliminateInput() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int themeId)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ThemeEliminateInput() when $default != null:
return $default(_that.themeId);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int themeId)  $default,) {final _that = this;
switch (_that) {
case _ThemeEliminateInput():
return $default(_that.themeId);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int themeId)?  $default,) {final _that = this;
switch (_that) {
case _ThemeEliminateInput() when $default != null:
return $default(_that.themeId);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ThemeEliminateInput implements ThemeEliminateInput {
  const _ThemeEliminateInput({required this.themeId});
  factory _ThemeEliminateInput.fromJson(Map<String, dynamic> json) => _$ThemeEliminateInputFromJson(json);

/// ID of the theme to eliminate
@override final  int themeId;

/// Create a copy of ThemeEliminateInput
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ThemeEliminateInputCopyWith<_ThemeEliminateInput> get copyWith => __$ThemeEliminateInputCopyWithImpl<_ThemeEliminateInput>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ThemeEliminateInputToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ThemeEliminateInput&&(identical(other.themeId, themeId) || other.themeId == themeId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,themeId);

@override
String toString() {
  return 'ThemeEliminateInput(themeId: $themeId)';
}


}

/// @nodoc
abstract mixin class _$ThemeEliminateInputCopyWith<$Res> implements $ThemeEliminateInputCopyWith<$Res> {
  factory _$ThemeEliminateInputCopyWith(_ThemeEliminateInput value, $Res Function(_ThemeEliminateInput) _then) = __$ThemeEliminateInputCopyWithImpl;
@override @useResult
$Res call({
 int themeId
});




}
/// @nodoc
class __$ThemeEliminateInputCopyWithImpl<$Res>
    implements _$ThemeEliminateInputCopyWith<$Res> {
  __$ThemeEliminateInputCopyWithImpl(this._self, this._then);

  final _ThemeEliminateInput _self;
  final $Res Function(_ThemeEliminateInput) _then;

/// Create a copy of ThemeEliminateInput
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? themeId = null,}) {
  return _then(_ThemeEliminateInput(
themeId: null == themeId ? _self.themeId : themeId // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}

// dart format on
