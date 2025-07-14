// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'socket_io_game_state_theme_data.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$SocketIOGameStateThemeData {

 PackageEntitiesOrder get order; String get name; String? get description; List<SocketIOGameStateQuestionData> get questions;
/// Create a copy of SocketIOGameStateThemeData
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SocketIOGameStateThemeDataCopyWith<SocketIOGameStateThemeData> get copyWith => _$SocketIOGameStateThemeDataCopyWithImpl<SocketIOGameStateThemeData>(this as SocketIOGameStateThemeData, _$identity);

  /// Serializes this SocketIOGameStateThemeData to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SocketIOGameStateThemeData&&(identical(other.order, order) || other.order == order)&&(identical(other.name, name) || other.name == name)&&(identical(other.description, description) || other.description == description)&&const DeepCollectionEquality().equals(other.questions, questions));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,order,name,description,const DeepCollectionEquality().hash(questions));

@override
String toString() {
  return 'SocketIOGameStateThemeData(order: $order, name: $name, description: $description, questions: $questions)';
}


}

/// @nodoc
abstract mixin class $SocketIOGameStateThemeDataCopyWith<$Res>  {
  factory $SocketIOGameStateThemeDataCopyWith(SocketIOGameStateThemeData value, $Res Function(SocketIOGameStateThemeData) _then) = _$SocketIOGameStateThemeDataCopyWithImpl;
@useResult
$Res call({
 PackageEntitiesOrder order, String name, String? description, List<SocketIOGameStateQuestionData> questions
});




}
/// @nodoc
class _$SocketIOGameStateThemeDataCopyWithImpl<$Res>
    implements $SocketIOGameStateThemeDataCopyWith<$Res> {
  _$SocketIOGameStateThemeDataCopyWithImpl(this._self, this._then);

  final SocketIOGameStateThemeData _self;
  final $Res Function(SocketIOGameStateThemeData) _then;

/// Create a copy of SocketIOGameStateThemeData
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? order = null,Object? name = null,Object? description = freezed,Object? questions = null,}) {
  return _then(_self.copyWith(
order: null == order ? _self.order : order // ignore: cast_nullable_to_non_nullable
as PackageEntitiesOrder,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,questions: null == questions ? _self.questions : questions // ignore: cast_nullable_to_non_nullable
as List<SocketIOGameStateQuestionData>,
  ));
}

}


/// Adds pattern-matching-related methods to [SocketIOGameStateThemeData].
extension SocketIOGameStateThemeDataPatterns on SocketIOGameStateThemeData {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SocketIOGameStateThemeData value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SocketIOGameStateThemeData() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SocketIOGameStateThemeData value)  $default,){
final _that = this;
switch (_that) {
case _SocketIOGameStateThemeData():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SocketIOGameStateThemeData value)?  $default,){
final _that = this;
switch (_that) {
case _SocketIOGameStateThemeData() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( PackageEntitiesOrder order,  String name,  String? description,  List<SocketIOGameStateQuestionData> questions)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SocketIOGameStateThemeData() when $default != null:
return $default(_that.order,_that.name,_that.description,_that.questions);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( PackageEntitiesOrder order,  String name,  String? description,  List<SocketIOGameStateQuestionData> questions)  $default,) {final _that = this;
switch (_that) {
case _SocketIOGameStateThemeData():
return $default(_that.order,_that.name,_that.description,_that.questions);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( PackageEntitiesOrder order,  String name,  String? description,  List<SocketIOGameStateQuestionData> questions)?  $default,) {final _that = this;
switch (_that) {
case _SocketIOGameStateThemeData() when $default != null:
return $default(_that.order,_that.name,_that.description,_that.questions);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SocketIOGameStateThemeData implements SocketIOGameStateThemeData {
  const _SocketIOGameStateThemeData({required this.order, required this.name, required this.description, required final  List<SocketIOGameStateQuestionData> questions}): _questions = questions;
  factory _SocketIOGameStateThemeData.fromJson(Map<String, dynamic> json) => _$SocketIOGameStateThemeDataFromJson(json);

@override final  PackageEntitiesOrder order;
@override final  String name;
@override final  String? description;
 final  List<SocketIOGameStateQuestionData> _questions;
@override List<SocketIOGameStateQuestionData> get questions {
  if (_questions is EqualUnmodifiableListView) return _questions;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_questions);
}


/// Create a copy of SocketIOGameStateThemeData
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SocketIOGameStateThemeDataCopyWith<_SocketIOGameStateThemeData> get copyWith => __$SocketIOGameStateThemeDataCopyWithImpl<_SocketIOGameStateThemeData>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SocketIOGameStateThemeDataToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SocketIOGameStateThemeData&&(identical(other.order, order) || other.order == order)&&(identical(other.name, name) || other.name == name)&&(identical(other.description, description) || other.description == description)&&const DeepCollectionEquality().equals(other._questions, _questions));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,order,name,description,const DeepCollectionEquality().hash(_questions));

@override
String toString() {
  return 'SocketIOGameStateThemeData(order: $order, name: $name, description: $description, questions: $questions)';
}


}

/// @nodoc
abstract mixin class _$SocketIOGameStateThemeDataCopyWith<$Res> implements $SocketIOGameStateThemeDataCopyWith<$Res> {
  factory _$SocketIOGameStateThemeDataCopyWith(_SocketIOGameStateThemeData value, $Res Function(_SocketIOGameStateThemeData) _then) = __$SocketIOGameStateThemeDataCopyWithImpl;
@override @useResult
$Res call({
 PackageEntitiesOrder order, String name, String? description, List<SocketIOGameStateQuestionData> questions
});




}
/// @nodoc
class __$SocketIOGameStateThemeDataCopyWithImpl<$Res>
    implements _$SocketIOGameStateThemeDataCopyWith<$Res> {
  __$SocketIOGameStateThemeDataCopyWithImpl(this._self, this._then);

  final _SocketIOGameStateThemeData _self;
  final $Res Function(_SocketIOGameStateThemeData) _then;

/// Create a copy of SocketIOGameStateThemeData
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? order = null,Object? name = null,Object? description = freezed,Object? questions = null,}) {
  return _then(_SocketIOGameStateThemeData(
order: null == order ? _self.order : order // ignore: cast_nullable_to_non_nullable
as PackageEntitiesOrder,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,questions: null == questions ? _self._questions : questions // ignore: cast_nullable_to_non_nullable
as List<SocketIOGameStateQuestionData>,
  ));
}


}

// dart format on
