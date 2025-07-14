// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'response_user.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$ResponseUser {

 int get id; String get username; String? get email; String? get discordId; DateTime? get birthday;/// link on file GET
 String? get avatar; DateTime get createdAt; DateTime get updatedAt; bool get isDeleted; List<Permissions> get permissions;
/// Create a copy of ResponseUser
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ResponseUserCopyWith<ResponseUser> get copyWith => _$ResponseUserCopyWithImpl<ResponseUser>(this as ResponseUser, _$identity);

  /// Serializes this ResponseUser to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ResponseUser&&(identical(other.id, id) || other.id == id)&&(identical(other.username, username) || other.username == username)&&(identical(other.email, email) || other.email == email)&&(identical(other.discordId, discordId) || other.discordId == discordId)&&(identical(other.birthday, birthday) || other.birthday == birthday)&&(identical(other.avatar, avatar) || other.avatar == avatar)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt)&&(identical(other.isDeleted, isDeleted) || other.isDeleted == isDeleted)&&const DeepCollectionEquality().equals(other.permissions, permissions));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,username,email,discordId,birthday,avatar,createdAt,updatedAt,isDeleted,const DeepCollectionEquality().hash(permissions));

@override
String toString() {
  return 'ResponseUser(id: $id, username: $username, email: $email, discordId: $discordId, birthday: $birthday, avatar: $avatar, createdAt: $createdAt, updatedAt: $updatedAt, isDeleted: $isDeleted, permissions: $permissions)';
}


}

/// @nodoc
abstract mixin class $ResponseUserCopyWith<$Res>  {
  factory $ResponseUserCopyWith(ResponseUser value, $Res Function(ResponseUser) _then) = _$ResponseUserCopyWithImpl;
@useResult
$Res call({
 int id, String username, String? email, String? discordId, DateTime? birthday, String? avatar, DateTime createdAt, DateTime updatedAt, bool isDeleted, List<Permissions> permissions
});




}
/// @nodoc
class _$ResponseUserCopyWithImpl<$Res>
    implements $ResponseUserCopyWith<$Res> {
  _$ResponseUserCopyWithImpl(this._self, this._then);

  final ResponseUser _self;
  final $Res Function(ResponseUser) _then;

/// Create a copy of ResponseUser
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? username = null,Object? email = freezed,Object? discordId = freezed,Object? birthday = freezed,Object? avatar = freezed,Object? createdAt = null,Object? updatedAt = null,Object? isDeleted = null,Object? permissions = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,username: null == username ? _self.username : username // ignore: cast_nullable_to_non_nullable
as String,email: freezed == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String?,discordId: freezed == discordId ? _self.discordId : discordId // ignore: cast_nullable_to_non_nullable
as String?,birthday: freezed == birthday ? _self.birthday : birthday // ignore: cast_nullable_to_non_nullable
as DateTime?,avatar: freezed == avatar ? _self.avatar : avatar // ignore: cast_nullable_to_non_nullable
as String?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,updatedAt: null == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as DateTime,isDeleted: null == isDeleted ? _self.isDeleted : isDeleted // ignore: cast_nullable_to_non_nullable
as bool,permissions: null == permissions ? _self.permissions : permissions // ignore: cast_nullable_to_non_nullable
as List<Permissions>,
  ));
}

}


