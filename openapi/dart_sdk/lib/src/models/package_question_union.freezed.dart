// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'package_question_union.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;
PackageQuestionUnion _$PackageQuestionUnionFromJson(
  Map<String, dynamic> json
) {
        switch (json['type']) {
                  case 'simple':
          return PackageQuestionUnionSimple.fromJson(
            json
          );
                case 'stake':
          return PackageQuestionUnionStake.fromJson(
            json
          );
                case 'secret':
          return PackageQuestionUnionSecret.fromJson(
            json
          );
                case 'noRisk':
          return PackageQuestionUnionNoRisk.fromJson(
            json
          );
                case 'choice':
          return PackageQuestionUnionChoice.fromJson(
            json
          );
                case 'hidden':
          return PackageQuestionUnionHidden.fromJson(
            json
          );
        
          default:
            throw CheckedFromJsonException(
  json,
  'type',
  'PackageQuestionUnion',
  'Invalid union type "${json['type']}"!'
);
        }
      
}

/// @nodoc
mixin _$PackageQuestionUnion {

 int? get id; PackageEntitiesOrder get order;/// Price is null only if price is hidden
 int? get price;/// Question text
 String? get text;/// Hint for the answer
 String? get answerHint;/// Comment or note about the question
 String? get questionComment; Enum get type; QuestionAnswerText? get answerText; List<PackageQuestionFile?>? get questionFiles; List<PackageQuestionFile?>? get answerFiles;/// Whether the question is hidden
 bool get isHidden;/// Delay in milliseconds before being able to answer, if applicable
 int get answerDelay;
/// Create a copy of PackageQuestionUnion
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PackageQuestionUnionCopyWith<PackageQuestionUnion> get copyWith => _$PackageQuestionUnionCopyWithImpl<PackageQuestionUnion>(this as PackageQuestionUnion, _$identity);

  /// Serializes this PackageQuestionUnion to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PackageQuestionUnion&&(identical(other.id, id) || other.id == id)&&(identical(other.order, order) || other.order == order)&&(identical(other.price, price) || other.price == price)&&(identical(other.text, text) || other.text == text)&&(identical(other.answerHint, answerHint) || other.answerHint == answerHint)&&(identical(other.questionComment, questionComment) || other.questionComment == questionComment)&&(identical(other.type, type) || other.type == type)&&(identical(other.answerText, answerText) || other.answerText == answerText)&&const DeepCollectionEquality().equals(other.questionFiles, questionFiles)&&const DeepCollectionEquality().equals(other.answerFiles, answerFiles)&&(identical(other.isHidden, isHidden) || other.isHidden == isHidden)&&(identical(other.answerDelay, answerDelay) || other.answerDelay == answerDelay));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,order,price,text,answerHint,questionComment,type,answerText,const DeepCollectionEquality().hash(questionFiles),const DeepCollectionEquality().hash(answerFiles),isHidden,answerDelay);

@override
String toString() {
  return 'PackageQuestionUnion(id: $id, order: $order, price: $price, text: $text, answerHint: $answerHint, questionComment: $questionComment, type: $type, answerText: $answerText, questionFiles: $questionFiles, answerFiles: $answerFiles, isHidden: $isHidden, answerDelay: $answerDelay)';
}


}

