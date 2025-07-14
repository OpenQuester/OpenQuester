// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'package_question_data.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PackageQuestionData {

 int? get id; QuestionType get type; PackageEntitiesOrder get order;/// Price is null only if price is hidden
 int? get price;/// Question text
 String? get text;/// Hint for the answer
 String? get answerHint;/// Comment or note about the question
 String? get questionComment; QuestionSubType get subType; QuestionAnswerText? get answerText; List<PackageQuestionFile?>? get questionFiles; List<PackageQuestionFile?>? get answerFiles; QuestionMaxPrice? get maxPrice; QuestionAllowedPrices? get allowedPrices; QuestionTransferType? get transferType; QuestionPriceMultiplier? get priceMultiplier; QuestionShowDelay? get showDelay; List<QuestionChoiceAnswers?>? get answers;/// Whether the question is hidden
 bool get isHidden;/// Delay in milliseconds before being able to answer, if applicable
 int get answerDelay;
/// Create a copy of PackageQuestionData
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PackageQuestionDataCopyWith<PackageQuestionData> get copyWith => _$PackageQuestionDataCopyWithImpl<PackageQuestionData>(this as PackageQuestionData, _$identity);

  /// Serializes this PackageQuestionData to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PackageQuestionData&&(identical(other.id, id) || other.id == id)&&(identical(other.type, type) || other.type == type)&&(identical(other.order, order) || other.order == order)&&(identical(other.price, price) || other.price == price)&&(identical(other.text, text) || other.text == text)&&(identical(other.answerHint, answerHint) || other.answerHint == answerHint)&&(identical(other.questionComment, questionComment) || other.questionComment == questionComment)&&(identical(other.subType, subType) || other.subType == subType)&&(identical(other.answerText, answerText) || other.answerText == answerText)&&const DeepCollectionEquality().equals(other.questionFiles, questionFiles)&&const DeepCollectionEquality().equals(other.answerFiles, answerFiles)&&(identical(other.maxPrice, maxPrice) || other.maxPrice == maxPrice)&&const DeepCollectionEquality().equals(other.allowedPrices, allowedPrices)&&(identical(other.transferType, transferType) || other.transferType == transferType)&&(identical(other.priceMultiplier, priceMultiplier) || other.priceMultiplier == priceMultiplier)&&(identical(other.showDelay, showDelay) || other.showDelay == showDelay)&&const DeepCollectionEquality().equals(other.answers, answers)&&(identical(other.isHidden, isHidden) || other.isHidden == isHidden)&&(identical(other.answerDelay, answerDelay) || other.answerDelay == answerDelay));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hashAll([runtimeType,id,type,order,price,text,answerHint,questionComment,subType,answerText,const DeepCollectionEquality().hash(questionFiles),const DeepCollectionEquality().hash(answerFiles),maxPrice,const DeepCollectionEquality().hash(allowedPrices),transferType,priceMultiplier,showDelay,const DeepCollectionEquality().hash(answers),isHidden,answerDelay]);

@override
String toString() {
  return 'PackageQuestionData(id: $id, type: $type, order: $order, price: $price, text: $text, answerHint: $answerHint, questionComment: $questionComment, subType: $subType, answerText: $answerText, questionFiles: $questionFiles, answerFiles: $answerFiles, maxPrice: $maxPrice, allowedPrices: $allowedPrices, transferType: $transferType, priceMultiplier: $priceMultiplier, showDelay: $showDelay, answers: $answers, isHidden: $isHidden, answerDelay: $answerDelay)';
}


}

