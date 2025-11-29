import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:nb_utils/nb_utils.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/controllers/oq_editor_controller.dart';
import 'package:oq_editor/models/media_file_reference.dart';
import 'package:oq_editor/models/oq_editor_translations.dart';
import 'package:oq_editor/models/ui_media_file.dart';
import 'package:oq_editor/utils/media_type_detector.dart';
import 'package:oq_editor/view/dialogs/display_time_dialog.dart';
import 'package:oq_editor/view/widgets/media_files_section.dart';
import 'package:oq_shared/oq_shared.dart';

/// Result data from question editing dialog
class QuestionEditResult {
  const QuestionEditResult({
    required this.question,
  });

  final PackageQuestionUnion question;
}

/// Comprehensive question editor dialog supporting all question types
class QuestionEditorDialog extends StatefulWidget {
  const QuestionEditorDialog({
    required this.question,
    required this.translations,
    required this.roundIndex,
    required this.themeIndex,
    required this.questionIndex,
    super.key,
  });

  final PackageQuestionUnion? question; // null for new question
  final OqEditorTranslations translations;
  final int roundIndex;
  final int themeIndex;
  final int? questionIndex; // null for new question

  @override
  State<QuestionEditorDialog> createState() => _QuestionEditorDialogState();

  /// Show the question editor dialog
  static Future<QuestionEditResult?> show({
    required BuildContext context,
    required OqEditorTranslations translations,
    required int roundIndex,
    required int themeIndex,
    PackageQuestionUnion? question,
    int? questionIndex,
  }) {
    return showDialog<QuestionEditResult>(
      context: context,
      builder: (context) => QuestionEditorDialog(
        question: question,
        translations: translations,
        roundIndex: roundIndex,
        themeIndex: themeIndex,
        questionIndex: questionIndex,
      ),
    );
  }
}

class _QuestionEditorDialogState extends State<QuestionEditorDialog> {
  final _formKey = GlobalKey<FormState>();

  // Controllers for common fields
  late final TextEditingController _textController;
  late final TextEditingController _priceController;
  late final TextEditingController _answerTextController;
  late final TextEditingController _answerHintController;
  late final TextEditingController _questionCommentController;
  late final TextEditingController _answerDelayController;

  // Question type
  late QuestionType _questionType;

  // Common fields
  bool _isHidden = false;

  // Stake-specific fields
  StakeQuestionSubType _stakeSubType = StakeQuestionSubType.simple;
  int? _stakeMaxPrice;

  // Secret-specific fields
  SecretQuestionSubType _secretSubType = SecretQuestionSubType.simple;
  QuestionTransferType _secretTransferType = QuestionTransferType.any;
  List<int> _secretAllowedPrices = [];

  // NoRisk-specific fields
  NoRiskQuestionSubType _noRiskSubType = NoRiskQuestionSubType.simple;
  String _noRiskPriceMultiplier = '1.5';

  // Choice-specific fields
  int _choiceShowDelay = 3000;
  List<QuestionChoiceAnswers> _choiceAnswers = [];

  // Media files with UI metadata (type, order, displayTime)
  final List<UiMediaFile> _questionMediaFiles = [];
  final List<UiMediaFile> _answerMediaFiles = [];

  @override
  void initState() {
    super.initState();
    _initializeFromQuestion();
    _loadExistingMediaFiles();
  }

  void _loadExistingMediaFiles() {
    // Load existing media files from question if editing
    final q = widget.question;
    if (q == null) return;

    final controller = GetIt.I<OqEditorController>();

    // Load question files
    final questionFiles = q.map(
      simple: (s) => s.questionFiles,
      stake: (s) => s.questionFiles,
      secret: (s) => s.questionFiles,
      noRisk: (s) => s.questionFiles,
      choice: (s) => s.questionFiles,
      hidden: (s) => s.questionFiles,
    );

    if (questionFiles != null) {
      for (final file in questionFiles) {
        if (file == null) continue;
        final ref = _getOrCreateMediaFileReference(
          controller,
          file.file.md5,
          file.file.type,
        );
        if (ref != null) {
          // Wrap MediaFileReference with UI metadata from PackageQuestionFile
          final uiFile = UiMediaFile(
            reference: ref,
            type: file.file.type,
            order: file.order,
            displayTime: file.displayTime,
          );
          _questionMediaFiles.add(uiFile);
        }
      }
    }

    // Load answer files
    final answerFiles = q.map(
      simple: (s) => s.answerFiles,
      stake: (s) => s.answerFiles,
      secret: (s) => s.answerFiles,
      noRisk: (s) => s.answerFiles,
      choice: (s) => s.answerFiles,
      hidden: (s) => s.answerFiles,
    );

    if (answerFiles != null) {
      for (final file in answerFiles) {
        if (file == null) continue;
        final ref = _getOrCreateMediaFileReference(
          controller,
          file.file.md5,
          file.file.type,
        );
        if (ref != null) {
          // Wrap MediaFileReference with UI metadata from PackageQuestionFile
          final uiFile = UiMediaFile(
            reference: ref,
            type: file.file.type,
            order: file.order,
            displayTime: file.displayTime,
          );
          _answerMediaFiles.add(uiFile);
        }
      }
    }
  }

