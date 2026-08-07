// Dynamic Expo config: injects the build-time environment into extra.appEnv,
// which src/config/env.ts reads first. Local `expo start` stays development;
// `APP_ENV=staging npx expo export` bakes staging; EAS profiles set APP_ENV
// in eas.json and flow through here the same way.
const appJson = require('./app.json');

module.exports = () => ({
  ...appJson.expo,
  extra: {
    ...appJson.expo.extra,
    appEnv: process.env.APP_ENV || 'development',
  },
});
