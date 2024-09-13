// Configuration settings for the game
const CONFIG = {
  HOST: 'localhost',           // or '0.0.0.0' for external access
  PORT: 6400,
  HTTPS: import('https'),
  HTTP: import('http'),
  TICK_RATE: 1000 * 60,       // 1000ms = 1 second, * 60 = 1 minute
  REGEN_INTERVAL: 1000 * 60,  // 1000ms = 1 second, * 60 = 1 minute
  NPC_MOVEMENT_INTERVAL = 1000 * 60,  // 1000ms = 1 second, * 60 = 1 minute
  INVENTORY_CAPACITY: 20,
  REGEN_RATES: {
    IN_COMBAT: 0.125, // 12.5% per minute
    STANDING: 0.25,   // 25% per minute
    SITTING: 0.5,     // 50% per minute
    SLEEPING: 0.75,   // 75% per minute
    UNCONSCIOUS: 1,   // 100% per minute
    MEDITATING: 2.0,  // 200% per minute
  },
  FILE_PATHS: {
    PLAYER_DATA: '.source code/world data/players',
    LOCATION_DATA: 'source code/world data/locations',
    NPC_DATA: 'source code/world data/npcs',
    ITEM_DATA: 'source code/world data/items',
  },
};
export default CONFIG;

export const PLAYER_DATA_PATH = './data/player.json'; // Example path, ensure it points to the correct file
export const LOCATION_DATA_PATH = './data/location.json'; // Example path
export const NPC_DATA_PATH = './data/npc.json'; // Example path
export const ITEM_DATA_PATH = './data/item.json'; // Example path