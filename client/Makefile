# Check if the environment variable "DONT_USE_PURO" is set to true
ifeq ($(DONT_USE_PURO),true)
PURO_CMD =
else
PURO_CMD = puro
endif

pre_build: gen_api pre_build_packages pre_run gen_indexes format 

pre_run: gen_files gen_workers gen_locale 

pre_build_package: pre_run gen_indexes format 

ifeq ($(DART_PACKAGE),true)
gen_locale:
	@echo "Skipping gen_locale"
pre_build_packages: 
	@echo "Skipping pre_build_packages"
gen_files_packages: 
	@echo "Skipping gen_files_packages"
else
gen_locale:
	$(PURO_CMD) flutter pub run easy_localization:generate -f keys -o locale_keys.g.dart -S assets/localization/

pre_build_packages:
	@if [ -n "$(TARGET_PACKAGES)" ]; then \
		for pkg_name in $(TARGET_PACKAGES); do \
			pkg="packages/$$pkg_name"; \
			if [ -d "$$pkg" ]; then \
				echo "" ; \
				echo "========================================" ; \
				echo "  Building package: $$pkg" ; \
				echo "========================================" ; \
				echo "" ; \
				$(MAKE) -C $$pkg -f ../../Makefile pre_build_package DART_PACKAGE=true; \
			else \
				echo "Warning: Package $$pkg not found, skipping..."; \
			fi; \
		done; \
	else \
		for pkg in packages/* ; do \
			if [ -d "$$pkg" ]; then \
				echo "" ; \
				echo "========================================" ; \
				echo "  Building package: $$pkg" ; \
				echo "========================================" ; \
				echo "" ; \
				$(MAKE) -C $$pkg -f ../../Makefile pre_build_package DART_PACKAGE=true; \
			fi; \
		done; \
	fi

gen_files_packages:
	@for pkg in packages/* ; do \
		echo "Running gen_files in $$pkg" ; \
		$(MAKE) -C $$pkg -f ../../Makefile gen_files DART_PACKAGE=true || true ; \
	done
endif

gen_files:
	@if grep -q "sdk: flutter" pubspec.yaml 2>/dev/null; then \
		$(PURO_CMD) flutter pub run build_runner build -d; \
	else \
		$(PURO_CMD) dart run build_runner build -d; \
	fi

gen_indexes: install_index_gen
	$(PURO_CMD) flutter pub global run index_generator

format:
	$(PURO_CMD) dart format lib packages/*/lib

fix:
	$(PURO_CMD) dart fix --apply

install_index_gen:
	$(PURO_CMD) dart pub global activate index_generator

windows_bundle:
	$(PURO_CMD) dart run msix:create

ifeq ($(DART_PACKAGE),true)
gen_api:
	@echo "Skipping gen_locale"
else
gen_api:
	$(MAKE) -C ./packages/openapi/ build
endif

ifeq ($(DART_PACKAGE),true)
gen_workers:
	@echo "Skipping gen_workers"
else
# List of files (without the '.g.dart' suffix)
FILES := package_service.web

# Directories for source and output
SRC_DIR := ./lib/workers
OUT_DIR := ./web/workers

# Generate output file names based on the source file name
JS_FILES := $(FILES:%=$(OUT_DIR)/%.g.dart.js)
WASM_FILES := $(FILES:%=$(OUT_DIR)/%.g.dart.wasm)

# Rule to compile Dart to JS
$(OUT_DIR)/%.g.dart.js: $(SRC_DIR)/%.g.dart
	@echo "Compiling $< to JavaScript..."
	$(PURO_CMD) dart compile js -O2 "$<" -o "$@"

# Rule to compile Dart to WASM
$(OUT_DIR)/%.g.dart.wasm: $(SRC_DIR)/%.g.dart
	@echo "Compiling $< to WebAssembly..."
	$(PURO_CMD) dart compile wasm "$<" -o "$@"

gen_workers:  $(JS_FILES) $(WASM_FILES)
endif


upgrade_package:
	@if grep -q "sdk: flutter" pubspec.yaml 2>/dev/null; then \
		$(PURO_CMD) flutter pub upgrade $(UPGRADE_FLAGS); \
	else \
		$(PURO_CMD) dart pub upgrade $(UPGRADE_FLAGS); \
	fi

upgrade:
	@if [ -f "pubspec.yaml" ]; then \
		echo "" ; \
		echo "========================================" ; \
		echo "  Upgrading current package" ; \
		echo "========================================" ; \
		echo "" ; \
		$(MAKE) upgrade_package UPGRADE_FLAGS="$(UPGRADE_FLAGS)"; \
	fi
	@for pkg in packages/* ; do \
		if [ -d "$$pkg" ] && [ -f "$$pkg/pubspec.yaml" ]; then \
			echo "" ; \
			echo "========================================" ; \
			echo "  Upgrading package: $$pkg" ; \
			echo "========================================" ; \
			echo "" ; \
			$(MAKE) -C $$pkg -f ../../Makefile upgrade_package UPGRADE_FLAGS="$(UPGRADE_FLAGS)"; \
		fi; \
	done