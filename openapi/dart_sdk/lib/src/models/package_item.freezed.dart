// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'package_item.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PackageItem {

 int get id; String get title; String? get description; DateTime get createdAt; ShortUserInfo get author;/// Package age restriction
 AgeRestriction get ageRestriction; String? get language; int get roundsCount; int get questionsCount; List<String> get tags;/// Logo file for the package
 PackageLogoFileItem? get logo;
/// Create a copy of PackageItem
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PackageItemCopyWith<PackageItem> get copyWith => _$PackageItemCopyWithImpl<PackageItem>(this as PackageItem, _$identity);

  /// Serializes this PackageItem to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PackageItem&&(identical(other.id, id) || other.id == id)&&(identical(other.title, title) || other.title == title)&&(identical(other.description, description) || other.description == description)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.author, author) || other.author == author)&&(identical(other.ageRestriction, ageRestriction) || other.ageRestriction == ageRestriction)&&(identical(other.language, language) || other.language == language)&&(identical(other.roundsCount, roundsCount) || other.roundsCount == roundsCount)&&(identical(other.questionsCount, questionsCount) || other.questionsCount == questionsCount)&&const DeepCollectionEquality().equals(other.tags, tags)&&(identical(other.logo, logo) || other.logo == logo));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,title,description,createdAt,author,ageRestriction,language,roundsCount,questionsCount,const DeepCollectionEquality().hash(tags),logo);

@override
String toString() {
  return 'PackageItem(id: $id, title: $title, description: $description, createdAt: $createdAt, author: $author, ageRestriction: $ageRestriction, language: $language, roundsCount: $roundsCount, questionsCount: $questionsCount, tags: $tags, logo: $logo)';
}


}

/// @nodoc
abstract mixin class $PackageItemCopyWith<$Res>  {
  factory $PackageItemCopyWith(PackageItem value, $Res Function(PackageItem) _then) = _$PackageItemCopyWithImpl;
@useResult
$Res call({
 int id, String title, String? description, DateTime createdAt, ShortUserInfo author, AgeRestriction ageRestriction, String? language, int roundsCount, int questionsCount, List<String> tags, PackageLogoFileItem? logo
});


$ShortUserInfoCopyWith<$Res> get author;$PackageLogoFileItemCopyWith<$Res>? get logo;

}
/// @nodoc
class _$PackageItemCopyWithImpl<$Res>
    implements $PackageItemCopyWith<$Res> {
  _$PackageItemCopyWithImpl(this._self, this._then);

  final PackageItem _self;
  final $Res Function(PackageItem) _then;

/// Create a copy of PackageItem
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? title = null,Object? description = freezed,Object? createdAt = null,Object? author = null,Object? ageRestriction = null,Object? language = freezed,Object? roundsCount = null,Object? questionsCount = null,Object? tags = null,Object? logo = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,author: null == author ? _self.author : author // ignore: cast_nullable_to_non_nullable
as ShortUserInfo,ageRestriction: null == ageRestriction ? _self.ageRestriction : ageRestriction // ignore: cast_nullable_to_non_nullable
as AgeRestriction,language: freezed == language ? _self.language : language // ignore: cast_nullable_to_non_nullable
as String?,roundsCount: null == roundsCount ? _self.roundsCount : roundsCount // ignore: cast_nullable_to_non_nullable
as int,questionsCount: null == questionsCount ? _self.questionsCount : questionsCount // ignore: cast_nullable_to_non_nullable
as int,tags: null == tags ? _self.tags : tags // ignore: cast_nullable_to_non_nullable
as List<String>,logo: freezed == logo ? _self.logo : logo // ignore: cast_nullable_to_non_nullable
as PackageLogoFileItem?,
  ));
}
/// Create a copy of PackageItem
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ShortUserInfoCopyWith<$Res> get author {
  
  return $ShortUserInfoCopyWith<$Res>(_self.author, (value) {
    return _then(_self.copyWith(author: value));
  });
}/// Create a copy of PackageItem
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


