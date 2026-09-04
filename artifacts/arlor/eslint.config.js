import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

const enWarn = (configs) =>
  configs.map((c) =>
    c.rules
      ? { ...c, rules: Object.fromEntries(Object.entries(c.rules).map(([k, v]) => [k, Array.isArray(v) ? ["warn", ...v.slice(1)] : v === "off" ? "off" : "warn"])) }
      : c,
  );

export default tseslint.config(
  { ignores: ["dist/**", "dist-hors-ligne/**", "src/integrations/supabase/types.ts"] },
  ...enWarn([js.configs.recommended]),
  ...enWarn(tseslint.configs.recommended),
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
);
