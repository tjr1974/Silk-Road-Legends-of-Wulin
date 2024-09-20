// Create New Player ******************************************************************************
/*
 * The CreateNewPlayer class is responsible for creating new player instances from existing player
 * data, providing methods to initialize player attributes and state.
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
  async updateData(updatedData) {
    if (updatedData.health !== undefined) await this.setHealth(updatedData.health); // Await health update if provided
    if (updatedData.experience !== undefined) await this.setExperience(updatedData.experience); // Await experience update if provided
    if (updatedData.level !== undefined) await this.setLevel(updatedData.level); // Await level update if provided
  }
}
// Entity ***************************************************************************************
/*
 * The Entity class is a base class for all entities in the game.
 * It contains shared properties and methods for characters and players.
*/
class Entity {
  constructor(name, health) {
    this.name = name; // Entity's name
    this.health = health; // Entity's health
  }
  getName() {
    return this.name; // Return entity's name
  }
  getHealth() {
    return this.health; // Return entity's health
  }
  setHealth(newHealth) {
    this.health = newHealth; // Set new health value
  }
}
// Character ***************************************************************************************
/*
 * The Character class represents a character in the game.
 * It extends the Entity class.
*/
class Character extends Entity {
  constructor(name, health) {
    super(name, health); // Call the parent constructor
  }
}
// Player *****************************************************************************************
/*
* The Player class represents a player in the game.
* It extends the Character class.
*/
class Player extends Character {
  #uid; // Unique identifier for the player
  #bcrypt; // Bcrypt instance for password hashing
  #inventory; // Set to hold player's inventory items
  #lastAttacker; // Reference to the last attacker
  #colorPreferences; // Player's color preferences
  #healthRegenerator; // Instance of health regenerator for health management
  constructor(uid, name, bcrypt) {
    super(name, 100); // Call the parent constructor
    this.CONFIG = null; // Initialize CONFIG
    this.importConfig(); // Call method to load config
    this.#uid = uid; // Initialize unique identifier
    this.#bcrypt = bcrypt; // Initialize bcrypt instance
    this.#inventory = new Set(); // Initialize inventory Set
    this.#lastAttacker; // Reference to the last attacker
    this.#colorPreferences; // Player's color preferences
    this.#healthRegenerator = new HealthRegenerator(this); // Initialize health regenerator
    this.password = ""; // Player's password
    this.description = ""; // Player's description
    this.title = ""; // Player's title
    this.reputation = ""; // Player's reputation
    this.profession = ""; // Player's profession
    this.sex = ""; // Player's sex
    this.age = 0; // Player's age
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
    this.previousState = { health: this.health, status: this.status }; // Track previous state
    this.actions = new PlayerActions(this); // Initialize PlayerActions
    this.inventoryManager = new InventoryManager(this); // Initialize InventoryManager
    this.combatActions = new CombatActions(this); // Initialize CombatActions
  }
  importConfig() {
    try {
      this.CONFIG = import('./config.js'); // Direct import of config
    } catch (error) {
      console.error('Failed to import config:', error); // Handle import error
    }
  }
  getId() {
    return this.#uid; // Return unique identifier
  }
  getPossessivePronoun() {
    return this.sex === 'male' ? 'his' : 'her'; // Return possessive pronoun based on sex
  }
  addToInventory(item) {
    this.#inventory.add(item); // Add item to inventory Set
  }
  removeFromInventory(item) {
    this.#inventory.delete(item); // Remove item from inventory Set
  }
  canAddToInventory(item) {
    return this.#inventory.size < this.getInventoryCapacity() && item.isValid(); // Check size of Set
  }
  getInventoryCapacity() {
    return INVENTORY_CAPACITY; // Return maximum inventory capacity
  }
  authenticate(password) {
    const isPasswordValid = this.#bcrypt.compare(password, this.password); // Compare provided password with stored password
    if (isPasswordValid) {
      this.resetFailedLoginAttempts(); // Reset failed login attempts on success
      return true; // Return true if authentication is successful
    }
    this.incrementFailedLoginAttempts(); // Increment failed login attempts on failure
    return false; // Return false if authentication fails
  }
  attackNpc(target) {
    const { currentLocation, actions } = this; // Destructure properties
    actions.attackNpc(target); // Delegate to PlayerActions
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
    const inventoryList = this.getInventoryList(); // Use utility method
    this.notifyPlayer(inventoryList); // Use utility method
  }
  lootSpecifiedNpc(target) {
    const location = gameManager.getLocation(this.currentLocation); // Get current location
    if (!location) return; // Early return if location is not found
    const targetLower = target.toLowerCase(); // Convert target name to lowercase
    const targetEntity = location.entities.find(entity => entity.name.toLowerCase() === targetLower); // Find target entity in location
    if (targetEntity) {
      this.notifyPlayer(`You loot ${targetEntity.name}.`); // Use utility method
      return; // Early return if target is found
    }
    this.notifyPlayer(`Target ${target} not found in location.`); // Use utility method
  }
  moveToLocation(newLocationId) {
    notifyPlayerMovement(this, this.currentLocation, newLocationId); // Notify player movement
  }
  notifyPlayer(message) {
    MessageManager.notify(this, message); // Centralized notification method
  }
  resetFailedLoginAttempts() {
    this.failedLoginAttempts = 0; // Reset failed login attempts
    this.consecutiveFailedAttempts = 0; // Reset consecutive failed attempts
    this.lastLoginTime = Date.now(); // Update last login time
  }
  save() {
    const playerData = this.collectPlayerData(); // Collect player data for batch saving
    QueueManager.addDataSaveTask(DatabaseManager.PLAYER_DATA_PATH, this.getId(), playerData); // Add save task to queue
  }
  collectPlayerData() {
    return {
      name: this.name,
      age: this.age,
      health: this.health,
      experience: this.experience,
      level: this.level,
      // ... add other relevant properties ...
    }; // Return an object with relevant player data
  }
  static async loadBatch(playerIds) {
    const playerDataArray = await DatabaseManager.loadPlayersData(playerIds); // Load data for multiple players
    return playerDataArray.map(data => new Player(data.uid, data.name, data.bcrypt)); // Create Player instances from loaded data
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
    try {
      this.hashedUid = await this.#bcrypt.hash(this.#uid, 5); // Await hashing the unique identifier
    } catch (error) {
      console.error('Failed to hash UID:', error); // Handle hashing error
    }
  }
  async login(inputPassword) {
    const isAuthenticated = await this.authenticate(inputPassword); // Await authentication
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
      return; // Early return if already sitting
    }
    if (this.status === "standing") {
      this.startHealthRegeneration(); // Start health regeneration
      this.status = "sitting"; // Set status to sitting
      MessageManager.notifySittingDown(this); // Notify sitting down action
      return; // Early return after sitting down
    }
    MessageManager.notifyStoppingMeditation(this); // Notify stopping meditation
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
      return; // Early return after waking up
    }
    if (this.status === "sleeping") {
      this.status = "standing"; // Set status to standing
      MessageManager.notifyWakingUp(this); // Notify waking up action
      return; // Early return after waking up
    }
    MessageManager.notifyAlreadyAwake(this); // Notify if already awake
  }
  autoLootToggle() {
    this.autoLoot = !this.autoLoot; // Toggle auto-loot setting
    MessageManager.notifyAutoLootToggle(this, this.autoLoot); // Notify auto-loot toggle
  }
  lookIn(containerName) {
    const location = gameManager.getLocation(this.currentLocation); // Get current location
    const containerId = getContainerId(containerName, location.items, 'item') || findEntity(containerName, location.items, 'item'); // Get container ID
    if (!containerId) {
      MessageManager.notifyNoContainerHere(this, containerName); // Notify if no container found
      return;
    }
    const container = this.player.items[containerId]; // Use this.player.items instead of items
    if (container instanceof ContainerItem) {
      const itemsInContainer = container.inventory.map(itemId => this.player.items[itemId].name); // Get items in container
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
  getInventoryList() {
    return Array.from(this.#inventory).map(item => item.name).join(", "); // Centralized inventory list retrieval
  }
}
// Health Regenerator ****************************************************************************
/*
 * The HealthRegenerator class is responsible for regenerating the player's health over time.
 * It uses a setInterval to call the regenerate method at regular intervals.
*/
class HealthRegenerator {
  constructor(player) {
    this.CONFIG = null; // Initialize CONFIG
    this.player = player; // Reference to the player instance
    this.regenInterval = null; // Interval for health regeneration
    this.importConfig(); // Call method to load config
  }
  importConfig() {
    try {
      this.CONFIG = import('./config.js'); // Direct import of config
    } catch (error) {
      console.error('Failed to import config:', error); // Handle import error
    }
  }
  start() {
    if (!this.regenInterval) {
      this.regenInterval = setInterval(() => this.regenerate(), REGEN_INTERVAL); // Start regeneration interval
    }
  }
  regenerate() {
    const { health, maxHealth, lastRegenTime } = this.player; // Destructure properties
    const now = Date.now(); // Get current time
    const timeSinceLastRegen = (now - lastRegenTime) / 1000; // Calculate time since last regeneration
    const regenAmount = (this.getRegenAmountPerMinute() / 60) * timeSinceLastRegen; // Calculate regeneration amount
    if (regenAmount > 0 && health < maxHealth) {
      this.player.health = Math.min(health + regenAmount, maxHealth); // Regenerate health
      this.player.lastRegenTime = now; // Update last regeneration time
    }
    if (health >= maxHealth) {
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
    const { currentLocation, player } = this; // Destructure properties
    const location = gameManager.getLocation(currentLocation); // Get current location
    if (!location) return; // Early return if location is not found
    const targetLower = target.toLowerCase(); // Convert target name to lowercase
    const playerNameLower = player.getName().toLowerCase(); // Convert player name to lowercase
    if (targetLower === 'self' || targetLower === playerNameLower || playerNameLower.startsWith(targetLower)) {
      this.lookAtSelf(); // Look at self if target is self
      return;
    }
    const itemInInventory = player.inventory.find(item => item.aliases.includes(targetLower)); // Find item in inventory
    if (itemInInventory) {
      MessageManager.notifyLookAtItemInInventory(player, itemInInventory); // Notify looking at item in inventory
      return;
    }
    const itemInLocation = location.items.find(item => item.aliases.includes(targetLower)); // Find item in location
    if (itemInLocation) {
      MessageManager.notifyLookAtItemInLocation(player, itemInLocation); // Notify looking at item in location
      return;
    }
    const npcId = location.npcs.find(npcId => {
      const npc = gameManager.getNpc(npcId); // Get NPC instance
      return npc && npc.aliases.includes(targetLower); // Check if NPC matches target
    });
    if (npcId) {
      const npc = gameManager.getNpc(npcId); // Get NPC instance
      MessageManager.notifyLookAtNpc(player, npc); // Notify looking at NPC
      return;
    }
    const otherPlayer = location.playersInLocation.find(player => player.name.toLowerCase() === targetLower); // Find other player in location
    if (otherPlayer) {
      MessageManager.notifyLookAtOtherPlayer(player, otherPlayer); // Notify looking at other player
      return;
    }
    MessageManager.notifyTargetNotFoundInLocation(player, target); // Notify if target is not found in location
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
  static generateUid() {
    const uniqueValue = Date.now() + Math.random(); // Generate a unique value based on time and randomness
    return bcrypt.hash(uniqueValue.toString(), 5); // Hash the unique value
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
// NPC ********************************************************************************************
/*
 * The Npc class is responsible for representing non-player characters in the game.
 * It extends the Character class.
*/
class Npc extends Character {
  constructor(name, sex, currHealth, maxHealth, attackPower, csml, aggro, assist, status, currentLocation, mobile = false, zones = [], aliases) {
    super(name, currHealth); // Call the parent constructor
    this.CONFIG = null; // Initialize CONFIG
    this.sex = sex; // NPC's sex
    this.maxHealth = maxHealth; // NPC's maximum health
    this.attackPower = attackPower; // NPC's attack power
    this.csml = csml; // NPC's CSML
    this.aggro = aggro; // NPC's aggro status
    this.assist = assist; // NPC's assist status
    this.status = status; // NPC's current status
    this.currentLocation = currentLocation; // NPC's current location
    this.mobile = mobile; // NPC's mobile status
    this.zones = zones; // NPC's zones
    this.aliases = aliases; // NPC's aliases
    this.id = UidGenerator.generateUid(); // Use UidGenerator to generate UID
    this.previousState = { currHealth, status }; // Track previous state
    if (this.mobile) this.startMovement(); // Start movement if NPC is mobile
  }
  importConfig() {
    try {
      this.CONFIG = import('./config.js'); // Direct import of config
    } catch (error) {
      console.error('Failed to import config:', error); // Handle import error
    }
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
      MessageManager.notifyNpcDeparture(this, DirectionManager.getDirectionTo(newLocationId)); // Notify players of NPC departure
      this.currentLocation = newLocationId; // Update NPC's location
      const direction = DirectionManager.getDirectionFrom(this.currentLocation); // Use DirectionManager directly
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
// Base Item ***************************************************************************************
/*
 * The BaseItem class is responsible for representing items in the game.
 * It stores the item's UID, name, description, and aliases.
*/
class BaseItem {
  constructor(name, description, aliases) {
    this.name = name; // Item's name
    this.description = description; // Item's description
    this.aliases = aliases; // Item's aliases
    this.uid = UidGenerator.generateUid(); // Use UidGenerator to generate UID
  }
}
// Item *******************************************************************************************
/*
 * The Item class is responsible for representing items in the game.
 * It stores the item's UID, name, description, and aliases.
*/
class Item extends BaseItem {
  constructor(name, description, aliases) {
    super(name, description, aliases); // Call parent constructor
  }
}
// Container Item *********************************************************************************
/*
 * The ContainerItem class extends the Item class and is used to represent items that can hold other items.
 * It adds an inventory property to store the items contained within the container.
*/
class ContainerItem extends BaseItem {
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
class WeaponItem extends BaseItem {
  constructor(name, description, aliases) {
    super(name, description, aliases); // Call parent constructor
    this.damage = 0; // Initialize damage value
  }
}
// Player Actions Class *****************************************************************************
class PlayerActions {
  constructor(player) {
    this.player = player; // Reference to the player instance
    this.messageData = {}; // Reusable message data object
  }
  attackNpc(target) {
    const location = gameManager.getLocation(this.player.currentLocation); // Get current location
    if (!location) return; // Early return if location is not found
    const npcId = target ? this.findEntity(target, location.npcs, "npc") : this.getAvailableNpcId(location.npcs); // Find NPC by name if specified
    if (!npcId) {
      if (target) {
        MessageManager.notifyTargetNotFound(this.player, target); // Notify if target NPC is not found
      } else {
        MessageManager.notifyNoConsciousEnemies(this.player); // Notify if no conscious enemies are available
      }
      return; // Early return if no NPC found
    }
    const npc = gameManager.getNpc(npcId); // Get NPC instance
    if (!npc) return; // Early return if NPC is not found
    if (npc.isUnconsciousOrDead()) {
      MessageManager.notifyNpcAlreadyInStatus(this.player, npc); // Notify if NPC is already in a specific status
    } else {
      this.startCombat(npcId, this.player, true); // Start combat with the NPC
    }
  }
  getAvailableNpcId(npcs) {
    return npcs.find(id => {
      const npc = this.gameManager.getNpc(id);
      return npc && !npc.isUnconsciousOrDead(); // Check if NPC is available for combat
    });
  }
  findEntity(name, entities, type) {
    const nameLower = name.toLowerCase(); // Convert name to lowercase
    return entities.find(entityId => {
      const entity = gameManager.getEntity(entityId, type); // Get entity instance
      return entity && entity.aliases.includes(nameLower); // Check if entity matches name
    });
  }
}
// Combat Actions Class ***************************************************************************
class CombatActions {
  constructor(player) {
    this.player = player; // Reference to the player instance
  }
  initiateCombat(npcId) {
    CombatManager.startCombat(npcId, this.player); // Start combat with the specified NPC
  }
  // Other combat-related methods can be added here
}
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
  addToInventory(item) {
    addToInventory(this.player, item); // Add item to inventory using utility function
  }
  removeFromInventory(item) {
    removeFromInventory(this.player, item); // Remove item from inventory using utility function
  }
  getAllItemsFromSource(source, sourceType, containerName) {
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
  getAllItemsFromLocation() {
    this.getAllItemsFromSource(location[this.player.currentLocation].items, 'location'); // Get all items from current location
  }
  getAllItemsFromContainer(containerName) {
    const containerId = this.getContainerId(containerName); // Get container ID
    if (!containerId) return; // Return if container not found
    const container = items[containerId]; // Get container instance
    if (container instanceof ContainerItem) {
      this.getAllItemsFromSource(container.inventory, 'container', container.name); // Get items from container
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
    const itemId = findEntity(target1, location[this.player.currentLocation].items, 'item'); // Find item in location
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
    const itemsToDrop = this.player.inventory.filter(item => itemMatchesType(item, itemType)); // Filter items by type
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
    if (!containerId) return; // Early return if container not found
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
    const containerId = findEntity(containerName, this.player.inventory, 'item'); // Find container ID
    const container = items[containerId]; // Get container instance
    if (container instanceof ContainerItem) {
      const itemsToPut = this.player.inventory.filter(item => item !== container && itemMatchesType(item, itemType)); // Filter items by type
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
      const itemsTaken = currentLocation.items.filter(itemId => itemMatchesType(items[itemId], itemType)); // Filter items by type
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
    const containerId = findEntity(containerName, this.player.inventory, 'item'); // Find container ID
    const container = items[containerId]; // Get container instance
    if (container instanceof ContainerItem) {
      const itemsTaken = container.inventory.filter(itemId => itemMatchesType(items[itemId], itemType)); // Filter items by type
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
    const npcId = findEntity(target1, location[this.player.currentLocation].npcs, 'npc'); // Find NPC in location
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
    const containerId = findEntity(containerName, this.player.inventory, 'item'); // Find container ID
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
    const containerId = findEntity(containerName, this.player.inventory, 'item'); // Find container ID
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
    this.player.transferItem(itemId, source, sourceType); // Use player's transferItem method
  }
}
// Combat Manager *********************************************************************************
class CombatManager {
  #combatOrder = new Map(); // Map to track combat order
  #defeatedNpcs = new Set(); // Set to track defeated NPCs
  #combatInitiatedNpcs = new Set(); // Set to track initiated combat NPCs
  constructor(gameManager) {
    this.CONFIG = null; // Initialize CONFIG
    this.importConfig(); // Call method to load config
    this.gameManager = gameManager; // Reference to the game manager instance
    this.techniques = this.initializeTechniques(); // Initialize combat techniques
  }
  async importConfig() {
    this.CONFIG = await import('./config.js'); // Direct import of config
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
    this.#combatOrder.set(npcId, { state: 'engaged' }); // Add NPC to combat order
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
    this.notifyPlayersInLocation(player.currentLocation, message.content); // Notify players in location
    if (!playerInitiated) {
      player.lastAttacker = npc.id; // Set last attacker for player
      this.#combatInitiatedNpcs.add(npc.id); // Add NPC to initiated combat set
    }
    this.startCombatLoop(player); // Start combat loop for player
  }
  notifyCombatJoin(npc, player) {
    this.notifyPlayersInLocation(player.currentLocation, {
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
        this.notifyHealthStatus(player, npc); // Notify health status
        const result = this.performCombatAction(player, npc, true); // Perform combat action
        if (npc.health <= 0) {
          this.handleNpcDefeat(npc, player); // Handle NPC defeat
        } else {
          // Use result to notify players of the combat action outcome
          this.notifyPlayersInLocation(player.currentLocation, result); // Notify combat action result
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
    this.gameManager.logger.info(`${player.getName()} has been defeated by ${defeatingNpc.getName()}.`, { playerId: player.getId(), npcId: defeatingNpc.id });
  }
  handleNpcDefeat(npc, player) {
    npc.status = player.killer ? "lying dead" : "lying unconscious"; // Set NPC status based on player
    player.status = "standing"; // Set player status to standing
    player.experience += npc.experienceReward; // Add experience reward to player
    const messages = this.generateDefeatMessages(player, npc); // Generate defeat messages
    this.notifyPlayersInLocation(this.gameManager.getLocation(player.currentLocation), { type: "combat", content: messages.join("<br>") }); // Notify players of defeat
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
    const outcome = this.calculateAttackOutcome(attacker, defender);
    const technique = CombatManager.getRandomElement(this.techniques);
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
    const location = this.gameManager.getLocation(player.currentLocation); // Get current location
    if (!location) return; // Early return if location is not found
    const npcId = target1 ? findEntity(target1, location.npcs, "npc") : this.getAvailableNpcId(location.npcs); // Find NPC by name if specified
    if (!npcId) {
      if (target1) {
        MessageManager.notifyTargetNotFound(player, target1); // Notify player if target NPC is not found
      } else {
        MessageManager.notifyNoConsciousEnemies(player); // Notify player if no conscious enemies are available
      }
      return; // Early return if no NPC found
    }
    const npc = this.gameManager.getNpc(npcId); // Get NPC instance
    if (!npc) return; // Early return if NPC is not found
    if (npc.isUnconsciousOrDead()) {
      MessageManager.notifyNpcAlreadyInStatus(player, npc); // Notify player if NPC is already in a non-combat state
    } else {
      this.startCombat(npcId, player, true); // Start combat with the NPC
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
    return Array.from(this.#combatOrder.keys())[0]; // Returns the first NPC in combat order
  }
  notifyPlayersInLocation(locationId, content) {
    MessageManager.notifyPlayersInLocation(this.gameManager.getLocation(locationId), content);
  }
  notifyHealthStatus(player, npc) {
    const playerHealthPercentage = this.calculateHealthPercentage(player.health, player.maxHealth);
    const npcHealthPercentage = this.calculateHealthPercentage(npc.health, npc.maxHealth);
    this.notifyPlayersInLocation(player.currentLocation,
      MessageManager.createCombatHealthStatusMessage(player, playerHealthPercentage, npc, npcHealthPercentage));
  }
  calculateHealthPercentage(currentHealth, maxHealth) {
    return (currentHealth / maxHealth) * 100; // Health percentage calculation
  }
  calculateAttackValue(attacker, defender, roll) {
    if (attacker.level === defender.level) {
      return roll + attacker.csml; // Equal levels
    } else if (attacker.level < defender.level) {
      return (roll + attacker.csml) - (defender.level - attacker.level); // Attacker lower level
    } else {
      return (roll + attacker.csml) + (attacker.level - defender.level); // Attacker higher level
    }
  }
  calculateAttackOutcome(attacker, defender) {
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
  static getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)]; // Random selection utility
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
    this.description = {}; // Reusable description object
  }
  describe() {
    const location = gameManager.getLocation(this.player.currentLocation); // Get current location
    if (!location) {
      MessageManager.notify(this.player, `${this.player.getName()} is in an unknown location.`); // Notify if location is unknown
      return;
    }
    this.description = this.formatDescription(location); // Format location description
    MessageManager.notify(this.player, this.description); // Send description to player
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
    return { cssid, content: message }; // Create message data with CSS ID
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
class MessageManager {
  static socket;
  static setSocket(socketInstance) {
    this.socket = socketInstance; // Set socket instance
  }
  static notify(player, message, cssid = '') {
    console.log(`Message to ${player.getName()}: ${message}`); // Log message
    const messageData = FormatMessageManager.createMessageData(cssid, message); // Create message data
    if (this.socket) {
      this.socket.emit('message', { playerId: player.getId(), messageData }); // Emit message
    }
    return messageData; // Return message data
  }
  static notifyPlayersInLocation(location, message) {
    if (!location || !location.playersInLocation) return;
    location.playersInLocation.forEach(player => this.notify(player, message));
  }
  static notifyAction(player, action, targetName, cssid) {
    return this.notify(player, `${player.getName()} ${action} ${targetName}.`, cssid);
  }
  static notifyLoginSuccess(player) {
    return this.notifyAction(player, 'has logged in successfully!', '', FormatMessageManager.getIdForMessage('loginSuccess'));
  }
  static notifyIncorrectPassword(player) {
    return this.notify(player, `Incorrect password. Please try again.`, FormatMessageManager.getIdForMessage('incorrectPassword'));
  }
  static notifyDisconnectionDueToFailedAttempts(player) {
    return this.notify(player, `${player.getName()} has been disconnected due to too many failed login attempts.`, FormatMessageManager.getIdForMessage('disconnectionFailedAttempts'));
  }
  static notifyPickupItem(player, itemName) {
    return this.notifyAction(player, 'picks up', itemName, FormatMessageManager.getIdForMessage('pickupItem'));
  }
  static notifyDropItem(player, itemName) {
    return this.notifyAction(player, 'drops', itemName, FormatMessageManager.getIdForMessage('dropItem'));
  }
}