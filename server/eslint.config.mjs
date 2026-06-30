import pluginJs from "@eslint/js";
import nodePlugin from "eslint-plugin-node";
import promisePlugin from "eslint-plugin-promise";
import globals from "globals";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";

const tsconfigRootDir = fileURLToPath(new URL(".", import.meta.url));

export default [
  { files: ["**/*.{js,mjs,cjs,ts}"] },
  {
    languageOptions: {
      globals: globals.browser
    }
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir
      }
    },
    rules: {
      "@typescript-eslint/no-floating-promises": ["error", { ignoreVoid: true }]
    }
  },
  {
    plugins: {
      node: nodePlugin,
      promise: promisePlugin
    },
    rules: {
      "node/no-sync": "error",
      "promise/no-callback-in-promise": "warn",
      "no-implicit-globals": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          vars: "all",
          args: "after-used",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ]
    }
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-comment": "off"
    }
  },
  {
    files: ["src/infrastructure/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["application/*", "presentation/*"],
              message:
                "Infrastructure must not import application or presentation. Use domain/shared abstractions or infrastructure-local dependencies."
            }
          ]
        }
      ]
    }
  },
  {
    files: ["src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["application/*", "infrastructure/*", "presentation/*"],
              message:
                "Domain must not import outer layers. Move data fetching/orchestration outward and pass domain-owned data in."
            }
          ]
        }
      ]
    }
  },
  {
    files: ["src/application/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: [
                "presentation/*",
                "socket.io",
                "express",
                "@aws-sdk/*",
                "@influxdata/*",
                "fs",
                "path",
                "typeorm"
              ],
              message:
                "Application must not import presentation. Return results/events and let presentation adapt transports."
            }
          ]
        }
      ]
    }
  },
  {
    files: ["src/presentation/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["infrastructure/*"],
              message:
                "Presentation must not import infrastructure. Presentation can depend only on application and should delegate all work to it."
            }
          ]
        }
      ]
    }
  },
  {
    ignores: ["**/dist", "**/build", "**/node_modules", "**/test", "**/.history"]
  }
];
