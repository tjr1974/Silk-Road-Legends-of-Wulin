/*
 * The Server class is the main entry point for the game server. It is responsible for initializing
the server environment, setting up middleware, and managing the game loop. The class handles the
following key functionalities:
 *
 * 1. **Module Initialization**: It imports necessary modules such as configuration settings,
 *    logging utilities, file system operations, and web server frameworks.
 *
 * 2. **Middleware Setup**: It configures middleware for logging, HTTP requests, and serving
 *    static files.
 *
 * 3. **Route Management**: It defines the main route for the server, providing a welcome message
 *    to users.
 *
 * 4. **Game Data Loading**: It loads essential game data, including player, Npcs, and item
 *    information, from the database to ensure the game state is ready for interaction.
 *
 * 5. **Queue Management**: It initializes a queue manager to handle asynchronous tasks related to
 *    game events.
 *
 * 6. **Server Creation**: It sets up the server to run in HTTPS or HTTP mode based on the
 *    availability of SSL certificates, ensuring secure communication when possible.
 *
 * 7. **Server Start**: It starts the server and listens for incoming connections, logging the
 *    server's operational status and address for easy access.
 */
// Server *****************************************************************************************
class Server {
  constructor() {
    this.logger = null;
    this.initializeModules(); // Ensure modules are initialized first
  }
  // Initialize Modules ***************************************************************************
  /*
  * The initializeModules method is responsible for loading and initializing the server modules.
  * It ensures that all necessary modules are imported and ready for use.
  * The order of initialization is crucial for proper functionality.
  */
  async initializeModules() {
    this.CONFIG = await import('./config.js');
    this.logger = (await import('pino')).default();
    this.logger.level = 'debug'; // Set logging level to debug for testing; change to info for production.
    this.pinoHttp = (await import('pino-http')).default(); // Added parentheses to invoke the function
    this.fs = await import('fs').then(module => module.promises);
    this.io = await import('socket.io');
    this.express = (await import('express')).default;
    this.app = this.express();
    this.app.use(this.pinoHttp({ logger: this.logger }));
    this.queueManager = new QueueManager();
    this.databaseManager = new DatabaseManager();
    this.gameManager = new GameManager();
    await this.createServer(); // Added await to ensure server creation completes
    await this.start(); // Added await to ensure server starts before proceeding
    this.setupMiddleware();
    this.setupRoutes();
    await this.loadGameData(); // Added await to ensure game data loads before proceeding
    await this.initializeQueue(); // Added await to ensure queue initializes before proceeding
  }
  // Create Server ********************************************************************************
  /*
  * The createServer method is responsible for creating the server instance.
  * It checks for the availability of SSL certificates and creates the server accordingly.
  * If SSL certificates are not found, it defaults to HTTP.
  */
  async createServer() {
    const sslOptions = {
      key: await this.fs.access('./ssl/server.key').then(() => this.fs.readFile('./ssl/server.key')),
      cert: await this.fs.access('./ssl/server.crt').then(() => this.fs.readFile('./ssl/server.crt')),
    };
    if (!sslOptions.key || !sslOptions.cert) {
      this.logger.warn('SSL files not found, defaulting to HTTP.');
      return require('http').createServer(this.app); // Use 'http' module if SSL is not available
    }
    return require('https').createServer(sslOptions, this.app); // Use 'https' module if SSL is available
  }
  // Start Server *********************************************************************************
  /*
  * The start method is responsible for starting the server and listening for incoming connections.
  * It logs the server's operational status and address for easy access.
  */
  async start() {
    this.app.listen(this.CONFIG.PORT, this.CONFIG.HOST, () => {
      this.logger.info(`Server running on https://${this.CONFIG.HOST}:${this.CONFIG.PORT}`);
    });
  }
  // Setup Middleware *****************************************************************************
  /*
  * The setupMiddleware method is responsible for configuring middleware for the server.
  * It uses the PinoHttp middleware for logging and the Express static middleware for serving
  * static files from the 'public' directory.
  */
  setupMiddleware() {
    this.app.use(this.pinoHttp({ logger: this.logger }));
    this.app.use(this.express.static('public'));
  }
  // Setup Routes ********************************************************************************
  /*
  * The setupRoutes method is responsible for defining the routes for the server.
  * It establishes the main route for the server, providing a welcome message to users.
  */
  setupRoutes() {
    this.app.get('/', (req, res) => {
      req.log.info('Logging services started. Level: [level: info]...');
      res.send('Welcome to the Game Server!');
    });
    this.setupSocketListeners(); // Call the method to set up socket listeners
    this.setupSocketEmitters(); // Call the method to set up socket emitters
  }
  // Setup Socket Listeners ***********************************************************************
  /*
  * The setupSocketListeners method is responsible for setting up socket listeners.
  * It listens for incoming socket connections and handles events.
  */
  setupSocketListeners() {
    this.io.on('connection', (socket) => {
      // Handle socket events here
      socket.on('event_name', (data) => {
        // Handle the event
      });
    });
  }
  // Setup Socket Emitters ***********************************************************************
  /*
  * The setupSocketEmitters method is responsible for setting up socket emitters.
  * It emits events to the socket listeners.
  *
  * Use io for broadcasting to all clients:
  *  this.io.emit('event_name', data);
  *
  * Use socket for emitting to a specific client:
  *  this.socket.emit('event_name', data);
  */
  setupSocketEmitters() {
    this.io.emit('event_name', data);
  }
  // Load Game Data *******************************************************************************
  /*
  * The loadGameData method is responsible for loading essential game data from the database.
  * It retrieves location, NPC, and item data to ensure the game state is ready for interaction.
  */
  loadGameData() {
    // Load data from files (e.g., players, NPCs)
    this.databaseManager.loadLocationData();
    this.databaseManager.loadNpcData();
    this.databaseManager.loadItemData();
  }
  // Initialize Queue *****************************************************************************
  /*
  * The initializeQueue method is responsible for creating a new queue instance for the server.
  * It assigns the queue instance to the queueManager for managing asynchronous tasks.
  */
  async initializeQueue() {
    this.queue = (await import('queue')).default();
  }
  // Initialize Server ******************************************************************************
  /*
  * The initializeServer method is responsible for initializing the server.
  */
  async initializeServer() {
    this.server = new Server();
  }
}
// Method Call to Start an instance of Server
new Server();
// Object Pool ************************************************************************************
  /*
  * The ObjectPool class is designed for efficient memory management and performance optimization,
  * by reusing objects instead of creating and destroying them frequently. This approach helps
  * reduce the overhead associated with memory allocation and garbage collection, which can be
  * particularly beneficial in performance-sensitive applications, such as games.
  */
