// dart format width=80
// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'package_round.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PackageRound {

 int? get id; PackageEntitiesOrder get order;/// Name of the round
 String get name;/// Description of the round
 String? get description; PackageRoundType get type;/// Themes in the round
 List<PackageTheme> get themes;
/// Create a copy of PackageRound
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PackageRoundCopyWith<PackageRound> get copyWith => _$PackageRoundCopyWithImpl<PackageRound>(this as PackageRound, _$identity);

  /// Serializes this PackageRound to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PackageRound&&(identical(other.id, id) || other.id == id)&&(identical(other.order, order) || other.order == order)&&(identical(other.name, name) || other.name == name)&&(identical(other.description, description) || other.description == description)&&(identical(other.type, type) || other.type == type)&&const DeepCollectionEquality().equals(other.themes, themes));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,order,name,description,type,const DeepCollectionEquality().hash(themes));

@override
String toString() {
  return 'PackageRound(id: $id, order: $order, name: $name, description: $description, type: $type, themes: $themes)';
}


}

/// @nodoc
abstract mixin class $PackageRoundCopyWith<$Res>  {
  factory $PackageRoundCopyWith(PackageRound value, $Res Function(PackageRound) _then) = _$PackageRoundCopyWithImpl;
@useResult
$Res call({
 int? id, PackageEntitiesOrder order, String name, String? description, PackageRoundType type, List<PackageTheme> themes
});




}
/// @nodoc
class _$PackageRoundCopyWithImpl<$Res>
    implements $PackageRoundCopyWith<$Res> {
  _$PackageRoundCopyWithImpl(this._self, this._then);

  final PackageRound _self;
  final $Res Function(PackageRound) _then;

/// Create a copy of PackageRound
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = freezed,Object? order = null,Object? name = null,Object? description = freezed,Object? type = null,Object? themes = null,}) {
  return _then(_self.copyWith(
id: freezed == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int?,order: null == order ? _self.order : order // ignore: cast_nullable_to_non_nullable
as PackageEntitiesOrder,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as PackageRoundType,themes: null == themes ? _self.themes : themes // ignore: cast_nullable_to_non_nullable
as List<PackageTheme>,
  ));
}

}


/// @nodoc
@JsonSerializable()

class _PackageRound implements PackageRound {
  const _PackageRound({required this.id, required this.order, required this.name, required this.description, required this.type, required final  List<PackageTheme> themes}): _themes = themes;
  factory _PackageRound.fromJson(Map<String, dynamic> json) => _$PackageRoundFromJson(json);

@override final  int? id;
@override final  PackageEntitiesOrder order;
/// Name of the round
@override final  String name;
/// Description of the round
@override final  String? description;
@override final  PackageRoundType type;
/// Themes in the round
 final  List<PackageTheme> _themes;
/// Themes in the round
@override List<PackageTheme> get themes {
  if (_themes is EqualUnmodifiableListView) return _themes;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_themes);
}


/// Create a copy of PackageRound
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PackageRoundCopyWith<_PackageRound> get copyWith => __$PackageRoundCopyWithImpl<_PackageRound>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PackageRoundToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PackageRound&&(identical(other.id, id) || other.id == id)&&(identical(other.order, order) || other.order == order)&&(identical(other.name, name) || other.name == name)&&(identical(other.description, description) || other.description == description)&&(identical(other.type, type) || other.type == type)&&const DeepCollectionEquality().equals(other._themes, _themes));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,order,name,description,type,const DeepCollectionEquality().hash(_themes));

@override
String toString() {
  return 'PackageRound(id: $id, order: $order, name: $name, description: $description, type: $type, themes: $themes)';
}


}

/// @nodoc
abstract mixin class _$PackageRoundCopyWith<$Res> implements $PackageRoundCopyWith<$Res> {
  factory _$PackageRoundCopyWith(_PackageRound value, $Res Function(_PackageRound) _then) = __$PackageRoundCopyWithImpl;
@override @useResult
$Res call({
 int? id, PackageEntitiesOrder order, String name, String? description, PackageRoundType type, List<PackageTheme> themes
});




}
/// @nodoc
class __$PackageRoundCopyWithImpl<$Res>
    implements _$PackageRoundCopyWith<$Res> {
  __$PackageRoundCopyWithImpl(this._self, this._then);

  final _PackageRound _self;
  final $Res Function(_PackageRound) _then;

/// Create a copy of PackageRound
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = freezed,Object? order = null,Object? name = null,Object? description = freezed,Object? type = null,Object? themes = null,}) {
  return _then(_PackageRound(
id: freezed == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int?,order: null == order ? _self.order : order // ignore: cast_nullable_to_non_nullable
as PackageEntitiesOrder,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as PackageRoundType,themes: null == themes ? _self._themes : themes // ignore: cast_nullable_to_non_nullable
as List<PackageTheme>,
  ));
}


}

// dart format on
