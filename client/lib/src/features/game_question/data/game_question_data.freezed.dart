// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'game_question_data.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$GameQuestionData {

 String? get text; PackageQuestionFile? get file;
/// Create a copy of GameQuestionData
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$GameQuestionDataCopyWith<GameQuestionData> get copyWith => _$GameQuestionDataCopyWithImpl<GameQuestionData>(this as GameQuestionData, _$identity);

  /// Serializes this GameQuestionData to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is GameQuestionData&&(identical(other.text, text) || other.text == text)&&(identical(other.file, file) || other.file == file));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,text,file);

@override
String toString() {
  return 'GameQuestionData(text: $text, file: $file)';
}


}

/// @nodoc
abstract mixin class $GameQuestionDataCopyWith<$Res>  {
  factory $GameQuestionDataCopyWith(GameQuestionData value, $Res Function(GameQuestionData) _then) = _$GameQuestionDataCopyWithImpl;
@useResult
$Res call({
 String? text, PackageQuestionFile? file
});


$PackageQuestionFileCopyWith<$Res>? get file;

}
/// @nodoc
class _$GameQuestionDataCopyWithImpl<$Res>
    implements $GameQuestionDataCopyWith<$Res> {
  _$GameQuestionDataCopyWithImpl(this._self, this._then);

  final GameQuestionData _self;
  final $Res Function(GameQuestionData) _then;

/// Create a copy of GameQuestionData
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? text = freezed,Object? file = freezed,}) {
  return _then(_self.copyWith(
text: freezed == text ? _self.text : text // ignore: cast_nullable_to_non_nullable
as String?,file: freezed == file ? _self.file : file // ignore: cast_nullable_to_non_nullable
as PackageQuestionFile?,
  ));
}
/// Create a copy of GameQuestionData
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PackageQuestionFileCopyWith<$Res>? get file {
    if (_self.file == null) {
    return null;
  }

  return $PackageQuestionFileCopyWith<$Res>(_self.file!, (value) {
    return _then(_self.copyWith(file: value));
  });
}
}


/// Adds pattern-matching-related methods to [GameQuestionData].
extension GameQuestionDataPatterns on GameQuestionData {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _GameQuestionData value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _GameQuestionData() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _GameQuestionData value)  $default,){
final _that = this;
switch (_that) {
case _GameQuestionData():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _GameQuestionData value)?  $default,){
final _that = this;
switch (_that) {
case _GameQuestionData() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String? text,  PackageQuestionFile? file)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _GameQuestionData() when $default != null:
return $default(_that.text,_that.file);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String? text,  PackageQuestionFile? file)  $default,) {final _that = this;
switch (_that) {
case _GameQuestionData():
return $default(_that.text,_that.file);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String? text,  PackageQuestionFile? file)?  $default,) {final _that = this;
switch (_that) {
case _GameQuestionData() when $default != null:
return $default(_that.text,_that.file);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _GameQuestionData implements GameQuestionData {
  const _GameQuestionData({this.text, this.file});
  factory _GameQuestionData.fromJson(Map<String, dynamic> json) => _$GameQuestionDataFromJson(json);

@override final  String? text;
@override final  PackageQuestionFile? file;

/// Create a copy of GameQuestionData
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$GameQuestionDataCopyWith<_GameQuestionData> get copyWith => __$GameQuestionDataCopyWithImpl<_GameQuestionData>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$GameQuestionDataToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _GameQuestionData&&(identical(other.text, text) || other.text == text)&&(identical(other.file, file) || other.file == file));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,text,file);

@override
String toString() {
  return 'GameQuestionData(text: $text, file: $file)';
}


}

/// @nodoc
abstract mixin class _$GameQuestionDataCopyWith<$Res> implements $GameQuestionDataCopyWith<$Res> {
  factory _$GameQuestionDataCopyWith(_GameQuestionData value, $Res Function(_GameQuestionData) _then) = __$GameQuestionDataCopyWithImpl;
@override @useResult
$Res call({
 String? text, PackageQuestionFile? file
});


@override $PackageQuestionFileCopyWith<$Res>? get file;

}
/// @nodoc
class __$GameQuestionDataCopyWithImpl<$Res>
    implements _$GameQuestionDataCopyWith<$Res> {
  __$GameQuestionDataCopyWithImpl(this._self, this._then);

  final _GameQuestionData _self;
  final $Res Function(_GameQuestionData) _then;

/// Create a copy of GameQuestionData
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? text = freezed,Object? file = freezed,}) {
  return _then(_GameQuestionData(
text: freezed == text ? _self.text : text // ignore: cast_nullable_to_non_nullable
as String?,file: freezed == file ? _self.file : file // ignore: cast_nullable_to_non_nullable
as PackageQuestionFile?,
  ));
}

/// Create a copy of GameQuestionData
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PackageQuestionFileCopyWith<$Res>? get file {
    if (_self.file == null) {
    return null;
  }

  return $PackageQuestionFileCopyWith<$Res>(_self.file!, (value) {
    return _then(_self.copyWith(file: value));
  });
}
}

// dart format on
