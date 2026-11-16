import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}", "tests/**/*.{ts,tsx}"],
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      "no-restricted-syntax": ["error", {
        selector: "Literal[value=/#([0-9a-fA-F]{3,8})\\b|rgba?\\(/]",
        message: "Use shared theme tokens for colors.",
      }, {
        selector: "TemplateElement[value.raw=/#([0-9a-fA-F]{3,8})\\b|rgba?\\(/]",
        message: "Use shared theme tokens for colors.",
      }],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/Icon/Icon.tsx"],
    rules: {
      "no-restricted-imports": ["error", { paths: [{ name: "lucide-react", message: "Use the semantic Icon component." }] }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
