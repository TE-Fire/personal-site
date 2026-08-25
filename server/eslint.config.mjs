/**
 * NestJS ESLint Flat Config （基于官方 typescript-eslint v8）
 *
 * 规则分层：
 *   · @eslint/js/recommended        — 通用 JS 最佳实践
 *   · typescript-eslint/recommended  — TS 类型安全
 *   · typescript-eslint/stylistic    — TS 代码风格
 *   · eslint-plugin-import           — import 分组排序（内置包→外部→内部→相对路径）
 *   · eslint-plugin-jest             — 单测文件规则
 *   · eslint-config-prettier         — 关闭所有与 Prettier 冲突的规则
 */
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import jestPlugin from 'eslint-plugin-jest';
import prettier from 'eslint-config-prettier';

export default [
  /* ---------- 忽略列表 ---------- */
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '*.config.{js,mjs,ts}',
      'prisma/**',
    ],
  },

  /* ---------- 推荐规则集合 ---------- */
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,

  /* ---------- 所有 TS/JS 文件 ---------- */
  {
    files: ['**/*.{ts,js,mjs,cjs}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        console: 'readonly',
      },
    },
    plugins: {
      import: importPlugin,
    },
    settings: {
      'import/resolver': {
        typescript: true,
        node: true,
      },
    },
    rules: {
      /* --- import 排序：按组输出，组间空行 --- */
      'import/order': [
        'warn',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
            'object',
            'type',
          ],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
          pathGroups: [
            {
              pattern: '@nestjs/**',
              group: 'external',
              position: 'before',
            },
            {
              pattern: '@/**',
              group: 'internal',
              position: 'after',
            },
          ],
          pathGroupsExcludedImportTypes: ['type'],
        },
      ],
      'import/no-unresolved': 'off',

      /* --- NestJS 友好的 TS 规则（初期宽松，熟练后收紧） --- */
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/require-await': 'warn',
      '@typescript-eslint/no-empty-function': [
        'warn',
        { allow: ['private-constructors'] },
      ],
      '@typescript-eslint/consistent-type-imports': 'warn',

      /* --- 其他风格 --- */
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-var': 'error',
      'prefer-const': 'warn',
    },
  },

  /* ---------- 测试文件 ---------- */
  {
    files: ['**/*.spec.ts', 'test/**/*.ts'],
    plugins: { jest: jestPlugin },
    languageOptions: {
      globals: jestPlugin.environments.globals.globals,
    },
    rules: {
      ...jestPlugin.configs.recommended.rules,
      'jest/no-disabled-tests': 'warn',
      'jest/no-focused-tests': 'error',
      'jest/valid-title': 'off',
    },
  },

  /* --- Prettier 放在最后，覆盖所有与格式化冲突的规则 --- */
  prettier,
];
