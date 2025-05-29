import 'package:archive/archive_io.dart';
import 'package:collection/collection.dart';
import 'package:crypto/crypto.dart';
import 'package:openapi/openapi.dart';
import 'package:siq_file/src/extensions.dart';
import 'package:xml/xml.dart';

class ContentXmlParser {
  ContentXmlParser(Archive? archive, {this.encodeFiles = false}) {
    _archive = archive;
  }
  final bool encodeFiles;

  Future<void> parse(String rawFile) async {
    final document = XmlDocument.parse(rawFile);
    final package = document.getElement('package')!;
    final metadata = await _parseMetadata(package);
    final roundsXml = package.getElement('rounds')!;
    final rounds = roundsXml.childElements.mapIndexed(_parseRound).toList();

    siqFile = metadata.copyWith(rounds: await Future.wait(rounds));
  }

  Future<PackageRound> _parseRound(int index, XmlElement round) async {
    final name = round.getAttribute('name') ?? '-';
    final attributeDescription = round.getAttribute('description');
    final comment = _getComment(round);
    final description = (attributeDescription ?? comment).nullOnEmpty;
    final themesXml = round.getElement('themes');
    final themes = themesXml?.childElements.mapIndexed(_parseTheme).toList();

    return PackageRound(
      id: null,
      name: name,
      themes: await Future.wait(themes ?? []),
      description: description,
      order: index,
    );
  }

  Future<PackageTheme> _parseTheme(int index, XmlElement theme) async {
    final name = theme.getAttribute('name') ?? '-';
    final comment = _getComment(theme);
    final questions =
        theme
            .getElement('questions')
            ?.children
            .mapIndexed(_parseQuestion)
            .toList() ??
        [];

    return PackageTheme(
      name: name,
      description: comment.nullOnEmpty,
      questions: await Future.wait(questions),
      id: null,
      order: index,
    );
  }

  String? _getComment(XmlElement element) {
    final comment = element
        .getElement('info')
        ?.getElement('comments')
        ?.innerText;
    return comment;
  }

