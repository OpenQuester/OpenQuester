# OpenQuester Flutter Client

The Flutter frontend for OpenQuester - an open-source multiplayer quiz game platform.

## 🏗️ Architecture

### Project Structure

```text
.
├── apps/
│   └── client/              # Flutter application
├── packages/
│   ├── openapi/             # Generated OpenAPI client
│   ├── oq_shared/           # Shared utilities and components
│   ├── oq_editor/           # Package editor implementation
│   ├── oq_compress/         # Package compression utilities
│   └── siq_file/            # SIQ file format support
└── pubspec.yaml             # Melos workspace configuration
```

### Flutter Application Structure

```text
lib/
├── src/
│   ├── core/
│   │   ├── application/
│   │   ├── controllers/
│   │   ├── env.dart
│   │   ├── get_it.dart
│   │   ├── router.dart
│   │   └── theme.dart
│   ├── features/
│   │   ├── auth/
│   │   ├── games/
│   │   ├── game_lobby/
│   │   ├── package_editor/
│   │   ├── chat/
│   │   └── ...
│   ├── connection/
│   │   ├── api/
│   │   ├── socket/
│   │   ├── auth/
│   │   └── storage/
│   ├── data/
│   ├── ui/
│   └── utils/
└── generated/
```

### Technology Stack

* **Framework**: Flutter 3.35.6+ with Dart 3.9.0+
* **Workspace Management**: Melos 7.8+
* **State Management**: watch_it + get_it
* **Navigation**: auto_route
* **Networking**: dio + socket_io_client
* **Authentication**: oauth2_client
* **Localization**: easy_localization
* **Storage**: shared_preferences + cookie_jar
* **Architecture**: Feature-based modular architecture

---

## 🚀 Getting Started

### Prerequisites

* Flutter SDK 3.35.6 or higher
* Dart SDK 3.9.0 or higher
* Melos 7.8 or higher
* Node.js (for backend development)
* Puro (optional, recommended)

### Install Melos

```bash
dart pub global activate melos
```

### Clone Repository

```bash
git clone https://github.com/OpenQuester/OpenQuester.git
cd OpenQuester
```

### Install Dependencies

```bash
dart pub get
melos bootstrap
```

### Generate Required Files

```bash
melos run pre_build
```

---

## 🛠️ Development

### Common Commands

#### Full Build Pipeline

Generates API client, localization keys, build_runner outputs, indexes, workers, and formats code.

```bash
melos run pre_run
```

#### Pre-build Tasks

```bash
melos run pre_build
```

#### Generate API Client

```bash
melos run gen_api
```

#### Generate build_runner Files

```bash
melos run gen_files
```

#### Generate Localization Keys

```bash
melos run gen_locale
```

#### Generate Barrel Exports

```bash
melos run gen_indexes
```

#### Generate Web Workers

```bash
melos run gen_workers
```

#### Format Code

```bash
melos run format
```

#### Apply Automated Fixes

```bash
melos run fix
```

#### Upgrade Dependencies

```bash
melos run upgrade
```

---

## 🔄 Melos Workspace

### Bootstrap Workspace

```bash
melos bootstrap
```

### List Packages

```bash
melos list
```

### Run a Script

```bash
melos run <script-name>
```

Example:

```bash
melos run pre_build
```

### Execute Command Across Packages

```bash
melos exec -- "<command>"
```

Example:

```bash
melos exec -- "dart analyze"
```

---

## 🧩 Code Generation

The project uses several code generation tools:

### OpenAPI Client

Generated from the backend OpenAPI schema.

```bash
melos run gen_api
```

### Localization Keys

Generated from localization JSON files.

```bash
melos run gen_locale
```

Usage:

```dart
Text(LocaleKeys.my_key.tr())
```

### build_runner

Used for:

* JSON serialization
* Dependency injection
* Routing
* Other generated code

```bash
melos run gen_files
```

### Index Files

Generates barrel exports.

```bash
melos run gen_indexes
```

---

## ✨ Adding New Features

1. Create a feature folder:

```text
lib/src/features/my_feature/
```

2. Add business logic/controller.
3. Create views/widgets.
4. Register routes using `@RoutePage()`.
5. Register dependencies in DI configuration.
6. Add tests.
7. Run:

```bash
melos run pre_build
```

---

## 🌍 Localization Workflow

1. Add translations to:

```text
assets/localization/en-US.json
```

2. Generate localization keys:

```bash
melos run gen_locale
```

3. Use generated keys:

```dart
Text(LocaleKeys.example_key.tr())
```

4. Verify translations in the application.

---

## 🔧 Configuration

### Environment Variables

The application uses `envied`.

Example:

```dart
@Envied(path: '.env')
abstract class Env {
  @EnviedField(varName: 'API_BASE_URL')
  static const String apiBaseUrl = _Env.apiBaseUrl;
}
```

Create:

```env
API_BASE_URL=http://localhost:3000
DISCORD_CLIENT_ID=your_discord_client_id
```

---

## 🧪 Testing

### Run All Tests

```bash
flutter test
```

### Run Specific Test

```bash
flutter test test/features/auth/auth_test.dart
```

### Run Integration Tests

```bash
flutter test integration_test/
```

### Test Structure

```text
test/
├── features/
├── utils/
├── widgets/
└── test_helpers/
```

### Testing Strategy

* Unit tests
* Widget tests
* Integration tests
* Golden tests

---

## 📦 Packages

### openapi

Generated API client based on the OpenAPI specification.

### oq_shared

Shared utilities, widgets, extensions, and common code.

### oq_editor

Quiz package editor implementation.

### oq_compress

Compression and decompression utilities.

### siq_file

SIQ file format parser and generator.

---

## 🤝 Contributing

### Development Guidelines

1. Follow the feature-based architecture.
2. Use dependency injection with get_it.
3. Write tests for new functionality.
4. Localize all user-facing strings.
5. Run formatting before committing:

```bash
melos run format
```

6. Run validation pipeline before opening a PR:

```bash
melos run pre_build
```

7. Keep documentation updated.

### Pull Request Workflow

1. Create a feature branch:

```bash
git checkout -b feature/my-feature
```

2. Implement changes.
3. Add tests.
4. Update documentation.
5. Run:

```bash
melos run pre_build
```

6. Submit PR.
7. Address review feedback.
8. Merge after approval.

### Commit Conventions

```bash
git commit -m "feat(auth): add Discord OAuth integration"
git commit -m "fix(ui): resolve responsive layout issues"
git commit -m "docs(readme): update setup instructions"
git commit -m "test(chat): add message rendering tests"
```

---

## 📖 Documentation

* API documentation is generated from the OpenAPI schema.
* Coding standards are documented in:

```text
.github/instructions/frontend.instructions.md
```

---

## 🐛 Troubleshooting

### Build Failures After Pulling Changes

```bash
melos run pre_build
flutter clean
melos bootstrap
```

### Localization Keys Missing

```bash
melos run gen_locale
```

### build_runner Issues

```bash
melos run clean_build_runner
melos run gen_files
```

### Dependency Problems

```bash
melos bootstrap
```

### Hot Reload Problems

```bash
flutter clean
flutter run
```

---

## 💬 Getting Help

* GitHub Issues: https://github.com/OpenQuester/OpenQuester/issues
* GitHub Discussions: https://github.com/OpenQuester/OpenQuester/discussions

---

## 📄 License

Licensed under the MIT License.

See:

```text
LICENSE
```

for details.

---

## 🙏 Acknowledgments

* Flutter Team
* OpenQuester Contributors
* The Dart and Flutter open-source ecosystem
