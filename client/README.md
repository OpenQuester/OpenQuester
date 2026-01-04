# OpenQuester Flutter Client

The Flutter frontend for OpenQuester - an open-source multiplayer quiz game platform.

## 🏗️ Architecture

### Project Structure

```
lib/
├── src/
│   ├── core/              # Core application logic
│   │   ├── application/    # App initialization and wrapper
│   │   ├── controllers/    # Global controllers (settings, time, etc.)
│   │   ├── env.dart       # Environment configuration
│   │   ├── get_it.dart    # Dependency injection setup
│   │   ├── router.dart    # Auto route configuration
│   │   └── theme.dart     # Material theme configuration
│   ├── features/          # Feature-based modules
│   │   ├── auth/          # Authentication & profile
│   │   ├── games/         # Game listing and management
│   │   ├── game_lobby/    # Game lobby and player management
│   │   ├── package_editor/ # Quiz package creation
│   │   ├── chat/          # Real-time chat system
│   │   └── ...           # Other features
│   ├── connection/        # External service integration
│   │   ├── api/          # REST API client
│   │   ├── socket/       # WebSocket connection
│   │   ├── auth/         # OAuth2 implementation
│   │   └── storage/      # Local storage management
│   ├── data/             # Data models and DTOs
│   ├── ui/               # Shared UI components
│   └── utils/            # Utilities and extensions
├── packages/             # Local packages
│   ├── oq_shared/        # Shared utilities and components
│   ├── oq_editor/        # Package editor implementation
│   ├── oq_compress/      # Package compression utilities
│   └── siq_file/         # SIQ file format support
└── generated/            # Auto-generated files
```

### Technology Stack

- **Framework**: Flutter 3.35.6+ with Dart 3.9.0+
- **State Management**: watch_it + get_it dependency injection
- **Navigation**: auto_route for type-safe routing
- **Networking**: dio for HTTP, socket_io_client for real-time
- **Authentication**: oauth2_client with Discord integration
- **Localization**: easy_localization with auto-generated keys
- **Storage**: shared_preferences + cookie_jar
- **Architecture**: Feature-based modular architecture

## 🚀 Getting Started

### Prerequisites

- **Flutter SDK**: 3.35.6 or higher
- **Dart SDK**: 3.9.0 or higher
- **Puro** (recommended): Flutter version manager
- **Node.js**: For running the backend server

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/OpenQuester/OpenQuester.git
   cd OpenQuester/client
   ```

2. **Install Flutter dependencies**

   ```bash
   flutter pub get
   ```

3. **Initialize project (build helper tool)**

   ```bash
   # From project root
   ./scripts/init_project.sh  # On Linux/Mac
   # or
   scripts\init_project.bat   # On Windows
   ```

4. **Generate required files**
   ```bash
   ./oqhelper pre_build
   ```

### Development Setup

#### Using oqhelper (Recommended)

```bash
# Full setup - generates API, locale keys, indexes, and formats code
./oqhelper pre_build

# Individual commands (coming soon)
# ./oqhelper gen_api           # Generate API client from OpenAPI spec
# ./oqhelper gen_locale        # Generate localization keys
# ./oqhelper gen_indexes       # Generate barrel files
# ./oqhelper format            # Format code
```

#### Manual Setup

```bash
# Generate API client
cd packages/openapi && dart run swagger_parser

# Generate locale keys
flutter pub run easy_localization:generate -f keys -o locale_keys.g.dart -S assets/localization/

# Generate dependency injection
dart run build_runner build