/// @nodoc
abstract mixin class $PackageQuestionDataCopyWith<$Res>  {
  factory $PackageQuestionDataCopyWith(PackageQuestionData value, $Res Function(PackageQuestionData) _then) = _$PackageQuestionDataCopyWithImpl;
@useResult
$Res call({
 int? id, QuestionType type, PackageEntitiesOrder order, int? price, String? text, String? answerHint, String? questionComment, QuestionSubType subType, QuestionAnswerText? answerText, List<PackageQuestionFile?>? questionFiles, List<PackageQuestionFile?>? answerFiles, QuestionMaxPrice? maxPrice, QuestionAllowedPrices? allowedPrices, QuestionTransferType? transferType, QuestionPriceMultiplier? priceMultiplier, QuestionShowDelay? showDelay, List<QuestionChoiceAnswers?>? answers, bool isHidden, int answerDelay
});




}
/// @nodoc
class _$PackageQuestionDataCopyWithImpl<$Res>
    implements $PackageQuestionDataCopyWith<$Res> {
  _$PackageQuestionDataCopyWithImpl(this._self, this._then);

  final PackageQuestionData _self;
  final $Res Function(PackageQuestionData) _then;

/// Create a copy of PackageQuestionData
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = freezed,Object? type = null,Object? order = null,Object? price = freezed,Object? text = freezed,Object? answerHint = freezed,Object? questionComment = freezed,Object? subType = null,Object? answerText = freezed,Object? questionFiles = freezed,Object? answerFiles = freezed,Object? maxPrice = freezed,Object? allowedPrices = freezed,Object? transferType = freezed,Object? priceMultiplier = freezed,Object? showDelay = freezed,Object? answers = freezed,Object? isHidden = null,Object? answerDelay = null,}) {
  return _then(_self.copyWith(
id: freezed == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int?,type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as QuestionType,order: null == order ? _self.order : order // ignore: cast_nullable_to_non_nullable
as PackageEntitiesOrder,price: freezed == price ? _self.price : price // ignore: cast_nullable_to_non_nullable
as int?,text: freezed == text ? _self.text : text // ignore: cast_nullable_to_non_nullable
as String?,answerHint: freezed == answerHint ? _self.answerHint : answerHint // ignore: cast_nullable_to_non_nullable
as String?,questionComment: freezed == questionComment ? _self.questionComment : questionComment // ignore: cast_nullable_to_non_nullable
as String?,subType: null == subType ? _self.subType : subType // ignore: cast_nullable_to_non_nullable
as QuestionSubType,answerText: freezed == answerText ? _self.answerText : answerText // ignore: cast_nullable_to_non_nullable
as QuestionAnswerText?,questionFiles: freezed == questionFiles ? _self.questionFiles : questionFiles // ignore: cast_nullable_to_non_nullable
as List<PackageQuestionFile?>?,answerFiles: freezed == answerFiles ? _self.answerFiles : answerFiles // ignore: cast_nullable_to_non_nullable
as List<PackageQuestionFile?>?,maxPrice: freezed == maxPrice ? _self.maxPrice : maxPrice // ignore: cast_nullable_to_non_nullable
as QuestionMaxPrice?,allowedPrices: freezed == allowedPrices ? _self.allowedPrices : allowedPrices // ignore: cast_nullable_to_non_nullable
as QuestionAllowedPrices?,transferType: freezed == transferType ? _self.transferType : transferType // ignore: cast_nullable_to_non_nullable
as QuestionTransferType?,priceMultiplier: freezed == priceMultiplier ? _self.priceMultiplier : priceMultiplier // ignore: cast_nullable_to_non_nullable
as QuestionPriceMultiplier?,showDelay: freezed == showDelay ? _self.showDelay : showDelay // ignore: cast_nullable_to_non_nullable
as QuestionShowDelay?,answers: freezed == answers ? _self.answers : answers // ignore: cast_nullable_to_non_nullable
as List<QuestionChoiceAnswers?>?,isHidden: null == isHidden ? _self.isHidden : isHidden // ignore: cast_nullable_to_non_nullable
as bool,answerDelay: null == answerDelay ? _self.answerDelay : answerDelay // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [PackageQuestionData].
extension PackageQuestionDataPatterns on PackageQuestionData {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PackageQuestionData value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PackageQuestionData() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PackageQuestionData value)  $default,){
final _that = this;
switch (_that) {
case _PackageQuestionData():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PackageQuestionData value)?  $default,){
final _that = this;
switch (_that) {
case _PackageQuestionData() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int? id,  QuestionType type,  PackageEntitiesOrder order,  int? price,  String? text,  String? answerHint,  String? questionComment,  QuestionSubType subType,  QuestionAnswerText? answerText,  List<PackageQuestionFile?>? questionFiles,  List<PackageQuestionFile?>? answerFiles,  QuestionMaxPrice? maxPrice,  QuestionAllowedPrices? allowedPrices,  QuestionTransferType? transferType,  QuestionPriceMultiplier? priceMultiplier,  QuestionShowDelay? showDelay,  List<QuestionChoiceAnswers?>? answers,  bool isHidden,  int answerDelay)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PackageQuestionData() when $default != null:
return $default(_that.id,_that.type,_that.order,_that.price,_that.text,_that.answerHint,_that.questionComment,_that.subType,_that.answerText,_that.questionFiles,_that.answerFiles,_that.maxPrice,_that.allowedPrices,_that.transferType,_that.priceMultiplier,_that.showDelay,_that.answers,_that.isHidden,_that.answerDelay);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int? id,  QuestionType type,  PackageEntitiesOrder order,  int? price,  String? text,  String? answerHint,  String? questionComment,  QuestionSubType subType,  QuestionAnswerText? answerText,  List<PackageQuestionFile?>? questionFiles,  List<PackageQuestionFile?>? answerFiles,  QuestionMaxPrice? maxPrice,  QuestionAllowedPrices? allowedPrices,  QuestionTransferType? transferType,  QuestionPriceMultiplier? priceMultiplier,  QuestionShowDelay? showDelay,  List<QuestionChoiceAnswers?>? answers,  bool isHidden,  int answerDelay)  $default,) {final _that = this;
switch (_that) {
case _PackageQuestionData():
return $default(_that.id,_that.type,_that.order,_that.price,_that.text,_that.answerHint,_that.questionComment,_that.subType,_that.answerText,_that.questionFiles,_that.answerFiles,_that.maxPrice,_that.allowedPrices,_that.transferType,_that.priceMultiplier,_that.showDelay,_that.answers,_that.isHidden,_that.answerDelay);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int? id,  QuestionType type,  PackageEntitiesOrder order,  int? price,  String? text,  String? answerHint,  String? questionComment,  QuestionSubType subType,  QuestionAnswerText? answerText,  List<PackageQuestionFile?>? questionFiles,  List<PackageQuestionFile?>? answerFiles,  QuestionMaxPrice? maxPrice,  QuestionAllowedPrices? allowedPrices,  QuestionTransferType? transferType,  QuestionPriceMultiplier? priceMultiplier,  QuestionShowDelay? showDelay,  List<QuestionChoiceAnswers?>? answers,  bool isHidden,  int answerDelay)?  $default,) {final _that = this;
switch (_that) {
case _PackageQuestionData() when $default != null:
return $default(_that.id,_that.type,_that.order,_that.price,_that.text,_that.answerHint,_that.questionComment,_that.subType,_that.answerText,_that.questionFiles,_that.answerFiles,_that.maxPrice,_that.allowedPrices,_that.transferType,_that.priceMultiplier,_that.showDelay,_that.answers,_that.isHidden,_that.answerDelay);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PackageQuestionData implements PackageQuestionData {
  const _PackageQuestionData({required this.id, required this.type, required this.order, required this.price, required this.text, required this.answerHint, required this.questionComment, required this.subType, this.answerText, final  List<PackageQuestionFile?>? questionFiles, final  List<PackageQuestionFile?>? answerFiles, this.maxPrice, final  QuestionAllowedPrices? allowedPrices, this.transferType, this.priceMultiplier, this.showDelay, final  List<QuestionChoiceAnswers?>? answers, this.isHidden = false, this.answerDelay = 4000}): _questionFiles = questionFiles,_answerFiles = answerFiles,_allowedPrices = allowedPrices,_answers = answers;
  factory _PackageQuestionData.fromJson(Map<String, dynamic> json) => _$PackageQuestionDataFromJson(json);

@override final  int? id;
@override final  QuestionType type;
@override final  PackageEntitiesOrder order;
/// Price is null only if price is hidden
@override final  int? price;
/// Question text
@override final  String? text;
/// Hint for the answer
@override final  String? answerHint;
/// Comment or note about the question
@override final  String? questionComment;
@override final  QuestionSubType subType;
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

@override final  QuestionMaxPrice? maxPrice;
 final  QuestionAllowedPrices? _allowedPrices;
@override QuestionAllowedPrices? get allowedPrices {
  final value = _allowedPrices;
  if (value == null) return null;
  if (_allowedPrices is EqualUnmodifiableListView) return _allowedPrices;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}

@override final  QuestionTransferType? transferType;
@override final  QuestionPriceMultiplier? priceMultiplier;
@override final  QuestionShowDelay? showDelay;
 final  List<QuestionChoiceAnswers?>? _answers;
@override List<QuestionChoiceAnswers?>? get answers {
  final value = _answers;
  if (value == null) return null;
  if (_answers is EqualUnmodifiableListView) return _answers;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}

/// Whether the question is hidden
@override@JsonKey() final  bool isHidden;
/// Delay in milliseconds before being able to answer, if applicable
@override@JsonKey() final  int answerDelay;

/// Create a copy of PackageQuestionData
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PackageQuestionDataCopyWith<_PackageQuestionData> get copyWith => __$PackageQuestionDataCopyWithImpl<_PackageQuestionData>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PackageQuestionDataToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PackageQuestionData&&(identical(other.id, id) || other.id == id)&&(identical(other.type, type) || other.type == type)&&(identical(other.order, order) || other.order == order)&&(identical(other.price, price) || other.price == price)&&(identical(other.text, text) || other.text == text)&&(identical(other.answerHint, answerHint) || other.answerHint == answerHint)&&(identical(other.questionComment, questionComment) || other.questionComment == questionComment)&&(identical(other.subType, subType) || other.subType == subType)&&(identical(other.answerText, answerText) || other.answerText == answerText)&&const DeepCollectionEquality().equals(other._questionFiles, _questionFiles)&&const DeepCollectionEquality().equals(other._answerFiles, _answerFiles)&&(identical(other.maxPrice, maxPrice) || other.maxPrice == maxPrice)&&const DeepCollectionEquality().equals(other._allowedPrices, _allowedPrices)&&(identical(other.transferType, transferType) || other.transferType == transferType)&&(identical(other.priceMultiplier, priceMultiplier) || other.priceMultiplier == priceMultiplier)&&(identical(other.showDelay, showDelay) || other.showDelay == showDelay)&&const DeepCollectionEquality().equals(other._answers, _answers)&&(identical(other.isHidden, isHidden) || other.isHidden == isHidden)&&(identical(other.answerDelay, answerDelay) || other.answerDelay == answerDelay));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hashAll([runtimeType,id,type,order,price,text,answerHint,questionComment,subType,answerText,const DeepCollectionEquality().hash(_questionFiles),const DeepCollectionEquality().hash(_answerFiles),maxPrice,const DeepCollectionEquality().hash(_allowedPrices),transferType,priceMultiplier,showDelay,const DeepCollectionEquality().hash(_answers),isHidden,answerDelay]);

@override
String toString() {
  return 'PackageQuestionData(id: $id, type: $type, order: $order, price: $price, text: $text, answerHint: $answerHint, questionComment: $questionComment, subType: $subType, answerText: $answerText, questionFiles: $questionFiles, answerFiles: $answerFiles, maxPrice: $maxPrice, allowedPrices: $allowedPrices, transferType: $transferType, priceMultiplier: $priceMultiplier, showDelay: $showDelay, answers: $answers, isHidden: $isHidden, answerDelay: $answerDelay)';
}


}

/// @nodoc
abstract mixin class _$PackageQuestionDataCopyWith<$Res> implements $PackageQuestionDataCopyWith<$Res> {
  factory _$PackageQuestionDataCopyWith(_PackageQuestionData value, $Res Function(_PackageQuestionData) _then) = __$PackageQuestionDataCopyWithImpl;
@override @useResult
$Res call({
 int? id, QuestionType type, PackageEntitiesOrder order, int? price, String? text, String? answerHint, String? questionComment, QuestionSubType subType, QuestionAnswerText? answerText, List<PackageQuestionFile?>? questionFiles, List<PackageQuestionFile?>? answerFiles, QuestionMaxPrice? maxPrice, QuestionAllowedPrices? allowedPrices, QuestionTransferType? transferType, QuestionPriceMultiplier? priceMultiplier, QuestionShowDelay? showDelay, List<QuestionChoiceAnswers?>? answers, bool isHidden, int answerDelay
});




}
/// @nodoc
class __$PackageQuestionDataCopyWithImpl<$Res>
    implements _$PackageQuestionDataCopyWith<$Res> {
  __$PackageQuestionDataCopyWithImpl(this._self, this._then);

  final _PackageQuestionData _self;
  final $Res Function(_PackageQuestionData) _then;

/// Create a copy of PackageQuestionData
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = freezed,Object? type = null,Object? order = null,Object? price = freezed,Object? text = freezed,Object? answerHint = freezed,Object? questionComment = freezed,Object? subType = null,Object? answerText = freezed,Object? questionFiles = freezed,Object? answerFiles = freezed,Object? maxPrice = freezed,Object? allowedPrices = freezed,Object? transferType = freezed,Object? priceMultiplier = freezed,Object? showDelay = freezed,Object? answers = freezed,Object? isHidden = null,Object? answerDelay = null,}) {
  return _then(_PackageQuestionData(
id: freezed == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int?,type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as QuestionType,order: null == order ? _self.order : order // ignore: cast_nullable_to_non_nullable
as PackageEntitiesOrder,price: freezed == price ? _self.price : price // ignore: cast_nullable_to_non_nullable
as int?,text: freezed == text ? _self.text : text // ignore: cast_nullable_to_non_nullable
as String?,answerHint: freezed == answerHint ? _self.answerHint : answerHint // ignore: cast_nullable_to_non_nullable
as String?,questionComment: freezed == questionComment ? _self.questionComment : questionComment // ignore: cast_nullable_to_non_nullable
as String?,subType: null == subType ? _self.subType : subType // ignore: cast_nullable_to_non_nullable
as QuestionSubType,answerText: freezed == answerText ? _self.answerText : answerText // ignore: cast_nullable_to_non_nullable
as QuestionAnswerText?,questionFiles: freezed == questionFiles ? _self._questionFiles : questionFiles // ignore: cast_nullable_to_non_nullable
as List<PackageQuestionFile?>?,answerFiles: freezed == answerFiles ? _self._answerFiles : answerFiles // ignore: cast_nullable_to_non_nullable
as List<PackageQuestionFile?>?,maxPrice: freezed == maxPrice ? _self.maxPrice : maxPrice // ignore: cast_nullable_to_non_nullable
as QuestionMaxPrice?,allowedPrices: freezed == allowedPrices ? _self._allowedPrices : allowedPrices // ignore: cast_nullable_to_non_nullable
as QuestionAllowedPrices?,transferType: freezed == transferType ? _self.transferType : transferType // ignore: cast_nullable_to_non_nullable
as QuestionTransferType?,priceMultiplier: freezed == priceMultiplier ? _self.priceMultiplier : priceMultiplier // ignore: cast_nullable_to_non_nullable
as QuestionPriceMultiplier?,showDelay: freezed == showDelay ? _self.showDelay : showDelay // ignore: cast_nullable_to_non_nullable
as QuestionShowDelay?,answers: freezed == answers ? _self._answers : answers // ignore: cast_nullable_to_non_nullable
as List<QuestionChoiceAnswers?>?,isHidden: null == isHidden ? _self.isHidden : isHidden // ignore: cast_nullable_to_non_nullable
as bool,answerDelay: null == answerDelay ? _self.answerDelay : answerDelay // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}

// dart format on
