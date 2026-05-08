import js from '@eslint/js';
import globals from 'globals';

/** @type {import('eslint').Linter.Config[]} */
export default [
    {
        ignores: [
            'node_modules/**',
            'dist/**',
            'coverage/**',
            '**/package-lock.json',
            'agents/**',
            'scripts/**',
            // Legacy Vue scaffold not wired into the Electron app
            'src/**'
        ]
    },
    js.configs.recommended,
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.es2021
            }
        },
        linterOptions: {
            reportUnusedDisableDirectives: 'warn'
        },
        rules: {
            'no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrors: 'none'
                }
            ],
            'no-console': 'off',
            // Legacy codebase: tighten these gradually in CI
            'no-empty': ['warn', { allowEmptyCatch: true }],
            'no-async-promise-executor': 'warn',
            'no-useless-catch': 'warn',
            'no-case-declarations': 'warn'
        }
    },
    {
        files: ['main.js', 'connection-pool.js', 'plugins/**/*.js'],
        languageOptions: {
            globals: {
                ...globals.node
            }
        }
    },
    {
        files: ['preload.js'],
        languageOptions: {
            sourceType: 'commonjs',
            globals: {
                ...globals.commonjs,
                ...globals.node
            }
        }
    },
    // Renderer scripts loaded as classic `<script>` tags — shared globals come from load order, not imports.
    {
        files: ['public/**/*.js'],
        ignores: ['public/js/auto-downloader.js'],
        languageOptions: {
            sourceType: 'script',
            globals: {
                ...globals.browser
            }
        },
        rules: {
            'no-undef': 'off',
            'no-unused-vars': 'off',
            'no-case-declarations': 'off',
            'no-duplicate-case': 'warn',
            'no-useless-escape': 'warn'
        }
    },
    {
        files: ['public/js/auto-downloader.js'],
        languageOptions: {
            sourceType: 'module',
            globals: {
                ...globals.node
            }
        }
    },
    // Required by main.js via createRequire — large switch/case sensor map (same logic as sensor-parser.js).
    {
        files: ['public/sensor-parser.cjs'],
        languageOptions: {
            sourceType: 'commonjs',
            globals: {
                ...globals.node
            }
        },
        rules: {
            'no-case-declarations': 'off',
            'no-duplicate-case': 'warn',
            'no-useless-escape': 'warn',
            'no-unused-vars': 'warn'
        }
    },
    {
        files: ['tests/**/*.js'],
        languageOptions: {
            globals: {
                ...globals.node
            }
        }
    },
    {
        files: ['vitest.config.js', 'eslint.config.js'],
        languageOptions: {
            globals: {
                ...globals.node
            }
        }
    }
];
