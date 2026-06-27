import 'package:freezed_annotation/freezed_annotation.dart';

part 'editor_node_id.freezed.dart';

enum EditorNodeKind {
  package,
  round,
  theme,
  question,
}

@freezed
sealed class EditorNodeId with _$EditorNodeId {
  const EditorNodeId._();

  const factory EditorNodeId.package() = PackageEditorNodeId;

  const factory EditorNodeId.round(int roundIndex) = RoundEditorNodeId;

  const factory EditorNodeId.theme(int roundIndex, int themeIndex) =
      ThemeEditorNodeId;

  const factory EditorNodeId.question(
    int roundIndex,
    int themeIndex,
    int questionIndex,
  ) = QuestionEditorNodeId;

  EditorNodeKind get kind {
    return map(
      package: (_) => EditorNodeKind.package,
      round: (_) => EditorNodeKind.round,
      theme: (_) => EditorNodeKind.theme,
      question: (_) => EditorNodeKind.question,
    );
  }

  int? get roundIndex {
    return map(
      package: (_) => null,
      round: (node) => node.roundIndex,
      theme: (node) => node.roundIndex,
      question: (node) => node.roundIndex,
    );
  }

  int? get themeIndex {
    return map(
      package: (_) => null,
      round: (_) => null,
      theme: (node) => node.themeIndex,
      question: (node) => node.themeIndex,
    );
  }

  int? get questionIndex {
    return map(
      package: (_) => null,
      round: (_) => null,
      theme: (_) => null,
      question: (node) => node.questionIndex,
    );
  }
}
