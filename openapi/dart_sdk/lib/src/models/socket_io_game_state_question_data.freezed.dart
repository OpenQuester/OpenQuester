// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'socket_io_game_state_question_data.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$SocketIOGameStateQuestionData {

 int get id; PackageEntitiesOrder get order;/// Price is null only if price is hidden
 int? get price;/// Comment that clarify what have to be answered on this question
 String? get questionComment;/// Marks if question was played before to disable picking action
 bool get isPlayed;
/// Create a copy of SocketIOGameStateQuestionData
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SocketIOGameStateQuestionDataCopyWith<SocketIOGameStateQuestionData> get copyWith => _$SocketIOGameStateQuestionDataCopyWithImpl<SocketIOGameStateQuestionData>(this as SocketIOGameStateQuestionData, _$identity);

  /// Serializes this SocketIOGameStateQuestionData to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SocketIOGameStateQuestionData&&(identical(other.id, id) || other.id == id)&&(identical(other.order, order) || other.order == order)&&(identical(other.price, price) || other.price == price)&&(identical(other.questionComment, questionComment) || other.questionComment == questionComment)&&(identical(other.isPlayed, isPlayed) || other.isPlayed == isPlayed));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,order,price,questionComment,isPlayed);

@override
String toString() {
  return 'SocketIOGameStateQuestionData(id: $id, order: $order, price: $price, questionComment: $questionComment, isPlayed: $isPlayed)';
}


}

/// @nodoc
abstract mixin class $SocketIOGameStateQuestionDataCopyWith<$Res>  {
  factory $SocketIOGameStateQuestionDataCopyWith(SocketIOGameStateQuestionData value, $Res Function(SocketIOGameStateQuestionData) _then) = _$SocketIOGameStateQuestionDataCopyWithImpl;
@useResult
$Res call({
 int id, PackageEntitiesOrder order, int? price, String? questionComment, bool isPlayed
});




}
/// @nodoc
class _$SocketIOGameStateQuestionDataCopyWithImpl<$Res>
    implements $SocketIOGameStateQuestionDataCopyWith<$Res> {
  _$SocketIOGameStateQuestionDataCopyWithImpl(this._self, this._then);

  final SocketIOGameStateQuestionData _self;
  final $Res Function(SocketIOGameStateQuestionData) _then;

/// Create a copy of SocketIOGameStateQuestionData
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? order = null,Object? price = freezed,Object? questionComment = freezed,Object? isPlayed = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,order: null == order ? _self.order : order // ignore: cast_nullable_to_non_nullable
as PackageEntitiesOrder,price: freezed == price ? _self.price : price // ignore: cast_nullable_to_non_nullable
as int?,questionComment: freezed == questionComment ? _self.questionComment : questionComment // ignore: cast_nullable_to_non_nullable
as String?,isPlayed: null == isPlayed ? _self.isPlayed : isPlayed // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [SocketIOGameStateQuestionData].
extension SocketIOGameStateQuestionDataPatterns on SocketIOGameStateQuestionData {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SocketIOGameStateQuestionData value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SocketIOGameStateQuestionData() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SocketIOGameStateQuestionData value)  $default,){
final _that = this;
switch (_that) {
case _SocketIOGameStateQuestionData():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SocketIOGameStateQuestionData value)?  $default,){
final _that = this;
switch (_that) {
case _SocketIOGameStateQuestionData() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int id,  PackageEntitiesOrder order,  int? price,  String? questionComment,  bool isPlayed)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SocketIOGameStateQuestionData() when $default != null:
return $default(_that.id,_that.order,_that.price,_that.questionComment,_that.isPlayed);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int id,  PackageEntitiesOrder order,  int? price,  String? questionComment,  bool isPlayed)  $default,) {final _that = this;
switch (_that) {
case _SocketIOGameStateQuestionData():
return $default(_that.id,_that.order,_that.price,_that.questionComment,_that.isPlayed);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int id,  PackageEntitiesOrder order,  int? price,  String? questionComment,  bool isPlayed)?  $default,) {final _that = this;
switch (_that) {
case _SocketIOGameStateQuestionData() when $default != null:
return $default(_that.id,_that.order,_that.price,_that.questionComment,_that.isPlayed);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SocketIOGameStateQuestionData implements SocketIOGameStateQuestionData {
  const _SocketIOGameStateQuestionData({required this.id, required this.order, required this.price, required this.questionComment, required this.isPlayed});
  factory _SocketIOGameStateQuestionData.fromJson(Map<String, dynamic> json) => _$SocketIOGameStateQuestionDataFromJson(json);

@override final  int id;
@override final  PackageEntitiesOrder order;
/// Price is null only if price is hidden
@override final  int? price;
/// Comment that clarify what have to be answered on this question
@override final  String? questionComment;
/// Marks if question was played before to disable picking action
@override final  bool isPlayed;

/// Create a copy of SocketIOGameStateQuestionData
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SocketIOGameStateQuestionDataCopyWith<_SocketIOGameStateQuestionData> get copyWith => __$SocketIOGameStateQuestionDataCopyWithImpl<_SocketIOGameStateQuestionData>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SocketIOGameStateQuestionDataToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SocketIOGameStateQuestionData&&(identical(other.id, id) || other.id == id)&&(identical(other.order, order) || other.order == order)&&(identical(other.price, price) || other.price == price)&&(identical(other.questionComment, questionComment) || other.questionComment == questionComment)&&(identical(other.isPlayed, isPlayed) || other.isPlayed == isPlayed));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,order,price,questionComment,isPlayed);

@override
String toString() {
  return 'SocketIOGameStateQuestionData(id: $id, order: $order, price: $price, questionComment: $questionComment, isPlayed: $isPlayed)';
}


}

/// @nodoc
abstract mixin class _$SocketIOGameStateQuestionDataCopyWith<$Res> implements $SocketIOGameStateQuestionDataCopyWith<$Res> {
  factory _$SocketIOGameStateQuestionDataCopyWith(_SocketIOGameStateQuestionData value, $Res Function(_SocketIOGameStateQuestionData) _then) = __$SocketIOGameStateQuestionDataCopyWithImpl;
@override @useResult
$Res call({
 int id, PackageEntitiesOrder order, int? price, String? questionComment, bool isPlayed
});




}
/// @nodoc
class __$SocketIOGameStateQuestionDataCopyWithImpl<$Res>
    implements _$SocketIOGameStateQuestionDataCopyWith<$Res> {
  __$SocketIOGameStateQuestionDataCopyWithImpl(this._self, this._then);

  final _SocketIOGameStateQuestionData _self;
  final $Res Function(_SocketIOGameStateQuestionData) _then;

/// Create a copy of SocketIOGameStateQuestionData
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? order = null,Object? price = freezed,Object? questionComment = freezed,Object? isPlayed = null,}) {
  return _then(_SocketIOGameStateQuestionData(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,order: null == order ? _self.order : order // ignore: cast_nullable_to_non_nullable
as PackageEntitiesOrder,price: freezed == price ? _self.price : price // ignore: cast_nullable_to_non_nullable
as int?,questionComment: freezed == questionComment ? _self.questionComment : questionComment // ignore: cast_nullable_to_non_nullable
as String?,isPlayed: null == isPlayed ? _self.isPlayed : isPlayed // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}

// dart format on
