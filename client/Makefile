# =============================================================================
# CONFIGURATION
# =============================================================================

# Check if the environment variable "DONT_USE_PURO" is set to true
# Puro is a tool for managing multiple Flutter SDK versions
ifeq ($(DONT_USE_PURO),true)
PURO_CMD =
else
PURO_CMD = puro
endif

# =============================================================================
# TIMING UTILITIES
# =============================================================================

# Cross-platform time measurement
# Windows uses PowerShell, Unix-like systems use 'date' command
ifeq ($(OS),Windows_NT)
    GET_TIME = powershell -Command "Get-Date -UFormat %s"
    PRINT_TIME = @powershell -Command "Write-Host '$(1) completed in' $$((Get-Date -UFormat %s) - $(2)) 'seconds'"
else
    GET_TIME = date +%s
    PRINT_TIME = @echo "$(1) completed in $$(($(shell $(GET_TIME)) - $(2))) seconds"
endif

# Reusable macro to print execution time for targets
define time_target
	@echo "========================================"
	$(call PRINT_TIME,$(1),$(2))
	@echo "========================================"
endef

# Reusable macro to print highlighted section headers
define print_section
	@echo ""
	@echo "========================================"
	@echo "  $(1)"
	@echo "========================================"
	@echo ""
endef

# =============================================================================
# MAIN BUILD TARGETS
# =============================================================================

START_TIME := $(shell $(GET_TIME))

# Full build pipeline: generates API, builds packages, runs pre-run tasks, indexes, and formats
pre_build: gen_api pre_build_packages pre_run gen_indexes format
	$(call time_target,pre_build,$(START_TIME))
	@notify-send -u normal "Build Complete" "pre_build finished successfully" 2>/dev/null && paplay /usr/share/sounds/freedesktop/stereo/complete.oga 2>/dev/null || echo "Notification skipped"

# Pre-run tasks: generates files, workers, and localization
pre_run: START_TIME_RUN := $(shell $(GET_TIME))
pre_run: gen_locale gen_files gen_workers
	$(call time_target,pre_run,$(START_TIME_RUN))

# Build pipeline for individual packages (skips API generation)
pre_build_package: pre_run gen_indexes format

# =============================================================================
# CONDITIONAL TARGETS (Package vs Main Project)
# =============================================================================

# When building a Dart package (not the main Flutter app), skip certain tasks
ifeq ($(DART_PACKAGE),true)

gen_locale:
	@echo "Skipping gen_locale (Dart package mode)"

pre_build_packages: 
	@echo "Skipping pre_build_packages (Dart package mode)"

gen_files_packages: 
	@echo "Skipping gen_files_packages (Dart package mode)"

else

# =============================================================================
# MAIN PROJECT TARGETS
# =============================================================================

# Generate localization keys from JSON files
gen_locale:
	$(PURO_CMD) flutter pub run easy_localization:generate -f keys -o locale_keys.g.dart -S assets/localization/

# Build all packages in the packages/ directory
# Supports TARGET_PACKAGES env var to build specific packages only
pre_build_packages:
	@if [ -n "$(TARGET_PACKAGES)" ]; then \
		for pkg_name in $(TARGET_PACKAGES); do \
			pkg="packages/$$pkg_name"; \
			if [ -d "$$pkg" ]; then \
				echo ""; \
				echo "========================================"; \
				echo "  Building package: $$pkg"; \
				echo "========================================"; \
				echo ""; \
				$(MAKE) -C $$pkg -f ../../Makefile pre_build_package DART_PACKAGE=true; \
			else \
				echo "Warning: Package $$pkg not found, skipping..."; \
			fi; \
		done; \
	else \
		for pkg in packages/* ; do \
			if [ -d "$$pkg" ]; then \
				echo ""; \
				echo "========================================"; \
				echo "  Building package: $$pkg"; \
				echo "========================================"; \
				echo ""; \
				$(MAKE) -C $$pkg -f ../../Makefile pre_build_package DART_PACKAGE=true; \
			fi; \
		done; \
	fi

# Run code generation for all packages
gen_files_packages:
	@for pkg in packages/* ; do \
		echo "Running gen_files in $$pkg" ; \
		$(MAKE) -C $$pkg -f ../../Makefile gen_files DART_PACKAGE=true || true ; \
	done

endif

# =============================================================================
# CODE GENERATION TARGETS
# =============================================================================

# Run build_runner to generate code (freezed, json_serializable, etc.)
gen_files: START_TIME_FILES := $(shell $(GET_TIME))
gen_files:
	@if grep -q "sdk: flutter" pubspec.yaml 2>/dev/null; then \
		$(PURO_CMD) flutter pub run build_runner build -d; \
	else \
		$(PURO_CMD) dart run build_runner build -d; \
	fi
	$(call time_target,gen_files,$(START_TIME_FILES))

# Generate index files (barrel exports) for easier imports
gen_indexes: install_index_gen
	$(PURO_CMD) flutter pub global run index_generator

# =============================================================================
# CODE QUALITY TARGETS
# =============================================================================

# Format Dart code according to style guide
format:
	$(PURO_CMD) dart format lib packages/*/lib

