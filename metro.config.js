// Expo's default Metro config + a blockList so backup `.env*.local`
// files (e.g. `.env.cloud.local` for the cloud Supabase swap) aren't
// picked up by the bundler. Without this, Metro tries to parse them
// as JS source and bombs with a syntax error.

const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [/\.env\.[^/]+\.local$/];

module.exports = config;
