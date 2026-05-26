module.exports = {
  root: true,
  extends: ['@react-native'],
  ignorePatterns: ['lib/', 'node_modules/', 'example/', 'coverage/'],
  rules: {
    'react-hooks/exhaustive-deps': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'prettier/prettier': 'off',
  },
};
