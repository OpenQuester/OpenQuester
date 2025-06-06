// dart format width=80
// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'input_update_user.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$InputUpdateUser {

 String? get username; String? get email; DateTime? get birthday; String? get avatar;
/// Create a copy of InputUpdateUser
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$InputUpdateUserCopyWith<InputUpdateUser> get copyWith => _$InputUpdateUserCopyWithImpl<InputUpdateUser>(this as InputUpdateUser, _$identity);

  /// Serializes this InputUpdateUser to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is InputUpdateUser&&(identical(other.username, username) || other.username == username)&&(identical(other.email, email) || other.email == email)&&(identical(other.birthday, birthday) || other.birthday == birthday)&&(identical(other.avatar, avatar) || other.avatar == avatar));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,username,email,birthday,avatar);

@override
String toString() {
  return 'InputUpdateUser(username: $username, email: $email, birthday: $birthday, avatar: $avatar)';
}


}

/// @nodoc
abstract mixin class $InputUpdateUserCopyWith<$Res>  {
  factory $InputUpdateUserCopyWith(InputUpdateUser value, $Res Function(InputUpdateUser) _then) = _$InputUpdateUserCopyWithImpl;
@useResult
$Res call({
 String? username, String? email, DateTime? birthday, String? avatar
});




}
/// @nodoc
class _$InputUpdateUserCopyWithImpl<$Res>
    implements $InputUpdateUserCopyWith<$Res> {
  _$InputUpdateUserCopyWithImpl(this._self, this._then);

  final InputUpdateUser _self;
  final $Res Function(InputUpdateUser) _then;

/// Create a copy of InputUpdateUser
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? username = freezed,Object? email = freezed,Object? birthday = freezed,Object? avatar = freezed,}) {
  return _then(_self.copyWith(
username: freezed == username ? _self.username : username // ignore: cast_nullable_to_non_nullable
as String?,email: freezed == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String?,birthday: freezed == birthday ? _self.birthday : birthday // ignore: cast_nullable_to_non_nullable
as DateTime?,avatar: freezed == avatar ? _self.avatar : avatar // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// @nodoc
@JsonSerializable()

class _InputUpdateUser implements InputUpdateUser {
  const _InputUpdateUser({required this.username, required this.email, required this.birthday, required this.avatar});
  factory _InputUpdateUser.fromJson(Map<String, dynamic> json) => _$InputUpdateUserFromJson(json);

@override final  String? username;
@override final  String? email;
@override final  DateTime? birthday;
@override final  String? avatar;

/// Create a copy of InputUpdateUser
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$InputUpdateUserCopyWith<_InputUpdateUser> get copyWith => __$InputUpdateUserCopyWithImpl<_InputUpdateUser>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$InputUpdateUserToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _InputUpdateUser&&(identical(other.username, username) || other.username == username)&&(identical(other.email, email) || other.email == email)&&(identical(other.birthday, birthday) || other.birthday == birthday)&&(identical(other.avatar, avatar) || other.avatar == avatar));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,username,email,birthday,avatar);

@override
String toString() {
  return 'InputUpdateUser(username: $username, email: $email, birthday: $birthday, avatar: $avatar)';
}


}

/// @nodoc
abstract mixin class _$InputUpdateUserCopyWith<$Res> implements $InputUpdateUserCopyWith<$Res> {
  factory _$InputUpdateUserCopyWith(_InputUpdateUser value, $Res Function(_InputUpdateUser) _then) = __$InputUpdateUserCopyWithImpl;
@override @useResult
$Res call({
 String? username, String? email, DateTime? birthday, String? avatar
});




}
/// @nodoc
class __$InputUpdateUserCopyWithImpl<$Res>
    implements _$InputUpdateUserCopyWith<$Res> {
  __$InputUpdateUserCopyWithImpl(this._self, this._then);

  final _InputUpdateUser _self;
  final $Res Function(_InputUpdateUser) _then;

/// Create a copy of InputUpdateUser
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? username = freezed,Object? email = freezed,Object? birthday = freezed,Object? avatar = freezed,}) {
  return _then(_InputUpdateUser(
username: freezed == username ? _self.username : username // ignore: cast_nullable_to_non_nullable
as String?,email: freezed == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String?,birthday: freezed == birthday ? _self.birthday : birthday // ignore: cast_nullable_to_non_nullable
as DateTime?,avatar: freezed == avatar ? _self.avatar : avatar // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}

// dart format on
