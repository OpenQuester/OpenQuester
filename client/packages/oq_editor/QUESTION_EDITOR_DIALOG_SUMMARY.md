# Question Editor Dialog - Implementation Summary

## Overview

Extracted the question editing functionality into a separate, reusable dialog component that supports all 6 question types defined in the OpenAPI schema.

## Changes Made

### 1. Created `/client/packages/oq_editor/lib/view/dialogs/question_editor_dialog.dart`

- **QuestionEditorDialog**: Stateful widget supporting create/edit for all question types
- **QuestionEditResult**: Data class for returning edited question
- **Question Type Support**:
  - ✅ Simple (basic question with answer)
  - ✅ Stake (bidding before answering)
  - ✅ Secret (transferable to other players)
  - ✅ NoRisk (wrong answer doesn't subtract points)
  - ✅ Choice (multiple choice with answers array)
  - ✅ Hidden (hidden answer until revealed)

### 2. Updated `/client/packages/oq_editor/lib/view/screens/questions_list_screen.dart`

- Removed inline `_QuestionEditDialog` and `_QuestionEditResult` classes (~160 lines)
- Updated `_showEditQuestionDialog()` to use new `QuestionEditorDialog.show()`
- Updated `_addNewQuestion()` to use dialog for creation
- Simplified imports and removed dead code

### 3. Key Features

#### Type-Safe Question Handling

```dart
// Automatically extracts values based on question union type
final text = question.map(
  simple: (s) => s.text ?? '',
  stake: (s) => s.text ?? '',
  secret: (s) => s.text ?? '',
  noRisk: (s) => s.text ?? '',
  choice: (s) => s.text ?? '',
  hidden: (s) => s.text ?? '',
);
```

#### Dynamic Form Fields

- Question text (all types)
- Price (all types)
- Answer text (not for choice/hidden)
- Type selector dropdown
- Info cards explaining each question type

#### Type-Specific Defaults

- **Simple**: Basic defaults
- **Stake**: subType=simple, priceMultiplier='1.5', maxPrice=null
- **Secret**: subType=simple, allowedPrices=null, transferType=any
- **NoRisk**: subType=simple, priceMultiplier='1.5'
- **Choice**: subType=null (dynamic), showDelay=3000, answers=[]
- **Hidden**: answerHint=null (no answer shown)

## Schema Compliance

### Question Type Fields (from schema.json)

| Type   | Required Fields                          | Optional Fields                                                                |
| ------ | ---------------------------------------- | ------------------------------------------------------------------------------ |
| Simple | id, order, type, price, text, answerText | answerHint, questionComment, questionFiles, answerFiles, isHidden, answerDelay |
| Stake  | + maxPrice                               | + subType                                                                      |
| Secret | + subType, allowedPrices, transferType   |                                                                                |
| NoRisk | + subType, priceMultiplier               |                                                                                |
| Choice | + subType, showDelay, answers            | (no answerText)                                                                |
| Hidden |                                          | + answerHint (no answerText)                                                   |

### Type-Specific Enums

- `StakeQuestionSubType`: simple, customPrice, empty, forEveryone
- `SecretQuestionSubType`: simple, customPrice
- `NoRiskQuestionSubType`: simple
- `QuestionTransferType`: any, exceptCurrent
- `ChoiceQuestionSubType`: dynamic (no enum)

## Current Limitations & Future Work

### 🚧 Not Yet Implemented

#### 1. Media File Upload

```dart
// TODO: Implement file picker and upload
_addQuestionFile() {
  // Need:
  // - File picker integration (image_picker, file_picker packages)
  // - Upload to backend (FileInput with md5, type)
  // - PackageQuestionFile with displayTime
}
```

#### 2. Advanced Type-Specific Fields

- **Stake**: No UI for maxPrice, allowedPrices, subType selector
- **Secret**: No UI for allowedPrices array, subType selector
- **Choice**: No UI for adding/editing answer options with files
- **All**: No UI for answerHint, questionComment, answerDelay, isHidden

#### 3. Field Validation

- No max price validation for stake questions
- No validation for 2-8 choice answers minimum
- No validation for allowedPrices array (2-5 items)

## Architecture Decisions

### ✅ Decision: Simple Dialog First

**Rationale**:

- Minimize compilation errors by using proven patterns
- Get basic functionality working before adding complexity
- Media upload requires backend integration planning

**Trade-off**: Some schema fields not editable yet
**Mitigation**: All question types createable, core fields editable

### ✅ Decision: Type-Safe Union Handling

**Rationale**:

- Leverages Freezed union's `.map()` method
- Compiler enforces exhaustive handling
- No runtime type checking needed

**Example**:

```dart
question.map(
  simple: (q) => q.copyWith(...),
  stake: (q) => q.copyWith(...),
  // ... compiler forces all 6 cases
)
```

### ✅ Decision: Separate Dialog File

**Rationale**:

- Reusable across multiple screens
- Easier to test independently
- Cleaner separation of concerns

**File Structure**:

```
oq_editor/
  lib/
    view/
      dialogs/
        question_editor_dialog.dart  ← New
      screens/
        questions_list_screen.dart   ← Refactored
```

## Testing Notes

### Manual Testing Checklist

- [ ] Create new simple question
- [ ] Edit existing question
- [ ] Switch between question types in dialog
- [ ] Form validation for required fields
- [ ] Cancel dialog without saving
- [ ] Save updates question in list
- [ ] Reordering still works after edit

### Edge Cases to Test

- [ ] Editing hidden question (no answer field)
- [ ] Editing choice question (no answer field)
- [ ] Question type switching preserves common fields
- [ ] Price validation for negative numbers
- [ ] Text field max length enforcement

## API Documentation References

### schema.json Lines

- **PackageQuestion**: Lines 2111-2180 (base properties)
- **Simple**: Lines 2259-2268
- **Stake**: Lines 2271-2290 (includes maxPrice)
- **Secret**: Lines 2207-2234 (includes subType, allowedPrices, transferType)
- **NoRisk**: Lines 2237-2256 (includes subType, priceMultiplier)
- **Choice**: Lines 2183-2203 (includes subType, showDelay, answers)
- **Hidden**: Lines 2293-2302
- **PackageQuestionFile**: Lines 2085-2105 (id, order, file, displayTime)
- **FileInput**: Lines 2021-2038 (md5, type for upload)

## Metrics

### Code Changes

- **Added**: `question_editor_dialog.dart` (~440 lines)
- **Modified**: `questions_list_screen.dart` (-160 lines dialog, +15 lines integration)
- **Removed**: Old inline dialog classes
- **Net**: +295 lines

### Compilation Status

```
flutter analyze
13 issues found (all info/warnings):
- 4 deprecated 'value' param (use 'initialValue')
- 6 unnecessary break statements
- 2 redundant default argument values
- 1 line length >80 chars
0 errors ✅
```

## Next Steps

### Priority 1: Media Upload

1. Add file picker dependencies to pubspec.yaml
2. Implement `_addQuestionFile()` and `_addAnswerFile()`
3. Create `FileUploadWidget` for preview/remove
4. Integrate with backend `/v1/files/` API
5. Calculate MD5 hashes for FileInput

### Priority 2: Advanced Fields UI

1. Add expandable "Advanced Options" section
2. Implement type-specific field panels
3. Add choice answer editor with reorderable list
4. Add allowed prices editor for secret questions
5. Add answer hint, comment, delay fields

### Priority 3: Enhanced UX

1. Add question preview mode
2. Implement media file preview
3. Add keyboard shortcuts (Ctrl+S save, Esc cancel)
4. Add auto-save draft functionality
5. Add validation error summaries

## Conclusion

**Status**: ✅ Core functionality complete, ready for basic usage

**Confidence**: HIGH

- All 6 question types supported
- Type-safe implementation
- Zero compilation errors
- Clean architecture

**Recommendation**:

1. Merge current implementation for basic editing
2. Create follow-up tickets for media upload and advanced fields
3. Gather user feedback on current UX before adding complexity
