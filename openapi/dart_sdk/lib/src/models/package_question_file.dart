// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'dart:io';

import 'package:freezed_annotation/freezed_annotation.dart';

import 'file_item.dart';
import 'package_entities_order.dart';

part 'package_question_file.freezed.dart';
part 'package_question_file.g.dart';

/// Question media file structure for package creation
@Freezed()
abstract class PackageQuestionFile with _$PackageQuestionFile {
  const factory PackageQuestionFile({
    required int? id,
    required PackageEntitiesOrder order,
    required FileItem file,

    /// Display duration in milliseconds
    required int? displayTime,
  }) = _PackageQuestionFile;
  
  factory PackageQuestionFile.fromJson(Map<String, Object?> json) => _$PackageQuestionFileFromJson(json);
}
