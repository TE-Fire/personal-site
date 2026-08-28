/**
 * 后端 ESLint 配置（扁平化 flat config 格式，对应 eslint 9.x）
 *
 * 按照作者偏好：禁用绝大多数规则，保留仅最低限度防坑项，保证写代码自由度。
 * 如需更强约束可逐个规则重新开启。
 */
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  // 全局忽略 dist / node_modules / prisma 生成代码
  { ignores: ['dist/**', 'node_modules/**', 'prisma/generated/**'] },

  // 基础 TS 推荐规则（可按需注释/降级）
  ...tseslint.configs.recommended.map((cfg) => ({
    ...cfg,
    files: ['**/*.ts'],
  })),

  // 与 Prettier 冲突的规则全部关闭
  eslintConfigPrettier,

  // 个性化放宽
  {
    files: ['**/*.ts'],
    rules: {
      // 允许未使用变量（下划线前缀或整件事都不报错）
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',

      // 放宽 any：快速开发时不卡 any
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',

      // 空值类不做严格提示（tsconfig 里 strictNullChecks 也已关）
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'off',

      // 不强制显式函数返回值类型
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',

      // 允许 require()、console.log 等常用
      'no-console': 'off',
      '@typescript-eslint/no-var-requires': 'off',

      // 允许空函数、空 catch
      'no-empty': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
    },
  },
);