  /// Get existing MediaFileReference by hash
  /// Returns null if not found (should not happen for valid package data)
  MediaFileReference? _getOrCreateMediaFileReference(
    OqEditorController controller,
    String hash,
    PackageFileType type,
  ) {
    // Get existing reference (works for both newly added and imported files)
    return controller.getMediaFileByHash(hash);
  }

  void _initializeFromQuestion() {
    final q = widget.question;
    final controller = GetIt.I<OqEditorController>();

    if (q == null) {
      // New question - use saved defaults from controller
      _questionType = QuestionType.simple;
      _textController = TextEditingController();
      _priceController = TextEditingController(
        text: controller.lastUsedPrice.toString(),
      );
      _answerTextController = TextEditingController();
      _answerHintController = TextEditingController();
      _questionCommentController = TextEditingController();
      _answerDelayController = TextEditingController(
        text: controller.lastUsedAnswerDelay.toString(),
      );
    } else {
      // Edit existing question - extract all fields
      _questionType = q.map(
        simple: (_) => QuestionType.simple,
        stake: (_) => QuestionType.stake,
        secret: (_) => QuestionType.secret,
        noRisk: (_) => QuestionType.noRisk,
        choice: (_) => QuestionType.choice,
        hidden: (_) => QuestionType.hidden,
      );

      final text = q.map(
        simple: (s) => s.text ?? '',
        stake: (s) => s.text ?? '',
        secret: (s) => s.text ?? '',
        noRisk: (s) => s.text ?? '',
        choice: (s) => s.text ?? '',
        hidden: (s) => s.text ?? '',
      );

      final price = q.map(
        simple: (s) => s.price ?? 100,
        stake: (s) => s.price ?? 100,
        secret: (s) => s.price ?? 100,
        noRisk: (s) => s.price ?? 100,
        choice: (s) => s.price ?? 100,
        hidden: (s) => s.price ?? 100,
      );

      final answer = q.map(
        simple: (s) => s.answerText ?? '',
        stake: (s) => s.answerText ?? '',
        secret: (s) => s.answerText ?? '',
        noRisk: (s) => s.answerText ?? '',
        choice: (_) => '',
        hidden: (_) => '',
      );

      final answerHint = q.map(
        simple: (s) => s.answerHint ?? '',
        stake: (s) => s.answerHint ?? '',
        secret: (s) => s.answerHint ?? '',
        noRisk: (s) => s.answerHint ?? '',
        choice: (s) => s.answerHint ?? '',
        hidden: (s) => s.answerHint ?? '',
      );

      final questionComment = q.map(
        simple: (s) => s.questionComment ?? '',
        stake: (s) => s.questionComment ?? '',
        secret: (s) => s.questionComment ?? '',
        noRisk: (s) => s.questionComment ?? '',
        choice: (s) => s.questionComment ?? '',
        hidden: (s) => s.questionComment ?? '',
      );

      final answerDelay = q.map(
        simple: (s) => s.answerDelay,
        stake: (s) => s.answerDelay,
        secret: (s) => s.answerDelay,
        noRisk: (s) => s.answerDelay,
        choice: (s) => s.answerDelay,
        hidden: (s) => s.answerDelay,
      );

      _isHidden = q.map(
        simple: (s) => s.isHidden,
        stake: (s) => s.isHidden,
        secret: (s) => s.isHidden,
        noRisk: (s) => s.isHidden,
        choice: (s) => s.isHidden,
        hidden: (_) => true,
      );

      _textController = TextEditingController(text: text);
      _priceController = TextEditingController(text: price.toString());
      _answerTextController = TextEditingController(text: answer);
      _answerHintController = TextEditingController(text: answerHint);
      _questionCommentController = TextEditingController(text: questionComment);
      _answerDelayController = TextEditingController(
        text: answerDelay.toString(),
      );

      // Extract type-specific fields
      q.map(
        simple: (_) {
          // No extra fields
        },
        stake: (s) {
          _stakeSubType = s.subType;
          _stakeMaxPrice = s.maxPrice;
        },
        secret: (s) {
          _secretSubType = s.subType;
          _secretTransferType = s.transferType;
          _secretAllowedPrices = s.allowedPrices?.toList() ?? [];
        },
        noRisk: (s) {
          _noRiskSubType = s.subType;
          _noRiskPriceMultiplier = s.priceMultiplier;
        },
        choice: (s) {
          _choiceShowDelay = s.showDelay;
          _choiceAnswers = s.answers.toList();
        },
        hidden: (_) {
          // No extra fields
        },
      );
    }
  }

