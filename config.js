// Color Codes for Console Output
const RESET = "\x1b[0m";
const ORANGE = "\x1b[38;5;208m";
const RED = "\x1b[0;31m";
const MAGENTA = "\x1b[95m";
// Server Configuration
const HOST = 'localhost';           // or '0.0.0.0' for external access
const PORT = 6400;                  // Port number for the server
const SSL_KEY_PATH = './ssl/server.key'; // Moved SSL key path to config
const SSL_CERT_PATH = './ssl/server.crt'; // Moved SSL cert path to config

// Logger Configuration
const LOG_LEVEL = 'DEBUG'; // Set the default logger level. Options: 'DEBUG', 'INFO', 'WARN', 'ERROR'
const LOG_FILE_PATH = './server logs';     // Path for log files
const LOG_MAX_FILE_SIZE = 1048576;  // Max file size for logger = 1 MB in bytes
// File Paths for Game Data
const PLAYER_DATA_PATH = './source code/world data/players';
const LOCATIONS_DATA_PATH = './source code/world data/locations'; // Changed from LOCATION_DATA_PATH
const NPCS_DATA_PATH = './source code/world data/npcs'; // Changed from NPC_DATA_PATH
const ITEMS_DATA_PATH = './source code/world data/items'; // Changed from ITEM_DATA_PATH
const GAME_DATA_PATH = './source code/world data/gameData.json';
// Game Configuration
const PASSWORD_SALT_ROUNDS = 10;             // Number of salt rounds for bcrypt
const ITEM_UID_SALT_ROUNDS = 1;     // Number of salt rounds for item UIDs
const SESSION_SECRET = 'your-secret-key'; // Secret key for session
const SESSION_RESAVE = false;       // Don't save session if unmodified
const SESSION_SAVE_UNINITIALIZED = false; // Don't create session until something stored
const COOKIE_SECURE = true;         // Use secure cookies in production
const COOKIE_HTTP_ONLY = true;      // Use HTTP-only cookies
const COOKIE_SAME_SITE = 'strict';  // CSRF protection
const TICK_RATE = 60000;       // 1000ms = 1 second, * 60 = 1 minute
const WORLD_EVENT_INTERVAL = 1440;  //
const NPC_MOVEMENT_INTERVAL = 15000;  // 1000ms = 1 second, * 60 = 1 minute
const INITIAL_HEALTH = 100;
const INITIAL_ATTACK_POWER = 10;
const REGEN_INTERVAL = 60000;  // 1000ms = 1 second, * 60 = 1 minute
const REGEN_RATES = new Map([
  ['IN_COMBAT', 0.125], // 12.5% per minute
  ['STANDING', 0.25],   // 25% per minute
  ['SITTING', 0.5],     // 50% per minute
  ['SLEEPING', 0.75],   // 75% per minute
  ['UNCONSCIOUS', 1],   // 100% per minute
  ['MEDITATING', 2.0],  // 200% per minute
]);
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
  LOCATIONS_DATA_PATH, // Updated
  NPCS_DATA_PATH, // Updated
  ITEMS_DATA_PATH, // Updated
  GAME_DATA_PATH, // Added to config
  PASSWORD_SALT_ROUNDS,
  ITEM_UID_SALT_ROUNDS,
  SESSION_SECRET,
  SESSION_RESAVE,
  SESSION_SAVE_UNINITIALIZED,
  COOKIE_SECURE,
  COOKIE_HTTP_ONLY,
  COOKIE_SAME_SITE,
  TICK_RATE,
  WORLD_EVENT_INTERVAL,
  NPC_MOVEMENT_INTERVAL,
  INITIAL_HEALTH,
  INITIAL_ATTACK_POWER,
  REGEN_INTERVAL,
  REGEN_RATES,
  LEVEL_UP_XP, // Added to config
  INVENTORY_CAPACITY,
  RESET, // Added color codes
  ORANGE, // Added color codes
  RED,   // Added color codes
  MAGENTA // Added color codes
};
export default CONFIG;
