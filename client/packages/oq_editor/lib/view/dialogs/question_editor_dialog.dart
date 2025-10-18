import 'package:flutter/material.dart';
import 'package:nb_utils/nb_utils.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/models/oq_editor_translations.dart';

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

  @override
  void initState() {
    super.initState();
    _initializeFromQuestion();
  }

  void _initializeFromQuestion() {
    final q = widget.question;

    if (q == null) {
      // New question - defaults
      _questionType = QuestionType.simple;
      _textController = TextEditingController(text: 'New Question');
      _priceController = TextEditingController(text: '100');
      _answerTextController = TextEditingController(text: 'Answer');
      _answerHintController = TextEditingController();
      _questionCommentController = TextEditingController();
      _answerDelayController = TextEditingController(text: '5000');
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
  void dispose() {
    _textController.dispose();
    _priceController.dispose();
    _answerTextController.dispose();
    _answerHintController.dispose();
    _questionCommentController.dispose();
    _answerDelayController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(
        widget.question == null
            ? widget.translations.addQuestion
            : widget.translations.editQuestion,
      ),
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
                  decoration: const InputDecoration(
                    labelText: 'Question Type',
                    border: OutlineInputBorder(),
                    filled: true,
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
                    filled: true,
                  ),
                  maxLines: 3,
                  maxLength: 500,
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return widget.translations.fieldRequired;
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                // Price
                TextFormField(
                  controller: _priceController,
                  decoration: InputDecoration(
                    labelText: widget.translations.questionPrice,
                    border: const OutlineInputBorder(),
                    filled: true,
                    suffixText: 'pts',
                  ),
                  keyboardType: TextInputType.number,
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return widget.translations.fieldRequired;
                    }
                    final price = int.tryParse(value);
                    if (price == null || price < 0) {
                      return 'Enter a valid positive number';
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
                      filled: true,
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
                  decoration: const InputDecoration(
                    labelText: 'Answer Hint (optional)',
                    border: OutlineInputBorder(),
                    filled: true,
                    helperText: 'Hint to help players answer',
                  ),
                  maxLines: 2,
                  maxLength: 200,
                ),
                const SizedBox(height: 16),

                TextFormField(
                  controller: _questionCommentController,
                  decoration: const InputDecoration(
                    labelText: 'Question Comment (optional)',
                    border: OutlineInputBorder(),
                    filled: true,
                    helperText: 'Additional context or notes',
                  ),
                  maxLines: 2,
                  maxLength: 200,
                ),
                const SizedBox(height: 16),

                TextFormField(
                  controller: _answerDelayController,
                  decoration: const InputDecoration(
                    labelText: 'Answer Delay',
                    border: OutlineInputBorder(),
                    filled: true,
                    suffixText: 'ms',
                    helperText: 'Time before showing answer',
                  ),
                  keyboardType: TextInputType.number,
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return 'Required';
                    }
                    final delay = int.tryParse(value);
                    if (delay == null || delay < 0) {
                      return 'Enter a valid number';
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
                    title: const Text('Is Hidden'),
                    subtitle: const Text('Hide this question from players'),
                    contentPadding: EdgeInsets.zero,
                  ),

                const SizedBox(height: 16),

                // Type-specific fields
                ..._buildTypeSpecificFields(),

                const SizedBox(height: 16),

                // Type-specific info card
                _buildTypeSpecificInfo(),
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
      QuestionType.simple => 'Simple',
      QuestionType.stake => 'Stake',
      QuestionType.secret => 'Secret',
      QuestionType.noRisk => 'No Risk',
      QuestionType.choice => 'Choice',
      QuestionType.hidden => 'Hidden',
      QuestionType.$unknown => 'Unknown',
    };
  }

  Widget _buildTypeSpecificInfo() {
    final info = switch (_questionType) {
      QuestionType.simple => 'Basic question type with standard answer',
      QuestionType.stake => 'Players bid on this question before answering',
      QuestionType.secret => 'Question can be transferred to another player',
      QuestionType.noRisk => "Wrong answer doesn't subtract points",
      QuestionType.choice =>
        'Multiple choice question (add choices in full editor)',
      QuestionType.hidden => 'Question with hidden answer until revealed',
      QuestionType.$unknown => 'Unknown question type',
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
        decoration: const InputDecoration(
          labelText: 'Stake SubType',
          border: OutlineInputBorder(),
          filled: true,
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
        decoration: const InputDecoration(
          labelText: 'Max Price (optional)',
          border: OutlineInputBorder(),
          filled: true,
          helperText: 'Maximum stake allowed',
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
        decoration: const InputDecoration(
          labelText: 'Secret SubType',
          border: OutlineInputBorder(),
          filled: true,
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
        decoration: const InputDecoration(
          labelText: 'Transfer Type',
          border: OutlineInputBorder(),
          filled: true,
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
                    'Allowed Prices',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  IconButton(
                    icon: const Icon(Icons.add),
                    onPressed: _addAllowedPrice,
                  ),
                ],
              ),
              if (_secretAllowedPrices.isEmpty)
                const Text(
                  'No prices set (defaults: 100, 200, 300, 400, 500)',
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
        decoration: const InputDecoration(
          labelText: 'NoRisk SubType',
          border: OutlineInputBorder(),
          filled: true,
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
        decoration: const InputDecoration(
          labelText: 'Price Multiplier',
          border: OutlineInputBorder(),
          filled: true,
          helperText: 'Multiplier for question price',
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
        decoration: const InputDecoration(
          labelText: 'Show Delay',
          border: OutlineInputBorder(),
          filled: true,
          suffixText: 'ms',
          helperText: 'Delay before showing choices',
        ),
        keyboardType: TextInputType.number,
        onChanged: (value) {
          _choiceShowDelay = int.tryParse(value) ?? 3000;
        },
        validator: (value) {
          if (value == null || value.trim().isEmpty) {
            return 'Required';
          }
          final delay = int.tryParse(value);
          if (delay == null || delay < 0) {
            return 'Enter a valid number';
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
                    'Choice Answers (${_choiceAnswers.length}/8)',
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
                const Text('Add 2-8 answer choices').paddingAll(8)
              else
                ..._choiceAnswers.asMap().entries.map((entry) {
                  final index = entry.key;
                  final answer = entry.value;
                  return ListTile(
                    leading: CircleAvatar(
                      child: Text('${index + 1}'),
                    ),
                    title: Text(answer.text ?? 'Empty'),
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
        title: const Text('Add Allowed Price'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(
            labelText: 'Price',
            border: OutlineInputBorder(),
          ),
          keyboardType: TextInputType.number,
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              final price = int.tryParse(controller.text);
              if (price != null && price > 0) {
                Navigator.pop(context, price);
              }
            },
            child: const Text('Add'),
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
        title: const Text('Add Choice Answer'),
        content: TextField(
          controller: textController,
          decoration: const InputDecoration(
            labelText: 'Answer Text',
            border: OutlineInputBorder(),
          ),
          maxLength: 100,
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              final text = textController.text.trim();
              if (text.isNotEmpty) {
                Navigator.pop(context, text);
              }
            },
            child: const Text('Add'),
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
        title: const Text('Edit Choice Answer'),
        content: TextField(
          controller: textController,
          decoration: const InputDecoration(
            labelText: 'Answer Text',
            border: OutlineInputBorder(),
          ),
          maxLength: 100,
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              final text = textController.text.trim();
              if (text.isNotEmpty) {
                Navigator.pop(context, text);
              }
            },
            child: const Text('Save'),
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

  void _saveQuestion() {
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
        );
    }

    Navigator.pop(context, QuestionEditResult(question: question));
  }
}