class ObjectPool {
  constructor(createFunc, size) {
    this.createFunc = createFunc;
    this.pool = Array.from({ length: size }, this.createFunc);
    this.available = [];
  }
  acquire() {
    return this.available.length > 0 ? this.available.pop() : this.pool.pop();
  }
  release(object) {
    this.available.push(object);
  }
}
// Task Class ************************************************************************************
/*
* The Task class is responsible for representing a task in the game's task queue.
* It contains a name and a placeholder for the task execution function.
*/
class Task {
  constructor(name) {
    this.name = name;
    this.execute = null; // Placeholder for the task execution function
  }
  async run() { // Added execute method
    if (this.execute) {
      await this.execute(); // Execute the assigned function
    }
  }
}
// Queue Manager *********************************************************************************
/*
* The QueueManager class is responsible for managing the game's task queue.
* It provides methods to add tasks to the queue, process the queue, and execute tasks.
*/
class QueueManager {
  constructor() {
    this.queue = [];
    this.isProcessing = false; // Track if the queue is currently processing
    this.taskPool = new ObjectPool(() => new Task(''), 10);
  }
  addTask(task) {
    this.queue.push(task);
    this.processQueue(); // Start processing the queue when a new task is added
  }
  async processQueue() {
    if (this.isProcessing) return; // Prevent re-entrance
    this.isProcessing = true; // Mark as processing
    while (this.queue.length > 0) {
      const task = this.queue.shift(); // Get the next task
      try {
        await task.run(); // Call the run method to execute the task
      } catch (error) {
        // Handle error
      }
    }
    this.isProcessing = false; // Mark as not processing
  }
  async executeTask(task) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 1000); // Adjust time as needed
    });
  }
  // Methods to add tasks
  addDataLoadTask(filePath, key) {
    const task = this.taskPool.acquire();
    task.name = 'Data Load Task';
    task.execute = async () => {
      const data = await this.databaseManager.loadData(filePath, key); // Corrected to use instance method
      this.taskPool.release(task);
    };
    this.addTask(task);
  }
  addDataSaveTask(filePath, key, data) {
    const task = this.taskPool.acquire();
    task.name = 'Data Save Task';
    task.execute = async () => {
      await this.databaseManager.saveData(filePath, key, data); // Corrected to use instance method
      this.taskPool.release(task);
    };
    this.addTask(task);
  }
  addCombatActionTask(player, target) {
    const task = this.taskPool.acquire();
    task.name = 'Combat Action Task';
    task.execute = async () => {
      player.attackNpc(target);
      this.taskPool.release(task);
    };
    this.addTask(task);
  }
  addEventProcessingTask(event) {
    const task = this.taskPool.acquire();
    task.name = 'Event Processing Task';
    task.execute = async () => {
      // Process the event (e.g., day/night transition)
      this.taskPool.release(task);
    };
    this.addTask(task);
  }
  addHealthRegenerationTask(player) {
    const task = this.taskPool.acquire();
    task.name = 'Health Regeneration Task';
    task.execute = async () => {
      player.startHealthRegeneration();
      this.taskPool.release(task);
    };
    this.addTask(task);
  }
  addInventoryManagementTask(player, action, item) {
    const task = this.taskPool.acquire();
    task.name = 'Inventory Management Task';
    task.execute = async () => {
      if (action === 'pickup') {
        player.addToInventory(item);
      } else if (action === 'drop') {
        player.removeFromInventory(item);
      }
      this.taskPool.release(task);
    };
    this.addTask(task);
  }
  addNotificationTask(player, message) {
    const task = this.taskPool.acquire();
    task.name = 'Notification Task';
    task.execute = async () => {
      MessageManager.notify(player, message);
      this.taskPool.release(task);
    };
    this.addTask(task);
  }
}
// Database Manager  ******************************************************************************
/*
* The DatabaseManager class is responsible for managing the game's data storage and retrieval.
* It provides methods to load and save data from various files, such as player, location, NPC,
* and item data.
*/
import CONFIG from './config.js';
class DatabaseManager {
  static PLAYER_DATA_PATH = CONFIG.FILE_PATHS.PLAYER_DATA;
  static LOCATION_DATA_PATH = CONFIG.FILE_PATHS.LOCATION_DATA;
  static NPC_DATA_PATH = CONFIG.FILE_PATHS.NPC_DATA;
  static ITEM_DATA_PATH = CONFIG.FILE_PATHS.ITEM_DATA;
  constructor() {
    this.fs = import('fs').promises; // Use promises API for file system operations
  }
  async loadData(filePath, key) {
    try {
      const data = await this.loadData(filePath); // Load data from the specified file
      return key ? data[key] : data; // Return specific key data or entire data
    } catch (error) {
      DatabaseManager.notifyDataLoadError(this, key, error); // Notify error if loading fails
      throw error; // Rethrow error for further handling
    }
  }
  async saveData(filePath, key, data) {
    try {
      const existingData = await this.loadData(filePath); // Load existing data to update
      existingData[key] = data; // Update the specific key with new data
      await this.fs.writeFile(filePath, JSON.stringify(existingData, null, 2)); // Save updated data
      this.logger.info(`Data saved for ${key} to ${filePath}`); // Log successful save
    } catch (error) {
      DatabaseManager.notifyDataSaveError(this, filePath, error); // Notify error if saving fails
    }
  }
  async loadPlayerData(username) {
    return this.loadData(DatabaseManager.PLAYER_DATA_PATH, username);
  }
  async savePlayerData(playerData) {
    await this.saveData(DatabaseManager.PLAYER_DATA_PATH, playerData.username, playerData);
  }
  async loadLocationData(locationId) {
    return this.loadData(DatabaseManager.LOCATION_DATA_PATH, locationId);
  }
  async saveLocationData(locationData) {
    await this.saveData(DatabaseManager.LOCATION_DATA_PATH, locationData.id, locationData);
  }
  async loadNpcData(npcId) {
    return this.loadData(DatabaseManager.NPC_DATA_PATH, npcId);
  }
  async saveNpcData(npcData) {
    await this.saveData(DatabaseManager.NPC_DATA_PATH, npcData.id, npcData);
  }
  async loadItemData(itemId) {
    return this.loadData(DatabaseManager.ITEM_DATA_PATH, itemId);
  }
  async saveItemData(itemData) {
    await this.saveData(DatabaseManager.ITEM_DATA_PATH, itemData.id, itemData);
  }
  async loadData(filePath) {
    try {
      const fileContent = await this.fs.readFile(filePath, 'utf-8');
      return JSON.parse(fileContent);
    } catch (error) {
      MessageManager.notifyError(this, `Error loading data from ${filePath}: ${error}`);
      return {};
    }
  }
  static notifyDataLoadError(manager, key, error) { // Corrected to be static
    manager.logger.error(`Error loading data for ${key}: ${error}`);
  }
  static notifyDataSaveError(manager, filePath, error) { // Corrected to be static
    manager.logger.error(`Error saving data to ${filePath}: ${error}`);
  }
}
// Game Manager ***********************************************************************************
/*
* The GameManager class is responsible for managing the game state and its components.
* It provides methods to start and stop the game, add players, manage locations and Npcs,
* and handle game events.
*/
class GameManager {
  #gameLoopInterval = null; // Declare the private field here
  #gameTime = 0; // Declare the private field
  #isRunning = false; // Add this line to declare the private field
  #combatManager;
  constructor() {
    this.players = new Map();
    this.locations = new Map();
    this.npcs = new Map();
    this.#combatManager = new CombatManager(this);
    this.eventEmitter = new EventEmitter();
  }
  getGameTime() {
    return this.#gameTime;
  }
  setGameTime(newTime) {
    this.#gameTime = newTime;
  }
  async startGame() {
    try {
      MessageManager.notifyGameInitialization(this);
      this.eventEmitter.emit('gameStarted');
      this.startGameLoop(); // Call the public method
      this.#isRunning = true;
      MessageManager.notifyGameInitializedSuccessfully(this);
    } catch (error) {
      MessageManager.notifyError(this, `Error initializing game: ${error}`);
      throw error;
    }
  }
  async shutdownGame() {
    try {
      this.stopGameLoop(); // Call the public method
      for (const player of this.players.values()) {
        await player.save();
      }
      MessageManager.notifyGameShutdownSuccess(this);
    } catch (error) {
      MessageManager.notifyError(this, `Error shutting down game: ${error}`);
      throw error;
    }
  }
  addPlayer(player) {
    this.players.set(player.getId(), player);
  }
  getPlayer(playerId) {
    return this.players.get(playerId);
  }
  removePlayer(playerId) {
    this.players.delete(playerId);
  }
  addLocation(location) {
    this.locations.set(location.getId(), location);
  }
  getLocation(locationId) {
    return this.locations.get(locationId);
  }
  addNpc(npc) {
    this.npcs.set(npc.getId(), npc);
  }
  getNpc(npcId) {
    return this.npcs.get(npcId);
  }
  startGameLoop() { // Public method to start the game loop
    this.startGameLoopInternal(); // Calls a public method
  }
  stopGameLoop() { // Public method to stop the game loop
    this.stopGameLoopInternal(); // Calls a public method
  }
  incrementGameTime() { // Public method to increment game time
    this.incrementGameTimeInternal(); // Calls a public method
  }
  getCurrentGameTime() { // Public method to get current game time
    return this.getGameTime(); // Calls the public getter
  }
  startGameLoopInternal() { this._startGameLoop(); } // New public method
  stopGameLoopInternal() { this._stopGameLoop(); } // New public method
  incrementGameTimeInternal() { this._updateGameTime(); } // New public method
  _startGameLoop() {
    this.#gameLoopInterval = setInterval(() => this._gameTick(), TICK_RATE); // Corrected to call the private method
  }
  _stopGameLoop() {
    if (this.#gameLoopInterval) {
      clearInterval(this.#gameLoopInterval);
      this.#gameLoopInterval = null;
    }
  }
  _gameTick() {
    // Update all NPCs in the game
    this._updateNpcs();
    // Update player status effects and conditions
    this._updatePlayerAffects();
    // Check and handle any world events that need to occur
    this._updateWorldEvents();
    // Emit a tick event with the current game time for any listeners
    this.eventEmitter.emit("tick", this.#gameTime);
  }
  _updateGameTime() {
    // Increment the game time by one minute
    this.setGameTime(this.getGameTime() + 1);
    // Check if a full day (1440 minutes) has passed
    if (this.getGameTime() >= 1440) {
      // Reset the game time to zero for a new day
      this.setGameTime(0);
      // Emit an event to signal the start of a new day
      this.eventEmitter.emit("newDay");
    }
  }
  _updateNpcs() {
    for (const npc of this.npcs.values()) {
      npc.update(this.#gameTime);
    }
  }
  _updatePlayerAffects() {
    for (const player of this.players.values()) {
      player.updateAffects();
    }
  }
  _updateWorldEvents() {
    // Check if it's time for an hourly update (every 60 game minutes)
    if (this.#gameTime % 60 === 0) {
      this._hourlyUpdate(); // Call the method to handle hourly updates
    }
    // Check if it's time for a daily update (at 360 and 1080 game minutes)
    if (this.#gameTime === 360 || this.#gameTime === 1080) {
      this._dailyUpdate(); // Call the method to handle daily updates
    }
  }
  _hourlyUpdate() {
    // Perform actions that need to occur every hour in the game
    this._regenerateResourceNodes(); // Regenerate resources in the game world
  }
  _dailyUpdate() {
    // Perform actions that need to occur every day in the game
    this._updateNpcSchedules(); // Update the schedules of all NPCs in the game
  }
  _updateNpcSchedules() {
    // Iterate through all NPCs and update their schedules based on the current game time
    for (const npc of this.npcs.values()) {
      npc.updateSchedule(this.#gameTime); // Call the updateSchedule method for each NPC
    }
  }
  async disconnectPlayer(playerId) {
    // Placeholder for the implementation of player disconnection logic
    // This method will handle the necessary steps to disconnect a player from the game
  }
  getGameTime() {
    // Calculate the current game time in hours and minutes
    const hours = Math.floor(this.#gameTime / 60); // Convert total minutes to hours
    const minutes = this.#gameTime % 60; // Get the remaining minutes
    return { hours, minutes }; // Return an object containing hours and minutes
  }
  autoLootNpc(npc, player) {
    if (npc.inventory && npc.inventory.length > 0) {
      const lootedItems = [...npc.inventory];
      player.inventory.push(...lootedItems.map(itemId => items[itemId])); // Assuming items is a global or accessible object
      npc.inventory = []; // Clear NPC's inventory after looting
      return MessageManager.createAutoLootMessage(player, npc, lootedItems);
    }
    return null; // No items to loot
  }
  findEntity(target, collection, type) {
    // Implementation for finding an entity in the collection
  }
  fullStateSync(player) {
    // Implementation for syncing the full state of the player
  }
  checkLevelUp(player) {
    // Implementation for checking if the player levels up
  }
}
// EventEmitter ***********************************************************************************
/*
* The EventEmitter class is responsible for managing events and their listeners.
* It provides methods to register listeners, emit events, and remove listeners.
*/
class EventEmitter {
  constructor() {
    this.events = {};
  }
  on(event, listener) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
  }
  emit(event, ...args) {
    if (this.events[event]) {
      this.events[event].forEach(listener => listener(...args));
    }
  }
  off(event, listener) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(l => l !== listener);
    }
  }
}
// Create New Player ******************************************************************************
/*
* The CreateNewPlayer class is responsible for creating new player instances.
* It provides a static method to create a player from existing player data.
*/
class CreateNewPlayer {
  constructor(name, age) {
    this.name = name;
    this.age = age;
  }
  static fromPlayerData(uid, playerData, bcrypt) {
    const player = new Player(uid, playerData.name, bcrypt);
    player.updateData(playerData);
    return player;
  }
  updateData(updatedData) {
    if (updatedData.health !== undefined) this.setHealth(updatedData.health);
    if (updatedData.experience !== undefined) this.setExperience(updatedData.experience);
    if (updatedData.level !== undefined) this.setLevel(updatedData.level);
  }
}
// Player *****************************************************************************************
/*
* The Player class represents a player in the game.
* It contains various properties and methods related to the player's state and actions.
*/
class Player {
  #uid;
  #name;
  #inventory = [];
  #lastAttacker;
  #colorPreferences;
  #bcrypt;
  #healthRegenerator;
  constructor(uid, name, bcrypt) {
    this.#bcrypt = bcrypt;
    this.#uid = uid;
    this.#name = name;
    this.password = "";
    this.description = "";
    this.title = "";
    this.reputation = "";
    this.profession = "";
    this.sex = "";
    this.age = 0;
    this.health = 100;
    this.maxHealth = 100;
    this.level = 0;
    this.csml = 0;
    this.attackPower = 10;
    this.defensePower = 0;
    this.experience = 0;
    this.currentLocation = "100";
    this.coordinates = {};
    this.skills = [];
    this.status = "standing";
    this.affects = [];
    this.killer = true;
    this.autoLoot = true;
    this.lastRegenTime = Date.now();
    this.failedLoginAttempts = 0;
    this.consecutiveFailedAttempts = 0;
    this.lastLoginTime = Date.now();
    this.totalPlayingTime = 0;
    this.colorPreferences = {};
    this.#healthRegenerator = new HealthRegenerator(this);
  }
  getId() {
    return this.#uid;
  }
  getName() {
    return this.#name;
  }
  getHealth() {
    return this.health;
  }
  setHealth(newHealth) {
    this.health = newHealth;
  }
  getStatus() {
    return this.status;
  }
  setStatus(newStatus) {
    this.status = newStatus;
  }
  getPossessivePronoun() {
    return this.sex === 'male' ? 'his' : 'her';
  }
  addToInventory(item) {
    if (!item.isValid()) {
      MessageManager.notifyInvalidItemAddition(this, item.name);
      return;
    }
    if (this.canAddToInventory(item)) {
      this.#inventory.push(item);
      MessageManager.notifyPlayersInLocation(this.currentLocation, MessageManager.notifyPickupItem(this, item.name));
    } else {
      MessageManager.notifyInventoryFull(this);
    }
  }
  removeFromInventory(item) {
    const index = this.#inventory.findIndex(i => i.uid === item.uid);
    if (index > -1) {
      this.#inventory.splice(index, 1);
      MessageManager.notifyPlayersInLocation(this.currentLocation, MessageManager.notifyDropItem(this, item.name));
    } else {
      MessageManager.notifyItemNotFoundInInventory(this);
    }
  }
  canAddToInventory(item) {
    return this.#inventory.length < this.getInventoryCapacity() && item.isValid();
  }
  getInventoryCapacity() {
    return INVENTORY_CAPACITY;
  }
  async authenticate(password) {
    const isPasswordValid = await this.#bcrypt.compare(password, this.password);
    if (isPasswordValid) {
      this.resetFailedLoginAttempts();
      return true;
    }
    this.incrementFailedLoginAttempts();
    return false;
  }
  attackNpc(target) {
    const location = gameManager.getLocation(this.currentLocation);
    if (!location) return;
    const npcId = target
      ? this.getNpcIdByName(target, location.npcs)
      : this.getFirstAvailableNpcId(location.npcs);
    if (npcId) {
      const npc = gameManager.getNpc(npcId);
      if (!npc) return;
      if (npc.isUnconsciousOrDead()) {
        MessageManager.notifyNpcAlreadyInStatus(this, npc);
      } else {
        CombatManager.startCombat(npcId, this, !target);
        MessageManager.notifyPlayersInLocation(this.currentLocation, MessageManager.notifyCombatInitiation(this, npc.getName()));
      }
    } else if (target) {
      MessageManager.notifyTargetNotFound(this, target);
    } else {
      MessageManager.notifyNoConsciousEnemies(this);
    }
  }
  getNpcIdByName(name, npcs) {
    return npcs.find(npcId => {
      const npc = gameManager.getNpc(npcId);
      return npc && npc.getName().toLowerCase() === name.toLowerCase();
    });
  }
  getFirstAvailableNpcId(npcs) {
    return npcs.find(npcId => {
      const npc = gameManager.getNpc(npcId);
      return npc && !npc.isUnconsciousOrDead();
    });
  }
  incrementFailedLoginAttempts() {
    this.failedLoginAttempts++;
    this.consecutiveFailedAttempts++;
    if (this.consecutiveFailedAttempts >= 3) {
      MessageManager.notifyDisconnectionDueToFailedAttempts(this);
      gameManager.disconnectPlayer(this.#uid);
    }
  }
  showInventory() {
    const inventoryList = this.#inventory.map(item => item.name).join(", ");
    MessageManager.notifyInventoryStatus(this, inventoryList);
  }
  lootSpecifiedNpc(target) {
    const location = gameManager.getLocation(this.currentLocation);
    if (!location) return;
    const targetLower = target.toLowerCase();
    const targetEntity = location.entities.find(entity => entity.name.toLowerCase() === targetLower);
    if (targetEntity) {
      MessageManager.notifyLootAction(this, targetEntity);
    } else {
      MessageManager.notifyTargetNotFoundInLocation(this, target);
    }
  }
  moveToLocation(newLocationId) {
    const oldLocationId = this.currentLocation;
    const oldLocation = gameManager.getLocation(oldLocationId);
    const newLocation = gameManager.getLocation(newLocationId);
    if (oldLocation) {
      MessageManager.notifyLeavingLocation(this, oldLocationId, newLocationId); // Updated to include newLocationId
      const direction = this.getDirectionTo(newLocationId);
      MessageManager.notify(this, `${this.getName()} travels ${direction}.`);
    }
    this.currentLocation = newLocationId;
    if (newLocation) {
      newLocation.addEntity(this, "players");
      MessageManager.notifyEnteringLocation(this, newLocationId); // Updated to use newLocationId
      const direction = this.getDirectionFrom(oldLocationId);
      MessageManager.notify(this, `${this.getName()} arrives ${direction}.`);
    }
  }
  getDirectionTo(newLocationId) {
    const directionMap = {
      'north': 'northward',
      'east': 'eastward',
      'west': 'westward',
      'south': 'southward',
      'up': 'upward',
      'down': 'downward',
    };
    return directionMap[newLocationId] || 'unknown direction';
  }
  getDirectionFrom(oldLocationId) {
    const directionMap = {
      'north': 'from the north',
      'east': 'from the east',
      'west': 'from the west',
      'south': 'from the south',
      'up': 'from above',
      'down': 'from below',
    };
    return directionMap[oldLocationId] || 'from an unknown direction';
  }
  notify(message) {
    MessageManager.notify(this, message);
  }
  resetFailedLoginAttempts() {
    this.failedLoginAttempts = 0;
    this.consecutiveFailedAttempts = 0;
    this.lastLoginTime = Date.now();
  }
  async save() {
    QueueManager.addDataSaveTask(DatabaseManager.PLAYER_DATA_PATH, this.getId(), this);
  }
  // @ todo: add code for this.
  score() {
    const stats = `Level: ${this.level}, XP: ${this.experience}, Health: ${this.health}/${this.maxHealth}`;
    MessageManager.notifyStats(this, stats);
  }
  updateData(updatedData) {
    if (updatedData.health !== undefined) this.setHealth(updatedData.health);
    if (updatedData.experience !== undefined) this.setExperience(updatedData.experience);
    if (updatedData.level !== undefined) this.setLevel(updatedData.level);
  }
  async hashUid() {
    this.hashedUid = await this.#bcrypt.hash(this.#uid, 5);
  }
  async login(inputPassword) {
    const isAuthenticated = await this.authenticate(inputPassword);
    if (isAuthenticated) {
      MessageManager.notifyLoginSuccess(this);
      return true;
    } else {
      MessageManager.notifyIncorrectPassword(this);
      return false;
    }
  }
  startHealthRegeneration() {
    this.#healthRegenerator.start();
  }
  checkAndRemoveExpiredAffects() {
    const now = Date.now();
    this.affects = this.affects.filter(affect => {
      if (affect.endTime && affect.endTime <= now) {
        affect.remove(this);
        return false;
      }
      return true;
    });
  }
  meditate() {
    if (this.status !== "sitting") {
      this.startHealthRegeneration();
      MessageManager.notifyMeditationAction(this);
      return;
    }
    this.status = "meditating";
    MessageManager.notifyMeditationStart(this);
  }
  sleep() {
    this.startHealthRegeneration();
    this.status = "sleeping";
    MessageManager.notifySleepAction(this);
  }
  sit() {
    if (this.status === "sitting") {
      MessageManager.notifyAlreadySitting(this);
    } else if (this.status === "standing") {
      this.startHealthRegeneration();
      this.status = "sitting";
      MessageManager.notifySittingDown(this);
    } else {
      MessageManager.notifyStoppingMeditation(this);
    }
  }
  stand() {
    if (this.status === "lying unconscious") {
      this.status = "standing";
      MessageManager.notifyStandingUp(this);
    } else {
      MessageManager.notifyAlreadyStanding(this);
    }
  }
  wake() {
    if (this.status === "lying unconscious") {
      this.status = "standing";
      MessageManager.notifyStandingUp(this);
    } else if (this.status === "sleeping") {
      this.status = "standing";
      MessageManager.notifyWakingUp(this);
    } else {
      MessageManager.notifyAlreadyAwake(this);
    }
  }
  autoLootToggle() {
    this.autoLoot = !this.autoLoot;
    MessageManager.notifyAutoLootToggle(this, this.autoLoot);
  }
  lookIn(containerName) {
    const location = gameManager.getLocation(this.currentLocation);
    const containerId = this.getContainerId(containerName) || findEntity(containerName, location.items, 'item');
    if (!containerId) {
      MessageManager.notifyNoContainerHere(this, containerName);
      return;
    }
    const container = items[containerId];
    if (container instanceof ContainerItem) {
      const itemsInContainer = container.inventory.map(itemId => items[itemId].name);
      MessageManager.notifyLookInContainer(this, container.name, itemsInContainer);
    } else {
      MessageManager.notifyNotAContainer(this, container.name);
    }
  }
}
// Health Regenerator ****************************************************************************
/*
 * The HealthRegenerator class is responsible for regenerating the player's health over time.
 * It uses a setInterval to call the regenerate method at regular intervals.
 */
class HealthRegenerator {
  constructor(player) {
    this.player = player;
    this.regenInterval = null;
  }
  start() {
    if (!this.regenInterval) {
      this.regenInterval = setInterval(() => this.regenerate(), REGEN_INTERVAL);
    }
  }
  regenerate() {
    const now = Date.now();
    const timeSinceLastRegen = (now - this.player.lastRegenTime) / 1000;
    const regenAmount = (this.getRegenAmountPerMinute() / 60) * timeSinceLastRegen;
    if (regenAmount > 0 && this.player.health < this.player.maxHealth) {
      this.player.health = Math.min(this.player.health + regenAmount, this.player.maxHealth);
      this.player.lastRegenTime = now;
    }
    if (this.player.health >= this.player.maxHealth) {
      this.stop();
    }
  }
  getRegenAmountPerMinute() {
    const regenRates = {
      "in combat": CONFIG.REGEN_RATES.IN_COMBAT,
      "standing": CONFIG.REGEN_RATES.STANDING,
      "sitting": CONFIG.REGEN_RATES.SITTING,
      "sleeping": CONFIG.REGEN_RATES.SLEEPING,
      "lying unconscious": CONFIG.REGEN_RATES.UNCONSCIOUS,
      "meditating": CONFIG.REGEN_RATES.MEDITATING,
    };
    return (regenRates[this.player.status] || 0) * this.player.maxHealth;
  }
  stop() {
    if (this.regenInterval) {
      clearInterval(this.regenInterval);
      this.regenInterval = null;
    }
  }
}
// Look At ***************************************************************************************
/*
 * The LookAt class is responsible for handling the player's "look" command.
 * It retrieves the target entity from the current location and formats the appropriate message.
 */
class LookAt {
  constructor(player) {
    this.player = player;
  }
  look(target) {
    const location = gameManager.getLocation(this.player.currentLocation);
    if (!location) return;
    const targetLower = target.toLowerCase();
    const playerNameLower = this.player.getName().toLowerCase();
    if (targetLower === 'self' || targetLower === playerNameLower || playerNameLower.startsWith(targetLower)) {
      this.lookAtSelf();
      return;
    }
    const itemInInventory = this.player.inventory.find(item => item.aliases.includes(targetLower));
    if (itemInInventory) {
      MessageManager.notifyLookAtItemInInventory(this.player, itemInInventory);
      return;
    }
    const itemInLocation = location.items.find(item => item.aliases.includes(targetLower));
    if (itemInLocation) {
      MessageManager.notifyLookAtItemInLocation(this.player, itemInLocation);
      return;
    }
    const npcId = location.npcs.find(npcId => {
      const npc = gameManager.getNpc(npcId);
      return npc && npc.aliases.includes(targetLower);
    });
    if (npcId) {
      const npc = gameManager.getNpc(npcId);
      MessageManager.notifyLookAtNpc(this.player, npc);
      return;
    }
    const otherPlayer = location.playersInLocation.find(player => player.name.toLowerCase() === targetLower);
    if (otherPlayer) {
      MessageManager.notifyLookAtOtherPlayer(this.player, otherPlayer);
      return;
    }
    MessageManager.notifyTargetNotFoundInLocation(this.player, target);
  }
  lookAtSelf() {
    MessageManager.notifyLookAtSelf(this.player);
  }
}
// Uid Generator **********************************************************************************
/*
 * The UidGenerator class is responsible for generating unique IDs for entities in the game.
 * It uses bcrypt to generate a unique value and return the hashed UID.
 */
class UidGenerator {
  static async generateUid() {
    const uniqueValue = Date.now() + Math.random();
    const hashedUid = await bcrypt.hash(uniqueValue.toString(), 5);
    return hashedUid;
  }
}
// NPC ********************************************************************************************
/*
 * The Npc class is responsible for representing non-player characters in the game.
 * It stores the NPC's ID, name, sex, current health, maximum health, attack power, CSML, aggro, assist, status, current location, aliases, and mobile status.
 */
class Npc {
  constructor(name, sex, currHealth, maxHealth, attackPower, csml, aggro, assist, status, currentLocation, aliases, mobile = false) {
    Object.assign(this, { name, sex, currHealth, maxHealth, attackPower, csml, aggro, assist, status, currentLocation, aliases, mobile });
    this.id = UidGenerator.generateUid(); // Use UidGenerator to generate UID
  }
}
// NPC Entries *************************************************************************************
const npcs = {
  '100': new Npc('Cityguard Ling', 'male', 100, 100, 10, 0, false, false, 'standing', '100', ['mob', 'npc', 'city']),
  '101': new Npc('Peacekeeper Chen', 'male', 100, 100, 10, 0, true, false, 'standing', '100', ['mob', 'npc', 'peacekeeper', 'peace', 'keeper', 'pea', 'kee', 'chen', 'che']),
};
// Item *******************************************************************************************
/*
 * The Item class is responsible for representing items in the game.
 * It stores the item's UID, name, description, and aliases.
 */
class Item {
  constructor(name, description, aliases) {
    this.uid = UidGenerator.generateUid(); // Use UidGenerator to generate UID
    Object.assign(this, { name, description, aliases, bcrypt });
  }
}
// Container Item *********************************************************************************
/*
 * The ContainerItem class extends the Item class and is used to represent items that can hold other items.
 * It adds an inventory property to store the items contained within the container.
 */
class ContainerItem extends Item {
  constructor(name, description, aliases) {
    super(name, description, aliases);
    this.inventory = [];
  }
}
// Weapon Item ************************************************************************************
/*
 * The WeaponItem class extends the Item class and is used to represent items that can be used in combat.
 * It adds a damage property to store the weapon's damage value.
 */
class WeaponItem extends Item {
  constructor(name, description, aliases) {
    super(name, description, aliases);
    this.damage = 0;
  }
}
// Item Entries ***********************************************************************************
const items = {
  '100': new Item('Health Potion', 'A potion that restores health.', ['potion', 'heal']),
};
// Container Item Entries *************************************************************************
const containerItems = {
  '100': new ContainerItem('Backpack', 'A sturdy backpack for carrying items.', ['pack', 'bag']),
  '101': new ContainerItem('Treasure Chest', 'A large chest filled with treasures.', ['chest', 'treasure']),
};
// Weapon Item Entries ****************************************************************************
const weaponItems = {
  '100': new WeaponItem('Rusty Sword', 'An old sword that has seen better days.', ['sword', 'rusty']),
};
// Inventory Manager ******************************************************************************
/*
 * The InventoryManager class is responsible for managing the player's inventory.
 * It handles the retrieval, transfer, and manipulation of items within the inventory.
 */
class InventoryManager {
  constructor(player) {
    this.player = player;
    this.messageManager = new MessageManager();
  }
  getAllItemsFromLocation() {
    this.getItemsFromSource(location[this.player.currentLocation].items, 'location');
  }
  getAllItemsFromContainer(containerName) {
    const containerId = this.getContainerId(containerName);
    if (!containerId) return;
    const container = items[containerId];
    if (container instanceof ContainerItem) {
      this.getItemsFromSource(container.inventory, 'container', container.name);
    }
  }
  getSingleItemFromContainer(itemName, containerName) {
    const containerId = this.getContainerId(containerName);
    if (!containerId) return;
    const container = items[containerId];
    if (container instanceof ContainerItem) {
      const item = container.inventory.find(i => items[i].name.toLowerCase() === itemName.toLowerCase());
      if (item) {
        this.transferItem(item, container, 'container');
      } else {
        this.messageManager.notifyNoItemInContainer(this.player, itemName, container.name);
      }
    }
  }
  getSingleItemFromLocation(target1) {
    const itemId = findEntity(target1, location[this.player.currentLocation].items, 'item');
    if (itemId) {
      this.transferItem(itemId, location[this.player.currentLocation], 'location');
    } else {
      this.messageManager.notifyNoItemHere(this.player, target1);
    }
  }
  dropAllItems() {
    this.dropItems(this.player.inventory, 'all');
  }
  dropAllSpecificItems(itemType) {
    const itemsToDrop = this.player.inventory.filter(item => this.itemMatchesType(item, itemType));
    this.dropItems(itemsToDrop, 'specific', itemType);
  }
  dropSingleItem(target1) {
    const item = this.player.inventory.find(i => i.name.toLowerCase() === target1.toLowerCase());
    if (item) {
      this.transferItem(item, location[this.player.currentLocation], 'drop');
    } else {
      this.messageManager.notifyNoItemToDrop(this.player, target1);
    }
  }
  putSingleItem(itemName, containerName) {
    const item = this.getItemFromInventory(itemName);
    if (!item) return;
    const containerId = this.getContainerId(containerName);
    if (!containerId) return;
    const container = items[containerId];
    if (container instanceof ContainerItem) {
      container.inventory.push(item.uid);
      this.player.inventory = this.player.inventory.filter(i => i !== item);
      this.messageManager.notifyItemPutInContainer(this.player, item.name, container.name);
    }
  }
  putAllItems(containerName) {
    const containerId = this.getContainerId(containerName);
    if (!containerId) return;
    const container = items[containerId];
    if (container instanceof ContainerItem) {
      const itemsToPut = this.player.inventory.filter(item => item !== container);
      if (itemsToPut.length === 0) {
        this.messageManager.notifyNoItemsToPut(this.player, container.name);
        return;
      }
      container.inventory.push(...itemsToPut.map(item => item.uid));
      this.player.inventory = this.player.inventory.filter(item => item === container);
      this.messageManager.notifyItemsPutInContainer(this.player, itemsToPut, container.name);
    }
  }
  putAllSpecificItemsIntoContainer(itemType, containerName) {
    const error = this.containerErrorMessage(containerName, 'hold');
    if (error) {
      this.messageManager.notify(this.player, error);
      return;
    }
    const containerId = findEntity(containerName, this.player.inventory, 'item');
    const container = items[containerId];
    if (container instanceof ContainerItem) {
      const itemsToPut = this.player.inventory.filter(item => item !== container && this.itemMatchesType(item, itemType));
      if (itemsToPut.length === 0) {
        this.messageManager.notifyNoSpecificItemsToPut(this.player, itemType, container.name);
        return;
      }
      container.inventory.push(...itemsToPut.map(item => item.uid));
      this.player.inventory = this.player.inventory.filter(item => !itemsToPut.includes(item));
      this.messageManager.notifyItemsPutInContainer(this.player, itemsToPut, container.name);
    }
  }
  itemMatchesType(item, itemType) {
    return item.name.toLowerCase().includes(itemType) || item.aliases.some(alias => alias.toLowerCase().includes(itemType));
  }
  getAllSpecificItemsFromLocation(itemType) {
    const currentLocation = location[this.player.currentLocation];
    if (currentLocation.items && currentLocation.items.length > 0) {
      const itemsTaken = currentLocation.items.filter(itemId => this.itemMatchesType(items[itemId], itemType));
      if (itemsTaken.length > 0) {
        this.player.inventory.push(...itemsTaken.map(itemId => items[itemId]));
        currentLocation.items = currentLocation.items.filter(itemId => !itemsTaken.includes(itemId));
        this.messageManager.notifyItemsTaken(this.player, itemsTaken);
      } else {
        this.messageManager.notifyNoSpecificItemsHere(this.player, itemType);
      }
    } else {
      this.messageManager.notifyNoItemsHere(this.player);
    }
  }
  getAllSpecificItemsFromContainer(itemType, containerName) {
    const error = this.containerErrorMessage(containerName, 'hold');
    if (error) {
      this.messageManager.notify(this.player, error);
      return;
    }
    const containerId = findEntity(containerName, this.player.inventory, 'item');
    const container = items[containerId];
    if (container instanceof ContainerItem) {
      const itemsTaken = container.inventory.filter(itemId => this.itemMatchesType(items[itemId], itemType));
      if (itemsTaken.length > 0) {
        this.player.inventory.push(...itemsTaken.map(itemId => items[itemId]));
        container.inventory = container.inventory.filter(itemId => !itemsTaken.includes(itemId));
        this.messageManager.notifyItemsTakenFromContainer(this.player, itemsTaken, container.name);
      } else {
        this.messageManager.notifyNoSpecificItemsInContainer(this.player, itemType, container.name);
      }
    }
  }
  autoLootNPC(npc) {
    if (npc.inventory && npc.inventory.length > 0) {
      const lootedItems = [...npc.inventory];
      this.player.inventory.push(...lootedItems.map(itemId => items[itemId]));
      npc.inventory = [];
      return this.messageManager.createAutoLootMessage(this.player, npc, lootedItems);
    }
    return null;
  }
  lootNPC(target1) {
    const npcId = findEntity(target1, location[this.player.currentLocation].npcs, 'npc');
    if (npcId) {
      const npc = npcs[npcId];
      if (npc.status === "lying unconscious" || npc.status === "lying dead") {
        if (npc.inventory && npc.inventory.length > 0) {
          const lootedItems = [...npc.inventory];
          this.player.inventory.push(...lootedItems.map(itemId => items[itemId]));
          npc.inventory = [];
          this.messageManager.notifyLootedNPC(this.player, npc, lootedItems);
        } else {
          this.messageManager.notifyNothingToLoot(this.player, npc);
        }
      } else {
        this.messageManager.notifyCannotLootNPC(this.player, npc);
      }
    } else {
      this.messageManager.notifyNoNPCToLoot(this.player, target1);
    }
  }
  lootAllNPCs() {
    const currentLocation = location[this.player.currentLocation];
    if (!currentLocation.npcs || currentLocation.npcs.length === 0) {
      this.messageManager.notifyNoNPCsToLoot(this.player);
      return;
    }
    const lootedItems = [];
    const lootedNPCs = [];
    currentLocation.npcs.forEach(npcId => {
      const npc = npcs[npcId];
      if ((npc.status === "lying unconscious" || npc.status === "lying dead") && npc.inventory && npc.inventory.length > 0) {
        lootedItems.push(...npc.inventory);
        this.player.inventory.push(...npc.inventory.map(itemId => items[itemId]));
        lootedNPCs.push(npc.name);
        npc.inventory = [];
      }
    });
    if (lootedItems.length > 0) {
      this.messageManager.notifyLootedAllNPCs(this.player, lootedNPCs, lootedItems);
    } else {
      this.messageManager.notifyNothingToLootFromNPCs(this.player);
    }
  }
  containerErrorMessage(containerName, action) {
    const containerId = findEntity(containerName, this.player.inventory, 'item');
    if (!containerId) {
      return `${this.player.getName()} doesn't have a ${containerName} to ${action}.`;
    }
    if (!items[containerId].inventory) {
      return MessageManager.notifyNotAContainer(this.player, items[containerId].name, action);
    }
    return null;
  }
  itemNotFoundMessage(itemName, location) {
    return MessageManager.notifyItemNotInInventory(this.player, itemName, location)
  }
  getItemsFromSource(source, sourceType, containerName) {
    if (source && source.length > 0) {
      const itemsTaken = source.map(itemId => items[itemId]);
      this.player.inventory.push(...itemsTaken);
      if (sourceType === 'location') {
        location[this.player.currentLocation].items = [];
      } else {
        items[containerName].inventory = [];
      }
      this.messageManager.notifyItemsTaken(this.player, itemsTaken);
    } else {
      this.messageManager.notifyNoItemsHere(this.player);
    }
  }
  dropItems(itemsToDrop, type, itemType) {
    if (itemsToDrop.length > 0) {
      if (!location[this.player.currentLocation].items) {
        location[this.player.currentLocation].items = [];
      }
      location[this.player.currentLocation].items.push(...itemsToDrop.map(item => item.uid));
      this.player.inventory = this.player.inventory.filter(item => !itemsToDrop.includes(item));
      this.messageManager.notifyItemsDropped(this.player, itemsToDrop);
    } else {
      this.messageManager.notifyNoItemsToDrop(this.player, type, itemType);
    }
  }
  getContainerId(containerName) {
    const containerId = findEntity(containerName, this.player.inventory, 'item');
    if (!containerId) {
      this.messageManager.notifyNoContainer(this.player, containerName);
      return null;
    }
    if (!items[containerId].inventory) {
      this.messageManager.notifyNotAContainer(this.player, items[containerId].name);
      return null;
    }
    return containerId;
  }
  getItemFromInventory(itemName) {
    const item = this.player.inventory.find(i => i.name.toLowerCase() === itemName.toLowerCase());
    if (!item) {
      this.messageManager.notifyItemNotInInventory(this.player, itemName);
    }
    return item;
  }
  transferItem(itemId, source, sourceType) {
    this.player.inventory.push(items[itemId]);
    if (sourceType === 'location') {
      source.items = source.items.filter(i => i !== itemId);
    } else {
      source.inventory = source.inventory.filter(i => i !== itemId);
    }
    this.messageManager.notifyItemTaken(this.player, items[itemId].name);
  }
}
// Combat Manager *********************************************************************************
/*
* The CombatManager class is responsible for managing combat between the player and NPCs.
* It handles the initiation, execution, and termination of combat, as well as the generation
* of combat messages and the handling of combat outcomes.
*/
// @ todo: Introduce more complex combat mechanics (e.g., special abilities, combos).
class CombatManager {
  #combatOrder = new Set();
  #defeatedNpcs = new Set();
  #combatInitiatedNpcs = new Set();
  constructor(gameManager) {
    this.gameManager = gameManager;
    this.techniques = this.initializeTechniques();
  }
  initializeTechniques() {
    return [
      "axe kick", "back kick", "back-fist", "butterfly kick", "butterfly twist kick", "canon fist",
      "crushing elbow", "crushing fist", "crushing hammer fist", "crushing hand", "crushing knee",
      "crushing kick", "crushing palm", "crushing shoulder strike", "crushing strike",
      "crouching leg-sweep kick", "crouching spinning leg-sweep kick", "cut kick", "dagger fingers",
      "dagger hand", "dagger kick", "diagonal knee", "double front kick", "double side kick",
      "downward roundhouse kick", "eagle claw", "falling elbow", "falling knee", "flying back kick",
      "flying drop kick", "flying front kick", "flying knee", "flying side kick", "front kick",
      "hammer fist", "headbutt", "hook kick", "inverted roundhouse kick", "inward elbow",
      "inside crescent kick", "jumping axe kick", "jumping back kick", "jumping double front kick",
      "jumping double roundhouse kick", "jumping double side kick", "jumping knee",
      "jumping reverse hook kick", "jumping roundhouse kick", "jumping spinning crescent kick",
      "jumping spinning hook kick", "knife hand", "knee-sweep kick", "leopard fist",
      "leg-sweep kick", "mantis fist", "oblique kick", "one knuckle fist", "outside crescent kick",
      "piercing elbow", "piercing fingers", "piercing fist", "piercing hand", "piercing knee",
      "piercing kick", "piercing palm", "piercing shoulder strike", "piercing strike",
      "reverse elbow", "ridge hand", "rising elbow", "rising knee", "roundhouse knee",
      "roundhouse kick", "scissor kick", "scoop kick", "scorpion kick", "shin kick",
      "shoulder strike", "side kick", "smashing elbow", "smashing fist", "smashing hammer fist",
      "smashing hand", "smashing knee", "smashing kick", "smashing palm", "smashing shoulder strike",
      "smashing strike", "snapping back-fist", "snapping elbow", "snapping fist",
      "snapping hammer fist", "snapping hand", "snapping knee", "snapping kick",
      "snapping palm", "snapping shoulder strike", "snapping strike", "spinning axe kick",
      "spinning back kick", "spinning crescent kick", "spinning elbow", "spinning heel kick",
      "spinning hook kick", "spinning leg-sweep kick", "spinning roundhouse kick",
      "spinning side kick", "stretch kick", "stomp kick", "stop kick", "switch kick",
      "thrusting fingers", "thrusting fist", "thrusting hand", "thrusting kick",
      "thrusting knee", "thrusting palm", "thrusting shoulder strike", "thrusting strike",
      "toe kick", "tornado axe kick", "tornado kick", "triple front kick", "triple side kick",
      "twisting kick", "two knuckle fist", "wheel kick", "whipping back-fist",
      "whipping elbow", "whipping fist", "whipping hammer fist", "whipping hand",
      "whipping knee", "whipping kick", "whipping palm", "whipping shoulder strike",
      "whipping strike"
    ];
  }
  initiateCombatWithNpc(npcId, player, playerInitiated = false) { // Public method to initiate combat
    this.startCombat(npcId, player, playerInitiated); // Calls the private method
  }
  endCombatForPlayer(player) { // Public method to end combat for a player
    this.endCombat(player); // Calls the private method
  }
  checkForAggressiveNpcs(player) { // Public method to check for aggressive NPCs
    this.checkAggressiveNpcs(player); // Calls a public method
  }
  checkAggressiveNpcs(player) { this._checkForAggressiveNpcs(player); } // New public method
  startCombat(npcId, player, playerInitiated) {
    const npc = this.gameManager.getNpc(npcId);
    if (!npc || this.#combatOrder.has(npcId)) return;
    this.#combatOrder.add(npcId);
    player.status !== "in combat"
      ? this.initiateCombat(player, npc, playerInitiated)
      : this.notifyCombatJoin(npc, player);
    npc.status = "engaged in combat";
  }
  initiateCombat(player, npc, playerInitiated) {
    player.status = "in combat";
    const message = playerInitiated
      ? MessageManager.notifyCombatInitiation(player, npc.getName())
      : MessageManager.notifyCombatInitiation(npc, player.getName());
    MessageManager.notifyCombatActionMessage(this.gameManager.getLocation(player.currentLocation), message.content);
    if (!playerInitiated) {
      player.lastAttacker = npc.id;
      this.#combatInitiatedNpcs.add(npc.id);
    }
    this.startCombatLoop(player);
  }
  notifyCombatJoin(npc, player) {
    MessageManager.notifyPlayersInLocation(this.gameManager.getLocation(player.currentLocation), {
      type: "combat",
      content: MessageManager.notifyCombatJoin(npc.getName()).content
    });
    this.#combatInitiatedNpcs.add(npc.id);
  }
  startCombatLoop(player) {
    if (player.status === "in combat" && !player.combatInterval) {
      player.combatInterval = setInterval(() => this.executeCombatRound(player), 1500);
    }
  }
  executeCombatRound(player) {
    while (true) {
      if (player.status !== "in combat") {
        this.endCombat(player);
        return;
      }
      const npc = this.getNextNpcInCombatOrder();
      if (npc) {
        // Display health percentages
        const playerHealthPercentage = (player.health / player.maxHealth) * 100;
        const npcHealthPercentage = (npc.health / npc.maxHealth) * 100;
        // Notify players of health status
        MessageManager.notifyPlayersInLocation(player.currentLocation,
          MessageManager.createCombatHealthStatusMessage(player, playerHealthPercentage, npc, npcHealthPercentage)
        );
        const result = this.performCombatAction(player, npc, true);
        if (npc.health <= 0) {
          this.handleNpcDefeat(npc, player);
        }
      }
      if (player.health <= 0) {
        this.handlePlayerDefeat(npc, player);
      }
    }
  }
  handlePlayerDefeat(defeatingNpc, player) {
    player.status = "lying unconscious";
    this.endCombat(player);
    MessageManager.notifyPlayersInLocation(this.gameManager.getLocation(player.currentLocation), {
      type: "combat",
      content: MessageManager.notifyDefeat(player, defeatingNpc.getName()).content
    });
  }
  handleNpcDefeat(npc, player) {
    npc.status = player.killer ? "lying dead" : "lying unconscious";
    player.status = "standing";
    player.experience += npc.experienceReward;
    const messages = this.generateDefeatMessages(player, npc);
    MessageManager.notifyPlayersInLocation(this.gameManager.getLocation(player.currentLocation), { type: "combat", content: messages.join("<br>") });
  }
  generateDefeatMessages(player, npc) {
    const messages = [MessageManager.notifyVictory(player, npc.getName()).content];
    const levelUpMessage = this.gameManager.checkLevelUp(player);
    if (levelUpMessage) messages.push(levelUpMessage);
    if (player.autoLoot) {
      const lootMessage = this.gameManager.autoLootNpc(npc, player);
      if (lootMessage) messages.push(lootMessage);
    }
    this.#combatOrder.delete(npc.id);
    this.#defeatedNpcs.add(npc.id);
    return messages;
  }
  endCombat(player) {
    if (player.combatInterval) {
      clearInterval(player.combatInterval);
      player.combatInterval = null;
    }
    this.#combatOrder.clear();
    this.#defeatedNpcs.clear();
    this.#combatInitiatedNpcs.clear();
    player.status = "standing";
    this.gameManager.fullStateSync(player);
    this.checkAggressiveNpcs(player);
  }
  _checkForAggressiveNpcs(player) {
    if (player.health > 0) {
      const location = this.gameManager.getLocation(player.currentLocation);
      if (location && location.npcs) {
        for (const npcId of location.npcs) {
          const npc = this.gameManager.getNpc(npcId);
          if (this._isAggressiveNpc(npc, player)) {
            this.startCombat(npcId, player, false);
          }
        }
      }
    }
  }
  _isAggressiveNpc(npc, player) {
    return npc && npc.aggressive &&
      npc.status !== "lying unconscious" &&
      npc.status !== "lying dead" &&
      player.status !== "lying unconscious" &&
      !this.#defeatedNpcs.has(npc.id);
  }
  performCombatAction(attacker, defender, isPlayer) {
    const outcome = this._calculateAttackOutcome(attacker, defender);
    const technique = this._getRandomTechnique();
    let damage = attacker.attackPower;
    let resistDamage = defender.defensePower;
    let description = this.getCombatDescription(outcome, attacker, defender, technique);
    if (outcome === "critical success") {
      damage *= 2;
    }
    if (damage > resistDamage) {
      defender.health -= damage - resistDamage;
    }
    return FormatMessageManager.createMessageData(`<span id="combat-message-${isPlayer ? "player" : "npc"}">${description}</span>`);
  }
  _getRandomTechnique() {
    return this.techniques[Math.floor(Math.random() * this.techniques.length)];
  }
  getCombatDescription(outcome, attacker, defender, technique) {
    const descriptions = {
      "attack is evaded": `${attacker.getName()} attacks ${defender.getName()} with a ${technique}, but ${defender.getName()} evades the strike!`,
      "attack is trapped": `${attacker.getName()} attacks ${defender.getName()} with a ${technique}, but ${defender.getName()} traps the strike!`,
      "attack is parried": `${attacker.getName()} attacks ${defender.getName()} with a ${technique}, but ${defender.getName()} parries the strike!`,
      "attack is blocked": `${attacker.getName()} attacks ${defender.getName()} with a ${technique}, but ${defender.getName()} blocks the strike!`,
      "attack hits": `${attacker.getName()} attacks ${defender.getName()} with a ${technique}. The strike successfully hits ${defender.getName()}!`,
      "critical success": `${attacker.getName()} attacks ${defender.getName()} with a devastatingly catastrophic ${technique}.<br>The strike critically hits ${defender.getName()}!`,
      "knockout": `${attacker.getName()} strikes ${defender.getName()} with a spectacularly phenomenal blow!<br>${defender.getName()}'s body goes limp and collapses to the ground!`,
    };
    return FormatMessageManager.createMessageData(descriptions[outcome] || `${attacker.getName()} attacks ${defender.getName()} with a ${technique}.`);
  }
  _calculateAttackOutcome(attacker, defender) {
    const roll = Math.floor(Math.random() * 20) + 1;
    let value = this._calculateAttackValue(attacker, defender, roll);
    if (value >= 21 || value === 19) return "critical success";
    if (value === 20) return "knockout";
    if (value >= 13) return "attack hits";
    if (value >= 10) return "attack is blocked";
    if (value >= 7) return "attack is parried";
    if (value >= 4) return "attack is trapped";
    if (value >= 1) return "attack is evaded";
    return "attack hits";
  }
  _calculateAttackValue(attacker, defender, roll) {
    if (attacker.level === defender.level) {
      return roll + attacker.csml;
    } else if (attacker.level < defender.level) {
      return (roll + attacker.csml) - (defender.level - attacker.level);
    } else {
      return (roll + attacker.csml) + (attacker.level - defender.level);
    }
  }
  attackNpc(player, target1) {
    const location = this.gameManager.getLocation(player.currentLocation);
    if (!location) return;
    const npcId = target1
      ? this.gameManager.findEntity(target1, location.npcs, "npc")
      : this.getAvailableNpcId(location.npcs);
    if (npcId) {
      const npc = this.gameManager.getNpc(npcId);
      if (!npc) return;
      if (npc.isUnconsciousOrDead()) {
        MessageManager.notifyNpcAlreadyInStatus(player, npc);
      } else {
        this.startCombat(npcId, player, true);
      }
    } else if (target1) {
      MessageManager.notifyTargetNotFound(player, target1);
    } else {
      MessageManager.notifyNoConsciousEnemies(player);
    }
  }
  getAvailableNpcId(npcs) {
    return npcs.find(id => {
      const npc = this.gameManager.getNpc(id);
      return npc && !npc.isUnconsciousOrDead();
    });
  }
  getCombatOrder() {
    return this.#combatOrder;
  }
  getNextNpcInCombatOrder() {
    return Array.from(this.#combatOrder)[0]; // Returns the first NPC in combat order
  }
}
// Describe Location Manager***********************************************************************
/*
 * The DescribeLocationManager class is responsible for describing the current location of the player.
 * It retrieves the location object from the game manager and formats the description based on the
 * location's details. The formatted description is then sent to the player.
 */
class DescribeLocationManager {
  constructor(player) {
    this.player = player;
  }
  describe() {
    const location = gameManager.getLocation(this.player.currentLocation);
    if (!location) {
      MessageManager.notify(this.player, `${this.player.getName()} is in an unknown location.`);
      return;
    }
    const description = this.formatDescription(location);
    MessageManager.notify(this.player, description);
  }
  formatDescription(location) {
    const title = { cssid: `location-title`, text: location.getName() };
    const desc = { cssid: `location-description`, text: location.getDescription() };
    const exits = { cssid: `location-exits`, text: 'Exits:' };
    const exitsList = this.getExitsDescription(location);
    const items = this.getItemsDescription(location);
    const npcs = this.getNpcsDescription(location);
    const players = this.getPlayersDescription(location);
    return {
      title,
      desc,
      exits,
      exitsList,
      items,
      npcs,
      players,
    };
  }
  getExitsDescription(location) {
    return Object.entries(location.exits).map(([direction, linkedLocation]) => ({
      cssid: `exit-${direction}`,
      text: `${direction.padEnd(6, ' ')} - ${linkedLocation.getName()}`,
    }));
  }
  getItemsDescription(location) {
    return location.items.map(item => ({
      cssid: `item-${item.uid}`,
      text: `A ${item.name} is lying here.`,
    }));
  }
  getNpcsDescription(location) {
    return location.npcs.map(npcId => {
      const npc = gameManager.getNpc(npcId);
      return npc ? { cssid: `npc-${npc.id}`, text: `${npc.getName()} is ${npc.status} here.` } : null;
    }).filter(npc => npc);
  }
  getPlayersDescription(location) {
    return location.playersInLocation.map(otherPlayer => ({
      cssid: `player`,
      text: `${otherPlayer.getName()} is ${otherPlayer.getStatus()} here.`,
    }));
  }
}
// Format Message Manager *************************************************************************
/*
 * The FormatMessageManager class is responsible for creating and managing message data that is
 * sent to players within the game. It centralizes the formatting of messages, ensuring consistency
 * in how messages are constructed and sent. This class provides methods to create message data with
 * associated CSS IDs for styling and to retrieve predefined message IDs based on specific types of
 * messages (e.g., login success, combat notifications). By centralizing message handling, it
 * simplifies the process of modifying or updating message formats and ensures that all messages
 * adhere to a consistent structure throughout the game.
 */
class FormatMessageManager {
  static createMessageData(cssid = '', message) {
    return { cssid, content: message }; // Return message with cssid
  }
  static getIdForMessage(type) {
    const messageIds = {
      loginSuccess: 'player-name',
      incorrectPassword: 'error-message',
      inventoryStatus: 'inventory-list',
      lootAction: 'combat-message',
      targetNotFound: 'error-message',
      combatInitiation: 'combat-message-player',
      combatJoin: 'combat-message-npc',
      combatMessageHealth: 'combat-message-health',
      defeat: 'combat-message-npc',
      victory: 'combat-message-player',
      meditationAction: 'combat-message',
      meditationStart: 'combat-message',
      sleepAction: 'combat-message',
      standingUp: 'combat-message',
      wakingUp: 'combat-message',
      alreadySitting: 'error-message',
      alreadyStanding: 'error-message',
      disconnectionFailedAttempts: 'error-message',
      stats: 'combat-message',
      invalidItemAddition: 'error-message',
      inventoryFull: 'error-message',
      itemNotFoundInInventory: 'error-message',
      leavingLocation: 'combat-message',
      enteringLocation: 'combat-message',
      combatActionMessage: 'combat-message',
      dataLoadError: 'error-message',
      dataSaveError: 'error-message',
      generalError: 'error-message',
      lookAtSelf: 'combat-message', // New message ID for looking at self
      lookAtItem: 'combat-message', // New message ID for looking at item
      lookAtNpc: 'combat-message', // New message ID for looking at NPC
      lookAtOtherPlayer: 'combat-message', // New message ID for looking at other player
    };
    return messageIds[type] || '';
  }
}
// Message Manager ********************************************************************************
/*
 * MessageManager is responsible for handling communication of messages to players within the
 * game. This centralizes message handling, ensuring consistency in how messages are constructed,
 * and sent to players. Centralizing all messages in one place is convenient for editing
 * purposes. Each method formats the message with cssid. This is used by the client to style HTML
 * elements. It also includes methods for notifying players in specific locations, handling errors,
 * and managing inventory notifications.
 */
class MessageManager {
  // Notification Methods *************************************************************************
  static notify(player, message, cssid = '') {
    this.logger.info(`Message to ${player.getName()}: ${message}`);
    return FormatMessageManager.createMessageData(cssid, message); // Return message with cssid
  }
  // Login Notifications **************************************************************************
  static notifyLoginSuccess(player) {
    return this.notify(player, `${player.getName()} has logged in successfully!`, this.getIdForMessage('loginSuccess'));
  }
  static notifyIncorrectPassword(player) {
    return this.notify(player, `Incorrect password. Please try again.`, this.getIdForMessage('incorrectPassword'));
  }
  static notifyDisconnectionDueToFailedAttempts(player) {
    return this.notify(player, `${player.getName()} has been disconnected due to too many failed login attempts.`, this.getIdForMessage('disconnectionFailedAttempts'));
  }
  // Player Notifications *************************************************************************
  static notifyPlayersInLocation(location, message) {
    if (!location || !location.playersInLocation) return;
    location.playersInLocation.forEach(player => {
      this.notify(player, message);
    });
  }
  // Inventory Notifications **********************************************************************
  static notifyInventoryStatus(player) {
    return this.notify(player, `${player.getName()}'s inventory:`, this.getIdForMessage('inventoryStatus'));
  }
  static notifyPickupItem(player, itemName) {
    return this.notify(player, `${player.getName()} picks up ${itemName}.`, this.getIdForMessage('pickupItem'));
  }
  static notifyDropItem(player, itemName) {
    return this.notify(player, `${player.getName()} drops ${itemName}.`, this.getIdForMessage('dropItem'));
  }
  static notifyInventoryFull(player) {
    return this.notify(player, `${player.getName()}'s inventory is full.`, this.getIdForMessage('inventoryFull'));
  }
  static notifyItemNotFoundInInventory(player) {
    return this.notify(player, `Item not found in ${player.getName()}'s inventory.`, this.getIdForMessage('itemNotFoundInInventory'));
  }
  static notifyInvalidItemAddition(player, itemName) {
    return this.notify(player, `Cannot add invalid item: ${itemName}`, this.getIdForMessage('invalidItemAddition'));
  }
  // Combat Notifications *************************************************************************
  static notifyCombatInitiation(attacker, defenderName) {
    return this.notify(attacker, `${attacker.getName()} attacks ${defenderName}.`, this.getIdForMessage('combatInitiation'));
  }
  static notifyCombatJoin(npc, player) {
    return this.notify(null, `${npc.getName()} attacks ${player.getName()}!`, this.getIdForMessage('combatJoin'));
  }
  static createCombatHealthStatusMessage(player, playerHealthPercentage, npc, npcHealthPercentage) {
    return FormatMessageManager.createMessageData(
      '',
      `${player.getName()}: ${playerHealthPercentage.toFixed(2)}% | ${npc.getName()}: ${npcHealthPercentage.toFixed(2)}%`
    );
  }
  static notifyDefeat(player, defeatingNpcName) {
    return this.notify(player, `${player.getName()} has been defeated by ${defeatingNpcName}.`, this.getIdForMessage('defeat'));
  }
  static notifyVictory(player, defeatedNpcName) {
    return this.notify(player, `${player.getName()} has defeated ${defeatingNpcName}!`, this.getIdForMessage('victory'));
  }
  static notifyCombatActionMessage(player, message) {
    return this.notify(player, message, this.getIdForMessage('combatActionMessage'));
  }
  static notifyNpcAlreadyInStatus(player, npc) {
    const pronoun = npc.getPronoun();
    return this.notify(player, `${npc.getName()} is already ${npc.getStatus()}. It would be dishonorable to attack ${pronoun} now.`);
  }
  // Inventory Notifications **********************************************************************
  static notifyNoItemInContainer(player, itemName, containerName) {
    return this.notify(player, `There doesn't seem to be any ${itemName} in the ${containerName}.`);
  }
  static notifyNoItemHere(player, itemName) {
    return this.notify(player, `There doesn't seem to be any ${itemName} here.`);
  }
  static notifyNoItemToDrop(player, itemName) {
    return this.notify(player, `${player.getName()} doesn't seem to have any ${itemName}'s to drop.`);
  }
  static notifyItemPutInContainer(player, itemName, containerName) {
    return this.notify(player, `${player.getName()} places a ${itemName} into a ${containerName}.`);
  }
  static notifyNoItemsToPut(player, containerName) {
    return this.notify(player, `${player.getName()} has nothing to put in the ${containerName}.`);
  }
  static notifyItemsPutInContainer(player, items, containerName) {
    const itemsList = items.map(item => item.name).join(", ");
    return this.notify(player, `${player.getName()} places the following items into the ${containerName}: ${itemsList}`);
  }
  static notifyNoSpecificItemsToPut(player, itemType, containerName) {
    return this.notify(player, `${player.getName()} has no ${itemType} to put in the ${containerName}.`);
  }
  static notifyItemsTaken(player, items) {
    const itemsList = items.map(item => item.name).join(", ");
    return this.notify(player, `${player.getName()} picks up: ${itemsList}`);
  }
  static notifyNoSpecificItemsHere(player, itemType) {
    return this.notify(player, `There doesn't seem to be any ${itemType} here.`);
  }
  static notifyNoItemsHere(player, itemType) {
    return this.notify(player, `There doesn't seem to be any ${itemType} to take here.`);
  }
  static notifyItemsTakenFromContainer(player, items, containerName) {
    const itemsList = items.map(itemId => items[itemId].name).join(", ");
    return this.notify(player, `${player.getName()} retrieves the following items from a ${containerName}: ${itemsList}`);
  }
  static notifyNoSpecificItemsInContainer(player, itemType, containerName) {
    return this.notify(player, `There doesn't seem to be any ${itemType} in the ${containerName}.`);
  }
  static createAutoLootMessage(player, npc, lootedItems) {
    const itemsList = lootedItems.map(itemId => items[itemId].name).join(", ");
    return `${player.getName()} searches ${npc.getName()} and grabs: ${itemsList}`;
  }
  static notifyLootedNPC(player, npc, lootedItems) {
    const itemsList = lootedItems.map(itemId => items[itemId].name).join(", ");
    return this.notify(player, `${player.getName()} searches ${npc.getName()} and grabs ${itemsList}`);
  }
  static notifyNothingToLoot(player, npc) {
    return this.notify(player, `${player.getName()} searches diligently, but finds nothing worth looting from ${npc.getName()}.`);
  }
  static notifyCannotLootNPC(player, npc) {
    return this.notify(player, `${npc.getName()} is not unconscious or dead. ${player.getName()} it would be dishonorable to loot them.`);
  }
  static notifyNoNPCToLoot(player, target) {
    return this.notify(player, `There doesn't seem to be any ${target} here to loot.`);
  }
  static notifyNoNPCsToLoot(player) {
    return this.notify(player, `There doesn't seem to be anyone here to loot.`);
  }
  static notifyLootedAllNPCs(player, lootedNPCs, lootedItems) {
    const itemsList = lootedItems.map(itemId => items[itemId].name).join(", ");
    return this.notify(player, `${player.getName()} searches ${lootedNPCs.join(", ")} and grabs: ${itemsList}`);
  }
  static notifyNothingToLootFromNPCs(player) {
    return this.notify(player, `${player.getName()} searches diligently, but finds nothing worth looting.`);
  }
  static notifyItemsDropped(player, items) {
    const itemsList = items.map(item => item.name).join(", ");
    return this.notify(player, `${player.getName()} drops: ${itemsList}`);
  }
  static notifyNoItemsToDrop(player, type, itemType) {
    const itemTypeText = type === 'all' ? 'items' : itemType;
    return this.notify(player, `${player.getName()} has no ${itemTypeText} to drop.`);
  }
  static notifyNoContainer(player, containerName) {
    return this.notify(player, `${player.getName()} doesn't seem to have any ${containerName}.`);
  }
  static notifyNotAContainer(player, itemName, action) {
    return this.notify(player, `The ${itemName} is not a container.`);
  }
  static notifyItemNotInInventory(player, itemName, location) {
    return this.notify(player, `${player.getName()} doesn't seem to have any ${itemName} in ${player.getPossessivePronoun()} inventory.`);
  }
  static notifyItemTaken(player, itemName) {
    return this.notify(player, `${player.getName()} grabs a ${itemName}.`);
  }
  // Look Notifications ***************************************************************************
  static notifyLookAtSelf(player) { // New method for looking at self
    return this.notify(player, `${player.getName()} looks at themselves, feeling a sense of self-awareness.`, this.getIdForMessage('lookAtSelf'));
  }
  static notifyLookAtItemInInventory(player, item) {
    return this.notify(player, `${player.getName()} looks at ${item.name} in their inventory.`, this.getIdForMessage('lookAtItem'));
  }
  static notifyLookAtItemInLocation(player, item) {
    return this.notify(player, `${player.getName()} looks at the ${item.name} lying here.`, this.getIdForMessage('lookAtItem'));
  }
  static notifyLookAtNpc(player, npc) {
    return this.notify(player, `${player.getName()} looks at ${npc.getName()}, who is currently ${npc.status}.`, this.getIdForMessage('lookAtNpc'));
  }
  static notifyLookAtOtherPlayer(player, otherPlayer) {
    return this.notify(player, `${player.getName()} looks at ${otherPlayer.getName()}, who is currently ${otherPlayer.getStatus()}.`, this.getIdForMessage('lookAtOtherPlayer'));
  }
  static notifyLookInContainer(player, containerName, items) {
    const itemsList = items.length > 0 ? items.join(", ") : 'nothing.';
    return this.notify(player, `You look inside the ${containerName} and see: ${itemsList}`);
  }
  static notifyNoContainerHere(player, containerName) {
    return this.notify(player, `You don't see a ${containerName} here.`);
  }
  static notifyNotAContainer(player, containerName) {
    return this.notify(player, `The ${containerName} is not a container.`);
  }
  // Status Notifications *************************************************************************
  static notifyMeditationAction(player) {
    return this.notify(player, `${player.getName()} starts meditating.`, this.getIdForMessage('meditationAction'));
  }
  static notifyMeditationStart(player) {
    return this.notify(player, `${player.getName()} is now meditating.`, this.getIdForMessage('meditationStart'));
  }
  static notifySleepAction(player) {
    return this.notify(player, `${player.getName()} goes to sleep.`, this.getIdForMessage('sleepAction'));
  }
  static notifyStandingUp(player) {
    return this.notify(player, `${player.getName()} stands up.`, this.getIdForMessage('standingUp'));
  }
  static notifyWakingUp(player) {
    return this.notify(player, `${player.getName()} wakes up.`, this.getIdForMessage('wakingUp'));
  }
  static notifyAlreadySitting(player) {
    return this.notify(player, `${player.getName()} is already sitting.`, this.getIdForMessage('alreadySitting'));
  }
  static notifyAlreadyStanding(player) {
    return this.notify(player, `${player.getName()} is already standing.`, this.getIdForMessage('alreadyStanding'));
  }
  // Location Notifications ***********************************************************************
  static notifyLeavingLocation(player, oldLocationId, newLocationId) {
    const direction = player.getDirectionTo(newLocationId);
    return this.notify(player, `${player.getName()} travels ${direction}.`, this.getIdForMessage('leavingLocation'));
  }
  static notifyEnteringLocation(player, newLocationId) {
    const direction = player.getDirectionFrom(newLocationId);
    return this.notify(player, `${player.getName()} arrives ${direction}.`, this.getIdForMessage('enteringLocation'));
  }
  // Logger Error Notifications *******************************************************************
  static notifyDataLoadError(manager, logger, key, error) {
    logger.error(`Error loading data for ${key}: ${error}`);
  }
  static notifyDataSaveError(manager, logger, filePath, error) {
    logger.error(`Error saving data to ${filePath}: ${error}`);
  }
  static notifyError(manager, logger, message) {
    logger.error(`Error: ${message}`);
  }
}