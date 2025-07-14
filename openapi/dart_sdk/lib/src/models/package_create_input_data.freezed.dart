// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'package_create_input_data.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PackageCreateInputData {

/// Title of the package
 String get title;/// Description of the package
 String? get description;/// Language of the package
 String? get language;/// Age restriction
 AgeRestriction get ageRestriction;/// Tags for the package. Can be null or an array of tag objects
 List<PackageTag>? get tags;/// Rounds in the package
 List<PackageRound> get rounds;/// Logo file for the package
 PackageLogoFileInput? get logo;
/// Create a copy of PackageCreateInputData
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PackageCreateInputDataCopyWith<PackageCreateInputData> get copyWith => _$PackageCreateInputDataCopyWithImpl<PackageCreateInputData>(this as PackageCreateInputData, _$identity);

  /// Serializes this PackageCreateInputData to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PackageCreateInputData&&(identical(other.title, title) || other.title == title)&&(identical(other.description, description) || other.description == description)&&(identical(other.language, language) || other.language == language)&&(identical(other.ageRestriction, ageRestriction) || other.ageRestriction == ageRestriction)&&const DeepCollectionEquality().equals(other.tags, tags)&&const DeepCollectionEquality().equals(other.rounds, rounds)&&(identical(other.logo, logo) || other.logo == logo));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,title,description,language,ageRestriction,const DeepCollectionEquality().hash(tags),const DeepCollectionEquality().hash(rounds),logo);

@override
String toString() {
  return 'PackageCreateInputData(title: $title, description: $description, language: $language, ageRestriction: $ageRestriction, tags: $tags, rounds: $rounds, logo: $logo)';
}


}

/// @nodoc
abstract mixin class $PackageCreateInputDataCopyWith<$Res>  {
  factory $PackageCreateInputDataCopyWith(PackageCreateInputData value, $Res Function(PackageCreateInputData) _then) = _$PackageCreateInputDataCopyWithImpl;
@useResult
$Res call({
 String title, String? description, String? language, AgeRestriction ageRestriction, List<PackageTag>? tags, List<PackageRound> rounds, PackageLogoFileInput? logo
});


$PackageLogoFileInputCopyWith<$Res>? get logo;

}
/// @nodoc
class _$PackageCreateInputDataCopyWithImpl<$Res>
    implements $PackageCreateInputDataCopyWith<$Res> {
  _$PackageCreateInputDataCopyWithImpl(this._self, this._then);

  final PackageCreateInputData _self;
  final $Res Function(PackageCreateInputData) _then;

/// Create a copy of PackageCreateInputData
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? title = null,Object? description = freezed,Object? language = freezed,Object? ageRestriction = null,Object? tags = freezed,Object? rounds = null,Object? logo = freezed,}) {
  return _then(_self.copyWith(
title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,language: freezed == language ? _self.language : language // ignore: cast_nullable_to_non_nullable
as String?,ageRestriction: null == ageRestriction ? _self.ageRestriction : ageRestriction // ignore: cast_nullable_to_non_nullable
as AgeRestriction,tags: freezed == tags ? _self.tags : tags // ignore: cast_nullable_to_non_nullable
as List<PackageTag>?,rounds: null == rounds ? _self.rounds : rounds // ignore: cast_nullable_to_non_nullable
as List<PackageRound>,logo: freezed == logo ? _self.logo : logo // ignore: cast_nullable_to_non_nullable
as PackageLogoFileInput?,
  ));
}
/// Create a copy of PackageCreateInputData
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PackageLogoFileInputCopyWith<$Res>? get logo {
    if (_self.logo == null) {
    return null;
  }

  return $PackageLogoFileInputCopyWith<$Res>(_self.logo!, (value) {
    return _then(_self.copyWith(logo: value));
  });
}
}