# Apply automated fixes for linting issues
fix:
	$(PURO_CMD) dart fix --apply

# Clean build_runner cache and generated files
clean_build_runner:
	@if grep -q "sdk: flutter" pubspec.yaml 2>/dev/null; then \
		$(PURO_CMD) flutter pub run build_runner clean; \
	else \
		$(PURO_CMD) dart run build_runner clean; \
	fi

# =============================================================================
# INSTALLATION & SETUP TARGETS
# =============================================================================

# Install the index_generator tool globally
install_index_gen:
	$(PURO_CMD) dart pub global activate index_generator

# =============================================================================
# PLATFORM-SPECIFIC TARGETS
# =============================================================================

# Create Windows MSIX installer bundle
windows_bundle:
	$(PURO_CMD) dart run msix:create

# =============================================================================
# API GENERATION
# =============================================================================

ifeq ($(DART_PACKAGE),true)
gen_api:
	@echo "Skipping gen_api (Dart package mode)"
else
# Generate OpenAPI client from schema
gen_api:
	$(MAKE) -C ./packages/openapi/ build
endif

# =============================================================================
# WEB WORKERS COMPILATION
# =============================================================================

ifeq ($(DART_PACKAGE),true)
gen_workers:
	@echo "Skipping gen_workers (Dart package mode)"
else

# List of worker files (without the '.g.dart' suffix)
FILES := package_service.web

# Source and output directories
SRC_DIR := ./lib/workers
OUT_DIR := ./web/workers

# Generate output file paths
JS_FILES := $(FILES:%=$(OUT_DIR)/%.g.dart.js)
WASM_FILES := $(FILES:%=$(OUT_DIR)/%.g.dart.wasm)

# Compile Dart worker to JavaScript with optimization level 2
$(OUT_DIR)/%.g.dart.js: $(SRC_DIR)/%.g.dart
	@echo "Compiling $< to JavaScript..."
	$(PURO_CMD) dart compile js -O2 "$<" -o "$@"

# Compile Dart worker to WebAssembly
$(OUT_DIR)/%.g.dart.wasm: $(SRC_DIR)/%.g.dart
	@echo "Compiling $< to WebAssembly..."
	$(PURO_CMD) dart compile wasm "$<" -o "$@"

# Generate all worker files (JS and WASM)
gen_workers: $(JS_FILES) $(WASM_FILES)

endif

# =============================================================================
# DEPENDENCY MANAGEMENT
# =============================================================================

# Upgrade dependencies for a single package (auto-detects Flutter vs Dart)
upgrade_package:
	@if grep -q "sdk: flutter" pubspec.yaml 2>/dev/null; then \
		$(PURO_CMD) flutter pub upgrade $(UPGRADE_FLAGS); \
	else \
		$(PURO_CMD) dart pub upgrade $(UPGRADE_FLAGS); \
	fi

# Upgrade dependencies for main project and all packages
# Usage: make upgrade UPGRADE_FLAGS="--major-versions"
upgrade:
	@if [ -f "pubspec.yaml" ]; then \
		echo ""; \
		echo "========================================"; \
		echo "  Upgrading current package"; \
		echo "========================================"; \
		echo ""; \
		$(MAKE) upgrade_package UPGRADE_FLAGS="$(UPGRADE_FLAGS)"; \
	fi
	@for pkg in packages/* ; do \
		if [ -d "$$pkg" ] && [ -f "$$pkg/pubspec.yaml" ]; then \
			echo ""; \
			echo "========================================"; \
			echo "  Upgrading package: $$pkg"; \
			echo "========================================"; \
			echo ""; \
			$(MAKE) -C $$pkg -f ../../Makefile upgrade_package UPGRADE_FLAGS="$(UPGRADE_FLAGS)"; \
		fi; \
	done
