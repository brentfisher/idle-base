module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { browsers: ['last 2 versions'] }, modules: 'commonjs' }],
    ['@babel/preset-react', { runtime: 'automatic' }],
  ],
};
