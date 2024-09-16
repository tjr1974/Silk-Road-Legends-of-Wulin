// Configuration settings for the game
const HOST = 'localhost';           // or '0.0.0.0' for external access
const PORT = 6400;
const HTTPS = import('https');
const HTTP = import('http');
const FILE_PATHS = {
  PLAYER_DATA: './world data/players',
  LOCATION_DATA: './world data/locations',
  NPC_DATA: './world data/npcs',
  ITEM_DATA: './world data/items',
  GAME_DATA: './world data/gameData.json', // Added game data path
};
const TICK_RATE = 60000;       // 1000ms = 1 second, * 60 = 1 minute
const NPC_MOVEMENT_INTERVAL = 60000;  // 1000ms = 1 second, * 60 = 1 minute
const REGEN_INTERVAL = 60000;  // 1000ms = 1 second, * 60 = 1 minute
const LEVEL_UP_XP = 100; // Experience points required to level up
const SSL_KEY_PATH = './ssl/server.key'; // Moved SSL key path to config
const SSL_CERT_PATH = './ssl/server.crt'; // Moved SSL cert path to config
const REGEN_RATES = {
  IN_COMBAT: 0.125, // 12.5% per minute
  STANDING: 0.25,   // 25% per minute
  SITTING: 0.5,     // 50% per minute
  SLEEPING: 0.75,   // 75% per minute
  UNCONSCIOUS: 1,   // 100% per minute
  MEDITATING: 2.0,  // 200% per minute
};
const INVENTORY_CAPACITY = 20;
const CONFIG = {
  HOST,
  PORT,
  HTTPS,
  HTTP,
  TICK_RATE,
  REGEN_INTERVAL,
  NPC_MOVEMENT_INTERVAL,
  INVENTORY_CAPACITY,
  REGEN_RATES,
  FILE_PATHS,
  SSL_KEY_PATH, // Added to config
  SSL_CERT_PATH, // Added to config
  LEVEL_UP_XP, // Added to config
};
export default CONFIG;
export { HOST, PORT, HTTPS, HTTP, FILE_PATHS, TICK_RATE, NPC_MOVEMENT_INTERVAL, REGEN_INTERVAL, REGEN_RATES, INVENTORY_CAPACITY, SSL_KEY_PATH, SSL_CERT_PATH, LEVEL_UP_XP };