  Future<PackageQuestionUnion> _parseQuestion(
    int index,
    XmlNode question,
  ) async {
    final price = int.tryParse(question.getAttribute('price') ?? '') ?? -1;
    final scenario = question.getElement('scenario');
    final params = question.getElement('params') ?? scenario;

    final questionType =
        QuestionType.values.firstWhereOrNull(
          (e) => e.name == question.getAttribute('type'),
        ) ??
        QuestionType.simple;

    final paramsChildren = params?.childElements ?? [];
    final questionParam =
        paramsChildren.firstWhereOrNull(
          (e) => e.getAttribute('name') == 'question',
        ) ??
        params;
    final questionItems = _getFileItems(questionParam);
    final questionFiles = (await Future.wait(
      questionItems.map(parseFile),
    )).nonNulls;
    final questionComment = questionItems
        .firstWhereOrNull((e) => e.getAttribute('type') == 'say')
        ?.value;

    String? questionText;
    final questionItem = questionParam?.getElement('item');
    final questionItemType =
        questionParam?.getElement('atom')?.getAttribute('type') ??
        questionItem?.getAttribute('type');
    if (questionItemType == null) {
      questionText ??= questionItem?.innerText ?? questionParam?.innerText;
    } else if (questionItemType == 'say') {
      questionText ??= questionParam?.children
          .where((e) => {null, 'say'}.contains(e.getAttribute('type')))
          .map((e) => e.innerText)
          .join(' ');
    }

    final selectionModeString = paramsChildren
        .firstWhereOrNull((e) => e.getAttribute('name') == 'selectionMode')
        ?.innerText;
    final transferType = selectionModeString == 'exceptCurrent'
        ? QuestionTransferType.exceptCurrent
        : QuestionTransferType.any;
    final answerParam = params?.children.firstWhereOrNull(
      (p0) => p0.getAttribute('name') == 'answer',
    );
    final answerItems = _getFileItems(answerParam);
    final answerFiles = (await Future.wait(
      answerItems.map(parseFile),
    )).nonNulls;

    Set<String> getAnswers(String key) =>
        question.getElement(key)?.children.map((e) => e.innerText).toSet() ??
        {};

    final rightAnswers = getAnswers('right');
    final answerText = rightAnswers.join(' / ').nullOnEmpty;
    final wrongAnswers = getAnswers('wrong').join(' / ').nullOnEmpty;
    final hostHint = wrongAnswers.isEmptyOrNull
        ? null
        : 'Wrong answers: $wrongAnswers';

    final packageQuestionFiles = questionFiles
        .mapIndexed(
          (index, e) => PackageQuestionFile(id: null, file: e, order: index),
        )
        .toList();
    final packageAnswerFiles = answerFiles
        .mapIndexed(
          (index, e) => PackageQuestionFile(id: null, file: e, order: index),
        )
        .toList();

    if (questionFiles.isEmpty && questionText.isEmptyOrNull) {
      throw Exception('Question have no files and text to ask users $question');
    }

    if (answerFiles.isEmpty && answerText.isEmptyOrNull) {
      throw Exception('Question have no files and text for answer $question');
    }

    return switch (questionType) {
      QuestionType.simple => PackageQuestionUnion.simple(
        price: price,
        text: questionText,
        type: SimpleQuestionType.simple,
        questionComment: questionComment,
        questionFiles: packageQuestionFiles,
        answerText: answerText,
        answerHint: hostHint,
        answerFiles: packageAnswerFiles,
        id: null,
        order: index,
      ),
      QuestionType.stake => PackageQuestionUnion.stake(
        price: price,
        text: questionText,
        type: StakeQuestionType.stake,
        questionComment: questionComment,
        questionFiles: packageQuestionFiles,
        answerText: answerText,
        answerHint: hostHint,
        answerFiles: packageAnswerFiles,
        id: null,
        maxPrice: null,
        order: index,
      ),
      QuestionType.secret => PackageQuestionUnion.secret(
        price: price,
        text: questionText,
        type: SecretQuestionType.secret,
        questionComment: questionComment,
        questionFiles: packageQuestionFiles,
        answerText: answerText,
        answerHint: hostHint,
        answerFiles: packageAnswerFiles,
        id: null,
        subType: SecretQuestionSubType.simple,
        allowedPrices: null,
        transferType: transferType,
        order: index,
      ),
      QuestionType.noRisk => PackageQuestionUnion.noRisk(
        price: price,
        text: questionText,
        type: NoRiskQuestionType.noRisk,
        questionComment: questionComment,
        questionFiles: packageQuestionFiles,
        answerText: answerText,
        answerHint: hostHint,
        answerFiles: packageAnswerFiles,
        id: null,
        subType: NoRiskQuestionSubType.simple,
        order: index,
        priceMultiplier: '2',
      ),
      QuestionType.hidden => PackageQuestionUnion.hidden(
        price: price,
        text: questionText,
        type: HiddenQuestionType.hidden,
        questionComment: questionComment,
        questionFiles: packageQuestionFiles,
        answerText: answerText,
        answerHint: hostHint,
        answerFiles: packageAnswerFiles,
        isHidden: true,
        id: null,
        order: index,
      ),
      QuestionType.choice => PackageQuestionUnion.choice(
        price: price,
        text: questionText,
        type: ChoiceQuestionType.choice,
        questionComment: questionComment,
        questionFiles: packageQuestionFiles,
        answerText: answerText,
        answerHint: hostHint,
        answerFiles: packageAnswerFiles,
        showDelay: 3000,
        answers: rightAnswers
            .mapIndexed(
              (index, e) =>
                  QuestionChoiceAnswers(id: null, text: e, order: index),
            )
            .toList(),
        id: null,
        subType: null,
        order: index,
      ),
      QuestionType.$unknown => throw Exception('QuestionType.unknown'),
    };
  }

  List<XmlElement> _getFileItems(XmlNode? node) {
    return node?.childElements.where((e) {
          final attribute = e.getAttribute('type');
          return attribute != null;
        }).toList() ??
        [];
  }