/// @nodoc
abstract mixin class $PackageQuestionUnionCopyWith<$Res>  {
  factory $PackageQuestionUnionCopyWith(PackageQuestionUnion value, $Res Function(PackageQuestionUnion) _then) = _$PackageQuestionUnionCopyWithImpl;
@useResult
$Res call({
 int? id, int order, int? price, String? text, String? answerHint, String? questionComment, String? answerText, List<PackageQuestionFile?>? questionFiles, List<PackageQuestionFile?>? answerFiles, bool isHidden, int answerDelay
});




}
/// @nodoc
class _$PackageQuestionUnionCopyWithImpl<$Res>
    implements $PackageQuestionUnionCopyWith<$Res> {
  _$PackageQuestionUnionCopyWithImpl(this._self, this._then);

  final PackageQuestionUnion _self;
  final $Res Function(PackageQuestionUnion) _then;

/// Create a copy of PackageQuestionUnion
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = freezed,Object? order = null,Object? price = freezed,Object? text = freezed,Object? answerHint = freezed,Object? questionComment = freezed,Object? answerText = freezed,Object? questionFiles = freezed,Object? answerFiles = freezed,Object? isHidden = null,Object? answerDelay = null,}) {
  return _then(_self.copyWith(
id: freezed == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int?,order: null == order ? _self.order : order // ignore: cast_nullable_to_non_nullable
as int,price: freezed == price ? _self.price : price // ignore: cast_nullable_to_non_nullable
as int?,text: freezed == text ? _self.text : text // ignore: cast_nullable_to_non_nullable
as String?,answerHint: freezed == answerHint ? _self.answerHint : answerHint // ignore: cast_nullable_to_non_nullable
as String?,questionComment: freezed == questionComment ? _self.questionComment : questionComment // ignore: cast_nullable_to_non_nullable
as String?,answerText: freezed == answerText ? _self.answerText : answerText // ignore: cast_nullable_to_non_nullable
as String?,questionFiles: freezed == questionFiles ? _self.questionFiles : questionFiles // ignore: cast_nullable_to_non_nullable
as List<PackageQuestionFile?>?,answerFiles: freezed == answerFiles ? _self.answerFiles : answerFiles // ignore: cast_nullable_to_non_nullable
as List<PackageQuestionFile?>?,isHidden: null == isHidden ? _self.isHidden : isHidden // ignore: cast_nullable_to_non_nullable
as bool,answerDelay: null == answerDelay ? _self.answerDelay : answerDelay // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [PackageQuestionUnion].
extension PackageQuestionUnionPatterns on PackageQuestionUnion {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>({TResult Function( PackageQuestionUnionSimple value)?  simple,TResult Function( PackageQuestionUnionStake value)?  stake,TResult Function( PackageQuestionUnionSecret value)?  secret,TResult Function( PackageQuestionUnionNoRisk value)?  noRisk,TResult Function( PackageQuestionUnionChoice value)?  choice,TResult Function( PackageQuestionUnionHidden value)?  hidden,required TResult orElse(),}){
final _that = this;
switch (_that) {
case PackageQuestionUnionSimple() when simple != null:
return simple(_that);case PackageQuestionUnionStake() when stake != null:
return stake(_that);case PackageQuestionUnionSecret() when secret != null:
return secret(_that);case PackageQuestionUnionNoRisk() when noRisk != null:
return noRisk(_that);case PackageQuestionUnionChoice() when choice != null:
return choice(_that);case PackageQuestionUnionHidden() when hidden != null:
return hidden(_that);case _:
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

@optionalTypeArgs TResult map<TResult extends Object?>({required TResult Function( PackageQuestionUnionSimple value)  simple,required TResult Function( PackageQuestionUnionStake value)  stake,required TResult Function( PackageQuestionUnionSecret value)  secret,required TResult Function( PackageQuestionUnionNoRisk value)  noRisk,required TResult Function( PackageQuestionUnionChoice value)  choice,required TResult Function( PackageQuestionUnionHidden value)  hidden,}){
final _that = this;
switch (_that) {
case PackageQuestionUnionSimple():
return simple(_that);case PackageQuestionUnionStake():
return stake(_that);case PackageQuestionUnionSecret():
return secret(_that);case PackageQuestionUnionNoRisk():
return noRisk(_that);case PackageQuestionUnionChoice():
return choice(_that);case PackageQuestionUnionHidden():
return hidden(_that);}
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>({TResult? Function( PackageQuestionUnionSimple value)?  simple,TResult? Function( PackageQuestionUnionStake value)?  stake,TResult? Function( PackageQuestionUnionSecret value)?  secret,TResult? Function( PackageQuestionUnionNoRisk value)?  noRisk,TResult? Function( PackageQuestionUnionChoice value)?  choice,TResult? Function( PackageQuestionUnionHidden value)?  hidden,}){
final _that = this;
switch (_that) {
case PackageQuestionUnionSimple() when simple != null:
return simple(_that);case PackageQuestionUnionStake() when stake != null:
return stake(_that);case PackageQuestionUnionSecret() when secret != null:
return secret(_that);case PackageQuestionUnionNoRisk() when noRisk != null:
return noRisk(_that);case PackageQuestionUnionChoice() when choice != null:
return choice(_that);case PackageQuestionUnionHidden() when hidden != null:
return hidden(_that);case _:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>({TResult Function( int? id,  PackageEntitiesOrder order,  int? price,  String? text,  String? answerHint,  String? questionComment,  SimpleQuestionType type,  QuestionAnswerText? answerText,  List<PackageQuestionFile?>? questionFiles,  List<PackageQuestionFile?>? answerFiles,  bool isHidden,  int answerDelay)?  simple,TResult Function( int? id,  PackageEntitiesOrder order,  int? price,  String? text,  String? answerHint,  String? questionComment,  StakeQuestionType type,  QuestionMaxPrice maxPrice,  QuestionAnswerText? answerText,  List<PackageQuestionFile?>? questionFiles,  List<PackageQuestionFile?>? answerFiles,  bool isHidden,  int answerDelay,  StakeQuestionSubType subType)?  stake,TResult Function( int? id,  PackageEntitiesOrder order,  int? price,  String? text,  String? answerHint,  String? questionComment,  SecretQuestionType type,  SecretQuestionSubType subType,  QuestionAllowedPrices allowedPrices,  QuestionTransferType transferType,  QuestionAnswerText? answerText,  List<PackageQuestionFile?>? questionFiles,  List<PackageQuestionFile?>? answerFiles,  bool isHidden,  int answerDelay)?  secret,TResult Function( int? id,  PackageEntitiesOrder order,  int? price,  String? text,  String? answerHint,  String? questionComment,  NoRiskQuestionType type,  NoRiskQuestionSubType subType,  QuestionPriceMultiplier priceMultiplier,  QuestionAnswerText? answerText,  List<PackageQuestionFile?>? questionFiles,  List<PackageQuestionFile?>? answerFiles,  bool isHidden,  int answerDelay)?  noRisk,TResult Function( int? id,  PackageEntitiesOrder order,  int? price,  String? text,  String? answerHint,  String? questionComment,  ChoiceQuestionType type,  dynamic subType,  QuestionShowDelay showDelay,  List<QuestionChoiceAnswers> answers,  QuestionAnswerText? answerText,  List<PackageQuestionFile?>? questionFiles,  List<PackageQuestionFile?>? answerFiles,  bool isHidden,  int answerDelay)?  choice,TResult Function( int? id,  PackageEntitiesOrder order,  int? price,  String? text,  String? answerHint,  String? questionComment,  HiddenQuestionType type,  QuestionAnswerText? answerText,  List<PackageQuestionFile?>? questionFiles,  List<PackageQuestionFile?>? answerFiles,  bool isHidden,  int answerDelay)?  hidden,required TResult orElse(),}) {final _that = this;
switch (_that) {
case PackageQuestionUnionSimple() when simple != null:
return simple(_that.id,_that.order,_that.price,_that.text,_that.answerHint,_that.questionComment,_that.type,_that.answerText,_that.questionFiles,_that.answerFiles,_that.isHidden,_that.answerDelay);case PackageQuestionUnionStake() when stake != null:
return stake(_that.id,_that.order,_that.price,_that.text,_that.answerHint,_that.questionComment,_that.type,_that.maxPrice,_that.answerText,_that.questionFiles,_that.answerFiles,_that.isHidden,_that.answerDelay,_that.subType);case PackageQuestionUnionSecret() when secret != null:
return secret(_that.id,_that.order,_that.price,_that.text,_that.answerHint,_that.questionComment,_that.type,_that.subType,_that.allowedPrices,_that.transferType,_that.answerText,_that.questionFiles,_that.answerFiles,_that.isHidden,_that.answerDelay);case PackageQuestionUnionNoRisk() when noRisk != null:
return noRisk(_that.id,_that.order,_that.price,_that.text,_that.answerHint,_that.questionComment,_that.type,_that.subType,_that.priceMultiplier,_that.answerText,_that.questionFiles,_that.answerFiles,_that.isHidden,_that.answerDelay);case PackageQuestionUnionChoice() when choice != null:
return choice(_that.id,_that.order,_that.price,_that.text,_that.answerHint,_that.questionComment,_that.type,_that.subType,_that.showDelay,_that.answers,_that.answerText,_that.questionFiles,_that.answerFiles,_that.isHidden,_that.answerDelay);case PackageQuestionUnionHidden() when hidden != null:
return hidden(_that.id,_that.order,_that.price,_that.text,_that.answerHint,_that.questionComment,_that.type,_that.answerText,_that.questionFiles,_that.answerFiles,_that.isHidden,_that.answerDelay);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>({required TResult Function( int? id,  PackageEntitiesOrder order,  int? price,  String? text,  String? answerHint,  String? questionComment,  SimpleQuestionType type,  QuestionAnswerText? answerText,  List<PackageQuestionFile?>? questionFiles,  List<PackageQuestionFile?>? answerFiles,  bool isHidden,  int answerDelay)  simple,required TResult Function( int? id,  PackageEntitiesOrder order,  int? price,  String? text,  String? answerHint,  String? questionComment,  StakeQuestionType type,  QuestionMaxPrice maxPrice,  QuestionAnswerText? answerText,  List<PackageQuestionFile?>? questionFiles,  List<PackageQuestionFile?>? answerFiles,  bool isHidden,  int answerDelay,  StakeQuestionSubType subType)  stake,required TResult Function( int? id,  PackageEntitiesOrder order,  int? price,  String? text,  String? answerHint,  String? questionComment,  SecretQuestionType type,  SecretQuestionSubType subType,  QuestionAllowedPrices allowedPrices,  QuestionTransferType transferType,  QuestionAnswerText? answerText,  List<PackageQuestionFile?>? questionFiles,  List<PackageQuestionFile?>? answerFiles,  bool isHidden,  int answerDelay)  secret,required TResult Function( int? id,  PackageEntitiesOrder order,  int? price,  String? text,  String? answerHint,  String? questionComment,  NoRiskQuestionType type,  NoRiskQuestionSubType subType,  QuestionPriceMultiplier priceMultiplier,  QuestionAnswerText? answerText,  List<PackageQuestionFile?>? questionFiles,  List<PackageQuestionFile?>? answerFiles,  bool isHidden,  int answerDelay)  noRisk,required TResult Function( int? id,  PackageEntitiesOrder order,  int? price,  String? text,  String? answerHint,  String? questionComment,  ChoiceQuestionType type,  dynamic subType,  QuestionShowDelay showDelay,  List<QuestionChoiceAnswers> answers,  QuestionAnswerText? answerText,  List<PackageQuestionFile?>? questionFiles,  List<PackageQuestionFile?>? answerFiles,  bool isHidden,  int answerDelay)  choice,required TResult Function( int? id,  PackageEntitiesOrder order,  int? price,  String? text,  String? answerHint,  String? questionComment,  HiddenQuestionType type,  QuestionAnswerText? answerText,  List<PackageQuestionFile?>? questionFiles,  List<PackageQuestionFile?>? answerFiles,  bool isHidden,  int answerDelay)  hidden,}) {final _that = this;
switch (_that) {
case PackageQuestionUnionSimple():
return simple(_that.id,_that.order,_that.price,_that.text,_that.answerHint,_that.questionComment,_that.type,_that.answerText,_that.questionFiles,_that.answerFiles,_that.isHidden,_that.answerDelay);case PackageQuestionUnionStake():
return stake(_that.id,_that.order,_that.price,_that.text,_that.answerHint,_that.questionComment,_that.type,_that.maxPrice,_that.answerText,_that.questionFiles,_that.answerFiles,_that.isHidden,_that.answerDelay,_that.subType);case PackageQuestionUnionSecret():
return secret(_that.id,_that.order,_that.price,_that.text,_that.answerHint,_that.questionComment,_that.type,_that.subType,_that.allowedPrices,_that.transferType,_that.answerText,_that.questionFiles,_that.answerFiles,_that.isHidden,_that.answerDelay);case PackageQuestionUnionNoRisk():
return noRisk(_that.id,_that.order,_that.price,_that.text,_that.answerHint,_that.questionComment,_that.type,_that.subType,_that.priceMultiplier,_that.answerText,_that.questionFiles,_that.answerFiles,_that.isHidden,_that.answerDelay);case PackageQuestionUnionChoice():
return choice(_that.id,_that.order,_that.price,_that.text,_that.answerHint,_that.questionComment,_that.type,_that.subType,_that.showDelay,_that.answers,_that.answerText,_that.questionFiles,_that.answerFiles,_that.isHidden,_that.answerDelay);case PackageQuestionUnionHidden():
return hidden(_that.id,_that.order,_that.price,_that.text,_that.answerHint,_that.questionComment,_that.type,_that.answerText,_that.questionFiles,_that.answerFiles,_that.isHidden,_that.answerDelay);}
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>({TResult? Function( int? id,  PackageEntitiesOrder order,  int? price,  String? text,  String? answerHint,  String? questionComment,  SimpleQuestionType type,  QuestionAnswerText? answerText,  List<PackageQuestionFile?>? questionFiles,  List<PackageQuestionFile?>? answerFiles,  bool isHidden,  int answerDelay)?  simple,TResult? Function( int? id,  PackageEntitiesOrder order,  int? price,  String? text,  String? answerHint,  String? questionComment,  StakeQuestionType type,  QuestionMaxPrice maxPrice,  QuestionAnswerText? answerText,  List<PackageQuestionFile?>? questionFiles,  List<PackageQuestionFile?>? answerFiles,  bool isHidden,  int answerDelay,  StakeQuestionSubType subType)?  stake,TResult? Function( int? id,  PackageEntitiesOrder order,  int? price,  String? text,  String? answerHint,  String? questionComment,  SecretQuestionType type,  SecretQuestionSubType subType,  QuestionAllowedPrices allowedPrices,  QuestionTransferType transferType,  QuestionAnswerText? answerText,  List<PackageQuestionFile?>? questionFiles,  List<PackageQuestionFile?>? answerFiles,  bool isHidden,  int answerDelay)?  secret,TResult? Function( int? id,  PackageEntitiesOrder order,  int? price,  String? text,  String? answerHint,  String? questionComment,  NoRiskQuestionType type,  NoRiskQuestionSubType subType,  QuestionPriceMultiplier priceMultiplier,  QuestionAnswerText? answerText,  List<PackageQuestionFile?>? questionFiles,  List<PackageQuestionFile?>? answerFiles,  bool isHidden,  int answerDelay)?  noRisk,TResult? Function( int? id,  PackageEntitiesOrder order,  int? price,  String? text,  String? answerHint,  String? questionComment,  ChoiceQuestionType type,  dynamic subType,  QuestionShowDelay showDelay,  List<QuestionChoiceAnswers> answers,  QuestionAnswerText? answerText,  List<PackageQuestionFile?>? questionFiles,  List<PackageQuestionFile?>? answerFiles,  bool isHidden,  int answerDelay)?  choice,TResult? Function( int? id,  PackageEntitiesOrder order,  int? price,  String? text,  String? answerHint,  String? questionComment,  HiddenQuestionType type,  QuestionAnswerText? answerText,  List<PackageQuestionFile?>? questionFiles,  List<PackageQuestionFile?>? answerFiles,  bool isHidden,  int answerDelay)?  hidden,}) {final _that = this;
switch (_that) {
case PackageQuestionUnionSimple() when simple != null:
return simple(_that.id,_that.order,_that.price,_that.text,_that.answerHint,_that.questionComment,_that.type,_that.answerText,_that.questionFiles,_that.answerFiles,_that.isHidden,_that.answerDelay);case PackageQuestionUnionStake() when stake != null:
return stake(_that.id,_that.order,_that.price,_that.text,_that.answerHint,_that.questionComment,_that.type,_that.maxPrice,_that.answerText,_that.questionFiles,_that.answerFiles,_that.isHidden,_that.answerDelay,_that.subType);case PackageQuestionUnionSecret() when secret != null:
return secret(_that.id,_that.order,_that.price,_that.text,_that.answerHint,_that.questionComment,_that.type,_that.subType,_that.allowedPrices,_that.transferType,_that.answerText,_that.questionFiles,_that.answerFiles,_that.isHidden,_that.answerDelay);case PackageQuestionUnionNoRisk() when noRisk != null:
return noRisk(_that.id,_that.order,_that.price,_that.text,_that.answerHint,_that.questionComment,_that.type,_that.subType,_that.priceMultiplier,_that.answerText,_that.questionFiles,_that.answerFiles,_that.isHidden,_that.answerDelay);case PackageQuestionUnionChoice() when choice != null:
return choice(_that.id,_that.order,_that.price,_that.text,_that.answerHint,_that.questionComment,_that.type,_that.subType,_that.showDelay,_that.answers,_that.answerText,_that.questionFiles,_that.answerFiles,_that.isHidden,_that.answerDelay);case PackageQuestionUnionHidden() when hidden != null:
return hidden(_that.id,_that.order,_that.price,_that.text,_that.answerHint,_that.questionComment,_that.type,_that.answerText,_that.questionFiles,_that.answerFiles,_that.isHidden,_that.answerDelay);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class PackageQuestionUnionSimple implements PackageQuestionUnion {
  const PackageQuestionUnionSimple({required this.id, required this.order, required this.price, required this.text, required this.answerHint, required this.questionComment, required this.type, this.answerText, final  List<PackageQuestionFile?>? questionFiles, final  List<PackageQuestionFile?>? answerFiles, this.isHidden = false, this.answerDelay = 4000}): _questionFiles = questionFiles,_answerFiles = answerFiles;
  factory PackageQuestionUnionSimple.fromJson(Map<String, dynamic> json) => _$PackageQuestionUnionSimpleFromJson(json);

@override final  int? id;
@override final  PackageEntitiesOrder order;
/// Price is null only if price is hidden
@override final  int? price;
/// Question text
@override final  String? text;
/// Hint for the answer
@override final  String? answerHint;
/// Comment or note about the question
@override final  String? questionComment;
@override final  SimpleQuestionType type;
@override final  QuestionAnswerText? answerText;
 final  List<PackageQuestionFile?>? _questionFiles;
@override List<PackageQuestionFile?>? get questionFiles {
  final value = _questionFiles;
  if (value == null) return null;
  if (_questionFiles is EqualUnmodifiableListView) return _questionFiles;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}

 final  List<PackageQuestionFile?>? _answerFiles;
@override List<PackageQuestionFile?>? get answerFiles {
  final value = _answerFiles;
  if (value == null) return null;
  if (_answerFiles is EqualUnmodifiableListView) return _answerFiles;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}

/// Whether the question is hidden
@override@JsonKey() final  bool isHidden;
/// Delay in milliseconds before being able to answer, if applicable
@override@JsonKey() final  int answerDelay;

/// Create a copy of PackageQuestionUnion
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PackageQuestionUnionSimpleCopyWith<PackageQuestionUnionSimple> get copyWith => _$PackageQuestionUnionSimpleCopyWithImpl<PackageQuestionUnionSimple>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PackageQuestionUnionSimpleToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PackageQuestionUnionSimple&&(identical(other.id, id) || other.id == id)&&(identical(other.order, order) || other.order == order)&&(identical(other.price, price) || other.price == price)&&(identical(other.text, text) || other.text == text)&&(identical(other.answerHint, answerHint) || other.answerHint == answerHint)&&(identical(other.questionComment, questionComment) || other.questionComment == questionComment)&&(identical(other.type, type) || other.type == type)&&(identical(other.answerText, answerText) || other.answerText == answerText)&&const DeepCollectionEquality().equals(other._questionFiles, _questionFiles)&&const DeepCollectionEquality().equals(other._answerFiles, _answerFiles)&&(identical(other.isHidden, isHidden) || other.isHidden == isHidden)&&(identical(other.answerDelay, answerDelay) || other.answerDelay == answerDelay));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,order,price,text,answerHint,questionComment,type,answerText,const DeepCollectionEquality().hash(_questionFiles),const DeepCollectionEquality().hash(_answerFiles),isHidden,answerDelay);

@override
String toString() {
  return 'PackageQuestionUnion.simple(id: $id, order: $order, price: $price, text: $text, answerHint: $answerHint, questionComment: $questionComment, type: $type, answerText: $answerText, questionFiles: $questionFiles, answerFiles: $answerFiles, isHidden: $isHidden, answerDelay: $answerDelay)';
}


}

/// @nodoc
abstract mixin class $PackageQuestionUnionSimpleCopyWith<$Res> implements $PackageQuestionUnionCopyWith<$Res> {
  factory $PackageQuestionUnionSimpleCopyWith(PackageQuestionUnionSimple value, $Res Function(PackageQuestionUnionSimple) _then) = _$PackageQuestionUnionSimpleCopyWithImpl;
@override @useResult
$Res call({
 int? id, PackageEntitiesOrder order, int? price, String? text, String? answerHint, String? questionComment, SimpleQuestionType type, QuestionAnswerText? answerText, List<PackageQuestionFile?>? questionFiles, List<PackageQuestionFile?>? answerFiles, bool isHidden, int answerDelay
});




}
/// @nodoc
class _$PackageQuestionUnionSimpleCopyWithImpl<$Res>
    implements $PackageQuestionUnionSimpleCopyWith<$Res> {
  _$PackageQuestionUnionSimpleCopyWithImpl(this._self, this._then);

  final PackageQuestionUnionSimple _self;
  final $Res Function(PackageQuestionUnionSimple) _then;

/// Create a copy of PackageQuestionUnion
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = freezed,Object? order = null,Object? price = freezed,Object? text = freezed,Object? answerHint = freezed,Object? questionComment = freezed,Object? type = null,Object? answerText = freezed,Object? questionFiles = freezed,Object? answerFiles = freezed,Object? isHidden = null,Object? answerDelay = null,}) {
  return _then(PackageQuestionUnionSimple(
id: freezed == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int?,order: null == order ? _self.order : order // ignore: cast_nullable_to_non_nullable
as PackageEntitiesOrder,price: freezed == price ? _self.price : price // ignore: cast_nullable_to_non_nullable
as int?,text: freezed == text ? _self.text : text // ignore: cast_nullable_to_non_nullable
as String?,answerHint: freezed == answerHint ? _self.answerHint : answerHint // ignore: cast_nullable_to_non_nullable
as String?,questionComment: freezed == questionComment ? _self.questionComment : questionComment // ignore: cast_nullable_to_non_nullable
as String?,type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as SimpleQuestionType,answerText: freezed == answerText ? _self.answerText : answerText // ignore: cast_nullable_to_non_nullable
as QuestionAnswerText?,questionFiles: freezed == questionFiles ? _self._questionFiles : questionFiles // ignore: cast_nullable_to_non_nullable
as List<PackageQuestionFile?>?,answerFiles: freezed == answerFiles ? _self._answerFiles : answerFiles // ignore: cast_nullable_to_non_nullable
as List<PackageQuestionFile?>?,isHidden: null == isHidden ? _self.isHidden : isHidden // ignore: cast_nullable_to_non_nullable
as bool,answerDelay: null == answerDelay ? _self.answerDelay : answerDelay // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}

/// @nodoc
@JsonSerializable()

class PackageQuestionUnionStake implements PackageQuestionUnion {
  const PackageQuestionUnionStake({required this.id, required this.order, required this.price, required this.text, required this.answerHint, required this.questionComment, required this.type, required this.maxPrice, this.answerText, final  List<PackageQuestionFile?>? questionFiles, final  List<PackageQuestionFile?>? answerFiles, this.isHidden = false, this.answerDelay = 4000, this.subType = StakeQuestionSubType.simple}): _questionFiles = questionFiles,_answerFiles = answerFiles;
  factory PackageQuestionUnionStake.fromJson(Map<String, dynamic> json) => _$PackageQuestionUnionStakeFromJson(json);

@override final  int? id;
@override final  PackageEntitiesOrder order;
/// Price is null only if price is hidden
@override final  int? price;
/// Question text
@override final  String? text;
/// Hint for the answer
@override final  String? answerHint;
/// Comment or note about the question
@override final  String? questionComment;
@override final  StakeQuestionType type;
 final  QuestionMaxPrice maxPrice;
@override final  QuestionAnswerText? answerText;
 final  List<PackageQuestionFile?>? _questionFiles;
@override List<PackageQuestionFile?>? get questionFiles {
  final value = _questionFiles;
  if (value == null) return null;
  if (_questionFiles is EqualUnmodifiableListView) return _questionFiles;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}

 final  List<PackageQuestionFile?>? _answerFiles;
@override List<PackageQuestionFile?>? get answerFiles {
  final value = _answerFiles;
  if (value == null) return null;
  if (_answerFiles is EqualUnmodifiableListView) return _answerFiles;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}

/// Whether the question is hidden
@override@JsonKey() final  bool isHidden;
/// Delay in milliseconds before being able to answer, if applicable
@override@JsonKey() final  int answerDelay;
/// Subtype of the stake question. simple is basically auction. forEveryone means everyone place some amount of money and write answer
@JsonKey() final  StakeQuestionSubType subType;

/// Create a copy of PackageQuestionUnion
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PackageQuestionUnionStakeCopyWith<PackageQuestionUnionStake> get copyWith => _$PackageQuestionUnionStakeCopyWithImpl<PackageQuestionUnionStake>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PackageQuestionUnionStakeToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PackageQuestionUnionStake&&(identical(other.id, id) || other.id == id)&&(identical(other.order, order) || other.order == order)&&(identical(other.price, price) || other.price == price)&&(identical(other.text, text) || other.text == text)&&(identical(other.answerHint, answerHint) || other.answerHint == answerHint)&&(identical(other.questionComment, questionComment) || other.questionComment == questionComment)&&(identical(other.type, type) || other.type == type)&&(identical(other.maxPrice, maxPrice) || other.maxPrice == maxPrice)&&(identical(other.answerText, answerText) || other.answerText == answerText)&&const DeepCollectionEquality().equals(other._questionFiles, _questionFiles)&&const DeepCollectionEquality().equals(other._answerFiles, _answerFiles)&&(identical(other.isHidden, isHidden) || other.isHidden == isHidden)&&(identical(other.answerDelay, answerDelay) || other.answerDelay == answerDelay)&&(identical(other.subType, subType) || other.subType == subType));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,order,price,text,answerHint,questionComment,type,maxPrice,answerText,const DeepCollectionEquality().hash(_questionFiles),const DeepCollectionEquality().hash(_answerFiles),isHidden,answerDelay,subType);

@override
String toString() {
  return 'PackageQuestionUnion.stake(id: $id, order: $order, price: $price, text: $text, answerHint: $answerHint, questionComment: $questionComment, type: $type, maxPrice: $maxPrice, answerText: $answerText, questionFiles: $questionFiles, answerFiles: $answerFiles, isHidden: $isHidden, answerDelay: $answerDelay, subType: $subType)';
}


}

/// @nodoc
abstract mixin class $PackageQuestionUnionStakeCopyWith<$Res> implements $PackageQuestionUnionCopyWith<$Res> {
  factory $PackageQuestionUnionStakeCopyWith(PackageQuestionUnionStake value, $Res Function(PackageQuestionUnionStake) _then) = _$PackageQuestionUnionStakeCopyWithImpl;
@override @useResult
$Res call({
 int? id, PackageEntitiesOrder order, int? price, String? text, String? answerHint, String? questionComment, StakeQuestionType type, QuestionMaxPrice maxPrice, QuestionAnswerText? answerText, List<PackageQuestionFile?>? questionFiles, List<PackageQuestionFile?>? answerFiles, bool isHidden, int answerDelay, StakeQuestionSubType subType
});




}
/// @nodoc
class _$PackageQuestionUnionStakeCopyWithImpl<$Res>
    implements $PackageQuestionUnionStakeCopyWith<$Res> {
  _$PackageQuestionUnionStakeCopyWithImpl(this._self, this._then);

  final PackageQuestionUnionStake _self;
  final $Res Function(PackageQuestionUnionStake) _then;

/// Create a copy of PackageQuestionUnion
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = freezed,Object? order = null,Object? price = freezed,Object? text = freezed,Object? answerHint = freezed,Object? questionComment = freezed,Object? type = null,Object? maxPrice = freezed,Object? answerText = freezed,Object? questionFiles = freezed,Object? answerFiles = freezed,Object? isHidden = null,Object? answerDelay = null,Object? subType = null,}) {
  return _then(PackageQuestionUnionStake(
id: freezed == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int?,order: null == order ? _self.order : order // ignore: cast_nullable_to_non_nullable
as PackageEntitiesOrder,price: freezed == price ? _self.price : price // ignore: cast_nullable_to_non_nullable
as int?,text: freezed == text ? _self.text : text // ignore: cast_nullable_to_non_nullable
as String?,answerHint: freezed == answerHint ? _self.answerHint : answerHint // ignore: cast_nullable_to_non_nullable
as String?,questionComment: freezed == questionComment ? _self.questionComment : questionComment // ignore: cast_nullable_to_non_nullable
as String?,type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as StakeQuestionType,maxPrice: freezed == maxPrice ? _self.maxPrice : maxPrice // ignore: cast_nullable_to_non_nullable
as QuestionMaxPrice,answerText: freezed == answerText ? _self.answerText : answerText // ignore: cast_nullable_to_non_nullable
as QuestionAnswerText?,questionFiles: freezed == questionFiles ? _self._questionFiles : questionFiles // ignore: cast_nullable_to_non_nullable
as List<PackageQuestionFile?>?,answerFiles: freezed == answerFiles ? _self._answerFiles : answerFiles // ignore: cast_nullable_to_non_nullable
as List<PackageQuestionFile?>?,isHidden: null == isHidden ? _self.isHidden : isHidden // ignore: cast_nullable_to_non_nullable
as bool,answerDelay: null == answerDelay ? _self.answerDelay : answerDelay // ignore: cast_nullable_to_non_nullable
as int,subType: null == subType ? _self.subType : subType // ignore: cast_nullable_to_non_nullable
as StakeQuestionSubType,
  ));
}


}

/// @nodoc
@JsonSerializable()

class PackageQuestionUnionSecret implements PackageQuestionUnion {
  const PackageQuestionUnionSecret({required this.id, required this.order, required this.price, required this.text, required this.answerHint, required this.questionComment, required this.type, required this.subType, required final  QuestionAllowedPrices allowedPrices, required this.transferType, this.answerText, final  List<PackageQuestionFile?>? questionFiles, final  List<PackageQuestionFile?>? answerFiles, this.isHidden = false, this.answerDelay = 4000}): _allowedPrices = allowedPrices,_questionFiles = questionFiles,_answerFiles = answerFiles;
  factory PackageQuestionUnionSecret.fromJson(Map<String, dynamic> json) => _$PackageQuestionUnionSecretFromJson(json);

@override final  int? id;
@override final  PackageEntitiesOrder order;
/// Price is null only if price is hidden
@override final  int? price;
/// Question text
@override final  String? text;
/// Hint for the answer
@override final  String? answerHint;
/// Comment or note about the question
@override final  String? questionComment;
@override final  SecretQuestionType type;
/// Subtype of the secret question. customPrice means player can choose cost of question
 final  SecretQuestionSubType subType;
 final  QuestionAllowedPrices _allowedPrices;
 QuestionAllowedPrices get allowedPrices {
  final value = _allowedPrices;
  if (value == null) return null;
  if (_allowedPrices is EqualUnmodifiableListView) return _allowedPrices;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}

 final  QuestionTransferType transferType;
@override final  QuestionAnswerText? answerText;
 final  List<PackageQuestionFile?>? _questionFiles;
@override List<PackageQuestionFile?>? get questionFiles {
  final value = _questionFiles;
  if (value == null) return null;
  if (_questionFiles is EqualUnmodifiableListView) return _questionFiles;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}

 final  List<PackageQuestionFile?>? _answerFiles;
@override List<PackageQuestionFile?>? get answerFiles {
  final value = _answerFiles;
  if (value == null) return null;
  if (_answerFiles is EqualUnmodifiableListView) return _answerFiles;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}

/// Whether the question is hidden
@override@JsonKey() final  bool isHidden;
/// Delay in milliseconds before being able to answer, if applicable
@override@JsonKey() final  int answerDelay;

/// Create a copy of PackageQuestionUnion
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PackageQuestionUnionSecretCopyWith<PackageQuestionUnionSecret> get copyWith => _$PackageQuestionUnionSecretCopyWithImpl<PackageQuestionUnionSecret>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PackageQuestionUnionSecretToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PackageQuestionUnionSecret&&(identical(other.id, id) || other.id == id)&&(identical(other.order, order) || other.order == order)&&(identical(other.price, price) || other.price == price)&&(identical(other.text, text) || other.text == text)&&(identical(other.answerHint, answerHint) || other.answerHint == answerHint)&&(identical(other.questionComment, questionComment) || other.questionComment == questionComment)&&(identical(other.type, type) || other.type == type)&&(identical(other.subType, subType) || other.subType == subType)&&const DeepCollectionEquality().equals(other._allowedPrices, _allowedPrices)&&(identical(other.transferType, transferType) || other.transferType == transferType)&&(identical(other.answerText, answerText) || other.answerText == answerText)&&const DeepCollectionEquality().equals(other._questionFiles, _questionFiles)&&const DeepCollectionEquality().equals(other._answerFiles, _answerFiles)&&(identical(other.isHidden, isHidden) || other.isHidden == isHidden)&&(identical(other.answerDelay, answerDelay) || other.answerDelay == answerDelay));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,order,price,text,answerHint,questionComment,type,subType,const DeepCollectionEquality().hash(_allowedPrices),transferType,answerText,const DeepCollectionEquality().hash(_questionFiles),const DeepCollectionEquality().hash(_answerFiles),isHidden,answerDelay);

@override
String toString() {
  return 'PackageQuestionUnion.secret(id: $id, order: $order, price: $price, text: $text, answerHint: $answerHint, questionComment: $questionComment, type: $type, subType: $subType, allowedPrices: $allowedPrices, transferType: $transferType, answerText: $answerText, questionFiles: $questionFiles, answerFiles: $answerFiles, isHidden: $isHidden, answerDelay: $answerDelay)';
}


}

/// @nodoc
abstract mixin class $PackageQuestionUnionSecretCopyWith<$Res> implements $PackageQuestionUnionCopyWith<$Res> {
  factory $PackageQuestionUnionSecretCopyWith(PackageQuestionUnionSecret value, $Res Function(PackageQuestionUnionSecret) _then) = _$PackageQuestionUnionSecretCopyWithImpl;
@override @useResult
$Res call({
 int? id, PackageEntitiesOrder order, int? price, String? text, String? answerHint, String? questionComment, SecretQuestionType type, SecretQuestionSubType subType, QuestionAllowedPrices allowedPrices, QuestionTransferType transferType, QuestionAnswerText? answerText, List<PackageQuestionFile?>? questionFiles, List<PackageQuestionFile?>? answerFiles, bool isHidden, int answerDelay
});




}
/// @nodoc
class _$PackageQuestionUnionSecretCopyWithImpl<$Res>
    implements $PackageQuestionUnionSecretCopyWith<$Res> {
  _$PackageQuestionUnionSecretCopyWithImpl(this._self, this._then);

  final PackageQuestionUnionSecret _self;
  final $Res Function(PackageQuestionUnionSecret) _then;

/// Create a copy of PackageQuestionUnion
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = freezed,Object? order = null,Object? price = freezed,Object? text = freezed,Object? answerHint = freezed,Object? questionComment = freezed,Object? type = null,Object? subType = null,Object? allowedPrices = freezed,Object? transferType = null,Object? answerText = freezed,Object? questionFiles = freezed,Object? answerFiles = freezed,Object? isHidden = null,Object? answerDelay = null,}) {
  return _then(PackageQuestionUnionSecret(
id: freezed == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int?,order: null == order ? _self.order : order // ignore: cast_nullable_to_non_nullable
as PackageEntitiesOrder,price: freezed == price ? _self.price : price // ignore: cast_nullable_to_non_nullable
as int?,text: freezed == text ? _self.text : text // ignore: cast_nullable_to_non_nullable
as String?,answerHint: freezed == answerHint ? _self.answerHint : answerHint // ignore: cast_nullable_to_non_nullable
as String?,questionComment: freezed == questionComment ? _self.questionComment : questionComment // ignore: cast_nullable_to_non_nullable
as String?,type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as SecretQuestionType,subType: null == subType ? _self.subType : subType // ignore: cast_nullable_to_non_nullable
as SecretQuestionSubType,allowedPrices: freezed == allowedPrices ? _self._allowedPrices : allowedPrices // ignore: cast_nullable_to_non_nullable
as QuestionAllowedPrices,transferType: null == transferType ? _self.transferType : transferType // ignore: cast_nullable_to_non_nullable
as QuestionTransferType,answerText: freezed == answerText ? _self.answerText : answerText // ignore: cast_nullable_to_non_nullable
as QuestionAnswerText?,questionFiles: freezed == questionFiles ? _self._questionFiles : questionFiles // ignore: cast_nullable_to_non_nullable
as List<PackageQuestionFile?>?,answerFiles: freezed == answerFiles ? _self._answerFiles : answerFiles // ignore: cast_nullable_to_non_nullable
as List<PackageQuestionFile?>?,isHidden: null == isHidden ? _self.isHidden : isHidden // ignore: cast_nullable_to_non_nullable
as bool,answerDelay: null == answerDelay ? _self.answerDelay : answerDelay // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}

/// @nodoc
@JsonSerializable()

class PackageQuestionUnionNoRisk implements PackageQuestionUnion {
  const PackageQuestionUnionNoRisk({required this.id, required this.order, required this.price, required this.text, required this.answerHint, required this.questionComment, required this.type, required this.subType, required this.priceMultiplier, this.answerText, final  List<PackageQuestionFile?>? questionFiles, final  List<PackageQuestionFile?>? answerFiles, this.isHidden = false, this.answerDelay = 4000}): _questionFiles = questionFiles,_answerFiles = answerFiles;
  factory PackageQuestionUnionNoRisk.fromJson(Map<String, dynamic> json) => _$PackageQuestionUnionNoRiskFromJson(json);

@override final  int? id;
@override final  PackageEntitiesOrder order;
/// Price is null only if price is hidden
@override final  int? price;
/// Question text
@override final  String? text;
/// Hint for the answer
@override final  String? answerHint;
/// Comment or note about the question
@override final  String? questionComment;
@override final  NoRiskQuestionType type;
/// Subtype of the no-risk question. forEveryone means everyone answers it, basically giving chances for everyone, instead of one player
 final  NoRiskQuestionSubType subType;
 final  QuestionPriceMultiplier priceMultiplier;
@override final  QuestionAnswerText? answerText;
 final  List<PackageQuestionFile?>? _questionFiles;
@override List<PackageQuestionFile?>? get questionFiles {
  final value = _questionFiles;
  if (value == null) return null;
  if (_questionFiles is EqualUnmodifiableListView) return _questionFiles;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}

 final  List<PackageQuestionFile?>? _answerFiles;
@override List<PackageQuestionFile?>? get answerFiles {
  final value = _answerFiles;
  if (value == null) return null;
  if (_answerFiles is EqualUnmodifiableListView) return _answerFiles;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}

/// Whether the question is hidden
@override@JsonKey() final  bool isHidden;
/// Delay in milliseconds before being able to answer, if applicable
@override@JsonKey() final  int answerDelay;

/// Create a copy of PackageQuestionUnion
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PackageQuestionUnionNoRiskCopyWith<PackageQuestionUnionNoRisk> get copyWith => _$PackageQuestionUnionNoRiskCopyWithImpl<PackageQuestionUnionNoRisk>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PackageQuestionUnionNoRiskToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PackageQuestionUnionNoRisk&&(identical(other.id, id) || other.id == id)&&(identical(other.order, order) || other.order == order)&&(identical(other.price, price) || other.price == price)&&(identical(other.text, text) || other.text == text)&&(identical(other.answerHint, answerHint) || other.answerHint == answerHint)&&(identical(other.questionComment, questionComment) || other.questionComment == questionComment)&&(identical(other.type, type) || other.type == type)&&(identical(other.subType, subType) || other.subType == subType)&&(identical(other.priceMultiplier, priceMultiplier) || other.priceMultiplier == priceMultiplier)&&(identical(other.answerText, answerText) || other.answerText == answerText)&&const DeepCollectionEquality().equals(other._questionFiles, _questionFiles)&&const DeepCollectionEquality().equals(other._answerFiles, _answerFiles)&&(identical(other.isHidden, isHidden) || other.isHidden == isHidden)&&(identical(other.answerDelay, answerDelay) || other.answerDelay == answerDelay));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,order,price,text,answerHint,questionComment,type,subType,priceMultiplier,answerText,const DeepCollectionEquality().hash(_questionFiles),const DeepCollectionEquality().hash(_answerFiles),isHidden,answerDelay);

@override
String toString() {
  return 'PackageQuestionUnion.noRisk(id: $id, order: $order, price: $price, text: $text, answerHint: $answerHint, questionComment: $questionComment, type: $type, subType: $subType, priceMultiplier: $priceMultiplier, answerText: $answerText, questionFiles: $questionFiles, answerFiles: $answerFiles, isHidden: $isHidden, answerDelay: $answerDelay)';
}


}

/// @nodoc
abstract mixin class $PackageQuestionUnionNoRiskCopyWith<$Res> implements $PackageQuestionUnionCopyWith<$Res> {
  factory $PackageQuestionUnionNoRiskCopyWith(PackageQuestionUnionNoRisk value, $Res Function(PackageQuestionUnionNoRisk) _then) = _$PackageQuestionUnionNoRiskCopyWithImpl;
@override @useResult
$Res call({
 int? id, PackageEntitiesOrder order, int? price, String? text, String? answerHint, String? questionComment, NoRiskQuestionType type, NoRiskQuestionSubType subType, QuestionPriceMultiplier priceMultiplier, QuestionAnswerText? answerText, List<PackageQuestionFile?>? questionFiles, List<PackageQuestionFile?>? answerFiles, bool isHidden, int answerDelay
});




}
/// @nodoc
class _$PackageQuestionUnionNoRiskCopyWithImpl<$Res>
    implements $PackageQuestionUnionNoRiskCopyWith<$Res> {
  _$PackageQuestionUnionNoRiskCopyWithImpl(this._self, this._then);

  final PackageQuestionUnionNoRisk _self;
  final $Res Function(PackageQuestionUnionNoRisk) _then;

/// Create a copy of PackageQuestionUnion
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = freezed,Object? order = null,Object? price = freezed,Object? text = freezed,Object? answerHint = freezed,Object? questionComment = freezed,Object? type = null,Object? subType = null,Object? priceMultiplier = null,Object? answerText = freezed,Object? questionFiles = freezed,Object? answerFiles = freezed,Object? isHidden = null,Object? answerDelay = null,}) {
  return _then(PackageQuestionUnionNoRisk(
id: freezed == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int?,order: null == order ? _self.order : order // ignore: cast_nullable_to_non_nullable
as PackageEntitiesOrder,price: freezed == price ? _self.price : price // ignore: cast_nullable_to_non_nullable
as int?,text: freezed == text ? _self.text : text // ignore: cast_nullable_to_non_nullable
as String?,answerHint: freezed == answerHint ? _self.answerHint : answerHint // ignore: cast_nullable_to_non_nullable
as String?,questionComment: freezed == questionComment ? _self.questionComment : questionComment // ignore: cast_nullable_to_non_nullable
as String?,type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as NoRiskQuestionType,subType: null == subType ? _self.subType : subType // ignore: cast_nullable_to_non_nullable
as NoRiskQuestionSubType,priceMultiplier: null == priceMultiplier ? _self.priceMultiplier : priceMultiplier // ignore: cast_nullable_to_non_nullable
as QuestionPriceMultiplier,answerText: freezed == answerText ? _self.answerText : answerText // ignore: cast_nullable_to_non_nullable
as QuestionAnswerText?,questionFiles: freezed == questionFiles ? _self._questionFiles : questionFiles // ignore: cast_nullable_to_non_nullable
as List<PackageQuestionFile?>?,answerFiles: freezed == answerFiles ? _self._answerFiles : answerFiles // ignore: cast_nullable_to_non_nullable
as List<PackageQuestionFile?>?,isHidden: null == isHidden ? _self.isHidden : isHidden // ignore: cast_nullable_to_non_nullable
as bool,answerDelay: null == answerDelay ? _self.answerDelay : answerDelay // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}

/// @nodoc
@JsonSerializable()

class PackageQuestionUnionChoice implements PackageQuestionUnion {
  const PackageQuestionUnionChoice({required this.id, required this.order, required this.price, required this.text, required this.answerHint, required this.questionComment, required this.type, required this.subType, required this.showDelay, required final  List<QuestionChoiceAnswers> answers, this.answerText, final  List<PackageQuestionFile?>? questionFiles, final  List<PackageQuestionFile?>? answerFiles, this.isHidden = false, this.answerDelay = 4000}): _answers = answers,_questionFiles = questionFiles,_answerFiles = answerFiles;
  factory PackageQuestionUnionChoice.fromJson(Map<String, dynamic> json) => _$PackageQuestionUnionChoiceFromJson(json);

@override final  int? id;
@override final  PackageEntitiesOrder order;
/// Price is null only if price is hidden
@override final  int? price;
/// Question text
@override final  String? text;
/// Hint for the answer
@override final  String? answerHint;
/// Comment or note about the question
@override final  String? questionComment;
@override final  ChoiceQuestionType type;
 final  dynamic subType;
 final  QuestionShowDelay showDelay;
 final  List<QuestionChoiceAnswers> _answers;
 List<QuestionChoiceAnswers> get answers {
  if (_answers is EqualUnmodifiableListView) return _answers;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_answers);
}

@override final  QuestionAnswerText? answerText;
 final  List<PackageQuestionFile?>? _questionFiles;
@override List<PackageQuestionFile?>? get questionFiles {
  final value = _questionFiles;
  if (value == null) return null;
  if (_questionFiles is EqualUnmodifiableListView) return _questionFiles;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}

 final  List<PackageQuestionFile?>? _answerFiles;
@override List<PackageQuestionFile?>? get answerFiles {
  final value = _answerFiles;
  if (value == null) return null;
  if (_answerFiles is EqualUnmodifiableListView) return _answerFiles;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}

/// Whether the question is hidden
@override@JsonKey() final  bool isHidden;
/// Delay in milliseconds before being able to answer, if applicable
@override@JsonKey() final  int answerDelay;

/// Create a copy of PackageQuestionUnion
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PackageQuestionUnionChoiceCopyWith<PackageQuestionUnionChoice> get copyWith => _$PackageQuestionUnionChoiceCopyWithImpl<PackageQuestionUnionChoice>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PackageQuestionUnionChoiceToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PackageQuestionUnionChoice&&(identical(other.id, id) || other.id == id)&&(identical(other.order, order) || other.order == order)&&(identical(other.price, price) || other.price == price)&&(identical(other.text, text) || other.text == text)&&(identical(other.answerHint, answerHint) || other.answerHint == answerHint)&&(identical(other.questionComment, questionComment) || other.questionComment == questionComment)&&(identical(other.type, type) || other.type == type)&&const DeepCollectionEquality().equals(other.subType, subType)&&(identical(other.showDelay, showDelay) || other.showDelay == showDelay)&&const DeepCollectionEquality().equals(other._answers, _answers)&&(identical(other.answerText, answerText) || other.answerText == answerText)&&const DeepCollectionEquality().equals(other._questionFiles, _questionFiles)&&const DeepCollectionEquality().equals(other._answerFiles, _answerFiles)&&(identical(other.isHidden, isHidden) || other.isHidden == isHidden)&&(identical(other.answerDelay, answerDelay) || other.answerDelay == answerDelay));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,order,price,text,answerHint,questionComment,type,const DeepCollectionEquality().hash(subType),showDelay,const DeepCollectionEquality().hash(_answers),answerText,const DeepCollectionEquality().hash(_questionFiles),const DeepCollectionEquality().hash(_answerFiles),isHidden,answerDelay);

@override
String toString() {
  return 'PackageQuestionUnion.choice(id: $id, order: $order, price: $price, text: $text, answerHint: $answerHint, questionComment: $questionComment, type: $type, subType: $subType, showDelay: $showDelay, answers: $answers, answerText: $answerText, questionFiles: $questionFiles, answerFiles: $answerFiles, isHidden: $isHidden, answerDelay: $answerDelay)';
}


}

/// @nodoc
abstract mixin class $PackageQuestionUnionChoiceCopyWith<$Res> implements $PackageQuestionUnionCopyWith<$Res> {
  factory $PackageQuestionUnionChoiceCopyWith(PackageQuestionUnionChoice value, $Res Function(PackageQuestionUnionChoice) _then) = _$PackageQuestionUnionChoiceCopyWithImpl;
@override @useResult
$Res call({
 int? id, PackageEntitiesOrder order, int? price, String? text, String? answerHint, String? questionComment, ChoiceQuestionType type, dynamic subType, QuestionShowDelay showDelay, List<QuestionChoiceAnswers> answers, QuestionAnswerText? answerText, List<PackageQuestionFile?>? questionFiles, List<PackageQuestionFile?>? answerFiles, bool isHidden, int answerDelay
});




}
/// @nodoc
class _$PackageQuestionUnionChoiceCopyWithImpl<$Res>
    implements $PackageQuestionUnionChoiceCopyWith<$Res> {
  _$PackageQuestionUnionChoiceCopyWithImpl(this._self, this._then);

  final PackageQuestionUnionChoice _self;
  final $Res Function(PackageQuestionUnionChoice) _then;

/// Create a copy of PackageQuestionUnion
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = freezed,Object? order = null,Object? price = freezed,Object? text = freezed,Object? answerHint = freezed,Object? questionComment = freezed,Object? type = null,Object? subType = freezed,Object? showDelay = null,Object? answers = null,Object? answerText = freezed,Object? questionFiles = freezed,Object? answerFiles = freezed,Object? isHidden = null,Object? answerDelay = null,}) {
  return _then(PackageQuestionUnionChoice(
id: freezed == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int?,order: null == order ? _self.order : order // ignore: cast_nullable_to_non_nullable
as PackageEntitiesOrder,price: freezed == price ? _self.price : price // ignore: cast_nullable_to_non_nullable
as int?,text: freezed == text ? _self.text : text // ignore: cast_nullable_to_non_nullable
as String?,answerHint: freezed == answerHint ? _self.answerHint : answerHint // ignore: cast_nullable_to_non_nullable
as String?,questionComment: freezed == questionComment ? _self.questionComment : questionComment // ignore: cast_nullable_to_non_nullable
as String?,type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as ChoiceQuestionType,subType: freezed == subType ? _self.subType : subType // ignore: cast_nullable_to_non_nullable
as dynamic,showDelay: null == showDelay ? _self.showDelay : showDelay // ignore: cast_nullable_to_non_nullable
as QuestionShowDelay,answers: null == answers ? _self._answers : answers // ignore: cast_nullable_to_non_nullable
as List<QuestionChoiceAnswers>,answerText: freezed == answerText ? _self.answerText : answerText // ignore: cast_nullable_to_non_nullable
as QuestionAnswerText?,questionFiles: freezed == questionFiles ? _self._questionFiles : questionFiles // ignore: cast_nullable_to_non_nullable
as List<PackageQuestionFile?>?,answerFiles: freezed == answerFiles ? _self._answerFiles : answerFiles // ignore: cast_nullable_to_non_nullable
as List<PackageQuestionFile?>?,isHidden: null == isHidden ? _self.isHidden : isHidden // ignore: cast_nullable_to_non_nullable
as bool,answerDelay: null == answerDelay ? _self.answerDelay : answerDelay // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}

/// @nodoc
@JsonSerializable()

class PackageQuestionUnionHidden implements PackageQuestionUnion {
  const PackageQuestionUnionHidden({required this.id, required this.order, required this.price, required this.text, required this.answerHint, required this.questionComment, required this.type, this.answerText, final  List<PackageQuestionFile?>? questionFiles, final  List<PackageQuestionFile?>? answerFiles, this.isHidden = false, this.answerDelay = 4000}): _questionFiles = questionFiles,_answerFiles = answerFiles;
  factory PackageQuestionUnionHidden.fromJson(Map<String, dynamic> json) => _$PackageQuestionUnionHiddenFromJson(json);

@override final  int? id;
@override final  PackageEntitiesOrder order;
/// Price is null only if price is hidden
@override final  int? price;
/// Question text
@override final  String? text;
/// Hint for the answer
@override final  String? answerHint;
/// Comment or note about the question
@override final  String? questionComment;
@override final  HiddenQuestionType type;
@override final  QuestionAnswerText? answerText;
 final  List<PackageQuestionFile?>? _questionFiles;
@override List<PackageQuestionFile?>? get questionFiles {
  final value = _questionFiles;
  if (value == null) return null;
  if (_questionFiles is EqualUnmodifiableListView) return _questionFiles;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}

 final  List<PackageQuestionFile?>? _answerFiles;
@override List<PackageQuestionFile?>? get answerFiles {
  final value = _answerFiles;
  if (value == null) return null;
  if (_answerFiles is EqualUnmodifiableListView) return _answerFiles;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}

/// Whether the question is hidden
@override@JsonKey() final  bool isHidden;
/// Delay in milliseconds before being able to answer, if applicable
@override@JsonKey() final  int answerDelay;

/// Create a copy of PackageQuestionUnion
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PackageQuestionUnionHiddenCopyWith<PackageQuestionUnionHidden> get copyWith => _$PackageQuestionUnionHiddenCopyWithImpl<PackageQuestionUnionHidden>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PackageQuestionUnionHiddenToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PackageQuestionUnionHidden&&(identical(other.id, id) || other.id == id)&&(identical(other.order, order) || other.order == order)&&(identical(other.price, price) || other.price == price)&&(identical(other.text, text) || other.text == text)&&(identical(other.answerHint, answerHint) || other.answerHint == answerHint)&&(identical(other.questionComment, questionComment) || other.questionComment == questionComment)&&(identical(other.type, type) || other.type == type)&&(identical(other.answerText, answerText) || other.answerText == answerText)&&const DeepCollectionEquality().equals(other._questionFiles, _questionFiles)&&const DeepCollectionEquality().equals(other._answerFiles, _answerFiles)&&(identical(other.isHidden, isHidden) || other.isHidden == isHidden)&&(identical(other.answerDelay, answerDelay) || other.answerDelay == answerDelay));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,order,price,text,answerHint,questionComment,type,answerText,const DeepCollectionEquality().hash(_questionFiles),const DeepCollectionEquality().hash(_answerFiles),isHidden,answerDelay);

@override
String toString() {
  return 'PackageQuestionUnion.hidden(id: $id, order: $order, price: $price, text: $text, answerHint: $answerHint, questionComment: $questionComment, type: $type, answerText: $answerText, questionFiles: $questionFiles, answerFiles: $answerFiles, isHidden: $isHidden, answerDelay: $answerDelay)';
}


}

/// @nodoc
abstract mixin class $PackageQuestionUnionHiddenCopyWith<$Res> implements $PackageQuestionUnionCopyWith<$Res> {
  factory $PackageQuestionUnionHiddenCopyWith(PackageQuestionUnionHidden value, $Res Function(PackageQuestionUnionHidden) _then) = _$PackageQuestionUnionHiddenCopyWithImpl;
@override @useResult
$Res call({
 int? id, PackageEntitiesOrder order, int? price, String? text, String? answerHint, String? questionComment, HiddenQuestionType type, QuestionAnswerText? answerText, List<PackageQuestionFile?>? questionFiles, List<PackageQuestionFile?>? answerFiles, bool isHidden, int answerDelay
});




}
/// @nodoc
class _$PackageQuestionUnionHiddenCopyWithImpl<$Res>
    implements $PackageQuestionUnionHiddenCopyWith<$Res> {
  _$PackageQuestionUnionHiddenCopyWithImpl(this._self, this._then);

  final PackageQuestionUnionHidden _self;
  final $Res Function(PackageQuestionUnionHidden) _then;

/// Create a copy of PackageQuestionUnion
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = freezed,Object? order = null,Object? price = freezed,Object? text = freezed,Object? answerHint = freezed,Object? questionComment = freezed,Object? type = null,Object? answerText = freezed,Object? questionFiles = freezed,Object? answerFiles = freezed,Object? isHidden = null,Object? answerDelay = null,}) {
  return _then(PackageQuestionUnionHidden(
id: freezed == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int?,order: null == order ? _self.order : order // ignore: cast_nullable_to_non_nullable
as PackageEntitiesOrder,price: freezed == price ? _self.price : price // ignore: cast_nullable_to_non_nullable
as int?,text: freezed == text ? _self.text : text // ignore: cast_nullable_to_non_nullable
as String?,answerHint: freezed == answerHint ? _self.answerHint : answerHint // ignore: cast_nullable_to_non_nullable
as String?,questionComment: freezed == questionComment ? _self.questionComment : questionComment // ignore: cast_nullable_to_non_nullable
as String?,type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as HiddenQuestionType,answerText: freezed == answerText ? _self.answerText : answerText // ignore: cast_nullable_to_non_nullable
as QuestionAnswerText?,questionFiles: freezed == questionFiles ? _self._questionFiles : questionFiles // ignore: cast_nullable_to_non_nullable
as List<PackageQuestionFile?>?,answerFiles: freezed == answerFiles ? _self._answerFiles : answerFiles // ignore: cast_nullable_to_non_nullable
as List<PackageQuestionFile?>?,isHidden: null == isHidden ? _self.isHidden : isHidden // ignore: cast_nullable_to_non_nullable
as bool,answerDelay: null == answerDelay ? _self.answerDelay : answerDelay // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}

// dart format on
