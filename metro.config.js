const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Bundle whisper model binaries + wav fixtures via require().
// (Phase 3: sample-16k.wav smoke-test fixture; .bin reserved for
// bundled-model path — primary model location is document/models/.)
config.resolver.assetExts.push('bin', 'wav');

module.exports = withNativeWind(config, { input: './global.css' });
