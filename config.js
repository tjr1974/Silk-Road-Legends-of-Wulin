// Color Codes for Console Output
const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const MAGENTA = "\x1b[35m";
// Server Configuration
const HOST = 'localhost';           // or '0.0.0.0' for external access
const PORT = 6400;                  // Port number for the server
const SSL_KEY_PATH = './ssl/server.key'; // Moved SSL key path to config
const SSL_CERT_PATH = './ssl/server.crt'; // Moved SSL cert path to config
// Logger Configuration
const LOG_LEVEL = 'INFO'; // Set the default logger level. Options: DEBUG, INFO, WARN, ERROR
const LOG_FILE_PATH = './server logs';     // Path for log files
const LOG_MAX_FILE_SIZE = 1048576;  // Max file size for logger = 1 MB in bytes
// File Paths for Game Data
const PLAYER_DATA_PATH = './source code/world data/players'; // Named constant
const LOCATION_DATA_PATH = './source code/world data/locations'; // Named constant
const NPC_DATA_PATH = './source code/world data/npcs'; // Named constant
const ITEM_DATA_PATH = './source code/world data/items'; // Named constant
const GAME_DATA_PATH = './source code/world data/gameData.json'; // Named constant
// Game Configuration
const TICK_RATE = 60000;       // 1000ms = 1 second, * 60 = 1 minute
const NPC_MOVEMENT_INTERVAL = 60000;  // 1000ms = 1 second, * 60 = 1 minute
const REGEN_INTERVAL = 60000;  // 1000ms = 1 second, * 60 = 1 minute
const REGEN_RATES = {
  IN_COMBAT: 0.125, // 12.5% per minute
  STANDING: 0.25,   // 25% per minute
  SITTING: 0.5,     // 50% per minute
  SLEEPING: 0.75,   // 75% per minute
  UNCONSCIOUS: 1,   // 100% per minute
  MEDITATING: 2.0,  // 200% per minute
};
const LEVEL_UP_XP = 100; // Experience points required to level up
const INVENTORY_CAPACITY = 20; // Inventory capacity for players
// Export configuration settings
const CONFIG = {
  HOST,
  PORT,
  SSL_KEY_PATH, // Added to config
  SSL_CERT_PATH, // Added to config
  LOG_LEVEL,
  LOG_FILE_PATH, // Added log file path
  LOG_MAX_FILE_SIZE, // Added max file size for logs
  PLAYER_DATA_PATH, // Added to config
  LOCATION_DATA_PATH, // Added to config
  NPC_DATA_PATH, // Added to config
  ITEM_DATA_PATH, // Added to config
  GAME_DATA_PATH, // Added to config
  TICK_RATE,
  NPC_MOVEMENT_INTERVAL,
  REGEN_INTERVAL,
  REGEN_RATES,
  LEVEL_UP_XP, // Added to config
  INVENTORY_CAPACITY,
  RESET, // Added color codes
  RED,   // Added color codes
  MAGENTA // Added color codes
};
export default CONFIG;
