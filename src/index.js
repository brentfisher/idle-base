const React = require('react');
const { createRoot } = require('react-dom/client');
const App = require('./App');
require('./styles/global.css');

const container = document.getElementById('root');
const root = createRoot(container);
root.render(React.createElement(App));
