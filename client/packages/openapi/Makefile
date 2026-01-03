# If DONT_USE_PURO is set to "true", skip the puro wrapper
ifeq ($(DONT_USE_PURO),true)
PURO_CMD =
else
PURO_CMD = puro
endif

# Detect Windows vs. Unix
ifeq ($(OS),Windows_NT)
  # On Windows: use Powershell to remove the directory if it exists
  define RM
	@powershell -NoProfile -Command "& { if (Test-Path '$(1)') { Remove-Item -Recurse -Force '$(1)' } }"
  endef
else
  # On Unix: classic rm -rf
  define RM
	@rm -rf $(1)
  endef
endif

.PHONY: build gen_files clean

build: clean gen_files
	$(PURO_CMD) dart run build_runner build -d

gen_files: clean
	$(PURO_CMD) dart run swagger_parser

clean:
	$(call RM,lib/src)
