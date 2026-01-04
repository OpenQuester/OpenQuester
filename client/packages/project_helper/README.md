# project_helper

Build automation tool for OpenQuester Dart/Flutter projects. Replaces Makefiles with a pure Dart solution.

## Features

- **Package Management**: Discovers and builds all packages in `packages/` directory
- **Priority System**: Control build order with custom priorities
- **Custom Handlers**: Add package-specific build logic with middleware-like interface
- **Cross-platform**: Works on Linux, macOS, and Windows
- **Puro Support**: Respects `DONT_USE_PURO` environment variable

## Installation

Run the init script from the project root:

```bash
# Linux/macOS
./scripts/init_project.sh

# Windows
scripts\init_project.bat
```

This will:
1. Build the `oqhelper` executable
2. Create symlinks (or copies on Windows) in all Dart project roots

## Usage

From any Dart project directory with `oqhelper`:

```bash
# Run full pre-build process
./oqhelper pre_build

# Skip package building
./oqhelper pre_build --skip-packages

# Skip code formatting
./oqhelper pre_build --skip-format

# Ignore specific packages (default: project_helper)
./oqhelper pre_build --ignore-packages=package1,package2

# Can also use short flags
./oqhelper pre_build -p -f  # skip packages and formatting
./oqhelper pre_build -i package1,package2  # ignore packages
```

## Architecture

### Package Priority

Packages can have custom priorities to control execution order:

- **Default priority**: 999 (runs last)
- **Current package**: 0 (where oqhelper is executed)
- **Negative priority**: Runs before current package
- **Positive priority**: Runs after current package
- **Same priority**: Runs concurrently

Example:
```dart
final packagePriorities = [
  PackagePriority('openapi', -1),  // Runs first
];
```

### Custom Handlers

Create custom build logic for specific packages:

```dart
class OpenApiPackageHandler implements PackageHandler {
  @override
  String get packageName => 'openapi';

  @override
  Future<bool> execute(String packagePath) async {
    // Custom logic: remove lib/src, run swagger_parser
    // ...
    return true;
  }
}
```

Register handlers in `lib/commands/pre_build_command.dart`:

```dart
final packageBuilder = PackageBuilder(
  customHandlers: [
    OpenApiPackageHandler(),
  ],
  packagePriorities: [
    PackagePriority('openapi', -1),
  ],
);
```

## Commands

### pre_build

Runs the complete build pipeline:

1. **Build Packages** (if packages exist)
   - Discovers packages in `packages/` directory
   - Executes custom handlers
   - Runs build_runner for each package
   - Respects priority ordering

2. **Pre-Run Tasks**
   - Generate files (build_runner)
   - Generate web workers (if applicable)
   - Generate localization keys (if applicable)

3. **Generate Indexes**
   - Runs index_generator for barrel exports

4. **Format Code**
   - Formats Dart code with `dart format`

## Environment Variables

- `DONT_USE_PURO`: Set to `"true"` to use system Flutter/Dart instead of puro

## Development

To modify or extend project_helper:

1. Edit files in `lib/`
2. Rebuild: `dart compile exe bin/oqhelper.dart -o bin/oqhelper`
3. Test in a project directory

## License

MIT License - Part of the OpenQuester project
