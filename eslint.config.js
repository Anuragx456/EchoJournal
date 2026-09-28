// eslint.config.js — Flat config for Expo SDK 57
const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  globalIgnores(['dist/*', 'node_modules/*']),
  expoConfig,
]);