/// Adds pattern-matching-related methods to [ResponseUser].
extension ResponseUserPatterns on ResponseUser {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ResponseUser value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ResponseUser() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ResponseUser value)  $default,){
final _that = this;
switch (_that) {
case _ResponseUser():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ResponseUser value)?  $default,){
final _that = this;
switch (_that) {
case _ResponseUser() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int id,  String username,  String? email,  String? discordId,  DateTime? birthday,  String? avatar,  DateTime createdAt,  DateTime updatedAt,  bool isDeleted,  List<Permissions> permissions)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ResponseUser() when $default != null:
return $default(_that.id,_that.username,_that.email,_that.discordId,_that.birthday,_that.avatar,_that.createdAt,_that.updatedAt,_that.isDeleted,_that.permissions);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int id,  String username,  String? email,  String? discordId,  DateTime? birthday,  String? avatar,  DateTime createdAt,  DateTime updatedAt,  bool isDeleted,  List<Permissions> permissions)  $default,) {final _that = this;
switch (_that) {
case _ResponseUser():
return $default(_that.id,_that.username,_that.email,_that.discordId,_that.birthday,_that.avatar,_that.createdAt,_that.updatedAt,_that.isDeleted,_that.permissions);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int id,  String username,  String? email,  String? discordId,  DateTime? birthday,  String? avatar,  DateTime createdAt,  DateTime updatedAt,  bool isDeleted,  List<Permissions> permissions)?  $default,) {final _that = this;
switch (_that) {
case _ResponseUser() when $default != null:
return $default(_that.id,_that.username,_that.email,_that.discordId,_that.birthday,_that.avatar,_that.createdAt,_that.updatedAt,_that.isDeleted,_that.permissions);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ResponseUser implements ResponseUser {
  const _ResponseUser({required this.id, required this.username, required this.email, required this.discordId, required this.birthday, required this.avatar, required this.createdAt, required this.updatedAt, required this.isDeleted, required final  List<Permissions> permissions}): _permissions = permissions;
  factory _ResponseUser.fromJson(Map<String, dynamic> json) => _$ResponseUserFromJson(json);

@override final  int id;
@override final  String username;
@override final  String? email;
@override final  String? discordId;
@override final  DateTime? birthday;
/// link on file GET
@override final  String? avatar;
@override final  DateTime createdAt;
@override final  DateTime updatedAt;
@override final  bool isDeleted;
 final  List<Permissions> _permissions;
@override List<Permissions> get permissions {
  if (_permissions is EqualUnmodifiableListView) return _permissions;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_permissions);
}


/// Create a copy of ResponseUser
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ResponseUserCopyWith<_ResponseUser> get copyWith => __$ResponseUserCopyWithImpl<_ResponseUser>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ResponseUserToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ResponseUser&&(identical(other.id, id) || other.id == id)&&(identical(other.username, username) || other.username == username)&&(identical(other.email, email) || other.email == email)&&(identical(other.discordId, discordId) || other.discordId == discordId)&&(identical(other.birthday, birthday) || other.birthday == birthday)&&(identical(other.avatar, avatar) || other.avatar == avatar)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt)&&(identical(other.isDeleted, isDeleted) || other.isDeleted == isDeleted)&&const DeepCollectionEquality().equals(other._permissions, _permissions));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,username,email,discordId,birthday,avatar,createdAt,updatedAt,isDeleted,const DeepCollectionEquality().hash(_permissions));

@override
String toString() {
  return 'ResponseUser(id: $id, username: $username, email: $email, discordId: $discordId, birthday: $birthday, avatar: $avatar, createdAt: $createdAt, updatedAt: $updatedAt, isDeleted: $isDeleted, permissions: $permissions)';
}


}

/// @nodoc
abstract mixin class _$ResponseUserCopyWith<$Res> implements $ResponseUserCopyWith<$Res> {
  factory _$ResponseUserCopyWith(_ResponseUser value, $Res Function(_ResponseUser) _then) = __$ResponseUserCopyWithImpl;
@override @useResult
$Res call({
 int id, String username, String? email, String? discordId, DateTime? birthday, String? avatar, DateTime createdAt, DateTime updatedAt, bool isDeleted, List<Permissions> permissions
});




}
/// @nodoc
class __$ResponseUserCopyWithImpl<$Res>
    implements _$ResponseUserCopyWith<$Res> {
  __$ResponseUserCopyWithImpl(this._self, this._then);

  final _ResponseUser _self;
  final $Res Function(_ResponseUser) _then;

/// Create a copy of ResponseUser
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? username = null,Object? email = freezed,Object? discordId = freezed,Object? birthday = freezed,Object? avatar = freezed,Object? createdAt = null,Object? updatedAt = null,Object? isDeleted = null,Object? permissions = null,}) {
  return _then(_ResponseUser(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,username: null == username ? _self.username : username // ignore: cast_nullable_to_non_nullable
as String,email: freezed == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String?,discordId: freezed == discordId ? _self.discordId : discordId // ignore: cast_nullable_to_non_nullable
as String?,birthday: freezed == birthday ? _self.birthday : birthday // ignore: cast_nullable_to_non_nullable
as DateTime?,avatar: freezed == avatar ? _self.avatar : avatar // ignore: cast_nullable_to_non_nullable
as String?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,updatedAt: null == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as DateTime,isDeleted: null == isDeleted ? _self.isDeleted : isDeleted // ignore: cast_nullable_to_non_nullable
as bool,permissions: null == permissions ? _self._permissions : permissions // ignore: cast_nullable_to_non_nullable
as List<Permissions>,
  ));
}


}

// dart format on
