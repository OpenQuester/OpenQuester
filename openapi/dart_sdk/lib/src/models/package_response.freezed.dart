// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'package_response.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PackageResponse {

 int get id; String get title; String? get description; DateTime get createdAt; ShortUserInfo get author;/// Package age restriction
 AgeRestriction get ageRestriction; String? get language;/// Rounds in the package
 List<PackageRound> get rounds;/// Tags for the package. Can be null or an array of tag objects
 List<PackageTag>? get tags;/// Logo file for the package
 PackageLogoFileItem? get logo;
/// Create a copy of PackageResponse
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PackageResponseCopyWith<PackageResponse> get copyWith => _$PackageResponseCopyWithImpl<PackageResponse>(this as PackageResponse, _$identity);

  /// Serializes this PackageResponse to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PackageResponse&&(identical(other.id, id) || other.id == id)&&(identical(other.title, title) || other.title == title)&&(identical(other.description, description) || other.description == description)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.author, author) || other.author == author)&&(identical(other.ageRestriction, ageRestriction) || other.ageRestriction == ageRestriction)&&(identical(other.language, language) || other.language == language)&&const DeepCollectionEquality().equals(other.rounds, rounds)&&const DeepCollectionEquality().equals(other.tags, tags)&&(identical(other.logo, logo) || other.logo == logo));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,title,description,createdAt,author,ageRestriction,language,const DeepCollectionEquality().hash(rounds),const DeepCollectionEquality().hash(tags),logo);

@override
String toString() {
  return 'PackageResponse(id: $id, title: $title, description: $description, createdAt: $createdAt, author: $author, ageRestriction: $ageRestriction, language: $language, rounds: $rounds, tags: $tags, logo: $logo)';
}


}

/// @nodoc
abstract mixin class $PackageResponseCopyWith<$Res>  {
  factory $PackageResponseCopyWith(PackageResponse value, $Res Function(PackageResponse) _then) = _$PackageResponseCopyWithImpl;
@useResult
$Res call({
 int id, String title, String? description, DateTime createdAt, ShortUserInfo author, AgeRestriction ageRestriction, String? language, List<PackageRound> rounds, List<PackageTag>? tags, PackageLogoFileItem? logo
});


$ShortUserInfoCopyWith<$Res> get author;$PackageLogoFileItemCopyWith<$Res>? get logo;

}
/// @nodoc
class _$PackageResponseCopyWithImpl<$Res>
    implements $PackageResponseCopyWith<$Res> {
  _$PackageResponseCopyWithImpl(this._self, this._then);

  final PackageResponse _self;
  final $Res Function(PackageResponse) _then;

/// Create a copy of PackageResponse
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? title = null,Object? description = freezed,Object? createdAt = null,Object? author = null,Object? ageRestriction = null,Object? language = freezed,Object? rounds = null,Object? tags = freezed,Object? logo = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,author: null == author ? _self.author : author // ignore: cast_nullable_to_non_nullable
as ShortUserInfo,ageRestriction: null == ageRestriction ? _self.ageRestriction : ageRestriction // ignore: cast_nullable_to_non_nullable
as AgeRestriction,language: freezed == language ? _self.language : language // ignore: cast_nullable_to_non_nullable
as String?,rounds: null == rounds ? _self.rounds : rounds // ignore: cast_nullable_to_non_nullable
as List<PackageRound>,tags: freezed == tags ? _self.tags : tags // ignore: cast_nullable_to_non_nullable
as List<PackageTag>?,logo: freezed == logo ? _self.logo : logo // ignore: cast_nullable_to_non_nullable
as PackageLogoFileItem?,
  ));
}
/// Create a copy of PackageResponse
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ShortUserInfoCopyWith<$Res> get author {
  
  return $ShortUserInfoCopyWith<$Res>(_self.author, (value) {
    return _then(_self.copyWith(author: value));
  });
}/// Create a copy of PackageResponse
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PackageLogoFileItemCopyWith<$Res>? get logo {
    if (_self.logo == null) {
    return null;
  }

  return $PackageLogoFileItemCopyWith<$Res>(_self.logo!, (value) {
    return _then(_self.copyWith(logo: value));
  });
}
}