  @override
  Future<void> dispose() async {
    super.dispose();
    // Dispose all media file controllers
    try {
      await Future.wait([
        ..._questionMediaFiles.map((e) => e.disposeController()),
        ..._answerMediaFiles.map((e) => e.disposeController()),
      ]);
    } catch (_) {}

    // Dispose text controllers
    _textController.dispose();
    _priceController.dispose();
    _answerTextController.dispose();
    _answerHintController.dispose();
    _questionCommentController.dispose();
    _answerDelayController.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(
        widget.question == null
            ? widget.translations.addQuestion
            : widget.translations.editQuestion,
      ),
      contentPadding: 16.all,
      insetPadding: 16.all,
      content: SizedBox(
        width: 600,
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Question type selector
                DropdownButtonFormField<QuestionType>(
                  initialValue: _questionType,
                  decoration: InputDecoration(
                    labelText: widget.translations.questionTypeLabel,
                    border: const OutlineInputBorder(),
                  ),
                  items: QuestionType.values
                      .where((e) => e != QuestionType.$unknown)
                      .map((type) {
                        return DropdownMenuItem(
                          value: type,
                          child: Text(_getQuestionTypeName(type)),
                        );
                      })
                      .toList(),
                  onChanged: (value) {
                    if (value != null) {
                      setState(() {
                        _questionType = value;
                      });
                    }
                  },
                ),
                const SizedBox(height: 16),

                // Question text
                TextFormField(
                  controller: _textController,
                  decoration: InputDecoration(
                    labelText: widget.translations.questionText,
                    border: const OutlineInputBorder(),
                  ),
                  maxLines: 3,
                  maxLength: 500,
                ),
                const SizedBox(height: 16),

                // Price
                TextFormField(
                  controller: _priceController,
                  decoration: InputDecoration(
                    labelText: widget.translations.questionPrice,
                    border: const OutlineInputBorder(),

                    suffixText: widget.translations.pts,
                  ),
                  keyboardType: TextInputType.number,
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return widget.translations.fieldRequired;
                    }
                    final price = int.tryParse(value);
                    if (price == null || price < 0) {
                      return widget.translations.enterValidPositiveNumber;
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                // Answer (not for choice/hidden)
                if (_questionType != QuestionType.choice &&
                    _questionType != QuestionType.hidden) ...[
                  TextFormField(
                    controller: _answerTextController,
                    decoration: InputDecoration(
                      labelText: widget.translations.questionAnswer,
                      border: const OutlineInputBorder(),
                    ),
                    maxLines: 2,
                    maxLength: 200,
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return widget.translations.fieldRequired;
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                ],

                // Common optional fields
                TextFormField(
                  controller: _answerHintController,
                  decoration: InputDecoration(
                    labelText:
                        '${widget.translations.questionHint}'
                        '(${widget.translations.optional})',
                    border: const OutlineInputBorder(),

                    helperText: widget.translations.questionHintHelper,
                  ),
                  maxLines: 2,
                  maxLength: 200,
                ),
                const SizedBox(height: 16),

                TextFormField(
                  controller: _questionCommentController,
                  decoration: InputDecoration(
                    labelText:
                        '${widget.translations.questionComment} '
                        '(${widget.translations.optional})',
                    border: const OutlineInputBorder(),

                    helperText: widget.translations.questionCommentHelper,
                  ),
                  maxLines: 2,
                  maxLength: 200,
                ),
                const SizedBox(height: 16),

                TextFormField(
                  controller: _answerDelayController,
                  decoration: InputDecoration(
                    labelText: widget.translations.answerDelay,
                    border: const OutlineInputBorder(),

                    suffixText: widget.translations.ms,
                    helperText: widget.translations.answerDelayHint,
                  ),
                  keyboardType: TextInputType.number,
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return widget.translations.required;
                    }
                    final delay = int.tryParse(value);
                    if (delay == null || delay < 0) {
                      return widget.translations.enterValidNumber;
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                // Is Hidden checkbox (not for hidden type)
                if (_questionType != QuestionType.hidden)
                  CheckboxListTile(
                    value: _isHidden,
                    onChanged: (value) {
                      setState(() {
                        _isHidden = value ?? false;
                      });
                    },
                    title: Text(widget.translations.isHidden),
                    subtitle: Text(widget.translations.isHiddenDesc),
                    contentPadding: EdgeInsets.zero,
                  ),

                const SizedBox(height: 16),

                // Type-specific fields
                ..._buildTypeSpecificFields(),

                const SizedBox(height: 16),

                // Type-specific info card
                _buildTypeSpecificInfo(),

                const SizedBox(height: 24),
                const Divider(),
                const SizedBox(height: 16),

                // Media files section
                MediaFilesSection(
                  title: widget.translations.questionMediaFiles,
                  files: _questionMediaFiles,
                  onAdd: () => _addMediaFile(isQuestionMedia: true),
                  onRemove: (int index) {
                    setState(() async {
                      // Dispose controller before removing
                      await _questionMediaFiles[index].disposeController();
                      _questionMediaFiles.removeAt(index);
                    });
                  },
                  onEditDisplayTime: (int index) =>
                      _editMediaDisplayTime(index, isQuestionMedia: true),
                ),

                const SizedBox(height: 16),

                MediaFilesSection(
                  title: widget.translations.answerMediaFiles,
                  files: _answerMediaFiles,
                  onAdd: () => _addMediaFile(isQuestionMedia: false),
                  onRemove: (int index) {
                    setState(() async {
                      // Dispose controller before removing
                      await _answerMediaFiles[index].disposeController();
                      _answerMediaFiles.removeAt(index);
                    });
                  },
                  onEditDisplayTime: (int index) =>
                      _editMediaDisplayTime(index, isQuestionMedia: false),
                ),
              ],
            ),
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text(widget.translations.cancelButton),
        ),
        FilledButton(
          onPressed: _saveQuestion,
          child: Text(widget.translations.saveButton),
        ),
      ],
    );
  }

  String _getQuestionTypeName(QuestionType type) {
    return switch (type) {
      QuestionType.simple => widget.translations.questionTypeSimple,
      QuestionType.stake => widget.translations.questionTypeStake,
      QuestionType.secret => widget.translations.questionTypeSecret,
      QuestionType.noRisk => widget.translations.questionTypeNoRisk,
      QuestionType.choice => widget.translations.questionTypeChoice,
      QuestionType.hidden => widget.translations.questionTypeHidden,
      QuestionType.$unknown => widget.translations.questionTypeUnknown,
    };
  }

  Widget _buildTypeSpecificInfo() {
    final info = switch (_questionType) {
      QuestionType.simple => widget.translations.questionTypeSimpleDesc,
      QuestionType.stake => widget.translations.questionTypeStakeDesc,
      QuestionType.secret => widget.translations.questionTypeSecretDesc,
      QuestionType.noRisk => widget.translations.questionTypeNoRiskDesc,
      QuestionType.choice => widget.translations.questionTypeChoiceDesc,
      QuestionType.hidden => widget.translations.questionTypeHiddenDesc,
      QuestionType.$unknown => widget.translations.questionTypeUnknownDesc,
    };

    return Card(
      color: Theme.of(context).colorScheme.primaryContainer,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Icon(
              Icons.info_outline,
              color: Theme.of(context).colorScheme.onPrimaryContainer,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                info,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onPrimaryContainer,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Builds type-specific fields based on selected question type
  List<Widget> _buildTypeSpecificFields() {
    switch (_questionType) {
      case QuestionType.stake:
        return _buildStakeFields();
      case QuestionType.secret:
        return _buildSecretFields();
      case QuestionType.noRisk:
        return _buildNoRiskFields();
      case QuestionType.choice:
        return _buildChoiceFields();
      case QuestionType.simple:
      case QuestionType.hidden:
      default:
        return [];
    }
  }

  /// Builds Stake-specific fields
  List<Widget> _buildStakeFields() {
    return [
      DropdownButtonFormField<StakeQuestionSubType>(
        initialValue: _stakeSubType,
        decoration: InputDecoration(
          labelText: widget.translations.stakeSubType,
          border: const OutlineInputBorder(),
        ),
        items: StakeQuestionSubType.values
            .where((e) => e != StakeQuestionSubType.$unknown)
            .map((type) {
              return DropdownMenuItem(
                value: type,
                child: Text(type.name.capitalizeFirstLetter()),
              );
            })
            .toList(),
        onChanged: (value) {
          setState(() {
            _stakeSubType = value ?? StakeQuestionSubType.simple;
          });
        },
      ),
      const SizedBox(height: 16),
      TextFormField(
        initialValue: _stakeMaxPrice?.toString() ?? '',
        decoration: InputDecoration(
          labelText:
              '${widget.translations.stakeMaxPrice} '
              '(${widget.translations.optional})',
          border: const OutlineInputBorder(),

          helperText: widget.translations.stakeMaxPriceHint,
        ),
        keyboardType: TextInputType.number,
        onChanged: (value) {
          _stakeMaxPrice = int.tryParse(value);
        },
      ),
      const SizedBox(height: 16),
    ];
  }

  /// Builds Secret-specific fields
  List<Widget> _buildSecretFields() {
    return [
      DropdownButtonFormField<SecretQuestionSubType>(
        initialValue: _secretSubType,
        decoration: InputDecoration(
          labelText: widget.translations.secretSubType,
          border: const OutlineInputBorder(),
        ),
        items: SecretQuestionSubType.values
            .where((e) => e != SecretQuestionSubType.$unknown)
            .map((type) {
              return DropdownMenuItem(
                value: type,
                child: Text(type.name.capitalizeFirstLetter()),
              );
            })
            .toList(),
        onChanged: (value) {
          setState(() {
            _secretSubType = value ?? SecretQuestionSubType.simple;
          });
        },
      ),
      const SizedBox(height: 16),
      DropdownButtonFormField<QuestionTransferType>(
        initialValue: _secretTransferType,
        decoration: InputDecoration(
          labelText: widget.translations.secretTransferType,
          border: const OutlineInputBorder(),
        ),
        items: QuestionTransferType.values
            .where((e) => e != QuestionTransferType.$unknown)
            .map((type) {
              return DropdownMenuItem(
                value: type,
                child: Text(type.name.capitalizeFirstLetter()),
              );
            })
            .toList(),
        onChanged: (value) {
          setState(() {
            _secretTransferType = value ?? QuestionTransferType.any;
          });
        },
      ),
      const SizedBox(height: 16),
      Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    widget.translations.allowedPrices,
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  IconButton(
                    icon: const Icon(Icons.add),
                    onPressed: _addAllowedPrice,
                  ),
                ],
              ),
              if (_secretAllowedPrices.isEmpty)
                Text(
                  widget.translations.noPricesSetDefaults,
                ).paddingAll(8)
              else
                Wrap(
                  spacing: 8,
                  children: _secretAllowedPrices.map((price) {
                    return Chip(
                      label: Text(price.toString()),
                      onDeleted: () {
                        setState(() {
                          _secretAllowedPrices.remove(price);
                        });
                      },
                    );
                  }).toList(),
                ),
            ],
          ),
        ),
      ),
      const SizedBox(height: 16),
    ];
  }

  /// Builds NoRisk-specific fields
  List<Widget> _buildNoRiskFields() {
    return [
      DropdownButtonFormField<NoRiskQuestionSubType>(
        initialValue: _noRiskSubType,
        decoration: InputDecoration(
          labelText: widget.translations.noRiskSubType,
          border: const OutlineInputBorder(),
        ),
        items: NoRiskQuestionSubType.values
            .where((e) => e != NoRiskQuestionSubType.$unknown)
            .map((type) {
              return DropdownMenuItem(
                value: type,
                child: Text(type.name.capitalizeFirstLetter()),
              );
            })
            .toList(),
        onChanged: (value) {
          setState(() {
            _noRiskSubType = value ?? NoRiskQuestionSubType.simple;
          });
        },
      ),
      const SizedBox(height: 16),
      DropdownButtonFormField<String>(
        initialValue: _noRiskPriceMultiplier,
        decoration: InputDecoration(
          labelText: widget.translations.priceMultiplier,
          border: const OutlineInputBorder(),

          helperText: widget.translations.priceMultiplierHint,
        ),
        items: const [
          DropdownMenuItem(value: '1.0', child: Text('1.0x')),
          DropdownMenuItem(value: '1.5', child: Text('1.5x')),
          DropdownMenuItem(value: '2.0', child: Text('2.0x')),
          DropdownMenuItem(value: '2.5', child: Text('2.5x')),
          DropdownMenuItem(value: '3.0', child: Text('3.0x')),
        ],
        onChanged: (value) {
          setState(() {
            _noRiskPriceMultiplier = value ?? '2.0';
          });
        },
      ),
      const SizedBox(height: 16),
    ];
  }

  /// Builds Choice-specific fields
  List<Widget> _buildChoiceFields() {
    return [
      TextFormField(
        initialValue: _choiceShowDelay.toString(),
        decoration: InputDecoration(
          labelText: widget.translations.showDelay,
          border: const OutlineInputBorder(),

          suffixText: widget.translations.ms,
          helperText: widget.translations.showDelayHint,
        ),
        keyboardType: TextInputType.number,
        onChanged: (value) {
          _choiceShowDelay = int.tryParse(value) ?? 3000;
        },
        validator: (value) {
          if (value == null || value.trim().isEmpty) {
            return widget.translations.required;
          }
          final delay = int.tryParse(value);
          if (delay == null || delay < 0) {
            return widget.translations.enterValidNumber;
          }
          return null;
        },
      ),
      const SizedBox(height: 16),
      Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '${widget.translations.choiceAnswers} (${_choiceAnswers.length}/8)',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  IconButton(
                    icon: const Icon(Icons.add),
                    onPressed: _choiceAnswers.length < 8
                        ? _addChoiceAnswer
                        : null,
                  ),
                ],
              ),
              if (_choiceAnswers.isEmpty)
                Text(widget.translations.add2to8Choices).paddingAll(8)
              else
                ..._choiceAnswers.asMap().entries.map((entry) {
                  final index = entry.key;
                  final answer = entry.value;
                  return ListTile(
                    leading: CircleAvatar(
                      child: Text('${index + 1}'),
                    ),
                    title: Text(answer.text ?? widget.translations.emptyAnswer),
                    trailing: IconButton(
                      icon: const Icon(Icons.delete),
                      onPressed: () => _removeChoiceAnswer(index),
                    ),
                    onTap: () => _editChoiceAnswer(index),
                  );
                }),
            ],
          ),
        ),
      ),
      const SizedBox(height: 16),
    ];
  }

  /// Add allowed price dialog
  Future<void> _addAllowedPrice() async {
    final controller = TextEditingController();
    final result = await showDialog<int>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(widget.translations.addAllowedPrice),
        content: TextField(
          controller: controller,
          decoration: InputDecoration(
            labelText: widget.translations.price,
            border: const OutlineInputBorder(),
          ),
          keyboardType: TextInputType.number,
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(widget.translations.cancelButton),
          ),
          TextButton(
            onPressed: () {
              final price = int.tryParse(controller.text);
              if (price != null && price > 0) {
                Navigator.pop(context, price);
              }
            },
            child: Text(widget.translations.addButton),
          ),
        ],
      ),
    );

    if (result != null) {
      setState(() {
        _secretAllowedPrices
          ..add(result)
          ..sort();
      });
    }
  }

  /// Add choice answer dialog
  Future<void> _addChoiceAnswer() async {
    final textController = TextEditingController();

    final result = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(widget.translations.addChoiceAnswer),
        content: TextField(
          controller: textController,
          decoration: InputDecoration(
            labelText: widget.translations.answerText,
            border: const OutlineInputBorder(),
          ),
          maxLength: 100,
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(widget.translations.cancelButton),
          ),
          TextButton(
            onPressed: () {
              final text = textController.text.trim();
              if (text.isNotEmpty) {
                Navigator.pop(context, text);
              }
            },
            child: Text(widget.translations.addButton),
          ),
        ],
      ),
    );

    if (result != null) {
      setState(() {
        final order = _choiceAnswers.isEmpty
            ? 0
            : (_choiceAnswers.last.order) + 1;
        _choiceAnswers.add(
          QuestionChoiceAnswers(
            id: null,
            order: order,
            text: result,
          ),
        );
      });
    }
  }

  /// Edit choice answer dialog
  Future<void> _editChoiceAnswer(int index) async {
    final answer = _choiceAnswers[index];
    final textController = TextEditingController(text: answer.text);

    final result = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(widget.translations.editChoiceAnswer),
        content: TextField(
          controller: textController,
          decoration: InputDecoration(
            labelText: widget.translations.answerText,
            border: const OutlineInputBorder(),
          ),
          maxLength: 100,
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(widget.translations.cancelButton),
          ),
          TextButton(
            onPressed: () {
              final text = textController.text.trim();
              if (text.isNotEmpty) {
                Navigator.pop(context, text);
              }
            },
            child: Text(widget.translations.saveButton),
          ),
        ],
      ),
    );

    if (result != null) {
      setState(() {
        _choiceAnswers[index] = _choiceAnswers[index].copyWith(text: result);
      });
    }
  }

  /// Remove choice answer
  void _removeChoiceAnswer(int index) {
    setState(() {
      _choiceAnswers.removeAt(index);
    });
  }

  /// Add media file (stores file reference, not bytes, for memory efficiency)
  Future<void> _addMediaFile({required bool isQuestionMedia}) async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: MediaTypeDetector.allExtensions,
      );

      if (result == null || result.files.isEmpty) return;

      final file = result.files.first;
      final type = MediaTypeDetector.detectType(file.extension);

      if (type == null) {
        throw Exception('Unsupported file type: ${file.extension}');
      }

      final targetList = isQuestionMedia
          ? _questionMediaFiles
          : _answerMediaFiles;

      final controller = GetIt.I<OqEditorController>();

      final mediaReference = MediaFileReference(
        platformFile: file,
      );

      final uiFile = UiMediaFile(
        reference: mediaReference,
        type: type,
        order: targetList.length,
        displayTime: isQuestionMedia
            ? controller.lastUsedQuestionDisplayTime
            : controller.lastUsedAnswerDisplayTime,
      );

      setState(() {
        targetList.add(uiFile);
      });

      // Register with controller for upload tracking
      // (async, after adding to list)
      await controller.registerMediaFile(mediaReference);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${widget.translations.errorAddingFile}: $e')),
      );
    }
  }

  /// Edit media display time
  Future<void> _editMediaDisplayTime(
    int index, {
    required bool isQuestionMedia,
  }) async {
    final files = isQuestionMedia ? _questionMediaFiles : _answerMediaFiles;
    final file = files[index];

    final result = await DisplayTimeDialog.show(context, file.displayTime);

    if (result != null) {
      setState(() {
        file.displayTime = result;
      });

      // Save to controller for next file
      final controller = GetIt.I<OqEditorController>();
      if (isQuestionMedia) {
        controller.lastUsedQuestionDisplayTime = result;
      } else {
        controller.lastUsedAnswerDisplayTime = result;
      }
    }
  }

  Future<void> _saveQuestion() async {
    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    final text = _textController.text.trim();
    final price = int.tryParse(_priceController.text) ?? 100;
    final answerText = _answerTextController.text.trim();

    // Parse common optional fields
    final answerHint = _answerHintController.text.trim();
    final questionComment = _questionCommentController.text.trim();
    final answerDelay = int.tryParse(_answerDelayController.text) ?? 4000;

    // Get existing order or use 0 for new
    final order =
        widget.question?.map(
          simple: (q) => q.order,
          stake: (q) => q.order,
          secret: (q) => q.order,
          noRisk: (q) => q.order,
          choice: (q) => q.order,
          hidden: (q) => q.order,
        ) ??
        0;

    // Get existing ID
    final id = widget.question?.map(
      simple: (q) => q.id,
      stake: (q) => q.id,
      secret: (q) => q.id,
      noRisk: (q) => q.id,
      choice: (q) => q.id,
      hidden: (q) => q.id,
    );

    // Convert UiMediaFile to PackageQuestionFile with hash
    final controller = GetIt.I<OqEditorController>()
      // Save settings to controller for next question
      ..lastUsedPrice = price
      ..lastUsedAnswerDelay = answerDelay;
    final questionFiles = await Future.wait(
      _questionMediaFiles.map((uiFile) async {
        final hash = await controller.registerMediaFile(uiFile.reference);
        return PackageQuestionFile(
          id: null,
          order: uiFile.order,
          file: FileItem(
            id: null,
            md5: hash,
            type: uiFile.type,
            link: null,
          ),
          displayTime: uiFile.displayTime,
        );
      }),
    );

    final answerFiles = await Future.wait(
      _answerMediaFiles.map((uiFile) async {
        final hash = await controller.registerMediaFile(uiFile.reference);
        return PackageQuestionFile(
          id: null,
          order: uiFile.order,
          file: FileItem(
            id: null,
            md5: hash,
            type: uiFile.type,
            link: null,
          ),
          displayTime: uiFile.displayTime,
        );
      }),
    );

    PackageQuestionUnion question;

    switch (_questionType) {
      case QuestionType.simple:
        question = PackageQuestionUnion.simple(
          id: id,
          order: order,
          type: SimpleQuestionType.simple,
          price: price,
          text: text,
          answerText: answerText.isEmpty ? null : answerText,
          answerHint: answerHint.isEmpty ? null : answerHint,
          questionComment: questionComment.isEmpty ? null : questionComment,
          answerDelay: answerDelay,
          isHidden: _isHidden,
          questionFiles: questionFiles.isEmpty ? null : questionFiles,
          answerFiles: answerFiles.isEmpty ? null : answerFiles,
        );

      case QuestionType.stake:
        question = PackageQuestionUnion.stake(
          id: id,
          order: order,
          type: StakeQuestionType.stake,
          price: price,
          text: text,
          answerText: answerText.isEmpty ? null : answerText,
          answerHint: answerHint.isEmpty ? null : answerHint,
          questionComment: questionComment.isEmpty ? null : questionComment,
          answerDelay: answerDelay,
          isHidden: _isHidden,
          subType: _stakeSubType,
          maxPrice: _stakeMaxPrice,
          questionFiles: questionFiles.isEmpty ? null : questionFiles,
          answerFiles: answerFiles.isEmpty ? null : answerFiles,
        );

      case QuestionType.secret:
        question = PackageQuestionUnion.secret(
          id: id,
          order: order,
          type: SecretQuestionType.secret,
          price: price,
          text: text,
          answerText: answerText.isEmpty ? null : answerText,
          answerHint: answerHint.isEmpty ? null : answerHint,
          questionComment: questionComment.isEmpty ? null : questionComment,
          answerDelay: answerDelay,
          isHidden: _isHidden,
          subType: _secretSubType,
          allowedPrices: _secretAllowedPrices.isEmpty
              ? null
              : _secretAllowedPrices,
          transferType: _secretTransferType,
          questionFiles: questionFiles.isEmpty ? null : questionFiles,
          answerFiles: answerFiles.isEmpty ? null : answerFiles,
        );

      case QuestionType.noRisk:
        question = PackageQuestionUnion.noRisk(
          id: id,
          order: order,
          type: NoRiskQuestionType.noRisk,
          price: price,
          text: text,
          answerText: answerText.isEmpty ? null : answerText,
          answerHint: answerHint.isEmpty ? null : answerHint,
          questionComment: questionComment.isEmpty ? null : questionComment,
          answerDelay: answerDelay,
          isHidden: _isHidden,
          subType: _noRiskSubType,
          priceMultiplier: _noRiskPriceMultiplier,
          questionFiles: questionFiles.isEmpty ? null : questionFiles,
          answerFiles: answerFiles.isEmpty ? null : answerFiles,
        );

      case QuestionType.choice:
        question = PackageQuestionUnion.choice(
          id: id,
          order: order,
          type: ChoiceQuestionType.choice,
          price: price,
          text: text,
          answerText: answerText.isEmpty ? null : answerText,
          answerHint: answerHint.isEmpty ? null : answerHint,
          questionComment: questionComment.isEmpty ? null : questionComment,
          answerDelay: answerDelay,
          isHidden: _isHidden,
          subType: null,
          showDelay: _choiceShowDelay,
          answers: _choiceAnswers,
          questionFiles: questionFiles.isEmpty ? null : questionFiles,
          answerFiles: answerFiles.isEmpty ? null : answerFiles,
        );

      case QuestionType.hidden:
        question = PackageQuestionUnion.hidden(
          id: id,
          order: order,
          type: HiddenQuestionType.hidden,
          price: price,
          text: text,
          answerText: answerText.isEmpty ? null : answerText,
          answerHint: answerHint.isEmpty ? null : answerHint,
          questionComment: questionComment.isEmpty ? null : questionComment,
          answerDelay: answerDelay,
          isHidden: _isHidden,
          questionFiles: questionFiles.isEmpty ? null : questionFiles,
          answerFiles: answerFiles.isEmpty ? null : answerFiles,
        );

      case QuestionType.$unknown:
        // Fallback to simple
        question = PackageQuestionUnion.simple(
          id: id,
          order: order,
          type: SimpleQuestionType.simple,
          price: price,
          text: text,
          answerText: answerText.isEmpty ? null : answerText,
          answerHint: answerHint.isEmpty ? null : answerHint,
          questionComment: questionComment.isEmpty ? null : questionComment,
          answerDelay: answerDelay,
          isHidden: _isHidden,
          questionFiles: questionFiles.isEmpty ? null : questionFiles,
          answerFiles: answerFiles.isEmpty ? null : answerFiles,
        );
    }

    if (mounted) {
      Navigator.pop(
        context,
        QuestionEditResult(
          question: question,
        ),
      );
    }
  }
}
