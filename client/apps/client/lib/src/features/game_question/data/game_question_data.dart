import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:openquester/openquester.dart';

part 'game_question_data.freezed.dart';
part 'game_question_data.g.dart';

@freezed
abstract class GameQuestionData with _$GameQuestionData {
  const factory GameQuestionData({String? text, PackageQuestionFile? file}) =
      _GameQuestionData;

  factory GameQuestionData.fromJson(Map<String, dynamic> json) =>
      _$GameQuestionDataFromJson(json);
}