/// Adds pattern-matching-related methods to [PackageResponse].
extension PackageResponsePatterns on PackageResponse {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PackageResponse value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PackageResponse() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PackageResponse value)  $default,){
final _that = this;
switch (_that) {
case _PackageResponse():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PackageResponse value)?  $default,){
final _that = this;
switch (_that) {
case _PackageResponse() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int id,  String title,  String? description,  DateTime createdAt,  ShortUserInfo author,  AgeRestriction ageRestriction,  String? language,  List<PackageRound> rounds,  List<PackageTag>? tags,  PackageLogoFileItem? logo)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PackageResponse() when $default != null:
return $default(_that.id,_that.title,_that.description,_that.createdAt,_that.author,_that.ageRestriction,_that.language,_that.rounds,_that.tags,_that.logo);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int id,  String title,  String? description,  DateTime createdAt,  ShortUserInfo author,  AgeRestriction ageRestriction,  String? language,  List<PackageRound> rounds,  List<PackageTag>? tags,  PackageLogoFileItem? logo)  $default,) {final _that = this;
switch (_that) {
case _PackageResponse():
return $default(_that.id,_that.title,_that.description,_that.createdAt,_that.author,_that.ageRestriction,_that.language,_that.rounds,_that.tags,_that.logo);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int id,  String title,  String? description,  DateTime createdAt,  ShortUserInfo author,  AgeRestriction ageRestriction,  String? language,  List<PackageRound> rounds,  List<PackageTag>? tags,  PackageLogoFileItem? logo)?  $default,) {final _that = this;
switch (_that) {
case _PackageResponse() when $default != null:
return $default(_that.id,_that.title,_that.description,_that.createdAt,_that.author,_that.ageRestriction,_that.language,_that.rounds,_that.tags,_that.logo);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PackageResponse implements PackageResponse {
  const _PackageResponse({required this.id, required this.title, required this.description, required this.createdAt, required this.author, required this.ageRestriction, required this.language, required final  List<PackageRound> rounds, required final  List<PackageTag>? tags, this.logo}): _rounds = rounds,_tags = tags;
  factory _PackageResponse.fromJson(Map<String, dynamic> json) => _$PackageResponseFromJson(json);

@override final  int id;
@override final  String title;
@override final  String? description;
@override final  DateTime createdAt;
@override final  ShortUserInfo author;
/// Package age restriction
@override final  AgeRestriction ageRestriction;
@override final  String? language;
/// Rounds in the package
 final  List<PackageRound> _rounds;
/// Rounds in the package
@override List<PackageRound> get rounds {
  if (_rounds is EqualUnmodifiableListView) return _rounds;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_rounds);
}

/// Tags for the package. Can be null or an array of tag objects
 final  List<PackageTag>? _tags;
/// Tags for the package. Can be null or an array of tag objects
@override List<PackageTag>? get tags {
  final value = _tags;
  if (value == null) return null;
  if (_tags is EqualUnmodifiableListView) return _tags;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}

/// Logo file for the package
@override final  PackageLogoFileItem? logo;

/// Create a copy of PackageResponse
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PackageResponseCopyWith<_PackageResponse> get copyWith => __$PackageResponseCopyWithImpl<_PackageResponse>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PackageResponseToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PackageResponse&&(identical(other.id, id) || other.id == id)&&(identical(other.title, title) || other.title == title)&&(identical(other.description, description) || other.description == description)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.author, author) || other.author == author)&&(identical(other.ageRestriction, ageRestriction) || other.ageRestriction == ageRestriction)&&(identical(other.language, language) || other.language == language)&&const DeepCollectionEquality().equals(other._rounds, _rounds)&&const DeepCollectionEquality().equals(other._tags, _tags)&&(identical(other.logo, logo) || other.logo == logo));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,title,description,createdAt,author,ageRestriction,language,const DeepCollectionEquality().hash(_rounds),const DeepCollectionEquality().hash(_tags),logo);

@override
String toString() {
  return 'PackageResponse(id: $id, title: $title, description: $description, createdAt: $createdAt, author: $author, ageRestriction: $ageRestriction, language: $language, rounds: $rounds, tags: $tags, logo: $logo)';
}


}

/// @nodoc
abstract mixin class _$PackageResponseCopyWith<$Res> implements $PackageResponseCopyWith<$Res> {
  factory _$PackageResponseCopyWith(_PackageResponse value, $Res Function(_PackageResponse) _then) = __$PackageResponseCopyWithImpl;
@override @useResult
$Res call({
 int id, String title, String? description, DateTime createdAt, ShortUserInfo author, AgeRestriction ageRestriction, String? language, List<PackageRound> rounds, List<PackageTag>? tags, PackageLogoFileItem? logo
});


@override $ShortUserInfoCopyWith<$Res> get author;@override $PackageLogoFileItemCopyWith<$Res>? get logo;

}
/// @nodoc
class __$PackageResponseCopyWithImpl<$Res>
    implements _$PackageResponseCopyWith<$Res> {
  __$PackageResponseCopyWithImpl(this._self, this._then);

  final _PackageResponse _self;
  final $Res Function(_PackageResponse) _then;

/// Create a copy of PackageResponse
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? title = null,Object? description = freezed,Object? createdAt = null,Object? author = null,Object? ageRestriction = null,Object? language = freezed,Object? rounds = null,Object? tags = freezed,Object? logo = freezed,}) {
  return _then(_PackageResponse(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,author: null == author ? _self.author : author // ignore: cast_nullable_to_non_nullable
as ShortUserInfo,ageRestriction: null == ageRestriction ? _self.ageRestriction : ageRestriction // ignore: cast_nullable_to_non_nullable
as AgeRestriction,language: freezed == language ? _self.language : language // ignore: cast_nullable_to_non_nullable
as String?,rounds: null == rounds ? _self._rounds : rounds // ignore: cast_nullable_to_non_nullable
as List<PackageRound>,tags: freezed == tags ? _self._tags : tags // ignore: cast_nullable_to_non_nullable
as List<PackageTag>?,logo: freezed == logo ? _self.logo : logo // ignore: cast_nullable_to_non_nullable
as PackageLogoFileItem?,
  ));
}

/// Create a copy of PackageResponse
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ShortUserInfoCopyWith<$Res> get author {
  
  return $ShortUserInfoCopyWith<$Res>(_self.author, (value) {
    return _then(_self.copyWith(author: value));
  });
}/// Create a copy of PackageResponse
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PackageLogoFileItemCopyWith<$Res>? get logo {
    if (_self.logo == null) {
    return null;
  }

  return $PackageLogoFileItemCopyWith<$Res>(_self.logo!, (value) {
    return _then(_self.copyWith(logo: value));
  });
}
}

// dart format on