/// Adds pattern-matching-related methods to [PackageItem].
extension PackageItemPatterns on PackageItem {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PackageItem value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PackageItem() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PackageItem value)  $default,){
final _that = this;
switch (_that) {
case _PackageItem():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PackageItem value)?  $default,){
final _that = this;
switch (_that) {
case _PackageItem() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int id,  String title,  String? description,  DateTime createdAt,  ShortUserInfo author,  AgeRestriction ageRestriction,  String? language,  int roundsCount,  int questionsCount,  List<String> tags,  PackageLogoFileItem? logo)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PackageItem() when $default != null:
return $default(_that.id,_that.title,_that.description,_that.createdAt,_that.author,_that.ageRestriction,_that.language,_that.roundsCount,_that.questionsCount,_that.tags,_that.logo);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int id,  String title,  String? description,  DateTime createdAt,  ShortUserInfo author,  AgeRestriction ageRestriction,  String? language,  int roundsCount,  int questionsCount,  List<String> tags,  PackageLogoFileItem? logo)  $default,) {final _that = this;
switch (_that) {
case _PackageItem():
return $default(_that.id,_that.title,_that.description,_that.createdAt,_that.author,_that.ageRestriction,_that.language,_that.roundsCount,_that.questionsCount,_that.tags,_that.logo);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int id,  String title,  String? description,  DateTime createdAt,  ShortUserInfo author,  AgeRestriction ageRestriction,  String? language,  int roundsCount,  int questionsCount,  List<String> tags,  PackageLogoFileItem? logo)?  $default,) {final _that = this;
switch (_that) {
case _PackageItem() when $default != null:
return $default(_that.id,_that.title,_that.description,_that.createdAt,_that.author,_that.ageRestriction,_that.language,_that.roundsCount,_that.questionsCount,_that.tags,_that.logo);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PackageItem implements PackageItem {
  const _PackageItem({required this.id, required this.title, required this.description, required this.createdAt, required this.author, required this.ageRestriction, required this.language, required this.roundsCount, required this.questionsCount, required final  List<String> tags, this.logo}): _tags = tags;
  factory _PackageItem.fromJson(Map<String, dynamic> json) => _$PackageItemFromJson(json);

@override final  int id;
@override final  String title;
@override final  String? description;
@override final  DateTime createdAt;
@override final  ShortUserInfo author;
/// Package age restriction
@override final  AgeRestriction ageRestriction;
@override final  String? language;
@override final  int roundsCount;
@override final  int questionsCount;
 final  List<String> _tags;
@override List<String> get tags {
  if (_tags is EqualUnmodifiableListView) return _tags;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_tags);
}

/// Logo file for the package
@override final  PackageLogoFileItem? logo;

/// Create a copy of PackageItem
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PackageItemCopyWith<_PackageItem> get copyWith => __$PackageItemCopyWithImpl<_PackageItem>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PackageItemToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PackageItem&&(identical(other.id, id) || other.id == id)&&(identical(other.title, title) || other.title == title)&&(identical(other.description, description) || other.description == description)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.author, author) || other.author == author)&&(identical(other.ageRestriction, ageRestriction) || other.ageRestriction == ageRestriction)&&(identical(other.language, language) || other.language == language)&&(identical(other.roundsCount, roundsCount) || other.roundsCount == roundsCount)&&(identical(other.questionsCount, questionsCount) || other.questionsCount == questionsCount)&&const DeepCollectionEquality().equals(other._tags, _tags)&&(identical(other.logo, logo) || other.logo == logo));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,title,description,createdAt,author,ageRestriction,language,roundsCount,questionsCount,const DeepCollectionEquality().hash(_tags),logo);

@override
String toString() {
  return 'PackageItem(id: $id, title: $title, description: $description, createdAt: $createdAt, author: $author, ageRestriction: $ageRestriction, language: $language, roundsCount: $roundsCount, questionsCount: $questionsCount, tags: $tags, logo: $logo)';
}


}

/// @nodoc
abstract mixin class _$PackageItemCopyWith<$Res> implements $PackageItemCopyWith<$Res> {
  factory _$PackageItemCopyWith(_PackageItem value, $Res Function(_PackageItem) _then) = __$PackageItemCopyWithImpl;
@override @useResult
$Res call({
 int id, String title, String? description, DateTime createdAt, ShortUserInfo author, AgeRestriction ageRestriction, String? language, int roundsCount, int questionsCount, List<String> tags, PackageLogoFileItem? logo
});


@override $ShortUserInfoCopyWith<$Res> get author;@override $PackageLogoFileItemCopyWith<$Res>? get logo;

}
/// @nodoc
class __$PackageItemCopyWithImpl<$Res>
    implements _$PackageItemCopyWith<$Res> {
  __$PackageItemCopyWithImpl(this._self, this._then);

  final _PackageItem _self;
  final $Res Function(_PackageItem) _then;

/// Create a copy of PackageItem
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? title = null,Object? description = freezed,Object? createdAt = null,Object? author = null,Object? ageRestriction = null,Object? language = freezed,Object? roundsCount = null,Object? questionsCount = null,Object? tags = null,Object? logo = freezed,}) {
  return _then(_PackageItem(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,author: null == author ? _self.author : author // ignore: cast_nullable_to_non_nullable
as ShortUserInfo,ageRestriction: null == ageRestriction ? _self.ageRestriction : ageRestriction // ignore: cast_nullable_to_non_nullable
as AgeRestriction,language: freezed == language ? _self.language : language // ignore: cast_nullable_to_non_nullable
as String?,roundsCount: null == roundsCount ? _self.roundsCount : roundsCount // ignore: cast_nullable_to_non_nullable
as int,questionsCount: null == questionsCount ? _self.questionsCount : questionsCount // ignore: cast_nullable_to_non_nullable
as int,tags: null == tags ? _self._tags : tags // ignore: cast_nullable_to_non_nullable
as List<String>,logo: freezed == logo ? _self.logo : logo // ignore: cast_nullable_to_non_nullable
as PackageLogoFileItem?,
  ));
}

/// Create a copy of PackageItem
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ShortUserInfoCopyWith<$Res> get author {
  
  return $ShortUserInfoCopyWith<$Res>(_self.author, (value) {
    return _then(_self.copyWith(author: value));
  });
}/// Create a copy of PackageItem
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