/// Adds pattern-matching-related methods to [PackageCreateInputData].
extension PackageCreateInputDataPatterns on PackageCreateInputData {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PackageCreateInputData value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PackageCreateInputData() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PackageCreateInputData value)  $default,){
final _that = this;
switch (_that) {
case _PackageCreateInputData():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PackageCreateInputData value)?  $default,){
final _that = this;
switch (_that) {
case _PackageCreateInputData() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String title,  String? description,  String? language,  AgeRestriction ageRestriction,  List<PackageTag>? tags,  List<PackageRound> rounds,  PackageLogoFileInput? logo)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PackageCreateInputData() when $default != null:
return $default(_that.title,_that.description,_that.language,_that.ageRestriction,_that.tags,_that.rounds,_that.logo);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String title,  String? description,  String? language,  AgeRestriction ageRestriction,  List<PackageTag>? tags,  List<PackageRound> rounds,  PackageLogoFileInput? logo)  $default,) {final _that = this;
switch (_that) {
case _PackageCreateInputData():
return $default(_that.title,_that.description,_that.language,_that.ageRestriction,_that.tags,_that.rounds,_that.logo);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String title,  String? description,  String? language,  AgeRestriction ageRestriction,  List<PackageTag>? tags,  List<PackageRound> rounds,  PackageLogoFileInput? logo)?  $default,) {final _that = this;
switch (_that) {
case _PackageCreateInputData() when $default != null:
return $default(_that.title,_that.description,_that.language,_that.ageRestriction,_that.tags,_that.rounds,_that.logo);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PackageCreateInputData implements PackageCreateInputData {
  const _PackageCreateInputData({required this.title, required this.description, required this.language, required this.ageRestriction, required final  List<PackageTag>? tags, required final  List<PackageRound> rounds, this.logo}): _tags = tags,_rounds = rounds;
  factory _PackageCreateInputData.fromJson(Map<String, dynamic> json) => _$PackageCreateInputDataFromJson(json);

/// Title of the package
@override final  String title;
/// Description of the package
@override final  String? description;
/// Language of the package
@override final  String? language;
/// Age restriction
@override final  AgeRestriction ageRestriction;
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

/// Rounds in the package
 final  List<PackageRound> _rounds;
/// Rounds in the package
@override List<PackageRound> get rounds {
  if (_rounds is EqualUnmodifiableListView) return _rounds;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_rounds);
}

/// Logo file for the package
@override final  PackageLogoFileInput? logo;

/// Create a copy of PackageCreateInputData
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PackageCreateInputDataCopyWith<_PackageCreateInputData> get copyWith => __$PackageCreateInputDataCopyWithImpl<_PackageCreateInputData>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PackageCreateInputDataToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PackageCreateInputData&&(identical(other.title, title) || other.title == title)&&(identical(other.description, description) || other.description == description)&&(identical(other.language, language) || other.language == language)&&(identical(other.ageRestriction, ageRestriction) || other.ageRestriction == ageRestriction)&&const DeepCollectionEquality().equals(other._tags, _tags)&&const DeepCollectionEquality().equals(other._rounds, _rounds)&&(identical(other.logo, logo) || other.logo == logo));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,title,description,language,ageRestriction,const DeepCollectionEquality().hash(_tags),const DeepCollectionEquality().hash(_rounds),logo);

@override
String toString() {
  return 'PackageCreateInputData(title: $title, description: $description, language: $language, ageRestriction: $ageRestriction, tags: $tags, rounds: $rounds, logo: $logo)';
}


}

/// @nodoc
abstract mixin class _$PackageCreateInputDataCopyWith<$Res> implements $PackageCreateInputDataCopyWith<$Res> {
  factory _$PackageCreateInputDataCopyWith(_PackageCreateInputData value, $Res Function(_PackageCreateInputData) _then) = __$PackageCreateInputDataCopyWithImpl;
@override @useResult
$Res call({
 String title, String? description, String? language, AgeRestriction ageRestriction, List<PackageTag>? tags, List<PackageRound> rounds, PackageLogoFileInput? logo
});


@override $PackageLogoFileInputCopyWith<$Res>? get logo;

}
/// @nodoc
class __$PackageCreateInputDataCopyWithImpl<$Res>
    implements _$PackageCreateInputDataCopyWith<$Res> {
  __$PackageCreateInputDataCopyWithImpl(this._self, this._then);

  final _PackageCreateInputData _self;
  final $Res Function(_PackageCreateInputData) _then;

/// Create a copy of PackageCreateInputData
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? title = null,Object? description = freezed,Object? language = freezed,Object? ageRestriction = null,Object? tags = freezed,Object? rounds = null,Object? logo = freezed,}) {
  return _then(_PackageCreateInputData(
title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,language: freezed == language ? _self.language : language // ignore: cast_nullable_to_non_nullable
as String?,ageRestriction: null == ageRestriction ? _self.ageRestriction : ageRestriction // ignore: cast_nullable_to_non_nullable
as AgeRestriction,tags: freezed == tags ? _self._tags : tags // ignore: cast_nullable_to_non_nullable
as List<PackageTag>?,rounds: null == rounds ? _self._rounds : rounds // ignore: cast_nullable_to_non_nullable
as List<PackageRound>,logo: freezed == logo ? _self.logo : logo // ignore: cast_nullable_to_non_nullable
as PackageLogoFileInput?,
  ));
}

/// Create a copy of PackageCreateInputData
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PackageLogoFileInputCopyWith<$Res>? get logo {
    if (_self.logo == null) {
    return null;
  }

  return $PackageLogoFileInputCopyWith<$Res>(_self.logo!, (value) {
    return _then(_self.copyWith(logo: value));
  });
}
}

// dart format on
