import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),

  // Data Access Layer guard (architecture.md § "Data Access Layer", Epic 24).
  //
  // Direct prisma client imports are forbidden in pages and components.
  // All Prisma access must go through src/data/<entity>.ts; pages and
  // components delegate to src/data/ for reads, and to src/actions/ for
  // mutations.
  //
  // Action files retain the right to import { prisma } because multi-step
  // write flows wrap reads + writes in prisma.$transaction(...) which is
  // an action-layer concern, not data-layer.
  {
    files: ['src/app/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    ignores: ['**/__tests__/**', '**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/lib/db',
              importNames: ['prisma'],
              message:
                "Direct prisma access is restricted to src/data/<entity>.ts and src/actions/. Pages and components must read via src/data/* or call server actions. See _bmad-output/planning-artifacts/architecture.md § 'Data Access Layer'.",
            },
          ],
        },
      ],
    },
  },
])

export default eslintConfig
