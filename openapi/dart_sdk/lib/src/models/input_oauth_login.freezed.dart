// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'input_oauth_login.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$InputOauthLogin {

 String get token; String? get tokenSchema; InputOauthLoginOauthProvider get oauthProvider;
/// Create a copy of InputOauthLogin
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$InputOauthLoginCopyWith<InputOauthLogin> get copyWith => _$InputOauthLoginCopyWithImpl<InputOauthLogin>(this as InputOauthLogin, _$identity);

  /// Serializes this InputOauthLogin to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is InputOauthLogin&&(identical(other.token, token) || other.token == token)&&(identical(other.tokenSchema, tokenSchema) || other.tokenSchema == tokenSchema)&&(identical(other.oauthProvider, oauthProvider) || other.oauthProvider == oauthProvider));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,token,tokenSchema,oauthProvider);

@override
String toString() {
  return 'InputOauthLogin(token: $token, tokenSchema: $tokenSchema, oauthProvider: $oauthProvider)';
}


}

/// @nodoc
abstract mixin class $InputOauthLoginCopyWith<$Res>  {
  factory $InputOauthLoginCopyWith(InputOauthLogin value, $Res Function(InputOauthLogin) _then) = _$InputOauthLoginCopyWithImpl;
@useResult
$Res call({
 String token, String? tokenSchema, InputOauthLoginOauthProvider oauthProvider
});




}
/// @nodoc
class _$InputOauthLoginCopyWithImpl<$Res>
    implements $InputOauthLoginCopyWith<$Res> {
  _$InputOauthLoginCopyWithImpl(this._self, this._then);

  final InputOauthLogin _self;
  final $Res Function(InputOauthLogin) _then;

/// Create a copy of InputOauthLogin
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? token = null,Object? tokenSchema = freezed,Object? oauthProvider = null,}) {
  return _then(_self.copyWith(
token: null == token ? _self.token : token // ignore: cast_nullable_to_non_nullable
as String,tokenSchema: freezed == tokenSchema ? _self.tokenSchema : tokenSchema // ignore: cast_nullable_to_non_nullable
as String?,oauthProvider: null == oauthProvider ? _self.oauthProvider : oauthProvider // ignore: cast_nullable_to_non_nullable
as InputOauthLoginOauthProvider,
  ));
}

}


/// Adds pattern-matching-related methods to [InputOauthLogin].
extension InputOauthLoginPatterns on InputOauthLogin {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _InputOauthLogin value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _InputOauthLogin() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _InputOauthLogin value)  $default,){
final _that = this;
switch (_that) {
case _InputOauthLogin():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _InputOauthLogin value)?  $default,){
final _that = this;
switch (_that) {
case _InputOauthLogin() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String token,  String? tokenSchema,  InputOauthLoginOauthProvider oauthProvider)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _InputOauthLogin() when $default != null:
return $default(_that.token,_that.tokenSchema,_that.oauthProvider);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String token,  String? tokenSchema,  InputOauthLoginOauthProvider oauthProvider)  $default,) {final _that = this;
switch (_that) {
case _InputOauthLogin():
return $default(_that.token,_that.tokenSchema,_that.oauthProvider);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String token,  String? tokenSchema,  InputOauthLoginOauthProvider oauthProvider)?  $default,) {final _that = this;
switch (_that) {
case _InputOauthLogin() when $default != null:
return $default(_that.token,_that.tokenSchema,_that.oauthProvider);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _InputOauthLogin implements InputOauthLogin {
  const _InputOauthLogin({required this.token, required this.tokenSchema, required this.oauthProvider});
  factory _InputOauthLogin.fromJson(Map<String, dynamic> json) => _$InputOauthLoginFromJson(json);

@override final  String token;
@override final  String? tokenSchema;
@override final  InputOauthLoginOauthProvider oauthProvider;

/// Create a copy of InputOauthLogin
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$InputOauthLoginCopyWith<_InputOauthLogin> get copyWith => __$InputOauthLoginCopyWithImpl<_InputOauthLogin>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$InputOauthLoginToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _InputOauthLogin&&(identical(other.token, token) || other.token == token)&&(identical(other.tokenSchema, tokenSchema) || other.tokenSchema == tokenSchema)&&(identical(other.oauthProvider, oauthProvider) || other.oauthProvider == oauthProvider));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,token,tokenSchema,oauthProvider);

@override
String toString() {
  return 'InputOauthLogin(token: $token, tokenSchema: $tokenSchema, oauthProvider: $oauthProvider)';
}


}

/// @nodoc
abstract mixin class _$InputOauthLoginCopyWith<$Res> implements $InputOauthLoginCopyWith<$Res> {
  factory _$InputOauthLoginCopyWith(_InputOauthLogin value, $Res Function(_InputOauthLogin) _then) = __$InputOauthLoginCopyWithImpl;
@override @useResult
$Res call({
 String token, String? tokenSchema, InputOauthLoginOauthProvider oauthProvider
});




}
/// @nodoc
class __$InputOauthLoginCopyWithImpl<$Res>
    implements _$InputOauthLoginCopyWith<$Res> {
  __$InputOauthLoginCopyWithImpl(this._self, this._then);

  final _InputOauthLogin _self;
  final $Res Function(_InputOauthLogin) _then;

/// Create a copy of InputOauthLogin
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? token = null,Object? tokenSchema = freezed,Object? oauthProvider = null,}) {
  return _then(_InputOauthLogin(
token: null == token ? _self.token : token // ignore: cast_nullable_to_non_nullable
as String,tokenSchema: freezed == tokenSchema ? _self.tokenSchema : tokenSchema // ignore: cast_nullable_to_non_nullable
as String?,oauthProvider: null == oauthProvider ? _self.oauthProvider : oauthProvider // ignore: cast_nullable_to_non_nullable
as InputOauthLoginOauthProvider,
  ));
}


}

// dart format on