# Format code
dart format lib packages/*/lib
```

## 🛠️ Development

### Code Generation

The project uses several code generation tools:

- **OpenAPI Client**: Auto-generated from `../openapi/schema.json`
- **Localization Keys**: Generated from `assets/localization/*.json`
- **Dependency Injection**: Injectable annotations → get_it registration
- **Routing**: auto_route annotations → route generation
- **JSON Serialization**: json_annotation → serialization code

### Adding New Features

1. **Create feature directory**: `lib/src/features/my_feature/`
2. **Add controller**: Business logic with dependency injection
3. **Create views**: StatelessWidget or WatchingWidget for reactive UI
4. **Add routes**: Use `@RoutePage()` annotation
5. **Register dependencies**: Add to `get_it.dart` configuration
6. **Add tests**: Create corresponding test files

### Localization Workflow

1. **Add translations**: Update `assets/localization/en-US.json`
2. **Generate keys**: Run `./oqhelper pre_build` (or manually: `flutter pub run easy_localization:generate -f keys -o locale_keys.g.dart -S assets/localization/`)
3. **Use in code**: `Text(LocaleKeys.my_key.tr())`
4. **Test**: Verify all strings are localized

## 🔧 Configuration

### Environment Setup

The app uses `envied` for environment configuration:

```dart
// lib/src/core/env.dart
@Envied(path: '.env')
abstract class Env {
  @EnviedField(varName: 'API_BASE_URL')
  static const String apiBaseUrl = _Env.apiBaseUrl;
}
```

Create `.env` file in the client directory:

```env
API_BASE_URL=http://localhost:3000
DISCORD_CLIENT_ID=your_discord_client_id
```

### Build Configuration

- **Analysis Options**: `analysis_options.yaml` - Very good analysis rules
- **Build Config**: `build.yaml` - Code generation settings
- **Flutter Config**: `flutter_launcher_icons.yaml`, `flutter_native_splash.yaml`

## 🧪 Testing

### Running Tests

```bash
# All tests
flutter test

# Specific test file
flutter test test/features/auth/auth_test.dart

# Integration tests
flutter test integration_test/
```

### Test Structure

```
test/
├── features/          # Feature-specific tests
├── utils/            # Utility tests
├── widgets/          # Widget tests
└── test_helpers/     # Test utilities and mocks
```

### Testing Patterns

- **Unit tests**: Controllers and business logic
- **Widget tests**: UI components and screens
- **Integration tests**: End-to-end user flows
- **Golden tests**: Visual regression testing

## 📦 Package Management

### Local Packages

The project includes several local packages:

- **project_helper**: Build automation tool (replaces Makefiles)
- **openapi**: Auto-generated API client from OpenAPI spec
- **oq_shared**: Common utilities, extensions, and base components
- **oq_editor**: Complete package editor with media support
- **oq_compress**: Package compression and decompression
- **siq_file**: SIQ file format parser and generator

### Adding Dependencies

1. **Add to pubspec.yaml**: Include version constraints
2. **Run pub get**: `flutter pub get`
3. **Update build**: `./oqhelper pre_build` if needed
4. **Import**: Use in your Dart files

## 🤝 Contributing

### Development Guidelines

1. **Follow architecture patterns**: Feature-based organization
2. **Use dependency injection**: Register services with get_it
3. **Write tests**: Unit tests for controllers, widget tests for UI
4. **Localize strings**: Use LocaleKeys for all user-facing text
5. **Follow style guide**: Run `make format` before commits
6. **Update documentation**: Keep README and code comments current

### Code Review Process

1. **Create feature branch**: `git checkout -b feature/my-feature`
2. **Implement changes**: Follow coding standards
3. **Add tests**: Ensure good test coverage
4. **Update documentation**: README, comments, etc.
5. **Run pre-build**: `./oqhelper pre_build` to format and validate
6. **Submit PR**: Include description and testing notes
7. **Address feedback**: Respond to review comments
8. **Merge**: Squash and merge when approved

### Commit Conventions

```bash
git commit -m "feat(auth): add Discord OAuth integration"
git commit -m "fix(ui): resolve responsive layout issues"
git commit -m "docs(readme): update setup instructions"
git commit -m "test(chat): add message rendering tests"
```

## 📖 Documentation

- **API Documentation**: Generated from OpenAPI spec
- **Coding Standards**: `/.github/instructions/frontend.instructions.md`

## 🐛 Troubleshooting

### Common Issues

**Build failures after git pull**

```bash
./oqhelper pre_build  # Regenerate all files
flutter clean        # Clean build cache
flutter pub get      # Reinstall dependencies
```

**Localization keys not found**

```bash
./oqhelper pre_build  # Regenerate locale keys (or run init_project script if oqhelper not found)
```

**Dependency injection errors**

```bash
dart run build_runner clean
dart run build_runner build --delete-conflicting-outputs
```

**Hot reload not working**

```bash
flutter clean
flutter run
```

### Getting Help

- **Issues**: [GitHub Issues](https://github.com/OpenQuester/OpenQuester/issues)
- **Discussions**: [GitHub Discussions](https://github.com/OpenQuester/OpenQuester/discussions)
- **Discord**: [OpenQuester Discord Server](#)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

## 🙏 Acknowledgments

- Flutter team for the amazing framework
- Contributors and community members
- Open source packages that make this project possible
