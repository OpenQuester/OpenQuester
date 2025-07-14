// dart format width=80
// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'final_bid_submit_input.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$FinalBidSubmitInput {

/// Player's bid amount
 int get bid;
/// Create a copy of FinalBidSubmitInput
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$FinalBidSubmitInputCopyWith<FinalBidSubmitInput> get copyWith => _$FinalBidSubmitInputCopyWithImpl<FinalBidSubmitInput>(this as FinalBidSubmitInput, _$identity);

  /// Serializes this FinalBidSubmitInput to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is FinalBidSubmitInput&&(identical(other.bid, bid) || other.bid == bid));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,bid);

@override
String toString() {
  return 'FinalBidSubmitInput(bid: $bid)';
}


}

/// @nodoc
abstract mixin class $FinalBidSubmitInputCopyWith<$Res>  {
  factory $FinalBidSubmitInputCopyWith(FinalBidSubmitInput value, $Res Function(FinalBidSubmitInput) _then) = _$FinalBidSubmitInputCopyWithImpl;
@useResult
$Res call({
 int bid
});




}
/// @nodoc
class _$FinalBidSubmitInputCopyWithImpl<$Res>
    implements $FinalBidSubmitInputCopyWith<$Res> {
  _$FinalBidSubmitInputCopyWithImpl(this._self, this._then);

  final FinalBidSubmitInput _self;
  final $Res Function(FinalBidSubmitInput) _then;

/// Create a copy of FinalBidSubmitInput
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? bid = null,}) {
  return _then(_self.copyWith(
bid: null == bid ? _self.bid : bid // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// @nodoc
@JsonSerializable()

class _FinalBidSubmitInput implements FinalBidSubmitInput {
  const _FinalBidSubmitInput({required this.bid});
  factory _FinalBidSubmitInput.fromJson(Map<String, dynamic> json) => _$FinalBidSubmitInputFromJson(json);

/// Player's bid amount
@override final  int bid;

/// Create a copy of FinalBidSubmitInput
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$FinalBidSubmitInputCopyWith<_FinalBidSubmitInput> get copyWith => __$FinalBidSubmitInputCopyWithImpl<_FinalBidSubmitInput>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$FinalBidSubmitInputToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _FinalBidSubmitInput&&(identical(other.bid, bid) || other.bid == bid));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,bid);

@override
String toString() {
  return 'FinalBidSubmitInput(bid: $bid)';
}


}

/// @nodoc
abstract mixin class _$FinalBidSubmitInputCopyWith<$Res> implements $FinalBidSubmitInputCopyWith<$Res> {
  factory _$FinalBidSubmitInputCopyWith(_FinalBidSubmitInput value, $Res Function(_FinalBidSubmitInput) _then) = __$FinalBidSubmitInputCopyWithImpl;
@override @useResult
$Res call({
 int bid
});




}
/// @nodoc
class __$FinalBidSubmitInputCopyWithImpl<$Res>
    implements _$FinalBidSubmitInputCopyWith<$Res> {
  __$FinalBidSubmitInputCopyWithImpl(this._self, this._then);

  final _FinalBidSubmitInput _self;
  final $Res Function(_FinalBidSubmitInput) _then;

/// Create a copy of FinalBidSubmitInput
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? bid = null,}) {
  return _then(_FinalBidSubmitInput(
bid: null == bid ? _self.bid : bid // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}

// dart format on
