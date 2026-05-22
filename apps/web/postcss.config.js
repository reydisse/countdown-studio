const path = require('path');
module.exports = {
  plugins: {
    tailwindcss: { config: path.join(__dirname, '../../packages/ui/tailwind.config.js') },
    autoprefixer: {},
  },
};
