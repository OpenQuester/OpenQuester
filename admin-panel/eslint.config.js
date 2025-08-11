import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import globals from "globals";

export default [
  { files: ["**/*.{js,jsx,ts,tsx}"] },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        React: true,
      },
    },
  },
  js.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
        // eslint-disable-next-line
        tsconfigRootDir: process.cwd(),
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "react/react-in-jsx-scope": "off",
      // plugin rules opt-in (sample)
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        {
          prefer: "type-imports",
          disallowTypeAnnotations: false,
          fixStyle: "separate-type-imports",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../server/*", "../../server/*"],
              message: "Import shared types via @server-dto barrel only.",
            },
            {
              group: ["@server-dto/*"],
              importNames: ["default"],
              message:
                "Default imports not allowed from @server-dto; use named type imports.",
            },
          ],
        },
      ],
    },
  },
  {
    ignores: ["dist", "node_modules"],
  },
];