  Future<FileItem?> parseFile(XmlElement? item) async {
    final itemType = _getFileType(item);

    final itemHash = await getItemMD5hash(
      itemType: itemType,
      itemFilePath: item?.innerText,
    );
    if (itemHash == null) return null;

    final md5 = itemHash.$2;
    final file = itemType == null
        ? null
        : FileItem(id: null, link: null, md5: md5, type: itemType);

    return file;
  }

  Future<String> getFileMD5(List<int> data) async =>
      md5.convert(data).toString();

  String _formatFileName(String filename) {
    if (filename.startsWith('@')) return filename.replaceFirst('@', '');
    return filename;
  }

  Future<(ArchiveFile, String)?> getItemMD5hash({
    required PackageFileType? itemType,
    required String? itemFilePath,
  }) async {
    final folder = switch (itemType) {
      PackageFileType.image => 'Images',
      PackageFileType.video => 'Video',
      PackageFileType.audio => 'Audio',
      PackageFileType.$unknown => null,
      null => null,
    };
    if (folder == null || itemFilePath == null) {
      return null;
    }

    final filePath = [folder, _formatFileName(itemFilePath)].join('/');

    final cachedHash = filesMD5.entries.firstWhereOrNull(
      (e) => e.value.any((e) => e.path == filePath),
    );
    if (cachedHash != null) {
      return (
        cachedHash.value.firstWhere((e) => e.path == filePath),
        cachedHash.key,
      );
    }

    final archiveFile = _archive?.files.firstWhereOrNull(
      (e) => e.path == filePath,
    );

    archiveFile?.decompress();
    final rawFile = archiveFile?.content;
    if (rawFile == null || rawFile.isEmpty) {
      throw Exception(
        [
          '$filePath not found in archive!',
          '(File path: $itemFilePath)',
        ].join(' '),
      );
    }

    final md5 = await getFileMD5(rawFile);

    // Save archive file to map for re-use
    if (filesMD5.containsKey(md5)) {
      final fileIsInList =
          filesMD5[md5]?.any((e) => e.path == archiveFile?.path) ?? false;
      if (!fileIsInList) filesMD5[md5]!.add(archiveFile!);
    } else {
      filesMD5[md5] = [archiveFile!];
    }

    // Clear hashed and saved file data
    archiveFile?.clear();

    return (archiveFile!, md5);
  }

  PackageFileType? _getFileType(XmlElement? item) {
    final type = item?.getAttribute('type');
    if (type == 'voice') return PackageFileType.audio;
    final itemType = PackageFileType.values.firstWhereOrNull(
      (e) => e.name == type,
    );
    return itemType;
  }

  Future<PackageCreateInputData> _parseMetadata(XmlElement package) async {
    final json = Map<String, dynamic>.fromEntries(
      package.attributes.map((e) => MapEntry(e.localName, e.value)),
    );
    final packageAttributeDescription = json['description']?.toString();
    final comment = _getComment(package);
    final restriction = switch (json['restriction']) {
      '12+' => AgeRestriction.a12,
      '16+' => AgeRestriction.a16,
      '18+' => AgeRestriction.a18,
      _ => AgeRestriction.none,
    };

    const image = PackageFileType.image;
    final logo = await getItemMD5hash(
      itemFilePath: json['logo']?.toString(),
      itemType: image,
    );

    final metadata = PackageCreateInputData(
      title: json['name']?.toString() ?? '',
      description: (packageAttributeDescription ?? comment).nullOnEmpty,
      language: json['language']?.toString().nullOnEmpty,
      ageRestriction: restriction,
      rounds: [],
      tags: [],
      logo: logo == null
          ? null
          : PackageLogoFileInput(
              file: FileInput(md5: logo.$2, type: image),
            ),
    );

    return metadata;
  }

  late PackageCreateInputData siqFile;
  Archive? _archive;
  Map<String, List<ArchiveFile>> filesMD5 = {};
}
