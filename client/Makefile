# Check if the environment variable "DONT_USE_PURO" is set to true
ifeq ($(DONT_USE_PURO),true)
PURO_CMD =
else
PURO_CMD = puro
endif

pre_build: gen_api pre_build_packages pre_run gen_indexes format 

pre_run: gen_files gen_workers gen_locale 


ifeq ($(DART_PACKAGE),true)
gen_locale:
	@echo "Skipping gen_locale"
pre_build_packages: 
	@echo "Skipping pre_build_packages"
gen_files_packages: 
	@echo "Skipping gen_files_packages"
else
gen_locale:
	$(PURO_CMD) dart run easy_localization:generate -f keys -o locale_keys.g.dart -S assets/localization/


API_PATH := ../openapi/dart_sdk/

pre_build_packages:
	@for pkg in packages/* ; do \
		echo "Running pre_build in $$pkg" ; \
		$(MAKE) -C $$pkg -f ../../Makefile pre_build DART_PACKAGE=true || true; \
	done
	echo "Running gen_files in $(API_PATH)" 	
	$(MAKE) -C $(API_PATH) -f ../../client/Makefile  gen_files DART_PACKAGE=true || true

gen_files_packages:
	@for pkg in packages/* ; do \
		echo "Running gen_files in $$pkg" ; \
		$(MAKE) -C $$pkg -f ../../Makefile gen_files DART_PACKAGE=true || true ; \
	done
	echo "Running gen_files in $(API_PATH)";
	$(MAKE) -C $(API_PATH) -f ../../client/Makefile gen_files DART_PACKAGE=true || true;
endif

gen_files:
	$(PURO_CMD) dart run build_runner build -d

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
	$(MAKE) -C ../openapi/dart_sdk/ build
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
