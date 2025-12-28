# If DONT_USE_PURO is set to "true", skip the puro wrapper
ifeq ($(DONT_USE_PURO),true)
PURO_CMD =
else
PURO_CMD = puro
endif

# Detect Windows vs. Unix
ifeq ($(OS),Windows_NT)
  # On Windows: use Powershell to remove the directory if it exists
  RM = powershell -NoProfile -Command "& { if (Test-Path '$(1)') { Remove-Item -Recurse -Force '$(1)' } }"
else
  # On Unix: classic rm -rf
  RM = rm -rf
endif

.PHONY: build gen_files clean

build: gen_files
	$(PURO_CMD) dart run build_runner build -d

gen_files:
	$(call RM,lib/src)
	$(PURO_CMD) dart run swagger_parser

clean:
	$(call RM,lib/src)
