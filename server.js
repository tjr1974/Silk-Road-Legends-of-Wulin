/*
 * The Server class is the main entry point for the game server. It is responsible for initializing
 * the server environment, setting up middleware, and managing the game loop.
 */
// Server *****************************************************************************************
class Server {
  constructor() {
    this.logger = null; // Logger instance for logging server activities
    this.initializeModules(); // Ensure modules are initialized first
  }
  // Initialize Modules ***************************************************************************
  /*
  * The initializeModules method loads and initializes the server modules.
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
    this.initializeQueue(); // Changed to synchronous
  }
  // Create Server ********************************************************************************
  /*
  * The createServer method is responsible for creating the server instance.
  * It checks for the availability of SSL certificates and creates the server accordingly.
  * If SSL certificates are not found, it defaults to HTTP.
  */
  async createServer() {
    this.logger.debug(`Creating server with SSL_KEY_PATH: ${SSL_KEY_PATH} and SSL_CERT_PATH: ${SSL_CERT_PATH}`); // Added debug message
    const SSL_KEY_PATH = './ssl/server.key'; // Added named constant for SSL key path
    const SSL_CERT_PATH = './ssl/server.crt'; // Added named constant for SSL cert path
    const sslOptions = {
      key: await this.fs.access(SSL_KEY_PATH).then(() => this.fs.readFile(SSL_KEY_PATH)), // Updated to use named constant
      cert: await this.fs.access(SSL_CERT_PATH).then(() => this.fs.readFile(SSL_CERT_PATH)), // Updated to use named constant
    };
    if (!sslOptions.key || !sslOptions.cert) {
      this.logger.warn(`SSL files not found, defaulting to HTTP.`); // Updated to use template literals
      return require('http').createServer(this.app); // Use 'http' module if SSL is not available
    }
    this.logger.debug(`SSL files found, creating HTTPS server.`); // Added debug message
    return require('https').createServer(sslOptions, this.app); // Use 'https' module if SSL is available
  }
  // Start Server *********************************************************************************
  /*
  * The start method starts the server and listens for incoming connections.
  * It logs the server's operational status and address for easy access.
  */
  async start() {
    this.logger.debug(`Starting server on ${this.CONFIG.HOST}:${this.CONFIG.PORT}`); // Added debug message
    this.app.listen(this.CONFIG.PORT, this.CONFIG.HOST, () => {
      this.logger.info(`Server running on https://${this.CONFIG.HOST}:${this.CONFIG.PORT}`); // Updated to use template literals
    });
  }
  // Setup Middleware *****************************************************************************
  /*
  * The setupMiddleware method configures middleware for the server.
  * It uses PinoHttp middleware for logging and Express static middleware for serving static files.
  */
  setupMiddleware() {
    this.app.use(this.pinoHttp({ logger: this.logger }));
    this.app.use(this.express.static('public')); // Updated to use template literals
  }
  // Setup Routes ********************************************************************************
  /*
  * The setupRoutes method defines the routes for the server.
  * It establishes the main route for the server, providing a welcome message to users.
  */
  setupRoutes() {
    this.app.get('/', (req, res) => {
      req.log.info('Logging services started. Level: [level: info]...');
      res.send(`Welcome to the Game Server!`); // Updated to use template literals
    });
    this.setupSocketListeners(); // Call the method to set up socket listeners
    this.setupSocketEmitters(); // Call the method to set up socket emitters
  }
  // Setup Socket Listeners ***********************************************************************
  /*
  * The setupSocketListeners method sets up socket listeners.
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
  * The setupSocketEmitters method sets up socket emitters.
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
  * The loadGameData method loads essential game data from the database.
  * It retrieves location, NPC, and item data to ensure the game state is ready for interaction.
  */
  loadGameData() {
    this.logger.debug(`Loading game data...`); // Added debug message
    // Load data from files (e.g., players, NPCs)
    this.databaseManager.loadLocationData();
    this.databaseManager.loadNpcData();
    this.databaseManager.loadItemData();
    this.logger.debug(`Game data loaded successfully.`); // Added debug message
  }
  // Initialize Queue *****************************************************************************
  /*
  * The initializeQueue method creates a new queue instance for the server.
  * It assigns the queue instance to the queueManager for managing asynchronous tasks.
  */
  initializeQueue() { // Changed to synchronous
    this.queue = (import('queue')).default(); // Removed async/await
  }
  // Initialize Server ******************************************************************************
  /*
  * The initializeServer method initializes the server.
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
 * particularly beneficial in performance-sensitive applications.
 */
class ObjectPool {
  constructor(createFunc, size) {
    this.createFunc = createFunc; // Function to create new objects
    this.pool = Array.from({ length: size }, this.createFunc); // Preallocate objects in the pool
    this.available = []; // Array to track available objects for reuse
  }
  acquire() {
    return this.available.length > 0 ? this.available.pop() : this.pool.pop(); // Acquire an object from the pool
  }
  release(object) {
    this.available.push(object); // Release an object back to the pool
  }
}
// Task Class ************************************************************************************
/*
* The Task class is responsible for representing a task in the game's task queue.
* It contains a name and a placeholder for the task execution function.
*/
class Task {
  constructor(name) {
    this.name = name; // Name of the task
    this.execute = null; // Placeholder for the task execution function
  }
  async run() { // Method to execute the task
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
    this.queue = []; // Array to hold tasks in the queue
    this.isProcessing = false; // Track if the queue is currently processing
    this.taskPool = new ObjectPool(() => new Task(''), 10); // Object pool for task management
  }
  addTask(task) {
    this.logger.debug(`Adding task: ${task.name}`); // Log task addition
    this.queue.push(task); // Add task to the queue
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
        resolve(); // Resolve the promise after a delay
      }, 1000); // Adjust time as needed
    });
  }
  // Methods to add tasks
  addDataLoadTask(filePath, key) {
    const task = this.taskPool.acquire(); // Acquire a task from the pool
    task.name = 'Data Load Task'; // Set task name
    task.execute = async () => {
      const data = await this.databaseManager.loadData(filePath, key); // Load data using the database manager
      this.taskPool.release(task); // Release the task back to the pool
    };
    this.addTask(task); // Add the task to the queue
  }
  addDataSaveTask(filePath, key, data) {
    const task = this.taskPool.acquire(); // Acquire a task from the pool
    task.name = 'Data Save Task'; // Set task name
    task.execute = async () => {
      await this.databaseManager.saveData(filePath, key, data); // Save data using the database manager
      this.taskPool.release(task); // Release the task back to the pool
    };
    this.addTask(task); // Add the task to the queue
  }
  addCombatActionTask(player, target) {
    const task = this.taskPool.acquire(); // Acquire a task from the pool
    task.name = 'Combat Action Task'; // Set task name
    task.execute = async () => {
      player.attackNpc(target); // Execute combat action
      this.taskPool.release(task); // Release the task back to the pool
    };
    this.addTask(task); // Add the task to the queue
  }
  addEventProcessingTask(event) {
    const task = this.taskPool.acquire(); // Acquire a task from the pool
    task.name = 'Event Processing Task'; // Set task name
    task.execute = async () => {
      // Process the event (e.g., day/night transition)
      this.taskPool.release(task); // Release the task back to the pool
    };
    this.addTask(task); // Add the task to the queue
  }
  addHealthRegenerationTask(player) {
    const task = this.taskPool.acquire(); // Acquire a task from the pool
    task.name = 'Health Regeneration Task'; // Set task name
    task.execute = async () => {
      player.startHealthRegeneration(); // Start health regeneration for the player
      this.taskPool.release(task); // Release the task back to the pool
    };
    this.addTask(task); // Add the task to the queue
  }
  addInventoryManagementTask(player, action, item) {
    const task = this.taskPool.acquire(); // Acquire a task from the pool
    task.name = 'Inventory Management Task'; // Set task name
    task.execute = async () => {
      if (action === 'pickup') {
        player.addToInventory(item); // Add item to player's inventory
      } else if (action === 'drop') {
        player.removeFromInventory(item); // Remove item from player's inventory
      }
      this.taskPool.release(task); // Release the task back to the pool
    };
    this.addTask(task); // Add the task to the queue
  }
  addNotificationTask(player, message) {
    const task = this.taskPool.acquire(); // Acquire a task from the pool
    task.name = 'Notification Task'; // Set task name
    task.execute = async () => {
      MessageManager.notify(player, message); // Send notification to the player
      this.taskPool.release(task); // Release the task back to the pool
    };
    this.addTask(task); // Add the task to the queue
  }
  cleanup() { // New cleanup method
    this.queue = []; // Clear the queue
    this.isProcessing = false; // Reset processing state
    this.taskPool = null; // Clear task pool reference
  }
}
// Database Manager  ******************************************************************************
/*
* The DatabaseManager class is responsible for managing the game's data storage and retrieval.
* It provides methods to load and save data from various files, such as player, location, NPC,
* and item data.
*/
import { PLAYER_DATA_PATH, LOCATION_DATA_PATH, NPC_DATA_PATH, ITEM_DATA_PATH } from './config.js'; // Ensure config.js exports these constants
import CONFIG from './config.js'; // Ensure CONFIG is correctly imported
import { MessageManager } from './MessageManager.js'; // Example import, ensure this file exists
import { EventEmitter } from 'events'; // Ensure 'events' module is available
import { CombatManager } from './CombatManager.js'; // Ensure this file exists
import { GameManager } from './GameManager.js'; // Ensure this file exists
import { QueueManager } from './QueueManager.js'; // Ensure this file exists
import { ObjectPool } from './ObjectPool.js'; // Ensure this file exists
import { Task } from './Task.js'; // Ensure this file exists
class DatabaseManager {
  constructor() {
    this.fs = import('fs').promises; // Use promises API for file system operations
  }
  async loadData(filePaths) { // Updated to accept an array of file paths
    const data = {};
    await Promise.all(filePaths.map(async (filePath) => {
      try {
        const fileContent = await this.fs.readFile(filePath, 'utf-8'); // Read file content
        data[filePath] = JSON.parse(fileContent); // Parse JSON data
      } catch (error) {
        MessageManager.notifyError(this, `Error loading data from ${filePath}: ${error}`); // Notify error
        data[filePath] = {}; // Default to empty object on error
      }
    }));
    return data; // Return all loaded data
  }
  async saveData(filePath, key, data) { // Updated to handle batch saving
    try {
      const existingData = await this.loadData([filePath]); // Load existing data
      existingData[filePath][key] = data; // Update the specific key with new data
      await this.fs.writeFile(filePath, JSON.stringify(existingData[filePath], null, 2)); // Save updated data
      this.logger.info(`Data saved for ${key} to ${filePath}`); // Log successful save
    } catch (error) {
      DatabaseManager.notifyDataSaveError(this, filePath, error); // Notify error if saving fails
    }
  }
  async loadPlayerData(username) {
    return this.loadData(PLAYER_DATA_PATH, username); // Load player data
  }
  async savePlayerData(playerData) {
    await this.saveData(PLAYER_DATA_PATH, playerData.username, playerData); // Save player data
  }
  async loadLocationData(locationId) {
    return this.loadData(LOCATION_DATA_PATH, locationId); // Load location data
  }
  async saveLocationData(locationData) {
    await this.saveData(LOCATION_DATA_PATH, locationData.id, locationData); // Save location data
  }
  loadNpcData(npcId) { // Removed async
    return this.loadData(NPC_DATA_PATH, npcId); // Load NPC data
  }
  saveNpcData(npcData) { // Removed async
    this.saveData(NPC_DATA_PATH, npcData.id, npcData); // Save NPC data
  }
  loadItemData(itemId) { // Removed async
    return this.loadData(ITEM_DATA_PATH, itemId); // Load item data
  }
  saveItemData(itemData) { // Removed async
    this.saveData(DatabaseManager.ITEM_DATA_PATH, itemData.id, itemData); // Save item data
  }
}
// Game Manager ***********************************************************************************
/*
* The GameManager class is responsible for managing the game state and its components.
* It provides methods to start and stop the game, add players, manage locations and NPCs,
* and handle game events.
*/
class GameManager {
  #gameLoopInterval = null; // Declare the private field for game loop interval
  #gameTime = 0; // Declare the private field for game time
  #isRunning = false; // Add this line to declare the private field for game state
  #combatManager; // Private field for combat manager instance
  constructor() {
    this.players = new Map(); // Map to store players
    this.locations = new Map(); // Map to store locations
    this.npcs = new Map(); // Map to store NPCs
    this.#combatManager = new CombatManager(this); // Initialize combat manager
    this.eventEmitter = new EventEmitter(); // Initialize event emitter for handling events
  }
  getGameTime() {
    return this.#gameTime; // Return current game time
  }
  setGameTime(newTime) {
    this.#gameTime = newTime; // Set new game time
  }
  async startGame() {
    try {
      MessageManager.notifyGameInitialization(this); // Notify game initialization
      this.eventEmitter.emit('gameStarted'); // Emit game started event
      this.startGameLoop(); // Call the public method to start the game loop
      this.#isRunning = true; // Mark game as running
      MessageManager.notifyGameInitializedSuccessfully(this); // Notify successful game initialization
    } catch (error) {
      MessageManager.notifyError(this, `Error initializing game: ${error}`); // Notify error during initialization
      throw error; // Rethrow error
    }
  }
  async shutdownGame() {
    try {
      this.stopGameLoop(); // Call the public method to stop the game loop
      for (const player of this.players.values()) {
        await player.save(); // Save each player's state
      }
      MessageManager.notifyGameShutdownSuccess(this); // Notify successful game shutdown
    } catch (error) {
      MessageManager.notifyError(this, `Error shutting down game: ${error}`); // Notify error during shutdown
      throw error; // Rethrow error
    }
  }
  addPlayer(player) {
    this.players.set(player.getId(), player); // Efficient insertion of player
  }
  getPlayer(playerId) {
    return this.players.get(playerId); // Efficient lookup of player
  }
  removePlayer(playerId) {
    this.players.delete(playerId); // Efficient removal of player
  }
  addLocation(location) {
    this.locations.set(location.getId(), location); // Efficient insertion of location
  }
  getLocation(locationId) {
    return this.locations.get(locationId); // Efficient lookup of location
  }
  addNpc(npc) {
    this.npcs.set(npc.getId(), npc); // Efficient insertion of NPC
  }
  getNpc(npcId) {
    return this.npcs.get(npcId); // Efficient lookup of NPC
  }
  removeNpc(npcId) {
    this.npcs.delete(npcId); // Efficient removal of NPC
  }
  startGameLoop() { // Public method to start the game loop
    this.startGameLoopInternal(); // Calls a public method to start the internal loop
  }
  stopGameLoop() { // Public method to stop the game loop
    this.stopGameLoopInternal(); // Calls a public method to stop the internal loop
  }
  incrementGameTime() { // Public method to increment game time
    this.incrementGameTimeInternal(); // Calls a public method to increment the internal game time
  }
  getCurrentGameTime() { // Public method to get current game time
    return this.getGameTime(); // Calls the public getter for game time
  }
  startGameLoopInternal() { this._startGameLoop(); } // New public method to start the internal game loop
  stopGameLoopInternal() { this._stopGameLoop(); } // New public method to stop the internal game loop
  incrementGameTimeInternal() { this._updateGameTime(); } // New public method to update the internal game time
  _startGameLoop() {
    this.#gameLoopInterval = setInterval(() => this._gameTick(), TICK_RATE); // Start the game loop at defined tick rate
  }
  _stopGameLoop() {
    if (this.#gameLoopInterval) {
      clearInterval(this.#gameLoopInterval); // Clear the game loop interval
      this.#gameLoopInterval = null; // Reset interval reference
    }
  }
  _gameTick() {
    // Update all NPCs in the game
    this._updateNpcs(); // Update NPC states
    // Update player status effects and conditions
    this._updatePlayerAffects(); // Update player status effects
    // Check and handle any world events that need to occur
    this._updateWorldEvents(); // Handle world events
    // Emit a tick event with the current game time for any listeners
    this.eventEmitter.emit("tick", this.#gameTime); // Emit tick event
  }
  _updateGameTime() {
    // Increment the game time by one minute
    this.setGameTime(this.getGameTime() + 1); // Increment game time
    // Check if a full day (1440 minutes) has passed
    if (this.getGameTime() >= 1440) {
      // Reset the game time to zero for a new day
      this.setGameTime(0); // Reset game time
      // Emit an event to signal the start of a new day
      this.eventEmitter.emit("newDay"); // Emit new day event
    }
  }
  _updateNpcs() {
    for (const npc of this.npcs.values()) {
      if (npc.hasChangedState()) { // Check if NPC state has changed
        npc.update(this.#gameTime); // Update NPC state
      }
    }
  }
  _updatePlayerAffects() {
    for (const player of this.players.values()) {
      if (player.hasChangedState()) { // Check if player state has changed
        player.updateAffects(); // Update player status effects
      }
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
      const lootedItems = [...npc.inventory]; // Clone NPC's inventory
      player.inventory.push(...lootedItems.map(itemId => items[itemId])); // Add looted items to player's inventory
      npc.inventory = []; // Clear NPC's inventory after looting
      return MessageManager.createAutoLootMessage(player, npc, lootedItems); // Create and return auto loot message
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
  moveEntity(entity, newLocationId) { // New method to handle movement
    const oldLocationId = entity.currentLocation; // Store old location ID
    const oldLocation = this.getLocation(oldLocationId); // Get old location
    const newLocation = this.getLocation(newLocationId); // Get new location
    if (oldLocation) {
      MessageManager.notifyLeavingLocation(entity, oldLocationId, newLocationId); // Notify leaving old location
      const direction = Utility.getDirectionTo(newLocationId); // Get direction to new location
      MessageManager.notify(entity, `${entity.getName()} travels ${direction}.`); // Notify entity of movement
    }
    entity.currentLocation = newLocationId; // Update entity's current location
    if (newLocation) {
      newLocation.addEntity(entity, "players"); // Add entity to new location
      MessageManager.notifyEnteringLocation(entity, newLocationId); // Notify entering new location
      const direction = Utility.getDirectionFrom(oldLocationId); // Get direction from old location
      MessageManager.notify(entity, `${entity.getName()} arrives ${direction}.`); // Notify entity of arrival
    }
  }
}
// EventEmitter ***********************************************************************************
/*
* The EventEmitter class is responsible for managing events and their listeners.
* It provides methods to register listeners, emit events, and remove listeners.
*/
class EventEmitter {
  constructor() {
    this.events = {}; // Object to store event listeners
  }
  on(event, listener) {
    if (!this.events[event]) {
      this.events[event] = []; // Initialize event array if it doesn't exist
    }
    this.events[event].push(listener); // Add listener to the event
  }
  emit(event, ...args) {
    if (this.events[event]) {
      this.events[event].forEach(listener => listener(...args)); // Call each listener with arguments
    }
  }
  off(event, listener) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(l => l !== listener); // Remove listener from the event
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
    this.name = name; // Player's name
    this.age = age; // Player's age
  }
  static fromPlayerData(uid, playerData, bcrypt) {
    const player = new Player(uid, playerData.name, bcrypt); // Create a new player instance
    player.updateData(playerData); // Update player data
    return player; // Return the created player
  }
  updateData(updatedData) {
    if (updatedData.health !== undefined) this.setHealth(updatedData.health); // Update health if provided
    if (updatedData.experience !== undefined) this.setExperience(updatedData.experience); // Update experience if provided
    if (updatedData.level !== undefined) this.setLevel(updatedData.level); // Update level if provided
  }
}
// Player *****************************************************************************************
/*
* The Player class represents a player in the game.
* It contains various properties and methods related to the player's state and actions.
*/
class Player {
  #uid; // Unique identifier for the player
  #name; // Player's name
  #inventory = []; // Array to hold player's inventory items
  #lastAttacker; // Reference to the last attacker
  #colorPreferences; // Player's color preferences
  #bcrypt; // Bcrypt instance for password hashing
  #healthRegenerator; // Instance of health regenerator for health management
  constructor(uid, name, bcrypt) {
    this.#bcrypt = bcrypt; // Initialize bcrypt instance
    this.#uid = uid; // Set unique identifier
    this.#name = name; // Set player's name
    this.password = ""; // Player's password
    this.description = ""; // Player's description
    this.title = ""; // Player's title
    this.reputation = ""; // Player's reputation
    this.profession = ""; // Player's profession
    this.sex = ""; // Player's sex
    this.age = 0; // Player's age
    this.health = 100; // Player's current health
    this.maxHealth = 100; // Player's maximum health
    this.level = 0; // Player's level
    this.csml = 0; // Player's CSML (Combat Skill Mastery Level)
    this.attackPower = 10; // Player's attack power
    this.defensePower = 0; // Player's defense power
    this.experience = 0; // Player's experience points
    this.currentLocation = "100"; // Player's current location ID
    this.coordinates = {}; // Player's coordinates
    this.skills = []; // Array to hold player's skills
    this.status = "standing"; // Player's current status
    this.affects = []; // Array to hold status effects
    this.killer = true; // Flag indicating if the player is a killer
    this.autoLoot = true; // Flag indicating if auto-loot is enabled
    this.lastRegenTime = Date.now(); // Timestamp of the last health regeneration
    this.failedLoginAttempts = 0; // Count of failed login attempts
    this.consecutiveFailedAttempts = 0; // Count of consecutive failed attempts
    this.lastLoginTime = Date.now(); // Timestamp of the last login
    this.totalPlayingTime = 0; // Total time spent playing
    this.colorPreferences = {}; // Object to hold color preferences
    this.#healthRegenerator = new HealthRegenerator(this); // Initialize health regenerator
    this.previousState = { health: this.health, status: this.status }; // Track previous state
  }
  getId() {
    return this.#uid; // Return unique identifier
  }
  getName() {
    return this.#name; // Return player's name
  }
  getHealth() {
    return this.health; // Return current health
  }
  setHealth(newHealth) {
    this.health = newHealth; // Set new health value
  }
  getStatus() {
    return this.status; // Return current status
  }
  setStatus(newStatus) {
    this.status = newStatus; // Set new status
  }
  getPossessivePronoun() {
    return this.sex === 'male' ? 'his' : 'her'; // Return possessive pronoun based on sex
  }
  addToInventory(item) {
    Utility.addToInventory(this, item); // Add item to inventory using utility function
  }
  removeFromInventory(item) {
    Utility.removeFromInventory(this, item); // Remove item from inventory using utility function
  }
  canAddToInventory(item) {
    return this.#inventory.length < this.getInventoryCapacity() && item.isValid(); // Check if item can be added to inventory
  }
  getInventoryCapacity() {
    return INVENTORY_CAPACITY; // Return maximum inventory capacity
  }
  async authenticate(password) {
    const isPasswordValid = await this.#bcrypt.compare(password, this.password); // Compare provided password with stored password
    if (isPasswordValid) {
      this.resetFailedLoginAttempts(); // Reset failed login attempts on success
      return true; // Return true if authentication is successful
    }
    this.incrementFailedLoginAttempts(); // Increment failed login attempts on failure
    return false; // Return false if authentication fails
  }
  attackNpc(target) {
    const location = gameManager.getLocation(this.currentLocation); // Get current location
    if (!location) return; // Return if location is not found
    const npcId = target
      ? Utility.getNpcIdByName(target, location.npcs) // Get NPC ID by name if target is specified
      : Utility.getFirstAvailableNpcId(location.npcs); // Get first available NPC ID if no target is specified
    if (npcId) {
      const npc = gameManager.getNpc(npcId); // Get NPC instance
      if (!npc) return; // Return if NPC is not found
      if (npc.isUnconsciousOrDead()) {
        MessageManager.notifyNpcAlreadyInStatus(this, npc); // Notify if NPC is already in a specific status
      } else {
        CombatManager.startCombat(npcId, this, !target); // Start combat with the NPC
        MessageManager.notifyPlayersInLocation(this.currentLocation, MessageManager.notifyCombatInitiation(this, npc.getName())); // Notify players of combat initiation
      }
    } else if (target) {
      MessageManager.notifyTargetNotFound(this, target); // Notify if target NPC is not found
    } else {
      MessageManager.notifyNoConsciousEnemies(this); // Notify if no conscious enemies are available
    }
  }
  incrementFailedLoginAttempts() {
    this.failedLoginAttempts++; // Increment failed login attempts
    this.consecutiveFailedAttempts++; // Increment consecutive failed attempts
    if (this.consecutiveFailedAttempts >= 3) {
      MessageManager.notifyDisconnectionDueToFailedAttempts(this); // Notify disconnection due to failed attempts
      gameManager.disconnectPlayer(this.#uid); // Disconnect player from the game
    }
  }
  showInventory() {
    const inventoryList = this.#inventory.map(item => item.name).join(", "); // Create a list of inventory items
    MessageManager.notifyInventoryStatus(this, inventoryList); // Notify player of inventory status
  }
  lootSpecifiedNpc(target) {
    const location = gameManager.getLocation(this.currentLocation); // Get current location
    if (!location) return; // Return if location is not found
    const targetLower = target.toLowerCase(); // Convert target name to lowercase
    const targetEntity = location.entities.find(entity => entity.name.toLowerCase() === targetLower); // Find target entity in location
    if (targetEntity) {
      MessageManager.notifyLootAction(this, targetEntity); // Notify loot action
    } else {
      MessageManager.notifyTargetNotFoundInLocation(this, target); // Notify if target is not found in location
    }
  }
  moveToLocation(newLocationId) {
    Utility.notifyPlayerMovement(this, this.currentLocation, newLocationId); // Notify player movement
  }
  notify(message) {
    MessageManager.notify(this, message); // Send notification to player
  }
  resetFailedLoginAttempts() {
    this.failedLoginAttempts = 0; // Reset failed login attempts
    this.consecutiveFailedAttempts = 0; // Reset consecutive failed attempts
    this.lastLoginTime = Date.now(); // Update last login time
  }
  async save() {
    QueueManager.addDataSaveTask(DatabaseManager.PLAYER_DATA_PATH, this.getId(), this); // Add save task to queue
  }
  // @ todo: add code for this.
  score() {
    const stats = `Level: ${this.level}, XP: ${this.experience}, Health: ${this.health}/${this.maxHealth}`; // Create score string
    MessageManager.notifyStats(this, stats); // Notify player of their stats
  }
  updateData(updatedData) {
    if (updatedData.health !== undefined) this.setHealth(updatedData.health); // Update health if provided
    if (updatedData.experience !== undefined) this.setExperience(updatedData.experience); // Update experience if provided
    if (updatedData.level !== undefined) this.setLevel(updatedData.level); // Update level if provided
  }
  async hashUid() {
    this.hashedUid = await this.#bcrypt.hash(this.#uid, 5); // Hash the unique identifier
  }
  async login(inputPassword) {
    const isAuthenticated = await this.authenticate(inputPassword); // Authenticate user
    if (isAuthenticated) {
      MessageManager.notifyLoginSuccess(this); // Notify successful login
      return true; // Return true if login is successful
    } else {
      MessageManager.notifyIncorrectPassword(this); // Notify incorrect password
      return false; // Return false if login fails
    }
  }
  startHealthRegeneration() {
    this.#healthRegenerator.start(); // Start health regeneration process
  }
  checkAndRemoveExpiredAffects() {
    const now = Date.now(); // Get current time
    this.affects = this.affects.filter(affect => {
      if (affect.endTime && affect.endTime <= now) {
        affect.remove(this); // Remove expired affect
        return false; // Filter out expired affects
      }
      return true; // Keep active affects
    });
  }
  meditate() {
    if (this.status !== "sitting") {
      this.startHealthRegeneration(); // Start health regeneration if not sitting
      MessageManager.notifyMeditationAction(this); // Notify meditation action
      return;
    }
    this.status = "meditating"; // Set status to meditating
    MessageManager.notifyMeditationStart(this); // Notify meditation start
  }
  sleep() {
    this.startHealthRegeneration(); // Start health regeneration
    this.status = "sleeping"; // Set status to sleeping
    MessageManager.notifySleepAction(this); // Notify sleep action
  }
  sit() {
    if (this.status === "sitting") {
      MessageManager.notifyAlreadySitting(this); // Notify if already sitting
    } else if (this.status === "standing") {
      this.startHealthRegeneration(); // Start health regeneration
      this.status = "sitting"; // Set status to sitting
      MessageManager.notifySittingDown(this); // Notify sitting down action
    } else {
      MessageManager.notifyStoppingMeditation(this); // Notify stopping meditation
    }
  }
  stand() {
    if (this.status === "lying unconscious") {
      this.status = "standing"; // Set status to standing
      MessageManager.notifyStandingUp(this); // Notify standing up action
    } else {
      MessageManager.notifyAlreadyStanding(this); // Notify if already standing
    }
  }
  wake() {
    if (this.status === "lying unconscious") {
      this.status = "standing"; // Set status to standing
      MessageManager.notifyStandingUp(this); // Notify standing up action
    } else if (this.status === "sleeping") {
      this.status = "standing"; // Set status to standing
      MessageManager.notifyWakingUp(this); // Notify waking up action
    } else {
      MessageManager.notifyAlreadyAwake(this); // Notify if already awake
    }
  }
  autoLootToggle() {
    this.autoLoot = !this.autoLoot; // Toggle auto-loot setting
    MessageManager.notifyAutoLootToggle(this, this.autoLoot); // Notify auto-loot toggle
  }
  lookIn(containerName) {
    const location = gameManager.getLocation(this.currentLocation); // Get current location
    const containerId = this.getContainerId(containerName) || findEntity(containerName, location.items, 'item'); // Get container ID
    if (!containerId) {
      MessageManager.notifyNoContainerHere(this, containerName); // Notify if no container found
      return;
    }
    const container = items[containerId]; // Get container instance
    if (container instanceof ContainerItem) {
      const itemsInContainer = container.inventory.map(itemId => items[itemId].name); // Get items in container
      MessageManager.notifyLookInContainer(this, container.name, itemsInContainer); // Notify items in container
    } else {
      MessageManager.notifyNotAContainer(this, container.name); // Notify if not a container
    }
  }
  hasChangedState() {
    const hasChanged = this.health !== this.previousState.health || this.status !== this.previousState.status; // Check if state has changed
    if (hasChanged) {
      this.previousState = { health: this.health, status: this.status }; // Update previous state
    }
    return hasChanged; // Return if state has changed
  }
}
// Health Regenerator ****************************************************************************
/*
 * The HealthRegenerator class is responsible for regenerating the player's health over time.
 * It uses a setInterval to call the regenerate method at regular intervals.
 */
class HealthRegenerator {
  constructor(player) {
    this.player = player; // Reference to the player instance
    this.regenInterval = null; // Interval for health regeneration
  }
  start() {
    if (!this.regenInterval) {
      this.regenInterval = setInterval(() => this.regenerate(), REGEN_INTERVAL); // Start regeneration interval
    }
  }
  regenerate() {
    const now = Date.now(); // Get current time
    const timeSinceLastRegen = (now - this.player.lastRegenTime) / 1000; // Calculate time since last regeneration
    const regenAmount = (this.getRegenAmountPerMinute() / 60) * timeSinceLastRegen; // Calculate regeneration amount
    if (regenAmount > 0 && this.player.health < this.player.maxHealth) {
      this.player.health = Math.min(this.player.health + regenAmount, this.player.maxHealth); // Regenerate health
      this.player.lastRegenTime = now; // Update last regeneration time
    }
    if (this.player.health >= this.player.maxHealth) {
      this.stop(); // Stop regeneration if max health is reached
    }
  }
  getRegenAmountPerMinute() {
    const regenRates = {
      "in combat": CONFIG.REGEN_RATES.IN_COMBAT, // Regeneration rate while in combat
      "standing": CONFIG.REGEN_RATES.STANDING, // Regeneration rate while standing
      "sitting": CONFIG.REGEN_RATES.SITTING, // Regeneration rate while sitting
      "sleeping": CONFIG.REGEN_RATES.SLEEPING, // Regeneration rate while sleeping
      "lying unconscious": CONFIG.REGEN_RATES.UNCONSCIOUS, // Regeneration rate while unconscious
      "meditating": CONFIG.REGEN_RATES.MEDITATING, // Regeneration rate while meditating
    };
    return (regenRates[this.player.status] || 0) * this.player.maxHealth; // Return regeneration amount based on status
  }
  stop() {
    if (this.regenInterval) {
      clearInterval(this.regenInterval); // Clear regeneration interval
      this.regenInterval = null; // Reset interval reference
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
    this.player = player; // Reference to the player instance
  }
  look(target) {
    const location = gameManager.getLocation(this.player.currentLocation); // Get current location
    if (!location) return; // Return if location is not found
    const targetLower = target.toLowerCase(); // Convert target name to lowercase
    const playerNameLower = this.player.getName().toLowerCase(); // Convert player name to lowercase
    if (targetLower === 'self' || targetLower === playerNameLower || playerNameLower.startsWith(targetLower)) {
      this.lookAtSelf(); // Look at self if target is self
      return;
    }
    const itemInInventory = this.player.inventory.find(item => item.aliases.includes(targetLower)); // Find item in inventory
    if (itemInInventory) {
      MessageManager.notifyLookAtItemInInventory(this.player, itemInInventory); // Notify looking at item in inventory
      return;
    }
    const itemInLocation = location.items.find(item => item.aliases.includes(targetLower)); // Find item in location
    if (itemInLocation) {
      MessageManager.notifyLookAtItemInLocation(this.player, itemInLocation); // Notify looking at item in location
      return;
    }
    const npcId = location.npcs.find(npcId => {
      const npc = gameManager.getNpc(npcId); // Get NPC instance
      return npc && npc.aliases.includes(targetLower); // Check if NPC matches target
    });
    if (npcId) {
      const npc = gameManager.getNpc(npcId); // Get NPC instance
      MessageManager.notifyLookAtNpc(this.player, npc); // Notify looking at NPC
      return;
    }
    const otherPlayer = location.playersInLocation.find(player => player.name.toLowerCase() === targetLower); // Find other player in location
    if (otherPlayer) {
      MessageManager.notifyLookAtOtherPlayer(this.player, otherPlayer); // Notify looking at other player
      return;
    }
    MessageManager.notifyTargetNotFoundInLocation(this.player, target); // Notify if target is not found in location
  }
  lookAtSelf() {
    MessageManager.notifyLookAtSelf(this.player); // Notify looking at self
  }
}
// Uid Generator **********************************************************************************
/*
 * The UidGenerator class is responsible for generating unique IDs for entities in the game.
 * It uses bcrypt to generate a unique value and return the hashed UID.
 */
class UidGenerator {
  static async generateUid() {
    const uniqueValue = Date.now() + Math.random(); // Generate a unique value based on time and randomness
    const hashedUid = await bcrypt.hash(uniqueValue.toString(), 5); // Hash the unique value
    return hashedUid; // Return the hashed UID
  }
}
// Direction Manager ******************************************************************************
/*
 * The DirectionManager class is responsible for partially generating Player and NPC movement
 * message content based on directions. It provides methods to get the direction to a new location
 * and the direction from an old location.
 */
class DirectionManager {
  static getDirectionTo(newLocationId) {
    const directionMap = {
      'north': 'northward', // Map direction to string
      'east': 'eastward',
      'west': 'westward',
      'south': 'southward',
      'up': 'upward',
      'down': 'downward',
    };
    return directionMap[newLocationId] || 'unknown direction'; // Return direction string or default
  }
  static getDirectionFrom(oldLocationId) {
    const directionMap = {
      'north': 'from the north', // Map direction to string
      'east': 'from the east',
      'west': 'from the west',
      'south': 'from the south',
      'up': 'from above',
      'down': 'from below',
    };
    return directionMap[oldLocationId] || 'from an unknown direction'; // Return direction string or default
  }
}
// Location ***************************************************************************************
/*
 * The Location class is responsible for representing locations in the game.
 * It stores the location's name, description, exits, items, NPCs, and provides methods to add exits, items, and NPCs.
 */
class Location {
  constructor(name, description) {
    this.name = name; // Location name
    this.description = description; // Location description
    this.exits = new Map(); // Map to store exits
    this.items = new Set(); // Set to store items
    this.npcs = new Set(); // Set to store NPCs
    this.playersInLocation = new Set(); // Set to store players in location
    this.zone = []; // Array to store zone information
  }
  addExit(direction, linkedLocation) {
    this.exits.set(direction, linkedLocation); // Add exit to the location
  }
  addItem(item) {
    this.items.add(item); // Add item to the location
  }
  addNpc(npc) {
    this.npcs.add(npc); // Add NPC to the location
  }
  addPlayer(player) {
    this.playersInLocation.add(player); // Add player to the location
  }
  removePlayer(player) {
    this.playersInLocation.delete(player); // Remove player from the location
  }
  getDescription() {
    return this.description; // Return location description
  }
  getName() {
    return this.name; // Return location name
  }
}
// Location Entries *********************************************************************************
const locations = {
  // Key for new location:
  '100': new Location(
    // Location title:
    `Chang'an South Gate`,
    // Location description:
    `The massive South Gate of Chang'an looms above you, an impressive entrance to the walled city. Guards patrol the area, ensuring the safety of the city. Travelers and merchants bustle in and out, while the sound of lively chatter fills the air. To the north, you can see the city's main street stretching into the distance.`,
    // Exits {<direction> <key to linked location>}:
    {'north': '101'},
    // Items in Location:
    ['100'],
    // Container Items:
    ['100', '101'],
    // Weapon Items in Location:
    ['100'],
    // Zone:
    [`Chang'an City`]
  ), // Correctly close the location's definition
  // Key for new location:
  '101': new Location(
    // Location title:
    `Chang'an Main Street`,
    // Location description:
    `The wide, cobblestone main street of Chang'an is bustling with activity. Various shops, inns, and market stalls line the street, selling a plethora of goods from the far reaches of the Silk Road. The aroma of exotic spices and delicious street food fills the air. To the north is the city center, while the South Gate lies to the south.`,
    // Exits {<direction> <key to linked location>}:
    {'north': '102', 'south': '100'},
    // Zone:
    [`Chang'an City`]
  ), // Correctly close the location's definition
  // Key for new location:
  '102': new Location(
    // Location title:
    `Chang'an City Center`,
    // Location description:
    `The city center of Chang'an is a large, open square where people gather for various activities. Musicians play traditional instruments, while acrobats and martial artists perform impressive feats. At the center stands a grand statue of the city's founder. The main street extends to the south, and narrow alleys lead east and west.`,
    // Exits {<direction> <key to linked location>}:
    {'south': '101', 'east': '103', 'west': '104'},
    // Zone:
    [`Chang'an City`]
  ), // Correctly close the location's definition
  // Key for new location:
  '103': new Location(
    // Location title:
    `Chang'an Imperial Palace`,
    // Location description:
    `The Chang'an Imperial Palace is a grand, sprawling complex surrounded by towering walls. This is the residence of the emperor and the political center of the city. The palace is decorated with exquisite carvings and paintings, reflecting the wealth and power of the empire. The city center lies to the south.`,
    // Exits {<direction> <key to linked location>}:
    {'south': '102'},
    // Zone:
    [`Chang'an City`]
  ), // Correctly close the location's definition
  // Key for new location:
  '104': new Location(
    // Location title:
    `Chang'an East Market`,
    // Location description:
    `The East Market is a vibrant and chaotic place, where merchants and traders from all over the world gather to buy and sell their goods. The air is filled with the sounds of haggling and the enticing scents of various exotic wares. The city center is to the west.`,
    // Exits {<direction> <key to linked location>}:
    {'west': '102'},
    // Zone:
    [`Chang'an City`]
  ), // Correctly close the location's definition
  // Key for new location:
  '105': new Location(
    // Location title:
    `Chang'an West Garden`,
    // Location description:
    `The West Garden is a tranquil, lush haven amidst the bustling city. A meandering path leads through beautifully manicured lawns, ornamental ponds, and fragrant flowerbeds. The gentle sound of a nearby waterfall and the chirping of birds create a serene atmosphere. The city center can be reached by heading east.`,
    // Exits {<direction> <key to linked location>}:
    {'east': '102'},
    // Zone:
    [`Chang'an City`]
  ), // Correctly close the location's definition
};
// NPC ********************************************************************************************
/*
 * The Npc class is responsible for representing non-player characters in the game.
 * It stores the NPC's ID, name, sex, current health, maximum health, attack power, CSML, aggro, assist, status, current location, aliases, and mobile status.
 */
class Npc {
  constructor(name, sex, currHealth, maxHealth, attackPower, csml, aggro, assist, status, currentLocation, mobile = false, zones = [], aliases) {
    Object.assign(this, { name, sex, currHealth, maxHealth, attackPower, csml, aggro, assist, status, currentLocation, mobile, zones, aliases }); // Assign properties
    this.id = UidGenerator.generateUid(); // Use UidGenerator to generate UID
    this.previousState = { currHealth, status }; // Track previous state
    if (this.mobile) this.startMovement(); // Start movement if NPC is mobile
  }
  startMovement() {
    setInterval(() => {
      if (this.status !== "engaged in combat") this.moveRandomly(); // Move randomly if not in combat
    }, CONFIG.NPC_MOVEMENT_INTERVAL); // Set movement interval
  }
  moveRandomly() {
    const location = gameManager.getLocation(this.currentLocation); // Get current location
    const validDirections = Object.keys(location.exits).filter(direction =>
      this.zones.includes(location.zone[0]) // Check if the zone matches
    );
    if (validDirections.length > 0) {
      const randomDirection = validDirections[Math.floor(Math.random() * validDirections.length)]; // Select a random direction
      const newLocationId = location.exits[randomDirection]; // Get new location ID
      MessageManager.notifyNpcDeparture(this, Utility.getDirectionTo(newLocationId)); // Notify players of NPC departure
      this.currentLocation = newLocationId; // Update NPC's location
      const direction = Utility.getDirectionFrom(this.currentLocation); // Use getDirectionFrom method
      MessageManager.notifyNpcArrival(this, direction); // Pass direction to notifyNpcArrival
    }
  }
  hasChangedState() {
    const hasChanged = this.currHealth !== this.previousState.currHealth || this.status !== this.previousState.status; // Check if state has changed
    if (hasChanged) {
      this.previousState = { currHealth: this.currHealth, status: this.status }; // Update previous state
    }
    return hasChanged; // Return if state has changed
  }
}
// NPC Entries *************************************************************************************
const npcs = {
  '100': new Npc('Cityguard Ling', 'male', 100, 100, 10, 0, false, false, 'standing', '100', false, [`Chang'an City`], ['mob', 'npc', 'city']),
  '101': new Npc('Peacekeeper Chen', 'male', 100, 100, 10, 0, true, false, 'standing', '100', true, [`Chang'an City`], ['mob', 'npc', 'peacekeeper', 'peace', 'keeper', 'pea', 'kee', 'chen', 'che']),
};
// Item *******************************************************************************************
/*
 * The Item class is responsible for representing items in the game.
 * It stores the item's UID, name, description, and aliases.
 */
class Item {
  constructor(name, description, aliases) {
    this.uid = UidGenerator.generateUid(); // Use UidGenerator to generate UID
    Object.assign(this, { name, description, aliases }); // Assign properties
  }
}
// Container Item *********************************************************************************
/*
 * The ContainerItem class extends the Item class and is used to represent items that can hold other items.
 * It adds an inventory property to store the items contained within the container.
 */
class ContainerItem extends Item {
  constructor(name, description, aliases) {
    super(name, description, aliases); // Call parent constructor
    this.inventory = []; // Initialize inventory array
  }
}
// Weapon Item ************************************************************************************
/*
 * The WeaponItem class extends the Item class and is used to represent items that can be used in combat.
 * It adds a damage property to store the weapon's damage value.
 */
class WeaponItem extends Item {
  constructor(name, description, aliases) {
    super(name, description, aliases); // Call parent constructor
    this.damage = 0; // Initialize damage value
  }
}
// Item Entries ***********************************************************************************
const items = {
  '100': new Item('Health Potion', 'A potion that restores health.', ['potion', 'heal']), // Example item
};
// Container Item Entries *************************************************************************
const containerItems = {
  '100': new ContainerItem('Backpack', 'A sturdy backpack for carrying items.', ['pack', 'bag']), // Example container item
  '101': new ContainerItem('Treasure Chest', 'A large chest filled with treasures.', ['chest', 'treasure']), // Example container item
};
// Weapon Item Entries ****************************************************************************
const weaponItems = {
  '100': new WeaponItem('Rusty Sword', 'An old sword that has seen better days.', ['sword', 'rusty']), // Example weapon item
};
// Inventory Manager ******************************************************************************
/*
 * The InventoryManager class is responsible for managing the player's inventory.
 * It handles the retrieval, transfer, and manipulation of items within the inventory.
 */
class InventoryManager {
  constructor(player) {
    this.player = player; // Reference to the player instance
    this.messageManager = new MessageManager(); // Initialize message manager
  }
  getAllItemsFromLocation() {
    this.getItemsFromSource(location[this.player.currentLocation].items, 'location'); // Get all items from current location
  }
  getAllItemsFromContainer(containerName) {
    const containerId = this.getContainerId(containerName); // Get container ID
    if (!containerId) return; // Return if container not found
    const container = items[containerId]; // Get container instance
    if (container instanceof ContainerItem) {
      this.getItemsFromSource(container.inventory, 'container', container.name); // Get items from container
    }
  }
  getSingleItemFromContainer(itemName, containerName) {
    const containerId = this.getContainerId(containerName); // Get container ID
    if (!containerId) return; // Return if container not found
    const container = items[containerId]; // Get container instance
    if (container instanceof ContainerItem) {
      const item = container.inventory.find(i => items[i].name.toLowerCase() === itemName.toLowerCase()); // Find item in container
      if (item) {
        this.transferItem(item, container, 'container'); // Transfer item from container to player
      } else {
        this.messageManager.notifyNoItemInContainer(this.player, itemName, container.name); // Notify if item not found
      }
    }
  }
  getSingleItemFromLocation(target1) {
    const itemId = Utility.findEntity(target1, location[this.player.currentLocation].items, 'item'); // Find item in location
    if (itemId) {
      this.transferItem(itemId, location[this.player.currentLocation], 'location'); // Transfer item from location to player
    } else {
      this.messageManager.notifyNoItemHere(this.player, target1); // Notify if item not found
    }
  }
  dropAllItems() {
    this.dropItems(this.player.inventory, 'all'); // Drop all items from inventory
  }
  dropAllSpecificItems(itemType) {
    const itemsToDrop = this.player.inventory.filter(item => Utility.itemMatchesType(item, itemType)); // Filter items by type
    this.dropItems(itemsToDrop, 'specific', itemType); // Drop specific items
  }
  dropSingleItem(target1) {
    const item = this.player.inventory.find(i => i.name.toLowerCase() === target1.toLowerCase()); // Find item in inventory
    if (item) {
      this.transferItem(item, location[this.player.currentLocation], 'drop'); // Transfer item from player to location
    } else {
      this.messageManager.notifyNoItemToDrop(this.player, target1); // Notify if item not found
    }
  }
  putSingleItem(itemName, containerName) {
    const item = this.getItemFromInventory(itemName); // Get item from inventory
    if (!item) return; // Return if item not found
    const containerId = this.getContainerId(containerName); // Get container ID
    if (!containerId) return; // Return if container not found
    const container = items[containerId]; // Get container instance
    if (container instanceof ContainerItem) {
      container.inventory.push(item.uid); // Add item to container's inventory
      this.player.inventory = this.player.inventory.filter(i => i !== item); // Remove item from player's inventory
      this.messageManager.notifyItemPutInContainer(this.player, item.name, container.name); // Notify item placement
    }
  }
  putAllItems(containerName) {
    const containerId = this.getContainerId(containerName); // Get container ID
    if (!containerId) return; // Return if container not found
    const container = items[containerId]; // Get container instance
    if (container instanceof ContainerItem) {
      const itemsToPut = this.player.inventory.filter(item => item !== container); // Filter items to put in container
      if (itemsToPut.length === 0) {
        this.messageManager.notifyNoItemsToPut(this.player, container.name); // Notify if no items to put
        return;
      }
      container.inventory.push(...itemsToPut.map(item => item.uid)); // Add items to container's inventory
      this.player.inventory = this.player.inventory.filter(item => item === container); // Remove items from player's inventory
      this.messageManager.notifyItemsPutInContainer(this.player, itemsToPut, container.name); // Notify items placement
    }
  }
  putAllSpecificItemsIntoContainer(itemType, containerName) {
    const error = this.containerErrorMessage(containerName, 'hold'); // Check for container errors
    if (error) {
      this.messageManager.notify(this.player, error); // Notify container error
      return;
    }
    const containerId = Utility.findEntity(containerName, this.player.inventory, 'item'); // Find container ID
    const container = items[containerId]; // Get container instance
    if (container instanceof ContainerItem) {
      const itemsToPut = this.player.inventory.filter(item => item !== container && Utility.itemMatchesType(item, itemType)); // Filter items by type
      if (itemsToPut.length === 0) {
        this.messageManager.notifyNoSpecificItemsToPut(this.player, itemType, container.name); // Notify if no specific items to put
        return;
      }
      container.inventory.push(...itemsToPut.map(item => item.uid)); // Add items to container's inventory
      this.player.inventory = this.player.inventory.filter(item => !itemsToPut.includes(item)); // Remove items from player's inventory
      this.messageManager.notifyItemsPutInContainer(this.player, itemsToPut, container.name); // Notify items placement
    }
  }
  getAllSpecificItemsFromLocation(itemType) {
    const currentLocation = location[this.player.currentLocation]; // Get current location
    if (currentLocation.items && currentLocation.items.length > 0) {
      const itemsTaken = currentLocation.items.filter(itemId => Utility.itemMatchesType(items[itemId], itemType)); // Filter items by type
      if (itemsTaken.length > 0) {
        this.player.inventory.push(...itemsTaken.map(itemId => items[itemId])); // Add items to player's inventory
        currentLocation.items = currentLocation.items.filter(itemId => !itemsTaken.includes(itemId)); // Remove items from location
        this.messageManager.notifyItemsTaken(this.player, itemsTaken); // Notify items taken
      } else {
        this.messageManager.notifyNoSpecificItemsHere(this.player, itemType); // Notify if no specific items found
      }
    } else {
      this.messageManager.notifyNoItemsHere(this.player); // Notify if no items found
    }
  }
  getAllSpecificItemsFromContainer(itemType, containerName) {
    const error = this.containerErrorMessage(containerName, 'hold'); // Check for container errors
    if (error) {
      this.messageManager.notify(this.player, error); // Notify container error
      return;
    }
    const containerId = Utility.findEntity(containerName, this.player.inventory, 'item'); // Find container ID
    const container = items[containerId]; // Get container instance
    if (container instanceof ContainerItem) {
      const itemsTaken = container.inventory.filter(itemId => Utility.itemMatchesType(items[itemId], itemType)); // Filter items by type
      if (itemsTaken.length > 0) {
        this.player.inventory.push(...itemsTaken.map(itemId => items[itemId])); // Add items to player's inventory
        container.inventory = container.inventory.filter(itemId => !itemsTaken.includes(itemId)); // Remove items from container
        this.messageManager.notifyItemsTakenFromContainer(this.player, itemsTaken, container.name); // Notify items taken from container
      } else {
        this.messageManager.notifyNoSpecificItemsInContainer(this.player, itemType, container.name); // Notify if no specific items found
      }
    }
  }
  autoLootNPC(npc) {
    if (npc.inventory && npc.inventory.length > 0) {
      const lootedItems = [...npc.inventory]; // Clone NPC's inventory
      this.player.inventory.push(...lootedItems.map(itemId => items[itemId])); // Add looted items to player's inventory
      npc.inventory = []; // Clear NPC's inventory
      return this.messageManager.createAutoLootMessage(this.player, npc, lootedItems); // Create and return auto loot message
    }
    return null; // No items to loot
  }
  lootNPC(target1) {
    const npcId = Utility.findEntity(target1, location[this.player.currentLocation].npcs, 'npc'); // Find NPC in location
    if (npcId) {
      const npc = npcs[npcId]; // Get NPC instance
      if (npc.status === "lying unconscious" || npc.status === "lying dead") {
        if (npc.inventory && npc.inventory.length > 0) {
          const lootedItems = [...npc.inventory]; // Clone NPC's inventory
          this.player.inventory.push(...lootedItems.map(itemId => items[itemId])); // Add looted items to player's inventory
          npc.inventory = []; // Clear NPC's inventory
          this.messageManager.notifyLootedNPC(this.player, npc, lootedItems); // Notify looted NPC
        } else {
          this.messageManager.notifyNothingToLoot(this.player, npc); // Notify if nothing to loot
        }
      } else {
        this.messageManager.notifyCannotLootNPC(this.player, npc); // Notify if NPC cannot be looted
      }
    } else {
      this.messageManager.notifyNoNPCToLoot(this.player, target1); // Notify if no NPC found to loot
    }
  }
  lootAllNPCs() {
    const currentLocation = location[this.player.currentLocation]; // Get current location
    if (!currentLocation.npcs || currentLocation.npcs.length === 0) {
      this.messageManager.notifyNoNPCsToLoot(this.player); // Notify if no NPCs to loot
      return;
    }
    const lootedItems = []; // Array to hold looted items
    const lootedNPCs = []; // Array to hold names of looted NPCs
    currentLocation.npcs.forEach(npcId => {
      const npc = npcs[npcId]; // Get NPC instance
      if ((npc.status === "lying unconscious" || npc.status === "lying dead") && npc.inventory && npc.inventory.length > 0) {
        lootedItems.push(...npc.inventory); // Add looted items to array
        this.player.inventory.push(...npc.inventory.map(itemId => items[itemId])); // Add items to player's inventory
        lootedNPCs.push(npc.name); // Add NPC name to looted NPCs
        npc.inventory = []; // Clear NPC's inventory
      }
    });
    if (lootedItems.length > 0) {
      this.messageManager.notifyLootedAllNPCs(this.player, lootedNPCs, lootedItems); // Notify looted NPCs
    } else {
      this.messageManager.notifyNothingToLootFromNPCs(this.player); // Notify if nothing to loot from NPCs
    }
  }
  containerErrorMessage(containerName, action) {
    const containerId = Utility.findEntity(containerName, this.player.inventory, 'item'); // Find container ID
    if (!containerId) {
      return `${this.player.getName()} doesn't have a ${containerName} to ${action}.`; // Return error message if container not found
    }
    if (!items[containerId].inventory) {
      return MessageManager.notifyNotAContainer(this.player, items[containerId].name, action); // Return error message if not a container
    }
    return null; // No error
  }
  itemNotFoundMessage(itemName, location) {
    return MessageManager.notifyItemNotInInventory(this.player, itemName, location) // Notify if item not found in inventory
  }
  getItemsFromSource(source, sourceType, containerName) {
    if (source && source.length > 0) {
      const itemsTaken = source.map(itemId => items[itemId]); // Get items from source
      this.player.inventory.push(...itemsTaken); // Add items to player's inventory
      if (sourceType === 'location') {
        location[this.player.currentLocation].items = []; // Clear items from location
      } else {
        items[containerName].inventory = []; // Clear items from container
      }
      this.messageManager.notifyItemsTaken(this.player, itemsTaken); // Notify items taken
    } else {
      this.messageManager.notifyNoItemsHere(this.player); // Notify if no items found
    }
  }
  dropItems(itemsToDrop, type, itemType) {
    if (itemsToDrop.length > 0) {
      if (!location[this.player.currentLocation].items) {
        location[this.player.currentLocation].items = []; // Initialize items array if not present
      }
      location[this.player.currentLocation].items.push(...itemsToDrop.map(item => item.uid)); // Add items to location
      this.player.inventory = this.player.inventory.filter(item => !itemsToDrop.includes(item)); // Remove items from player's inventory
      this.messageManager.notifyItemsDropped(this.player, itemsToDrop); // Notify items dropped
    } else {
      this.messageManager.notifyNoItemsToDrop(this.player, type, itemType); // Notify if no items to drop
    }
  }
  getContainerId(containerName) {
    const containerId = Utility.findEntity(containerName, this.player.inventory, 'item'); // Find container ID
    if (!containerId) {
      this.messageManager.notifyNoContainer(this.player, containerName); // Notify if no container found
      return null; // Return null if not found
    }
    if (!items[containerId].inventory) {
      this.messageManager.notifyNotAContainer(this.player, items[containerId].name); // Notify if not a container
      return null; // Return null if not a container
    }
    return containerId; // Return container ID
  }
  getItemFromInventory(itemName) {
    const item = this.player.inventory.find(i => i.name.toLowerCase() === itemName.toLowerCase()); // Find item in inventory
    if (!item) {
      this.messageManager.notifyItemNotInInventory(this.player, itemName); // Notify if item not found
    }
    return item; // Return found item or undefined
  }
  transferItem(itemId, source, sourceType) {
    Utility.transferItem(itemId, source, sourceType, this.player); // Transfer item using utility function
  }
}
// Combat Manager *********************************************************************************
/*
* The CombatManager class is responsible for managing combat between the player and NPCs.
* It handles the initiation, execution, and termination of combat, as well as the generation
* of combat messages and the handling of combat outcomes.
*/
class CombatManager {
  #combatOrder = new Set(); // Set to track combat order
  #defeatedNpcs = new Set(); // Set to track defeated NPCs
  #combatInitiatedNpcs = new Set(); // Set to track initiated combat NPCs
  constructor(gameManager) {
    this.gameManager = gameManager; // Reference to the game manager instance
    this.techniques = this.initializeTechniques(); // Initialize combat techniques
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
    ]; // List of combat techniques
  }
  initiateCombatWithNpc(npcId, player, playerInitiated = false) { // Public method to initiate combat
    this.startCombat(npcId, player, playerInitiated); // Calls the private method to start combat
  }
  endCombatForPlayer(player) { // Public method to end combat for a player
    this.endCombat(player); // Calls the private method to end combat
  }
  checkForAggressiveNpcs(player) { // Public method to check for aggressive NPCs
    this.checkAggressiveNpcs(player); // Calls a public method to check aggressive NPCs
  }
  checkAggressiveNpcs(player) { this._checkForAggressiveNpcs(player); } // New public method to check aggressive NPCs
  startCombat(npcId, player, playerInitiated) {
    const npc = this.gameManager.getNpc(npcId); // Get NPC instance
    if (!npc || this.#combatOrder.has(npcId)) return; // Return if NPC not found or already in combat
    this.#combatOrder.add(npcId); // Add NPC to combat order
    player.status !== "in combat"
      ? this.initiateCombat(player, npc, playerInitiated) // Initiate combat if player is not in combat
      : this.notifyCombatJoin(npc, player); // Notify if player joins combat
    npc.status = "engaged in combat"; // Set NPC status to engaged
  }
  initiateCombat(player, npc, playerInitiated) {
    player.status = "in combat"; // Set player status to in combat
    const message = playerInitiated
      ? MessageManager.notifyCombatInitiation(player, npc.getName()) // Notify combat initiation by player
      : MessageManager.notifyCombatInitiation(npc, player.getName()); // Notify combat initiation by NPC
    MessageManager.notifyPlayersInLocation(this.gameManager.getLocation(player.currentLocation), message.content); // Notify players in location
    if (!playerInitiated) {
      player.lastAttacker = npc.id; // Set last attacker for player
      this.#combatInitiatedNpcs.add(npc.id); // Add NPC to initiated combat set
    }
    this.startCombatLoop(player); // Start combat loop for player
  }
  notifyCombatJoin(npc, player) {
    MessageManager.notifyPlayersInLocation(this.gameManager.getLocation(player.currentLocation), {
      type: "combat",
      content: MessageManager.notifyCombatJoin(npc.getName()).content // Notify players of NPC joining combat
    });
    this.#combatInitiatedNpcs.add(npc.id); // Add NPC to initiated combat set
  }
  startCombatLoop(player) {
    if (player.status === "in combat" && !player.combatInterval) {
      player.combatInterval = setInterval(() => this.executeCombatRound(player), 1500); // Start combat round interval
    }
  }
  executeCombatRound(player) {
    while (true) {
      if (player.status !== "in combat") {
        this.endCombat(player); // End combat if player is not in combat
        return;
      }
      const npc = this.getNextNpcInCombatOrder(); // Get next NPC in combat order
      if (npc) {
        // Display health percentages
        const playerHealthPercentage = Utility.calculateHealthPercentage(player.health, player.maxHealth); // Calculate player's health percentage
        const npcHealthPercentage = Utility.calculateHealthPercentage(npc.health, npc.maxHealth); // Calculate NPC's health percentage
        // Notify players of health status
        MessageManager.notifyPlayersInLocation(player.currentLocation,
          MessageManager.createCombatHealthStatusMessage(player, playerHealthPercentage, npc, npcHealthPercentage) // Notify health status
        );
        const result = this.performCombatAction(player, npc, true); // Perform combat action
        if (npc.health <= 0) {
          this.handleNpcDefeat(npc, player); // Handle NPC defeat
        }
      }
      if (player.health <= 0) {
        this.handlePlayerDefeat(npc, player); // Handle player defeat
      }
    }
  }
  handlePlayerDefeat(defeatingNpc, player) {
    player.status = "lying unconscious"; // Set player status to lying unconscious
    this.endCombat(player); // End combat for player
    MessageManager.notifyPlayersInLocation(this.gameManager.getLocation(player.currentLocation), {
      type: "combat",
      content: MessageManager.notifyDefeat(player, defeatingNpc.getName()).content // Notify players of player defeat
    });
  }
  handleNpcDefeat(npc, player) {
    npc.status = player.killer ? "lying dead" : "lying unconscious"; // Set NPC status based on player
    player.status = "standing"; // Set player status to standing
    player.experience += npc.experienceReward; // Add experience reward to player
    const messages = this.generateDefeatMessages(player, npc); // Generate defeat messages
    MessageManager.notifyPlayersInLocation(this.gameManager.getLocation(player.currentLocation), { type: "combat", content: messages.join("<br>") }); // Notify players of defeat
  }
  generateDefeatMessages(player, npc) {
    const messages = [MessageManager.notifyVictory(player, npc.getName()).content]; // Create victory message
    const levelUpMessage = this.gameManager.checkLevelUp(player); // Check for level up
    if (levelUpMessage) messages.push(levelUpMessage); // Add level up message if applicable
    if (player.autoLoot) {
      const lootMessage = this.gameManager.autoLootNpc(npc, player); // Attempt to auto loot NPC
      if (lootMessage) messages.push(lootMessage); // Add loot message if applicable
    }
    this.#combatOrder.delete(npc.id); // Remove NPC from combat order
    this.#defeatedNpcs.add(npc.id);
    return messages;
  }
  endCombat(player) {
    // Ends combat for the specified player, clearing combat states and resetting status
    if (player.combatInterval) {
      clearInterval(player.combatInterval);
      player.combatInterval = null;
    }
    this.#combatOrder.clear();
    this.#defeatedNpcs.clear();
    this.#combatInitiatedNpcs.clear();
    player.status = "standing"; // Reset player status to standing
    this.gameManager.fullStateSync(player); // Sync player state with the game manager
    this.checkAggressiveNpcs(player); // Check for aggressive NPCs in the player's location
  }
  _checkForAggressiveNpcs(player) {
    // Checks for aggressive NPCs in the player's current location and initiates combat if found
    if (player.health > 0) {
      const location = this.gameManager.getLocation(player.currentLocation);
      if (location && location.npcs) {
        for (const npcId of location.npcs) {
          const npc = this.gameManager.getNpc(npcId);
          if (this._isAggressiveNpc(npc, player)) {
            this.startCombat(npcId, player, false); // Start combat with aggressive NPC
          }
        }
      }
    }
  }
  _isAggressiveNpc(npc, player) {
    // Determines if the specified NPC is aggressive towards the player
    return npc && npc.aggressive &&
      npc.status !== "lying unconscious" &&
      npc.status !== "lying dead" &&
      player.status !== "lying unconscious" &&
      !this.#defeatedNpcs.has(npc.id); // Check if NPC is not defeated
  }
  performCombatAction(attacker, defender, isPlayer) {
    // Executes a combat action between the attacker and defender, returning the result message
    const outcome = Utility.calculateAttackOutcome(attacker, defender);
    const technique = Utility.getRandomElement(this.techniques);
    let damage = attacker.attackPower;
    let resistDamage = defender.defensePower;
    let description = this.getCombatDescription(outcome, attacker, defender, technique);
    if (outcome === "critical success") {
      damage *= 2; // Double damage on critical success
    }
    if (damage > resistDamage) {
      defender.health -= damage - resistDamage; // Apply damage to defender's health
    }
    return FormatMessageManager.createMessageData(`<span id="combat-message-${isPlayer ? "player" : "npc"}">${description}</span>`); // Return formatted combat message
  }
  getCombatDescription(outcome, attacker, defender, technique) {
    // Generates a description of the combat action based on the outcome
    const descriptions = {
      "attack is evaded": `${attacker.getName()} attacks ${defender.getName()} with a ${technique}, but ${defender.getName()} evades the strike!`,
      "attack is trapped": `${attacker.getName()} attacks ${defender.getName()} with a ${technique}, but ${defender.getName()} traps the strike!`,
      "attack is parried": `${attacker.getName()} attacks ${defender.getName()} with a ${technique}, but ${defender.getName()} parries the strike!`,
      "attack is blocked": `${attacker.getName()} attacks ${defender.getName()} with a ${technique}, but ${defender.getName()} blocks the strike!`,
      "attack hits": `${attacker.getName()} attacks ${defender.getName()} with a ${technique}. The strike successfully hits ${defender.getName()}!`,
      "critical success": `${attacker.getName()} attacks ${defender.getName()} with a devastatingly catastrophic ${technique}.<br>The strike critically hits ${defender.getName()}!`,
      "knockout": `${attacker.getName()} strikes ${defender.getName()} with a spectacularly phenomenal blow!<br>${defender.getName()}'s body goes limp and collapses to the ground!`,
    };
    return FormatMessageManager.createMessageData(descriptions[outcome] || `${attacker.getName()} attacks ${defender.getName()} with a ${technique}.`); // Return combat description
  }
  attackNpc(player, target1) {
    // Initiates an attack on the specified NPC by the player
    const location = this.gameManager.getLocation(player.currentLocation);
    if (!location) return; // Return if location is not found
    const npcId = target1
      ? this.gameManager.findEntity(target1, location.npcs, "npc") // Find NPC by name if specified
      : this.getAvailableNpcId(location.npcs); // Get available NPC ID if no target specified
    if (npcId) {
      const npc = this.gameManager.getNpc(npcId);
      if (!npc) return; // Return if NPC is not found
      if (npc.isUnconsciousOrDead()) {
        MessageManager.notifyNpcAlreadyInStatus(player, npc); // Notify player if NPC is already in a non-combat state
      } else {
        this.startCombat(npcId, player, true); // Start combat with the NPC
      }
    } else if (target1) {
      MessageManager.notifyTargetNotFound(player, target1); // Notify player if target NPC is not found
    } else {
      MessageManager.notifyNoConsciousEnemies(player); // Notify player if no conscious enemies are available
    }
  }
  getAvailableNpcId(npcs) {
    // Returns the ID of the first available NPC that is not unconscious or dead
    return npcs.find(id => {
      const npc = this.gameManager.getNpc(id);
      return npc && !npc.isUnconsciousOrDead(); // Check if NPC is available for combat
    });
  }
  getCombatOrder() {
    // Returns the current combat order
    return this.#combatOrder; // Return the set of NPCs in combat order
  }
  getNextNpcInCombatOrder() {
    // Returns the first NPC in the combat order
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
    this.player = player; // Reference to the player instance
  }
  describe() {
    const location = gameManager.getLocation(this.player.currentLocation); // Get current location
    if (!location) {
      MessageManager.notify(this.player, `${this.player.getName()} is in an unknown location.`); // Notify if location is unknown
      return;
    }
    const description = this.formatDescription(location); // Format location description
    MessageManager.notify(this.player, description); // Send description to player
  }
  formatDescription(location) {
    const title = { cssid: `location-title`, text: location.getName() }; // Title of the location
    const desc = { cssid: `location-description`, text: location.getDescription() }; // Description of the location
    const exits = { cssid: `location-exits`, text: 'Exits:' }; // Exits information
    const exitsList = this.getExitsDescription(location); // Get exits description
    const items = this.getItemsDescription(location); // Get items description
    const npcs = this.getNpcsDescription(location); // Get NPCs description
    const players = this.getPlayersDescription(location); // Get players description
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
      cssid: `exit-${direction}`, // CSS ID for exit
      text: `${direction.padEnd(6, ' ')} - ${linkedLocation.getName()}`, // Exit description
    }));
  }
  getItemsDescription(location) {
    return location.items.map(item => ({
      cssid: `item-${item.uid}`, // CSS ID for item
      text: `A ${item.name} is lying here.`, // Item description
    }));
  }
  getNpcsDescription(location) {
    return location.npcs.map(npcId => {
      const npc = gameManager.getNpc(npcId); // Get NPC instance
      return npc ? { cssid: `npc-${npc.id}`, text: `${npc.getName()} is ${npc.status} here.` } : null; // NPC description
    }).filter(npc => npc); // Filter out null values
  }
  getPlayersDescription(location) {
    return location.playersInLocation.map(otherPlayer => ({
      cssid: `player`, // CSS ID for player
      text: `${otherPlayer.getName()} is ${otherPlayer.getStatus()} here.`, // Player description
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
    return Utility.createMessageData(cssid, message); // Create message data with CSS ID
  }
  static getIdForMessage(type) {
    const messageIds = {
      loginSuccess: 'player-name', // ID for login success message
      incorrectPassword: 'error-message', // ID for incorrect password message
      inventoryStatus: 'inventory-list', // ID for inventory status message
      lootAction: 'combat-message', // ID for loot action message
      targetNotFound: 'error-message', // ID for target not found message
      combatInitiation: 'combat-message-player', // ID for combat initiation message
      combatJoin: 'combat-message-npc', // ID for combat join message
      combatMessageHealth: 'combat-message-health', // ID for combat health status message
      defeat: 'combat-message-npc', // ID for defeat message
      victory: 'combat-message-player', // ID for victory message
      meditationAction: 'combat-message', // ID for meditation action message
      meditationStart: 'combat-message', // ID for meditation start message
      sleepAction: 'combat-message', // ID for sleep action message
      standingUp: 'combat-message', // ID for standing up message
      wakingUp: 'combat-message', // ID for waking up message
      alreadySitting: 'error-message', // ID for already sitting message
      alreadyStanding: 'error-message', // ID for already standing message
      disconnectionFailedAttempts: 'error-message', // ID for disconnection due to failed attempts
      stats: 'combat-message', // ID for stats message
      invalidItemAddition: 'error-message', // ID for invalid item addition message
      inventoryFull: 'error-message', // ID for inventory full message
      itemNotFoundInInventory: 'error-message', // ID for item not found in inventory message
      leavingLocation: 'combat-message', // ID for leaving location message
      enteringLocation: 'combat-message', // ID for entering location message
      combatActionMessage: 'combat-message', // ID for combat action message
      dataLoadError: 'error-message', // ID for data load error message
      dataSaveError: 'error-message', // ID for data save error message
      generalError: 'error-message', // ID for general error message
      lookAtSelf: 'combat-message', // ID for looking at self message
      lookAtItem: 'combat-message', // ID for looking at item message
      lookAtNpc: 'combat-message', // ID for looking at NPC message
      lookAtOtherPlayer: 'combat-message', // ID for looking at other player message
    };
    return messageIds[type] || ''; // Return message ID or empty string
  }
}
// Message Manager ********************************************************************************
/*
 * The MessageManager class is responsible for handling communication of messages to players within the
 * game. This centralizes message handling, ensuring consistency in how messages are constructed,
 * and sent to players. Centralizing all messages in one place is convenient for editing
 * purposes. Each method formats the message with cssid. This is used by the client to style HTML
 * elements. It also includes methods for notifying players in specific locations, handling errors,
 * and managing inventory notifications.
 */
class MessageManager {
  // Notification Methods *************************************************************************
  static notify(player, message, cssid = '') {
    this.logger.info(`Message to ${player.getName()}: ${message}`); // Log message to player
    return Utility.createMessageData(cssid, message); // Create message data using Utility
  }
  // Login Notifications **************************************************************************
  static notifyLoginSuccess(player) {
    return this.notify(player, `${player.getName()} has logged in successfully!`, this.getIdForMessage('loginSuccess')); // Notify player of successful login
  }
  static notifyIncorrectPassword(player) {
    return this.notify(player, `Incorrect password. Please try again.`, this.getIdForMessage('incorrectPassword')); // Notify player of incorrect password
  }
  static notifyDisconnectionDueToFailedAttempts(player) {
    return this.notify(player, `${player.getName()} has been disconnected due to too many failed login attempts.`, this.getIdForMessage('disconnectionFailedAttempts')); // Notify player of disconnection
  }
  // Player Notifications *************************************************************************
  static notifyPlayersInLocation(location, message) {
    if (!location || !location.playersInLocation) return; // Return if location or players are not found
    location.playersInLocation.forEach(player => {
      this.notify(player, message); // Notify each player in location
    });
  }
  // Inventory Notifications **********************************************************************
  static notifyInventoryStatus(player) {
    return this.notify(player, `${player.getName()}'s inventory:`, this.getIdForMessage('inventoryStatus')); // Notify player of inventory status
  }
  static notifyPickupItem(player, itemName) {
    return this.notify(player, `${player.getName()} picks up ${itemName}.`, this.getIdForMessage('pickupItem')); // Notify player of item pickup
  }
  static notifyDropItem(player, itemName) {
    return this.notify(player, `${player.getName()} drops ${itemName}.`, this.getIdForMessage('dropItem')); // Notify player of item drop
  }
  static notifyInventoryFull(player) {
    return this.notify(player, `${player.getName()}'s inventory is full.`, this.getIdForMessage('inventoryFull')); // Notify player of full inventory
  }
  static notifyItemNotFoundInInventory(player) {
    return this.notify(player, `Item not found in ${player.getName()}'s inventory.`, this.getIdForMessage('itemNotFoundInInventory')); // Notify player of item not found
  }
  static notifyInvalidItemAddition(player, itemName) {
    return this.notify(player, `Cannot add invalid item: ${itemName}`, this.getIdForMessage('invalidItemAddition')); // Notify player of invalid item addition
  }
  // Combat Notifications *************************************************************************
  static notifyCombatInitiation(attacker, defenderName) {
    return this.notify(attacker, `${attacker.getName()} attacks ${defenderName}.`, this.getIdForMessage('combatInitiation')); // Notify combat initiation
  }
  static notifyCombatJoin(npc, player) {
    return this.notify(null, `${npc.getName()} attacks ${player.getName()}!`, this.getIdForMessage('combatJoin')); // Notify combat join
  }
  static createCombatHealthStatusMessage(player, playerHealthPercentage, npc, npcHealthPercentage) {
    return FormatMessageManager.createMessageData(
      '',
      `${player.getName()}: ${playerHealthPercentage.toFixed(2)}% | ${npc.getName()}: ${npcHealthPercentage.toFixed(2)}%` // Create health status message
    );
  }
  static notifyDefeat(player, defeatingNpcName) {
    return this.notify(player, `${player.getName()} has been defeated by ${defeatingNpcName}.`, this.getIdForMessage('defeat')); // Notify player of defeat
  }
  static notifyVictory(player, defeatedNpcName) {
    return this.notify(player, `${player.getName()} has defeated ${defeatedNpcName}!`, this.getIdForMessage('victory')); // Notify player of victory
  }
  static notifyCombatActionMessage(player, message) {
    return this.notify(player, message, this.getIdForMessage('combatActionMessage')); // Notify player of combat action
  }
  static notifyNpcAlreadyInStatus(player, npc) {
    const pronoun = npc.getPronoun(); // Get NPC pronoun
    return this.notify(player, `${npc.getName()} is already ${npc.getStatus()}. It would be dishonorable to attack ${pronoun} now.`); // Notify player of NPC status
  }
  // Inventory Notifications **********************************************************************
  static notifyNoItemInContainer(player, itemName, containerName) {
    return this.notify(player, `There doesn't seem to be any ${itemName} in the ${containerName}.`); // Notify player of no item in container
  }
  static notifyNoItemHere(player, itemName) {
    return this.notify(player, `There doesn't seem to be any ${itemName} here.`); // Notify player of no item here
  }
  static notifyNoItemToDrop(player, itemName) {
    return this.notify(player, `${player.getName()} doesn't seem to have any ${itemName}'s to drop.`); // Notify player of no item to drop
  }
  static notifyItemPutInContainer(player, itemName, containerName) {
    return this.notify(player, `${player.getName()} places a ${itemName} into a ${containerName}.`); // Notify player of item placement in container
  }
  static notifyNoItemsToPut(player, containerName) {
    return this.notify(player, `${player.getName()} has nothing to put in the ${containerName}.`); // Notify player of no items to put
  }
  static notifyItemsPutInContainer(player, items, containerName) {
    const itemsList = items.map(item => item.name).join(", "); // Create list of item names
    return this.notify(player, `${player.getName()} places the following items into the ${containerName}: ${itemsList}`); // Notify player of items placed in container
  }
  static notifyNoSpecificItemsToPut(player, itemType, containerName) {
    return this.notify(player, `${player.getName()} has no ${itemType} to put in the ${containerName}.`); // Notify player of no specific items to put
  }
  static notifyItemsTaken(player, items) {
    const itemsList = items.map(item => item.name).join(", "); // Create list of item names
    return this.notify(player, `${player.getName()} picks up: ${itemsList}`); // Notify player of items taken
  }
  static notifyNoSpecificItemsHere(player, itemType) {
    return this.notify(player, `There doesn't seem to be any ${itemType} here.`); // Notify player of no specific items here
  }
  static notifyNoItemsHere(player, itemType) {
    return this.notify(player, `There doesn't seem to be any ${itemType} to take here.`); // Notify player of no items here
  }
  static notifyItemsTakenFromContainer(player, items, containerName) {
    const itemsList = items.map(itemId => items[itemId].name).join(", "); // Create list of item names
    return this.notify(player, `${player.getName()} retrieves the following items from a ${containerName}: ${itemsList}`); // Notify player of items taken from container
  }
  static notifyNoSpecificItemsInContainer(player, itemType, containerName) {
    return this.notify(player, `There doesn't seem to be any ${itemType} in the ${containerName}.`); // Notify player of no specific items in container
  }
  static createAutoLootMessage(player, npc, lootedItems) {
    const itemsList = lootedItems.map(itemId => items[itemId].name).join(", "); // Create list of looted item names
    return `${player.getName()} searches ${npc.getName()} and grabs: ${itemsList}`; // Create auto loot message
  }
  static notifyLootedNPC(player, npc, lootedItems) {
    const itemsList = lootedItems.map(itemId => items[itemId].name).join(", "); // Create list of looted item names
    return this.notify(player, `${player.getName()} searches ${npc.getName()} and grabs ${itemsList}`); // Notify player of looted NPC
  }
  static notifyNothingToLoot(player, npc) {
    return this.notify(player, `${player.getName()} searches diligently, but finds nothing worth looting from ${npc.getName()}.`); // Notify player of nothing to loot
  }
  static notifyCannotLootNPC(player, npc) {
    return this.notify(player, `${npc.getName()} is not unconscious or dead. ${player.getName()} it would be dishonorable to loot them.`); // Notify player of looting restrictions
  }
  static notifyNoNPCToLoot(player, target) {
    return this.notify(player, `There doesn't seem to be any ${target} here to loot.`); // Notify player of no NPC to loot
  }
  static notifyNoNPCsToLoot(player) {
    return this.notify(player, `There doesn't seem to be anyone here to loot.`); // Notify player of no NPCs to loot
  }
  static notifyLootedAllNPCs(player, lootedNPCs, lootedItems) {
    const itemsList = lootedItems.map(itemId => items[itemId].name).join(", "); // Create list of looted item names
    return this.notify(player, `${player.getName()} searches ${lootedNPCs.join(", ")} and grabs: ${itemsList}`); // Notify player of looted NPCs
  }
  static notifyNothingToLootFromNPCs(player) {
    return this.notify(player, `${player.getName()} searches diligently, but finds nothing worth looting.`); // Notify player of nothing to loot from NPCs
  }
  static notifyItemsDropped(player, items) {
    const itemsList = items.map(item => item.name).join(", "); // Create list of item names
    return this.notify(player, `${player.getName()} drops: ${itemsList}`); // Notify player of items dropped
  }
  static notifyNoItemsToDrop(player, type, itemType) {
    const itemTypeText = type === 'all' ? 'items' : itemType; // Determine item type text
    return this.notify(player, `${player.getName()} has no ${itemTypeText} to drop.`); // Notify player of no items to drop
  }
  static notifyNoContainer(player, containerName) {
    return this.notify(player, `${player.getName()} doesn't seem to have any ${containerName}.`); // Notify player of no container
  }
  static notifyNotAContainer(player, itemName, action) {
    return this.notify(player, `The ${itemName} is not a container.`); // Notify player of non-container item
  }
  static notifyItemNotInInventory(player, itemName, location) {
    return this.notify(player, `${player.getName()} doesn't seem to have any ${itemName} in ${player.getPossessivePronoun()} inventory.`); // Notify player of item not in inventory
  }
  static notifyItemTaken(player, itemName) {
    return this.notify(player, `${player.getName()} grabs a ${itemName}.`); // Notify player of item taken
  }
  // Look Notifications ***************************************************************************
  static notifyLookAtSelf(player) { // New method for looking at self
    return this.notify(player, `${player.getName()} looks at themselves, feeling a sense of self-awareness.`, this.getIdForMessage('lookAtSelf')); // Notify player of self-examination
  }
  static notifyLookAtItemInInventory(player, item) {
    return this.notify(player, `${player.getName()} looks at ${item.name} in their inventory.`, this.getIdForMessage('lookAtItem')); // Notify player of item in inventory
  }
  static notifyLookAtItemInLocation(player, item) {
    return this.notify(player, `${player.getName()} looks at the ${item.name} lying here.`, this.getIdForMessage('lookAtItem')); // Notify player of item in location
  }
  static notifyLookAtNpc(player, npc) {
    return this.notify(player, `${player.getName()} looks at ${npc.getName()}, who is currently ${npc.status}.`, this.getIdForMessage('lookAtNpc')); // Notify player of NPC status
  }
  static notifyLookAtOtherPlayer(player, otherPlayer) {
    return this.notify(player, `${player.getName()} looks at ${otherPlayer.getName()}, who is currently ${otherPlayer.getStatus()}.`, this.getIdForMessage('lookAtOtherPlayer')); // Notify player of other player's status
  }
  static notifyLookInContainer(player, containerName, items) {
    const itemsList = items.length > 0 ? items.join(", ") : 'nothing.'; // Create list of items or indicate nothing
    return this.notify(player, `You look inside the ${containerName} and see: ${itemsList}`); // Notify player of container contents
  }
  static notifyNoContainerHere(player, containerName) {
    return this.notify(player, `You don't see a ${containerName} here.`); // Notify player of no container
  }
  static notifyNotAContainer(player, containerName) {
    return this.notify(player, `The ${containerName} is not a container.`); // Notify player of non-container item
  }
  // Status Notifications *************************************************************************
  static notifyMeditationAction(player) {
    return this.notify(player, `${player.getName()} starts meditating.`, this.getIdForMessage('meditationAction')); // Notify player of meditation action
  }
  static notifyMeditationStart(player) {
    return this.notify(player, `${player.getName()} is now meditating.`, this.getIdForMessage('meditationStart')); // Notify player of meditation start
  }
  static notifySleepAction(player) {
    return this.notify(player, `${player.getName()} goes to sleep.`, this.getIdForMessage('sleepAction')); // Notify player of sleep action
  }
  static notifyStandingUp(player) {
    return this.notify(player, `${player.getName()} stands up.`, this.getIdForMessage('standingUp')); // Notify player of standing up
  }
  static notifyWakingUp(player) {
    return this.notify(player, `${player.getName()} wakes up.`, this.getIdForMessage('wakingUp')); // Notify player of waking up
  }
  static notifyAlreadySitting(player) {
    return this.notify(player, `${player.getName()} is already sitting.`, this.getIdForMessage('alreadySitting')); // Notify player of already sitting
  }
  static notifyAlreadyStanding(player) {
    return this.notify(player, `${player.getName()} is already standing.`, this.getIdForMessage('alreadyStanding')); // Notify player of already standing
  }
  // Location Notifications ***********************************************************************
  static notifyLeavingLocation(player, oldLocationId, newLocationId) {
    const direction = player.getDirectionTo(newLocationId); // Get direction to new location
    return this.notify(player, `${player.getName()} travels ${direction}.`, this.getIdForMessage('leavingLocation')); // Notify player of leaving location
  }
  static notifyEnteringLocation(player, newLocationId) {
    const direction = player.getDirectionFrom(newLocationId); // Get direction from new location
    return this.notify(player, `${player.getName()} arrives ${direction}.`, this.getIdForMessage('enteringLocation')); // Notify player of entering location
  }
  // Logger Error Notifications *******************************************************************
  static notifyDataLoadError(manager, logger, key, error) {
    logger.error(`Error loading data for ${key}: ${error}`); // Log data load error
  }
  static notifyDataSaveError(manager, logger, filePath, error) {
    logger.error(`Error saving data to ${filePath}: ${error}`); // Log data save error
  }
  static notifyError(manager, logger, message) {
    logger.error(`Error: ${message}`); // Log general error
  }
  static notifyNpcDeparture(npc, direction) {
    return this.notify(null, `${npc.getName()} travels ${direction}.`); // Notify players of NPC departure
  }
  static notifyNpcArrival(npc, direction) {
    return this.notify(null, `${npc.getName()} arrives ${direction}.`); // Notify players of NPC arrival
  }
}
// Utility Class **********************************************************************************
/*
 * The Utility class for commonly used and shared methods.
 */
class Utility {
  static createMessageData(cssid = '', message) {
    return { cssid, content: message }; // Centralized message creation
  }
  static getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)]; // Random selection utility
  }
  static findEntity(target, collection, type) {
    return collection.find(entity => entity.name.toLowerCase() === target.toLowerCase()); // Find entity by name
  }
  static calculateHealthPercentage(currentHealth, maxHealth) {
    return (currentHealth / maxHealth) * 100; // Health percentage calculation
  }
  static transferItem(itemId, source, sourceType, player) {
    player.inventory.push(items[itemId]); // Add item to player's inventory
    if (sourceType === 'location') {
      source.items = source.items.filter(i => i !== itemId); // Remove item from location
    } else {
      source.inventory = source.inventory.filter(i => i !== itemId); // Remove item from container
    }
    MessageManager.notifyItemTaken(player, items[itemId].name); // Notify player of item taken
  }
  static calculateAttackValue(attacker, defender, roll) {
    if (attacker.level === defender.level) {
      return roll + attacker.csml; // Equal levels
    } else if (attacker.level < defender.level) {
      return (roll + attacker.csml) - (defender.level - attacker.level); // Attacker lower level
    } else {
      return (roll + attacker.csml) + (attacker.level - defender.level); // Attacker higher level
    }
  }
  static calculateAttackOutcome(attacker, defender) {
    const roll = Math.floor(Math.random() * 20) + 1; // Roll a d20
    let value = this.calculateAttackValue(attacker, defender, roll); // Calculate attack value
    if (value >= 21 || value === 19) return "critical success"; // Critical success
    if (value === 20) return "knockout"; // Knockout
    if (value >= 13) return "attack hits"; // Attack hits
    if (value >= 10) return "attack is blocked"; // Attack blocked
    if (value >= 7) return "attack is parried"; // Attack parried
    if (value >= 4) return "attack is trapped"; // Attack trapped
    if (value >= 1) return "attack is evaded"; // Attack evaded
    return "attack hits"; // Default case
  }
  static notifyPlayerMovement(entity, oldLocationId, newLocationId) {
    const oldLocation = gameManager.getLocation(oldLocationId); // Get old location
    const newLocation = gameManager.getLocation(newLocationId); // Get new location
    if (oldLocation) {
      MessageManager.notifyLeavingLocation(entity, oldLocationId, newLocationId); // Notify leaving location
      const direction = entity.getDirectionTo(newLocationId); // Get direction to new location
      MessageManager.notify(entity, `${entity.getName()} travels ${direction}.`); // Notify player of travel
    }
    entity.currentLocation = newLocationId; // Update entity's current location
    if (newLocation) {
      newLocation.addEntity(entity, "players"); // Add entity to new location
      MessageManager.notifyEnteringLocation(entity, newLocationId); // Notify entering location
      const direction = entity.getDirectionFrom(oldLocationId); // Get direction from old location
      MessageManager.notify(entity, `${entity.getName()} arrives ${direction}.`); // Notify player of arrival
    }
  }
  static addToInventory(player, item) {
    if (!item.isValid()) {
      MessageManager.notifyInvalidItemAddition(player, item.name); // Notify invalid item addition
      return;
    }
    if (player.canAddToInventory(item)) {
      player.inventory.push(item); // Add item to inventory
    } else {
      MessageManager.notifyInventoryFull(player); // Notify inventory full
    }
  }
  static removeFromInventory(player, item) {
    const index = player.inventory.findIndex(i => i.uid === item.uid); // Find item index
    if (index > -1) {
      player.inventory.splice(index, 1); // Remove item from inventory
    } else {
      MessageManager.notifyItemNotFoundInInventory(player); // Notify item not found
    }
  }
}