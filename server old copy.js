// Define server-------------------------------------------------------------------------
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const app = express();
const server = http.createServer(app);
app.use(cors());
const io = new Server(server, {
  cors: {
    origin: "http://localhost:6400",
    //origin: "*", // Be cautious with this in production
    methods: ["GET", "POST"]
  }
});
app.use(express.static('public'));
io.on('connection', (socket) => {
  console.log('Player connected.');
  socket.on('createNewCharacter', ({ playerName, password }) => {
    createNewCharacter(playerName, password, socket);
    console.log(`New character created: ${playerName}`);
  });
  socket.on('login', ({ playerName, password }) => {
    loadPlayerData(playerName, password, socket);
    console.log(`${playerName} logged in.`);
  });
  // Handle player joining the game
  socket.on('joinGame', (playerName) => {
    const newPlayer = initializeNewPlayer(playerName, socket.id);
    players.set(socket.id, newPlayer);
    socket.join(newPlayer.currentRoom);
    socket.emit('gameJoined', newPlayer);
    describeRoom(newPlayer);
  });
  // Handle player commands
  socket.on('command', (command) => {
    handleCommand(command, socket.id);
  });
  // Handle disconnection
  socket.on('disconnect', () => {
    const player = players.get(socket.id);
    if (player) {
      console.log(`${player.name} disconnected.`);
      // Notify other players in the same room
      socket.to(player.currentRoom).emit('displayMessage', `${player.name} has left the game.`);
      // Remove the player from the players Map
      players.delete(socket.id);
    } else {
      console.log('Player disconnected before login.');
    }
  });
});
io.sockets.disconnectAll = function() {
  Object.keys(io.sockets.sockets).forEach(function(socketId) {
    io.sockets.sockets[socketId].disconnect(true);
  });
};
function shutdownServer(player) {
  displayMessage("Shutting down the server...");
  console.log(`Server shutdown initiated by ${player.name}.`);
  // Save all player data
  //players.forEach(player => savePlayerData(player));
  stopGame();
  io.sockets.disconnectAll();
  server.close(() => {
    console.log("Server has been shut down.");
    process.exit(0);
  });
}
function displayMessage(message, playerId) {
  io.to(playerId).emit('displayMessage', message);
}
function cleanupDisconnectedPlayers() {
  for (const [playerId, player] of players.entries()) {
    if (!io.sockets.sockets.get(playerId)) {
      console.log(`Removing disconnected player: ${player.name}`);
      players.delete(playerId);
    }
  }
}
// define global variables---------------------------------------------------------------
const bcrypt = require('bcrypt');
const saltRounds = 10;
const fileSystem = require('fs');
const path = require('path');
const players = new Map();
let npcReviveInterval;
let npcMovementInterval;
let healthRegenInterval;
let combatInterval;
let combatOrder = [];
let defeatedNPCs = new Set();
let combatInitiatedNPCs = new Set();
const DIRECTIONS = ['n', 'e', 'w', 's', 'u', 'd'];
const DIRECTION_NAMES = {
  n: 'North',
  e: 'East',
  w: 'West',
  s: 'South',
  u: 'Up',
  d: 'Down'
};
const oppositeDirection = { 'n': 's', 'e': 'w', 'w': 'e', 's': 'n', 'u': 'd', 'd': 'u' };
let techniques = [
  'axe kick', 'back kick', 'back-fist', 'butterfly kick', 'butterfly twist kick', 'canon fist', 'crushing elbow', 'crushing fist', 'crushing hammer fist', 'crushing hand', 'crushing knee', 'crushing kick', 'crushing palm', 'crushing shoulder strike', 'crushing strike', 'crouching leg-sweep kick', 'crouching spinning leg-sweep kick', 'cut kick', 'dagger fingers', 'dagger hand', 'dagger kick', 'diagonal knee', 'double front kick', 'double side kick', 'downward roundhouse kick', 'eagle claw', 'falling elbow', 'falling knee', 'flying back kick', 'flying drop kick', 'flying front kick', 'flying knee', 'flying side kick', 'front kick', 'hammer fist', 'headbutt', 'hook kick', 'inverted roundhouse kick', 'inward elbow', 'inside crescent kick', 'jumping axe kick', 'jumping back kick', 'jumping double front kick', 'jumping double roundhouse kick', 'jumping double side kick', 'jumping knee', 'jumping reverse hook kick', 'jumping roundhouse kick', 'jumping spinning crescent kick', 'jumping spinning hook kick', 'knife hand', 'knee-sweep kick', 'leopard fist', 'leg-sweep kick', 'mantis fist', 'oblique kick', 'one knuckle fist', 'outside crescent kick', 'piercing elbow', 'piercing fingers', 'piercing fist', 'piercing hand', 'piercing knee', 'piercing kick', 'piercing palm', 'piercing shoulder strike', 'piercing strike', 'reverse elbow', 'ridge hand', 'rising elbow', 'rising knee', 'roundhouse knee', 'roundhouse kick', 'scissor kick', 'scoop kick', 'scorpion kick', 'shin kick', 'shoulder strike', 'side kick', 'smashing elbow', 'smashing fist', 'smashing hammer fist', 'smashing hand', 'smashing knee', 'smashing kick', 'smashing palm', 'smashing shoulder strike', 'smashing strike', 'snapping back-fist', 'snapping elbow', 'snapping fist', 'snapping hammer fist', 'snapping hand', 'snapping knee', 'snapping kick', 'snapping palm', 'snapping shoulder strike', 'snapping strike', 'spinning axe kick', 'spinning back kick', 'spinning crescent kick', 'spinning elbow', 'spinning heel kick', 'spinning hook kick', 'spinning leg-sweep kick', 'spinning roundhouse kick', 'spinning side kick', 'stretch kick', 'stomp kick', 'stop kick', 'switch kick', 'thrusting fingers', 'thrusting fist', 'thrusting hand', 'thrusting kick', 'thrusting knee', 'thrusting palm', 'thrusting shoulder strike', 'thrusting strike', 'toe kick', 'tornado axe kick', 'tornado kick', 'triple front kick', 'triple side kick', 'twisting kick', 'two knuckle fist', 'wheel kick', 'whipping back-fist', 'whipping elbow', 'whipping fist', 'whipping hammer fist', 'whipping hand', 'whipping knee', 'whipping kick', 'whipping palm', 'whipping shoulder strike', 'whipping strike'
];
// Define rooms--------------------------------------------------------------------------
const rooms = {
  "room100": {
    id: "room100",
    title: "Temple Entrance",
    description: "A massive stone gateway serves as the main entrance to this legendary Chang'an Buddhist Temple. The air crackles with activity and the echoes of Wuseng (warrior monks) in training.",
    exits: new Map([
      ['n', "room101"],
      ['e', "room102"],
      ['w', "room103"],
      ['s', "room104"],
      ['u', "room105"],
      ['d', "room106"]
    ]),
    items: ["item100", "item101", "item102", "item103", "item104"],
    npcs: ["npc100", "npc101"]
  },
  "room101": {
    id: "room101",
    title: "Training Grounds",
    description: "A wide, circular area filled with training dummies, weapon racks, and the sounds of warriors honing their skills. This is where combatants prepare for the challenges ahead.",
    exits: new Map([
      ['s', "room100"]
    ]),
    items: [],
    npcs: ["npc101"]
  },
  "room102": {
    id: "room102",
    title: "Temple Gardens",
    description: "A serene garden with carefully manicured trees, colorful flowers, and a small koi pond. The gentle sound of a nearby fountain adds to the peaceful atmosphere.",
    exits: new Map([
      ['w', "room100"]
    ]),
    items: [],
    npcs: []
  },
  "room103": {
    id: "room103",
    title: "Meditation Hall",
    description: "A quiet, dimly lit hall with rows of cushions for meditation. Incense burns softly, filling the air with a calming aroma.",
    exits: new Map([
      ['e', "room100"]
    ]),
    items: [],
    npcs: []
  },
  "room104": {
    id: "room104",
    title: "Temple Courtyard",
    description: "A spacious open area surrounded by ornate pillars and statues of Buddhist deities. A large bronze bell hangs in the center, occasionally rung to mark the hours.",
    exits: new Map([
      ['n', "room100"]
    ]),
    items: [],
    npcs: []
  },
  "room105": {
    id: "room105",
    title: "Temple Rooftop",
    description: "An open area atop the temple, offering a breathtaking view of Chang'an and the surrounding landscape. Prayer flags flutter in the breeze.",
    exits: new Map([
      ['d', "room100"]
    ]),
    items: [],
    npcs: []
  },
  "room106": {
    id: "room106",
    title: "Temple Crypt",
    description: "A solemn underground chamber, housing ancient relics and the tombs of revered monks. Flickering torches cast dancing shadows on the walls.",
    exits: new Map([
      ['u', "room100"]
    ]),
    items: [],
    npcs: []
  }
};
// Define NPCs---------------------------------------------------------------------------
const npcs = {
  "npc100": {
    id: "npc100",
    name: "Temple Guard",
    level: 1,
    csmod: 0,       // Csmod = level, with a maximum of 20
    health: 100,     // 100 per level or 100 x level = player
    maxHealth: 100, // 100 per level or 100 x level = player
    attackPower: 10,//  10 per level or 10 x level = player
    defensePower: 0,
    xpReward: 5,
    mobile: false,
    aggro: false,
    status: "standing",
    originalStatus: "standing",
    aliases: ["mob", "temple guard", "temple", "guard"],
    inventory: ["item103"]
  },
  "npc101": {
    id: "npc101",
    name: "Warrior Monk",
    level: 2,
    csmod: 1,
    health: 200,
    maxHealth: 200,
    attackPower: 20,
    defensePower: 0,
    xpReward: 2,
    mobile: false,
    aggro: false,
    status: "wandering about",
    originalStatus: "wandering about",
    aliases: ["mob", "warrior monk", "warrior", "monk"],
  }
};
// Define items--------------------------------------------------------------------------
const items = {
  "item100": {
    id: "item100",
    name: "compass",
    aliases: ["compass", "nav", "navigation"],
    description: "A shimmering compass that seems to point in impossible directions."
  },
  "item101": {
    id: "item101",
    name: "bag",
    aliases: ["bag", "sack", "backpack"],
    description: "A leather bag 1 that can hold various items.",
    inventory: []
  },
  "item102": {
    id: "item102",
    name: "mysterious key",
    aliases: ["mysterious key", "key", "mkey"],
    description: "An ornate key that radiates an otherworldly energy."
  },
  "item103": {
    id: "item103",
    name: "compass",
    aliases: ["compass", "nav", "navigation"],
    description: "A shimmering compass that seems to point in impossible directions."
  },
  "item104": {
    id: "item101",
    name: "bag",
    aliases: ["bag", "sack", "backpack"],
    description: "A leather bag 2 that can hold various items.",
    inventory: []
  },
};
// Login functions-----------------------------------------------------------------------
function createNewCharacter(playerName, password, socket) {
  // Create playerData directory if it doesn't exist
  fileSystem.mkdir(path.join(__dirname, 'playerData'), { recursive: true }, (err) => {
    if (err) console.error('Error creating playerData directory:', err);
  });
  // Check if the player already exists
  const fileName = `${playerName.toLowerCase()}.json`;
  const filePath = path.join(__dirname, 'playerData', fileName);
  fileSystem.access(filePath, fileSystem.constants.F_OK, (err) => {
    if (!err) {
      // File exists, character name already in use
      socket.emit('loginResult', { success: false, message: 'Character name already exists. Please choose a different name.<br>' });
    } else {
      // Create new character
      bcrypt.hash(password, saltRounds, (err, hashedPassword) => {
        if (err) {
          console.error('Error hashing password:', err);
          socket.emit('loginResult', { success: false, message: 'Error creating new character. Please try again.<br>' });
        } else {
          const newPlayer = initializeNewPlayer(playerName, password);
          newPlayer.hashedPassword = hashedPassword;

          // Save the new player data
          fileSystem.writeFile(filePath, JSON.stringify(newPlayer, null, 2), (err) => {
            if (err) {
              console.error(`Error saving new player data for ${playerName}:`, err);
              socket.emit('loginResult', { success: false, message: 'Error creating character. Please try again.<br>' });
            } else {
              players.set(socket.id, newPlayer);
              socket.emit('loginResult', { success: true, message: 'Character created successfully. You can now log in.<br>' });
            }
          });
        }
      });
    }
  });
}
// Define player-------------------------------------------------------------------------
//Use playerId when passing the ID as a parameter to functions or when working with the ID directly.
//Use player.id when you have a player object and need to access its ID property.
function initializeNewPlayer(playerName, password) {
  const newPlayer = {
    id: createPlayerId(playerName, password),
    name: playerName,
    hashedPassword: "",
    age: 0,
    sex: "male",
    hisher: "his",
    level: 0,
    csmod: 0,
    attackPower: 10,
    defensePower: 0,
    xp: 0,
    health: 100,
    maxHealth: 100,
    status: "standing",
    killer: true,
    autoloot: true,
    currentRoom: "room100",
    coordinates: { "x": 0, "y": 0, "z": 0 },
    inventory: [],
    lastAttacker: null,
    lastRegenTime: Date.now(),
    skills: ["vital breath", "meditate", "iron body", "sleeper hold", "knock down", "immortal vigor", "heavenly flow"],
    affects: [],
    title: "",
    reputation: "",
    profession: "",
    description: ""
  };
  return newPlayer;
}
function createPlayerId(playerName, password) {
  // Use a lower salt round for the ID generation to keep it quick
  const salt = bcrypt.genSaltSync(5);
  return bcrypt.hashSync(playerName + password, salt);
}
// Player skill functions----------------------------------------------------------------

function vitalBreath(player) {
  if (player.health >= player.maxHealth) {
    displayMessage(`<span id="error-message">${player.name} is already at full health.</span><br>`, player.id);
    return;
  }
  const healPercentage = Math.min(1, 0.2 * Math.floor(player.csmod / 4));
  player.health = Math.min(player.maxHealth, player.health + player.maxHealth * healPercentage);
  displayMessage(`${player.name} uses Vital Breath Qi Gong to restore ${player.hisher} health.<br>`, player.id);
}
// fountain of life
function heavenlyFlow(player) {
  displayMessage(`${player.name} uses Heavenly Flow Qi Gong to temporarily increase ${player.hisher} vitality.<br>`, player.id);
}
// life of the immortals
function immortalVigor(player) {
  const multipliers = [1, 1.25, 1, 1.25, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
  const multiplier = multipliers[Math.min(player.csmod, 20)];
  player.maxHealth *= multiplier;
  player.health = player.maxHealth;
  fullStateSync(player);
  displayMessage(`${player.name} uses Immortal Vigor Qi Gong to temporarily increase ${player.hisher} vitality.<br>`, player.id);
}
function ironBody(player) {
  if (player.affects.some(affect => affect.name === 'Iron Body')) {
    displayMessage(`<span id="error-message">${player.name} is already under the effects of Iron Body Qi Gong.</span><br>`, player.id);
    return;
  }
  const duration = 6 * 60 * 1000; // 6 minutes in milliseconds
  const defensePowerIncrease = player.maxHealth * 0.1;
  player.defensePower += defensePowerIncrease;
  const ironBodyEffect = {
    name: 'Iron Body',
    endTime: Date.now() + duration,
    remove: () => {
      player.defensePower -= defensePowerIncrease;
      player.affects = player.affects.filter(affect => affect.name !== 'Iron Body');
      displayMessage(`${player.name}'s Iron Body Qi Gong effect has worn off.<br>`, player.id);
    }
  };
  player.affects.push(ironBodyEffect);
  displayMessage(`${player.name} uses Iron Body Qi Gong to temporarily increase ${player.hisher} resistance to physical damage for 6 minutes.<br>`, player.id);
  setTimeout(ironBodyEffect.remove, duration);
}
function knockDown(player) {
  if (player.csmod >= 4) {
    displayMessage(`${player.name} uses knock down and attempts to knock down an opponent.<br>`, player.id);
  }
  function meditate(player) {
    player.status = "meditating";
    displayMessage(`${player.name} begins to meditate.<br>`, player.id);
  }
  function sleeperHold(player) {
    displayMessage(`${player.name} uses sleeper hold and attempts to immobilize an opponent.<br>`, player.id);
  }
}
// Player functions----------------------------------------------------------------------
function extractPlayerData(player) {
  return {
    id: player.id,
    name: player.name,
    hashedPassword: player.hashedPassword,
    sex: player.sex,
    hisher: player.hisher,
    level: player.level,
    csmod: player.csmod,
    attackPower: player.attackPower,
    defensePower: player.defensePower,
    xp: player.xp,
    health: player.health,
    maxHealth: player.maxHealth,
    status: player.status,
    killer: player.killer,
    autoloot: player.autoloot,
    currentRoom: player.currentRoom,
    coordinates: player.coordinates,
    inventory: player.inventory,
    lastAttacker: player.lastAttacker,
    lastRegenTime: player.lastRegenTime,
    skills: player.skills,
    affects: player.affects
  };
}
function fullStateSync(player) {
  const playerState = extractPlayerData(player);
  io.to(player.id).emit('fullStateSync', { playerState });
}
function savePlayerData(player) {
  const playerData = extractPlayerData(player);
  const fileName = `${player.name.toLowerCase()}.json`;
  const filePath = path.join(__dirname, 'playerData', fileName);
  fileSystem.writeFile(filePath, JSON.stringify(playerData, null, 2), (err) => {
    if (err) {
      console.error(`Error saving player data for ${player.name}:`, err);
      displayMessage(`<span id="error-message">Error saving game data.</span><br>`, player.id);
    } else {
      displayMessage(`Game data saved for ${player.name}.<br>`, player.id);
    }
  });
}
function loadPlayerData(playerName, password, socket) {
  const fileName = `${playerName.toLowerCase()}.json`;
  const filePath = path.join(__dirname, 'playerData', fileName);
  fileSystem.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        socket.emit('loginResult', { success: false, message: "Player not found. Please check your character's name or create a new character.<br>"});
      } else {
        console.error(`Error loading player data for ${playerName}:`, err);
        socket.emit('loginResult', { success: false, message: 'Error loading game data. Please try again.<br>' });
      }
    } else {
      try {
        const playerData = JSON.parse(data);
        // Verify password
        bcrypt.compare(password, playerData.hashedPassword, (err, result) => {
          if (err) {
            console.error('Error comparing passwords:', err);
            socket.emit('loginResult', { success: false, message: 'Error during login. Please try again.<br>' });
          } else if (result) {
            // Password is correct
            playerData.id = createPlayerId(playerName, password); // Update with the new ID
            players.set(playerData.id, playerData);
            const player = {
              ...playerData,
              id: socket.id // Use socket.id as the player's id
            };
            players.set(socket.id, player);
            socket.emit('loginResult', { success: true, message: 'Login successful.<br>' });
            socket.emit('gameJoined', player);
            socket.join(player.currentRoom);
            fullStateSync(player);
            describeRoom(player);
          } else {
            // Password is incorrect
            socket.emit('loginResult', { success: false, message: 'That password is incorrect. Please create-account-button.' });
          }
        });
      } catch (parseErr) {
        console.error(`Error parsing player data for ${playerName}:`, parseErr);
        socket.emit('loginResult', { success: false, message: 'Error loading game data. Please try again.' });
      }
    }
  });
}
function startHealthRegeneration(player) {
  if (!player.healthRegenInterval) {
    player.healthRegenInterval = setInterval(() => {
      regenerateHealth(player);
      fullStateSync(player);
    }, 15000); // Check for regen every 15 seconds
  }
}
function regenerateHealth(player) {
  const now = Date.now();
  const timeSinceLastRegen = (now - player.lastRegenTime) / 1000; // Convert to seconds
  let regenAmountPerMinute;
  // Regen amount per minute based on player status, but updated every 30 seconds
  switch (player.status) {
    case "in combat":
      regenAmountPerMinute = 0.125 * player.maxHealth;
      break;
    case "standing":
      regenAmountPerMinute = 0.25 * player.maxHealth;
      break;
    case "sitting":
      regenAmountPerMinute = 0.5 * player.maxHealth;
      break;
    case "sleeping":
      regenAmountPerMinute = 0.75 * player.maxHealth;
    case "lying unconscious":
      regenAmountPerMinute = 1 * player.maxHealth;
      break;
    case "meditating":
      regenAmountPerMinute = 2.0 * player.maxHealth;
      break;
  }
  // Calculate the actual regen amount for the time passed
  const regenAmount = (regenAmountPerMinute / 60) * timeSinceLastRegen;
  if (regenAmount > 0 && player.health < player.maxHealth) {
    player.health = Math.min(player.health + regenAmount, player.maxHealth);
    player.lastRegenTime = now;
    fullStateSync(player);
  }
  // Check if player's health is at 100% and clear the interval if so
  if (player.health >= player.maxHealth) {
    clearInterval(player.healthRegenInterval);
    player.healthRegenInterval = null;
  }
}
function checkAndRemoveExpiredAffects(player) {
  const now = Date.now();
  player.affects = player.affects.filter(affect => {
    if (affect.endTime && affect.endTime <= now) {
      affect.remove(player);
      return false;
    }
    return true;
  });
}
function sleep(player) {
  startHealthRegeneration(player);
  player.status = "sleeping";
  displayMessage(`${player.name} lies down and falls asleep.<br>`, player.id);
}
function sit(player) {
  if (player.status === "sitting") {
    displayMessage(`<span id="error-message">${player.name} is already sitting.</span><br>`, player.id);
  } else if (player.status === "standing") {
    startHealthRegeneration(player);
    player.status = "sitting";
    displayMessage(`${player.name} sits down.`, player.id);
  } else {
    displayMessage(`<span id="error-message">${player.name} stops meditating and simply sits here.</span><br>`, player.id);
  }
}
function meditate(player) {
  if (player.status !== "sitting") {
    startHealthRegeneration(player);
    displayMessage(`<span id="error-message">${player.name} sits down here and begins to meditate.</span><br>`, player.id);
    return;
  }
  player.status = "meditating";
  displayMessage(`${player.name} begins to meditate.`, player.id);
}
function wake(player) {
  if (player.status === "lying unconscious") {
    player.status = "standing";
    displayMessage(`${player.name} slowly regains consciousness and stands up.`, player.id);
  } else if (player.status === "sleeping") {
    player.status = "standing";
    displayMessage(`${player.name} wakes up and stands.`, player.id);
  } else {
    displayMessage(`<span id="error-message">${player.name} is already awake.</span><br>`, player.id);
  }
}
function stand(player) {
  if (player.status === "lying unconscious") {
    player.status = "standing";
    displayMessage(`${player.name} slowly regains consciousness and stands up.<br>`, player.id);
  } else {
    displayMessage(`<span id="error-message">${player.name} is already standing.</span><br>`, player.id);
  }
}
function toggleAutoloot(player) {
  player.autoloot = !player.autoloot;
  displayMessage(`Autoloot is now ${player.autoloot ? 'on' : 'off'}.`, player.id);
}
function toggleKillerMode(player) {
  player.killer = !player.killer;
  displayMessage(`${player.name} is now in ${player.killer ? "killer mode" : "normal mode"}.`, player.id);
}
function isPlayerConscious(player) {
  return player.status !== "lying unconscious";
}
function findEntity(alias, entityList, entityType) {
  const entityMap = entityType === 'item' ? items : npcs;
  return entityList.find(id => entityMap[id].aliases.includes(alias.toLowerCase())) || null;
}
// Room functions------------------------------------------------------------------------
function describeRoom(player) {
  const room = rooms[player.currentRoom];
  let description = `<br><span id="room-title">${room.title}</span><br><span id="room-description">${room.description}</span><br>`;
  const availableExits = DIRECTIONS.filter(exit => room.exits.has(exit));
  if (availableExits.length > 0) {
    description += "Exits:<br><div id='exits-list'>";
    const maxLength = Math.max(...availableExits.map(exit => DIRECTION_NAMES[exit].length));
    description += availableExits.map(exit =>
      `<span id="exit">${padWithNbsp(DIRECTION_NAMES[exit], maxLength)}</span> - <span id="exit-room">${rooms[room.exits.get(exit)].title}</span>`
    ).join("<br>");
    description += "</div>";
  } else {
    description += `<span id="error-message">There are no obvious exits.</span><br>`;
  }
  if (room.items && room.items.length > 0) {
    description += `<div id='items-list'><br>`;
    description += room.items.map(itemId => `A <span id="item">${items[itemId].name}</span> is lying here.`).join("<br>");
    description += "</div>";
  }
  if (room.npcs && room.npcs.length > 0) {
    description += `<div id='npcs-list'><br>`;
    description += room.npcs.map(npcId => `<span id="npc">${npcs[npcId].name}</span> is ${npcs[npcId].status} here.`).join("<br>");
    description += "</div>";
  }
  const playersInRoom = Array.from(io.sockets.adapter.rooms.get(player.currentRoom) || [])
    .map(playerId => players.get(playerId))
    .filter(p => p && p.id !== player.id); // Exclude the current player
  if (playersInRoom.length > 0) {
    description += `<div id='players-list'><br>`;
    description += playersInRoom.map(p => `<span id="player">${p.name}</span> is ${p.status} here.`).join("<br>");
    description += "</div>";
  }
  description += "<br>";
  displayMessage(description, player.id);
}
function padWithNbsp(str, length) {
  return str + '&nbsp;'.repeat(Math.max(0, length - str.length));
}
// NPC functions-------------------------------------------------------------------------
function moveNPC(npcId) {
  const npc = npcs[npcId];
  if (!npc.currentRoom) return;
  const currentRoom = rooms[npc.currentRoom];
  const availableExits = Array.from(currentRoom.exits.keys());
  if (availableExits.length === 0) return;
  const randomExit = availableExits[Math.floor(Math.random() * availableExits.length)];
  const newRoomId = currentRoom.exits.get(randomExit);
  // Remove NPC from current room
  currentRoom.npcs = currentRoom.npcs.filter(id => id !== npcId);
  // Add NPC to new room
  const newRoom = rooms[newRoomId];
  if (!newRoom.npcs) newRoom.npcs = [];
  newRoom.npcs.push(npcId);
  // Update NPC's current room
  npc.currentRoom = newRoomId;
  // Notify players
  const exitMessage = getExitMessage(randomExit);
  const entryMessage = getEntryMessage(randomExit);
  io.to(npc.currentRoom).emit('displayMessage', `<span id="npc">${npc.name}</span> travels ${exitMessage}.<br>`);
  io.to(newRoomId).emit('displayMessage', `<span id="npc">${npc.name}</span> arrives ${entryMessage}.<br>`);
  // Check for aggressive NPCs for players in the new room
  const playersInNewRoom = Array.from(io.sockets.adapter.rooms.get(newRoomId) || []);
  playersInNewRoom.forEach(playerId => {
    const player = players.get(playerId);
    if (player) checkForAggressiveNPCs(player);
  });
}
function getExitMessage(direction) {
  return direction === 'u' ? "up" :
         direction === 'd' ? "down" :
         `to the ${DIRECTION_NAMES[direction].toLowerCase()}`;
}
function getEntryMessage(direction) {
  const oppositeDir = oppositeDirection[direction];
  return oppositeDir === 'u' ? "from above" :
         oppositeDir === 'd' ? "from below" :
         `from the ${DIRECTION_NAMES[oppositeDir].toLowerCase()}`;
}
function startNPCMovement() {
  setInterval(() => {
    for (const npcId in npcs) {
      if (npcs[npcId].mobile === true && npcs[npcId].status !== "lying unconscious") {
        moveNPC(npcId);
      }
    }
  }, 60000); // 60 seconds
}
npcReviveInterval = setInterval(reviveAllNPCs, 300000); // 300000 ms = 5 minutes
function reviveAllNPCs() {
  for (const npcId of defeatedNPCs) {
    const npc = npcs[npcId];
    npc.health = npc.maxHealth;
    npc.status = npc.originalStatus;
    if (rooms[player.currentRoom].npcs.includes(npcId)) {
      displayMessage(`<span id="npc">${npc.name}</span> awakens and stands up.<br>`);
    }
  }
  defeatedNPCs.clear();
}
// Combat functions----------------------------------------------------------------------
function startCombatLoop(player) {
  if (!player.combatInterval) {
    player.combatInterval = setInterval(() => {
      executeCombatRound(player);
    }, 1500); // Execute a combat round every 1.5 seconds
  }
}
function startCombat(npcId, player, playerInitiated = false) {
  const npc = npcs[npcId];
  if (!combatOrder.includes(npcId) && !defeatedNPCs.has(npcId)) {
    combatOrder.push(npcId);
  }
  if (player.status !== "in combat") {
    player.status = "in combat";
    if (playerInitiated) {
      player.lastAttacker = null;
      notifyPlayersInRoom(player.currentRoom, `<span id="combat-message">${player.name} attacks ${npc.name}!</span>`);
    } else if (!combatInitiatedNPCs.has(npcId)) {
      player.lastAttacker = npcId;
      notifyPlayersInRoom(player.currentRoom, `<span id="combat-message">${npc.name} attacks ${player.name}!</span>`);
      combatInitiatedNPCs.add(npcId);
    }
    startCombatLoop(player);
  } else if (!combatInitiatedNPCs.has(npcId)) {
    notifyPlayersInRoom(player.currentRoom, `<span id="combat-message">${npc.name} joins the fight!</span>`);
    combatInitiatedNPCs.add(npcId);
  }
  npc.status = "engaged in combat";
}
function executeCombatRound(player) {
  let description = '';
  let defeatingNPC = null;
  const playerInitiated = player.lastAttacker === null;

  if (playerInitiated) {
    // Player attacks first
    for (const npcId of combatOrder) {
      const npc = npcs[npcId];
      if (npc.health > 0 && player.health > 0 && !defeatedNPCs.has(npcId)) {
        description += displayCombatHealth(npc, player);
        const playerAction = performCombatAction(player, npc, true);
        description += displayCombatAction(playerAction);
        if (npc.health > 0) {
          const npcAction = performCombatAction(npc, player, false);
          description += displayCombatAction(npcAction);
        }
        if (player.health <= 0) {
          defeatingNPC = npc;
          break;
        }
        description += '<br>';
      }
    }
  } else {
    // NPCs attack first
    for (const npcId of combatOrder) {
      const npc = npcs[npcId];
      if (npc.health > 0 && player.health > 0 && !defeatedNPCs.has(npcId)) {
        description += displayCombatHealth(npc, player);
        const npcAction = performCombatAction(npc, player, false);
        description += displayCombatAction(npcAction);
        if (player.health > 0) {
          const playerAction = performCombatAction(player, npc, true);
          description += displayCombatAction(playerAction);
        } else {
          defeatingNPC = npc;
          break;
        }
        description += '<br>';
      }
    }
  }
  // Handle NPC defeat
  for (const npcId of combatOrder) {
    const npc = npcs[npcId];
    if (npc.health <= 0 && !defeatedNPCs.has(npcId)) {
      const defeatMessage = handleNPCDefeat(npc, player);
      description += '<br>' + defeatMessage + '<br>';
      defeatedNPCs.add(npcId);
    }
  }
  // Display combat messages to all players in the room
  notifyPlayersInRoom(player.currentRoom, description);
  // Handle player defeat if it occurred
  if (defeatingNPC) {
    handlePlayerDefeat(defeatingNPC, player);
  }
  fullStateSync(player);
  if (player.health <= 0 || combatOrder.length === 0) {
    endCombat(player);
  }
}
function displayCombatHealth(npc, player) {
  const playerHealthPercent = Math.round((player.health / player.maxHealth) * 100);
  const npcHealthPercent = Math.round((npc.health / npc.maxHealth) * 100);
  return `<span id="combat-message-health">${player.name}: ${playerHealthPercent}%</span><br>` +
    `<span id="combat-message-health">${npc.name}: ${npcHealthPercent}%</span><br>`;
}
function displayCombatAction(action) {
  return `<span id="combat-message">${action}</span><br>`;
}
function handlePlayerDefeat(defeatingNPC, player) {
  startHealthRegeneration(player);
  player.status = "lying unconscious";
  notifyPlayersInRoom(player.currentRoom, `<span id="combat-message">${defeatingNPC.name} is victorious!<br>${player.name} is defeated and lying unconscious here.</span>`);
  // Update status of aggressive NPCs in the room
  const room = rooms[player.currentRoom];
  if (room.npcs) {
    room.npcs.forEach(npcId => {
      const npc = npcs[npcId];
      if (npc.aggro && npc.status === "engaged in combat") {
        npc.status = npc.originalStatus;
      }
    });
  }
  endCombat(player);
}
function handleNPCDefeat(npc, player) {
  npc.status = player.killer ? "lying dead" : "lying unconscious";
  player.status = "standing";
  player.xp += npc.xpReward;
  let messages = [`<span id="combat-message">${player.name} is victorious!<br>${npc.name} is defeated and ${npc.status} here.</span>`];
  const levelUpMessage = checkLevelUp(player);
  if (levelUpMessage) {
    messages.push(levelUpMessage);
  }
  if (player.autoloot) {
    const lootMessage = autoLootNPC(npc, player);
    if (lootMessage) {
      messages.push(lootMessage);
    }
  }
  combatOrder = combatOrder.filter(id => id !== npc.id);
  // Add the defeated NPC to the set
  defeatedNPCs.add(npc.id);
  notifyPlayersInRoom(player.currentRoom, messages.join('<br>'));
  return;
}
function endCombat(player) {
  clearInterval(player.combatInterval);
  player.combatInterval = null;
  combatOrder = [];
  defeatedNPCs.clear();
  combatInitiatedNPCs.clear();
  fullStateSync(player);
  checkForAggressiveNPCs(player);
}
function checkLevelUp(player) {
  const xpThreshold = 3;
  if (player.xp >= xpThreshold) {
    player.level++;
    player.xp -= xpThreshold;
    player.maxHealth += 100;
    player.health = player.maxHealth;
    player.attackPower += 10;
    player.defensePower += 1;
    // Increase csmod by 1 until level 20. At level 20, the csmod reaches its maximum value of 20 and stays there
    if (player.level <= 20) {
      player.csmod = Math.min(player.csmod + 1, 20);
    }
    fullStateSync(player)
    return `<span id="combat-message">Congratulations! ${player.name} is now level ${player.level}!</span><br>`;
  }
  return null;
}
function checkForAggressiveNPCs(player) {
  if (player.health > 0) {
    const room = rooms[player.currentRoom];
    if (room.npcs && room.npcs.length > 0) {
      for (const npcId of room.npcs) {
        const npc = npcs[npcId];
        if (npc.aggro === true &&
          npc.status !== "lying unconscious" &&
          npc.status !== "lying dead" &&
          player.status !== "lying unconscious" &&
          !defeatedNPCs.has(npcId)) {
          startCombat(npcId, player, false);
          break; // Only start combat with one NPC at a time
        }
      }
    }
  }
}
function performCombatAction(attacker, defender, isPlayer) {
  const outcome = calculateAttackOutcome(attacker, defender);
  const technique = techniques[Math.floor(Math.random() * techniques.length)];
  let damage = attacker.attackPower;
  let resistDamage = defender.defensePower;
  let description = '';
  switch (outcome) {
    case "attack is evaded":
      description = `${attacker.name} attacks ${defender.name} with a ${technique}, but ${defender.name} evades the strike!`;
      damage = 0;
      break;
    case "attack is trapped":
      description = `${attacker.name} attacks ${defender.name} with a ${technique}, but ${defender.name} traps the strike!`;
      damage = Math.floor(damage * 0.25); // 75% reduction
      break;
    case "attack is parried":
      description = `${attacker.name} attacks ${defender.name} with a ${technique}, but ${defender.name} parries the strike!`;
      damage = Math.floor(damage * 0.5); // 50% reduction
      break;
    case "attack is blocked":
      description = `${attacker.name} attacks ${defender.name} with a ${technique}, but ${defender.name} blocks the strike!`;
      damage = Math.floor(damage * 0.75); // 25% reduction
      break;
    case "attack hits":
      description = `${attacker.name} attacks ${defender.name} with a ${technique}. The strike successfully hits ${defender.name}!`;
      break;
    case "critical success":
      description = `${attacker.name} attacks ${defender.name} with a devastatingly catastrophic ${technique}.<br>The strike critically hits ${defender.name}!`;
      damage = damage * 2; // Double damage for critical hits
      break;
    case "knockout":
      description = `${attacker.name} strikes ${defender.name} with a spectacularly phenomenal blow!<br>${defender.name}'s body goes limp and collapses to the ground!`;
      damage = defender.health; // Set damage to 100% of defender's current health
      break;
  }
  if (damage > resistDamage) {
    defender.health -= damage - resistDamage;
  }
  return `<span id="combat-message-${isPlayer ? 'player' : 'npc'}">${description}</span>`;
}
function calculateAttackOutcome(attacker, defender) {
  const roll = Math.floor(Math.random() * 20) + 1; // Roll 1d20
  let value;
  if (attacker.level === defender.level) {
    value = roll + attacker.csmod;
  } else if (attacker.level < defender.level) {
    value = (roll + attacker.csmod) - (defender.level - attacker.level);
  } else {
    value = (roll + attacker.csmod) + (attacker.level - defender.level);
  }
  if (value >= 21 || value === 19) return "critical success";
  if (value === 20) return "knockout";
  if (value >= 13) return "attack hits";
  if (value >= 10) return "attack is blocked";
  if (value >= 7) return "attack is parried";
  if (value >= 4) return "attack is trapped";
  if (value >= 1) return "attack is evaded";
  // Fallback for unexpected values
  return "attack hits";
}
function attackNPC(target1, player) {
  let npcId;
  if (target1) {
    npcId = findEntity(target1, rooms[player.currentRoom].npcs, 'npc');
  } else {
    npcId = rooms[player.currentRoom].npcs.find(id => npcs[id].status !== "lying unconscious" && npcs[id].status !== "lying dead");
  }
  if (npcId) {
    const npc = npcs[npcId];
    if (npc.status === "lying unconscious" || npc.status === "lying dead") {
      displayMessage(`<span id="error-message">${npc.name} is already ${npc.status}. It would be dishonorable to attack them now.</span><br>`, player.id);
    } else {
      startCombat(npcId, player, true);
    }
  } else if (target1) {
    displayMessage(`<span id="error-message">There doesn't seem to be any ${target1} here.</span><br>`, player.id);
  } else {
    displayMessage(`<span id="error-message">There are no conscious enemies to attack.</span><br>`, player.id);
  }
}
// Command functions---------------------------------------------------------------------
function attackNPC(target1, player) {
  let npcId;
  if (target1) {
    npcId = findEntity(target1, rooms[player.currentRoom].npcs, 'npc');
  } else {
    npcId = rooms[player.currentRoom].npcs.find(id => npcs[id].status !== "lying unconscious" && npcs[id].status !== "lying dead");
  }
  if (npcId) {
    const npc = npcs[npcId];
    if (npc.status === "lying unconscious" || npc.status === "lying dead") {
      displayMessage(`<span id="error-message">${npc.name} is already ${npc.status}. It would be dishonorable to attack them now.</span><br>`, player.id);
    } else {
      startCombat(npcId, player, true);
    }
  } else if (target1) {
    displayMessage(`<span id="error-message">There doesn't seem to be any ${target1} here.</span><br>`, player.id);
  } else {
    displayMessage(`<span id="error-message">There are no conscious enemies to attack.</span><br>`, player.id);
  }
}
function clearGameContainer(playerId) {
  io.to(playerId).emit('clearGameContainer');
}
function flee(player) {
  if (player.status === "in combat") {
    const availableExits = Array.from(rooms[player.currentRoom].exits.keys());
    if (availableExits.length > 0) {
      const randomExit = availableExits[Math.floor(Math.random() * availableExits.length)];
      player.currentRoom = rooms[player.currentRoom].exits.get(randomExit);
      clearInterval(player.combatInterval);
      player.combatInterval = null;
      player.status = "standing";
      displayMessage(`${player.name} escapes ${DIRECTION_NAMES[randomExit].toLowerCase()} to safety!`, player.id);
      describeRoom(player);
      fullStateSync(player);
    } else {
      displayMessage(`<span id="error-message">There's nowhere to flee! ${player.name} must stand and fight!</span>`, player.id);
    }
  } else {
    displayMessage(`<span id="error-message">${player.name} is not in combat. There's no need to flee.</span><br>`, player.id);
  }
}
function inventory(player) {
  if (player.inventory.length > 0) {
    let inventoryList = "You are carrying:<div id='inventory-list'>";
    inventoryList += player.inventory.map(itemId => `<span id="item">${items[itemId].name}</span>`).join("<br>");
    inventoryList += "</div>";
    displayMessage(inventoryList, player.id);
  } else {
    displayMessage("Your inventory is empty.<br>", player.id);
  }
}
function movePlayer(action, player) {
  if (player.status === "in combat") {
    displayMessage(`<span id="error-message">${player.name} is in combat and cannot leave! Use the 'flee' command to attempt an escape.</span><br>`, player.id);
  } else if (rooms[player.currentRoom].exits.has(action)) {
    const oldRoom = player.currentRoom;
    const newRoom = rooms[player.currentRoom].exits.get(action);
    player.currentRoom = newRoom;
    switch (action) {
      case 'n':
        player.coordinates.y += 1;
        break;
      case 'e':
        player.coordinates.x -= 1;
        break;
      case 'w':
        player.coordinates.x += 1;
        break;
      case 's':
        player.coordinates.y -= 1;
        break;
      case 'u':
        player.coordinates.z += 1;
        break;
      case 'd':
        player.coordinates.z -= 1;
        break;
    }
    defeatedNPCs.clear();
    // Notify players in the old room
    notifyPlayersInRoom(oldRoom, `${player.name} leaves ${DIRECTION_NAMES[action].toLowerCase()}.<br>`);
    // Move the player's socket to the new room
    io.sockets.sockets.get(player.id).leave(oldRoom);
    io.sockets.sockets.get(player.id).join(newRoom);
    // Notify players in the new room
    notifyPlayersInRoom(newRoom, `${player.name} enters from the ${DIRECTION_NAMES[oppositeDirection[action]].toLowerCase()}.<br>`);
    // Describe the new room to the player
    describeRoom(player);
    fullStateSync(player);
    checkForAggressiveNPCs(player);
  } else {
    displayMessage(`<span id="error-message">${player.name} is unable to travel ${DIRECTION_NAMES[action].toLowerCase()}.</span><br>`, player.id);
  }
}
// Helper function to notify all players in a room
function notifyPlayersInRoom(roomId, message) {
  io.to(roomId).emit('displayMessage', message);
}
function score(player) {
  let affectsDisplay = player.affects.length > 0
    ? player.affects.map(affect => `- ${affect.name}`).join('<br>')
    : 'None';
  displayMessage(`
  -------------------------------------------------------------------------------<br>
  ${player.name}<br>
  -------------------------------------------------------------------------------<br>
  Level: ${player.level}<br>
  Health: ${Math.round(player.health)}/${player.maxHealth}<br>
  Attack Power: ${player.attackPower}<br>
  Defense Power: ${player.defensePower}<br>
  XP: ${player.xp}<br>
  -------------------------------------------------------------------------------<br>
  Active Affects:<br>
  ${affectsDisplay}<br>
  -------------------------------------------------------------------------------<br>`, player.id);
}
// Get, put, drop, loot functions--------------------------------------------------------
function getAllItemsFromRoom(player) {
  const room = rooms[player.currentRoom];
  if (room.items && room.items.length > 0) {
    const itemsTaken = [...room.items];
    player.inventory.push(...itemsTaken);
    room.items = [];
    const message = `${player.name} picks up:<div id='inventory-list'>${itemsTaken.map(itemId => `<span id="item">${items[itemId].name}</span>`).join("<br>")}</div>`;
    notifyPlayersInRoom(player.currentRoom, message);
  } else {
    displayMessage(`<span id="error-message">There doesn't seem to be any items to take here.</span><br>`, player.id);
  }
}
function getAllItemsFromContainer(containerName, player) {
  const error = containerErrorMessage(containerName, player, 'hold');
  if (error) {
    displayErrorMessage(error, player.id);
    return;
  }
  const containerId = findEntity(containerName, player.inventory, 'item');
  if (items[containerId].inventory.length === 0) {
    displayMessage(`The <span id="item">${items[containerId].name}</span> is empty.<br>`, player.id);
  } else {
    const itemsTaken = [...items[containerId].inventory];
    player.inventory.push(...itemsTaken);
    items[containerId].inventory = [];
    const message = `${player.name} takes the following items from the <span id="item">${items[containerId].name}</span>:<div id='inventory-list'>${itemsTaken.map(itemId => `<span id="item">${items[itemId].name}</span>`).join("<br>")}</div>`;
    notifyPlayersInRoom(player.currentRoom, message);
  }
}
function getItemFromContainer(itemName, containerName, player) {
  const error = containerErrorMessage(containerName, player, 'hold');
  if (error) {
    displayErrorMessage(error, player.id);
    return;
  }
  const containerId = findEntity(containerName, player.inventory, 'item');
  const itemId = findEntity(itemName, items[containerId].inventory, 'item');
  if (itemId) {
    player.inventory.push(itemId);
    items[containerId].inventory = items[containerId].inventory.filter(i => i !== itemId);
    const message = `${player.name} takes the <span id="item">${items[itemId].name}</span> from the <span id="item">${items[containerId].name}</span>.<br>`;
    notifyPlayersInRoom(player.currentRoom, message);
  } else {
    displayErrorMessage(`There doesn't seem to be any ${itemName} in the ${items[containerId].name}.<br>`, player.id);
  }
}
function getItemFromRoom(target1, player) {
  const itemId = findEntity(target1, rooms[player.currentRoom].items, 'item');
  if (itemId) {
    player.inventory.push(itemId);
    rooms[player.currentRoom].items = rooms[player.currentRoom].items.filter(i => i !== itemId);
    const message = `${player.name} picks up the <span id="item">${items[itemId].name}</span>.<br>`;
    notifyPlayersInRoom(player.currentRoom, message);
  } else {
    displayMessage(`<span id="error-message">There doesn't seem to be any ${target1} here.</span><br>`, player.id);
  }
}
function dropAllItems(player) {
  if (player.inventory.length > 0) {
    const itemsDropped = [...player.inventory];
    if (!rooms[player.currentRoom].items) {
      rooms[player.currentRoom].items = [];
    }
    rooms[player.currentRoom].items.push(...itemsDropped);
    player.inventory = [];
    const message = `${player.name} drops:<div id='items-list'>${itemsDropped.map(itemId => `<span id="item">${items[itemId].name}</span>`).join("<br>")}</div>`;
    notifyPlayersInRoom(player.currentRoom, message);
  } else {
    displayMessage(`<span id='error-message'>${player.name} has no items to drop.</span><br>`, player.id);
  }
}
function dropAllSpecificItems(itemType, player) {
  const itemsToDrop = player.inventory.filter(itemId => itemMatchesType(itemId, itemType));
  if (itemsToDrop.length > 0) {
    if (!rooms[player.currentRoom].items) {
      rooms[player.currentRoom].items = [];
    }
    rooms[player.currentRoom].items.push(...itemsToDrop);
    player.inventory = player.inventory.filter(itemId => !itemsToDrop.includes(itemId));
    const message = `${player.name} drops:<div id='items-list'>${itemsToDrop.map(itemId => `<span id="item">${items[itemId].name}</span>`).join("<br>")}</div>`;
    notifyPlayersInRoom(player.currentRoom, message);
  } else {
    displayMessage(`<span id='error-message'>${player.name} has no ${itemType} to drop.</span><br>`, player.id);
  }
}
function dropItem(target1, player) {
  const itemId = findEntity(target1, player.inventory, 'item');
  if (itemId) {
    player.inventory = player.inventory.filter(i => i !== itemId);
    if (!rooms[player.currentRoom].items) {
      rooms[player.currentRoom].items = [];
    }
    rooms[player.currentRoom].items.push(itemId);
    const message = `${player.name} drops the <span id="item">${items[itemId].name}</span>.`;
    notifyPlayersInRoom(player.currentRoom, message);
  } else {
    displayMessage(`<span id="error-message">${player.name} doesn't seem to have any ${target1}'s to drop.</span><br>`, player.id);
  }
}
function putItem(itemName, containerName, player) {
  const itemId = findEntity(itemName, player.inventory, 'item');
  if (!itemId) {
    displayErrorMessage(itemNotFoundMessage(itemName, 'inventory', player), player.id);
    return;
  }
  const error = containerErrorMessage(containerName, player, 'hold');
  if (error) {
    displayErrorMessage(error, player.id);
    return;
  }
  const containerId = findEntity(containerName, player.inventory, 'item');
  items[containerId].inventory.push(itemId);
  player.inventory = player.inventory.filter(i => i !== itemId);
  const message = `${player.name} places the <span id="item">${items[itemId].name}</span> into the <span id="item">${items[containerId].name}</span>.`;
  notifyPlayersInRoom(player.currentRoom, message);
}
function putAllItems(containerName, player) {
  const containerId = findEntity(containerName, player.inventory, 'item');
  if (!containerId) {
    displayErrorMessage(itemNotFoundMessage(containerName, 'inventory', player), player.id);
    return;
  }
  if (!items[containerId].inventory) {
    displayErrorMessage(`The ${items[containerId].name} is not a container and cannot hold other items.`, player.id);
    return;
  }
  const itemsToPut = player.inventory.filter(itemId => itemId !== containerId);
  if (itemsToPut.length === 0) {
    displayErrorMessage(`${player.name} has no items to put in the ${items[containerId].name}.`, player.id);
    return;
  }
  items[containerId].inventory.push(...itemsToPut);
  player.inventory = player.inventory.filter(itemId => itemId === containerId);

  const message = `${player.name} places the following items into the <span id="item">${items[containerId].name}</span>:<div id='inventory-list'>${itemsToPut.map(itemId => `<span id="item">${items[itemId].name}</span>`).join("<br>")}</div>`;
  notifyPlayersInRoom(player.currentRoom, message);
}
function itemMatchesType(itemId, itemType) {
  return items[itemId].name.toLowerCase().includes(itemType) ||
    items[itemId].aliases.some(alias => alias.toLowerCase().includes(itemType));
}
function getAllSpecificItemsFromRoom(itemType, player) {
  const room = rooms[player.currentRoom];
  if (room.items && room.items.length > 0) {
    const itemsTaken = room.items.filter(itemId => itemMatchesType(itemId, itemType));
    if (itemsTaken.length > 0) {
      player.inventory.push(...itemsTaken);
      room.items = room.items.filter(itemId => !itemsTaken.includes(itemId));
      const message = `${player.name} picks up:<div id='inventory-list'>${itemsTaken.map(itemId => `<span id="item">${items[itemId].name}</span>`).join("<br>")}</div>`;
      notifyPlayersInRoom(player.currentRoom, message);
    } else {
      displayMessage(`<span id="error-message">There doesn't seem to be any ${itemType} here.</span><br>`, player.id);
    }
  } else {
    displayMessage(`<span id="error-message">There doesn't seem to be any items to take here.</span><br>`, player.id);
  }
}
function getAllSpecificItemsFromContainer(itemType, containerName, player) {
  const error = containerErrorMessage(containerName, player, 'hold');
  if (error) {
    displayErrorMessage(error, player.id);
    return;
  }
  const containerId = findEntity(containerName, player.inventory, 'item');
  const itemsTaken = items[containerId].inventory.filter(itemId => itemMatchesType(itemId, itemType));
  if (itemsTaken.length > 0) {
    player.inventory.push(...itemsTaken);
    items[containerId].inventory = items[containerId].inventory.filter(itemId => !itemsTaken.includes(itemId));
    const message = `${player.name} takes the following items from the <span id="item">${items[containerId].name}</span>:<div id='inventory-list'>${itemsTaken.map(itemId => `<span id="item">${items[itemId].name}</span>`).join("<br>")}</div>`;
    notifyPlayersInRoom(player.currentRoom, message);
  } else {
    displayMessage(`<span id="error-message">There doesn't seem to be any ${itemType} in the ${items[containerId].name}.</span><br>`, player.id);
  }
}
function putAllSpecificItemsIntoContainer(itemType, containerName, player) {
  const error = containerErrorMessage(containerName, player, 'hold');
  if (error) {
    displayErrorMessage(error, player.id);
    return;
  }
  const containerId = findEntity(containerName, player.inventory, 'item');
  const itemsToPut = player.inventory.filter(itemId => itemId !== containerId && itemMatchesType(itemId, itemType));
  if (itemsToPut.length === 0) {
    displayErrorMessage(`${player.name} has no ${itemType} to put in the ${items[containerId].name}.`, player.id);
    return;
  }
  items[containerId].inventory.push(...itemsToPut);
  player.inventory = player.inventory.filter(itemId => !itemsToPut.includes(itemId));
  const message = `${player.name} places the following items into the <span id="item">${items[containerId].name}</span>:<div id='inventory-list'>${itemsToPut.map(itemId => `<span id="item">${items[itemId].name}</span>`).join("<br>")}</div>`;
  notifyPlayersInRoom(player.currentRoom, message);
}
function autoLootNPC(npc, player) {
  if (npc.inventory && npc.inventory.length > 0) {
    const lootedItems = [...npc.inventory];
    player.inventory.push(...lootedItems);
    npc.inventory = [];
    return `${player.name} automatically loots from ${npc.name}:<div id='inventory-list'>${lootedItems.map(itemId => `<span id="item">${items[itemId].name}</span>`).join("<br>")}</div>`;
  }
  return null;
}
function lootNPC(target1, player) {
  const npcId = findEntity(target1, rooms[player.currentRoom].npcs, 'npc');
  if (npcId) {
    const npc = npcs[npcId];
    if (npc.status === "lying unconscious" || npc.status === "lying dead") {
      if (npc.inventory && npc.inventory.length > 0) {
        const lootedItems = [...npc.inventory];
        player.inventory.push(...lootedItems);
        npc.inventory = [];
        const message = `${player.name} loots from ${npc.name}:<div id='inventory-list'>${lootedItems.map(itemId => `<span id="item">${items[itemId].name}</span>`).join("<br>")}</div>`;
        notifyPlayersInRoom(player.currentRoom, message);
      } else {
        displayMessage(`${player.name} finds nothing to loot from ${npc.name}.<br>`, player.id);
      }
    } else {
      displayMessage(`<span id="error-message">${npc.name} is not unconscious or dead. ${player.name} cannot loot them.</span><br>`, player.id);
    }
  } else {
    displayMessage(`<span id="error-message">There doesn't seem to be any ${target1} here to loot.</span><br>`, player.id);
  }
}
function lootAllNPCs(player) {
  const room = rooms[player.currentRoom];
  if (!room.npcs || room.npcs.length === 0) {
    displayMessage(`<span id="error-message">There are no NPCs here to loot.</span><br>`, player.id);
    return;
  }
  const lootedItems = [];
  const lootedNPCs = [];
  room.npcs.forEach(npcId => {
    const npc = npcs[npcId];
    if ((npc.status === "lying unconscious" || npc.status === "lying dead") && npc.inventory && npc.inventory.length > 0) {
      lootedItems.push(...npc.inventory);
      player.inventory.push(...npc.inventory);
      lootedNPCs.push(npc.name);
      npc.inventory = [];
    }
  });
  if (lootedItems.length > 0) {
    const message = `${player.name} loots from ${lootedNPCs.join(", ")}:<div id='inventory-list'>` +
      lootedItems.map(itemId => `<span id="item">${items[itemId].name}</span>`).join("<br>") +
      "</div>";
    notifyPlayersInRoom(player.currentRoom, message);
  } else {
    displayMessage(`${player.name} finds nothing to loot from any NPCs in the room.<br>`, player.id);
  }
}
function containerErrorMessage(containerName, player, action) {
  const containerId = findEntity(containerName, player.inventory, 'item');
  if (!containerId) {
    return `${player.name} doesn't have a ${containerName} to ${action}.`;
  }
  if (!items[containerId].inventory) {
    return `The ${items[containerId].name} is not a container and cannot ${action} other items.<br>`;
  }
  return null;
}
function itemNotFoundMessage(itemName, location, player) {
  return `${player.name} doesn't have any ${itemName} in ${player.hisher} ${location}.<br>`;
}
function displayErrorMessage(message, playerId) {
  io.to(playerId).emit('displayMessage', `<span id="error-message">${message}</span><br>`);
}
// Look functions------------------------------------------------------------------------
function lookAtInventoryItem(itemAlias, player) {
  const itemId = findEntity(itemAlias, player.inventory, 'item');
  if (itemId) {
    let description = `<span id="item">${items[itemId].name}</span><br>`;
    description += `<div id="item-description">${items[itemId].description}</div>`;
    if (items[itemId].inventory) {
      if (items[itemId].inventory.length > 0) {
        description += `<div id="item-contents">It contains:<br>`;
        description += items[itemId].inventory.map(subItemId => `- <span id="item">${items[subItemId].name}</span>`).join("<br>");
        description += `</div>`;
      } else {
        description += `<div id="item-contents">It is empty.</div>`;
      }
    }
    displayMessage(description, player.id);
  } else {
    displayMessage(`<span id="error-message">${player.name} doesn't seem to have any ${itemAlias} in ${player.hisher} inventory.</span><br>`, player.id);
  }
}
function lookAtNpc(npcAlias, player) {
  const npcId = findEntity(npcAlias, rooms[player.currentRoom].npcs, 'npc');
  if (npcId) {
    const npc = npcs[npcId];
    let description = `<span id="npc">${npc.name}</span><br>`;
    description += `<div id="npc-description">${npc.description || "You see nothing special about them."}</div>`;
    description += `<div id="npc-status">They are ${npc.status}.</div>`;
    displayMessage(description, player.id);
  } else {
    displayMessage(`<span id="error-message">You don't see any ${npcAlias} here.</span><br>`, player.id);
  }
}
function lookInContainer(containerName, player) {
  const error = containerErrorMessage(containerName, player, 'hold');
  if (error) {
    displayErrorMessage(error, player.id);
    return;
  }
  const containerId = findEntity(containerName, player.inventory, 'item');
  if (items[containerId].inventory.length === 0) {
    displayMessage(`The <span id="item">${items[containerId].name}</span> is empty.<br>`, player.id);
  } else {
    let contents = `The <span id="item">${items[containerId].name}</span> contains:<div id='inventory-list'>`;
    contents += items[containerId].inventory.map(itemId => `<span id="item">${items[itemId].name}</span>`).join("<br>");
    contents += "</div>";
    displayMessage(contents, player.id);
  }
}
// Process commands----------------------------------------------------------------------
function handleCommand(command, playerId) {
  const player = players.get(playerId);
  if (player) {
    const [action, target1, target2, target3] = command.toLowerCase().split(" ");
    if (!isPlayerConscious(player) && !["wake", "wak", "wa", "score", "sc"].includes(action)) {
      return;
    }
    if (player.status !== "lying unconscious" && player.health > 0) {
      checkForAggressiveNPCs(player);
    }
    switch (action) {
      case "n":
      case "e":
      case "w":
      case "s":
      case "u":
      case "d":
        movePlayer(action, player);
        break;
      case "attack":
      case "att":
      case "a":
      case "kill":
      case "k":
        attackNPC(target1, player);
        break;
      case "autoloot":
        toggleAutoloot(player);
        break;
      case "clear":
      case "clear screen":
      case "clr":
      case "cls":
        clearGameContainer(player.id);
        break;
      case "drop":
        if (target1 === "all") {
          dropAllItems(player);
        } else if (target1.startsWith("all.")) {
          const itemType = target1.split(".")[1];
          dropAllSpecificItems(itemType, player);
        } else {
          dropItem(target1, player);
        }
        break;
      case "flee":
      case "run":
        flee(player);
        break;
      case "get":
      case "grab":
      case "gra":
      case "take":
      case "tak":
        if (target1.startsWith("all.")) {
          const itemType = target1.split(".")[1];
          if (target2) {
            getAllSpecificItemsFromContainer(itemType, target2, player);
          } else {
            getAllSpecificItemsFromRoom(itemType, player);
          }
        } else if (target1 === "all") {
          if (target2 && target3) {
            getAllSpecificItemsFromContainer(target2, target3, player);
          } else if (target2 && !target3) {
            getAllItemsFromContainer(target2, player);
          } else {
            getAllItemsFromRoom(player);
          }
        } else if (target1 && target2) {
          getItemFromContainer(target1, target2, player);
        } else {
          getItemFromRoom(target1, player);
        }
        break;
      case "inventory":
      case "inv":
      case "i":
        inventory(player);
        break;
      case "killer":
        toggleKillerMode(player);
        break;
      case "look":
      case "loo":
      case "l":
        if (target1 && !target2) {
          lookAtInventoryItem(target1, player);
        } else if (target1 === "in" && target2) {
          lookInContainer(target2, player);
        } else if (target1 === "at" && target2) {
          const npc = findEntity(target2, rooms[player.currentRoom].npcs, 'npc');
          if (npc) {
            lookAtNpc(target2, player);
          } else {
            lookAtInventoryItem(target2, player);
          }
        } else {
          describeRoom(player);
        }
        break;
      case "loot":
        if (target1 === "all") {
          lootAllNPCs(player);
        } else {
          lootNPC(target1, player);
        }
        break;
      case "meditate":
      case "med":
        meditate(player);
        break;
      case "put":
      case "place":
        if (target1.startsWith("all.")) {
          const itemType = target1.split(".")[1];
          putAllSpecificItemsIntoContainer(itemType, target2, player);
        } else if (target1 === "all") {
          putAllItems(target2, player);
        } else {
          putItem(target1, target2, player);
        }
        break;
      case "save":
        savePlayerData(player);
        break;
      case "score":
      case "sco":
      case "sc":
        score(player);
        break;
      case "shutdown":
      case "sd":
        if (player.name === "q") { // Replace "Admin" with the actual admin username
          shutdownServer(player);
        }
        break;
      case "sit":
      case "si":
        sit(player);
        break;
      case "sleep":
      case "sle":
        sleep(player);
        break;
      case "stand":
      case "sta":
      case "st":
        stand(player);
        break;
      case "stop":
      case "sto":
        stopGame();
        break;
      case "wake":
      case "wak":
      case "wa":
        wake(player);
        break;
      // Skill commands--------------------------------------------------------------------
      case "immortal":
      case "vigor":
      case "imm":
      case "vig":
      case "iv":
        if (player.skills.includes("immortal vigor")) {
          immortalVigor(player);
        } else {
          displayErrorMessage(`${player.name} doesn't know the Immortal Vigor skill.<br>`, player.id);
        }
        break;
      case "vital":
      case "breath":
      case "vit":
      case "bre":
      case "vb":
        if (player.skills.includes("vital breath")) {
          vitalBreath(player);
        } else {
          displayErrorMessage(`${player.name} doesn't know the Vital Breath skill.<br>`, player.id);
        }
        break;
      case "iron":
      case "body":
      case "iro":
      case "bod":
      case "ib":
        if (player.skills.includes("iron body")) {
          ironBody(player);
        } else {
          displayErrorMessage(`${player.name} doesn't know the Iron Body skill.<br>`, player.id);
        }
        break;
      case "heavenly":
      case "flow":
      case "hea":
      case "flo":
      case "hf":
        if (player.skills.includes("heavenly flow")) {
          heavenlyFlow(player);
        } else {
          displayErrorMessage(`${player.name} doesn't know the Heavenly Flow skill.<br>`, player.id);
        }
        break;
      case "knock":
      case "down":
      case "kno":
      case "dow":
      case "kd":
        if (player.skills.includes("knock down")) {
          knockDown(player);
        } else {
          displayErrorMessage(`${player.name} doesn't know the Knock Down skill.<br>`, player.id);
        }
        break;
      case "sleeper":
      case "hold":
      case "sle":
      case "hol":
      case "sh":
        if (player.skills.includes("sleeper hold")) {
          sleeperHold(player);
        } else {
          displayErrorMessage(`${player.name} doesn't know the Sleeper Hold skill.<br>`, player.id);
        }
        break;
      // Navigational errors---------------------------------------------------------------
      case "go":
      case "walk":
      case "move":
      case "north":
      case "east":
      case "west":
      case "south":
      case "up":
      case "down":
        displayErrorMessage(`You're working too hard!<br>Simply type:<br>'n' to travel north.<br>'e' to travel east.<br>'w' to travel west.<br>'s' to travel south.<br>'u' to travel up.<br>'d' to travel down.<br>`, player.id);
        break;

      default:
        displayErrorMessage(`Dude, try speaking english!<br>`, player.id);
    }
  }
}
function startGame() {
  assignCoordinates();
  console.log('Game started on server.');
  setInterval(checkAndRemoveExpiredAffects, 60000); // 60 seconds
  startNPCMovement();
  setInterval(cleanupDisconnectedPlayers, 5 * 60 * 1000); //5 minutes
}
function stopGame() {
  clearInterval(npcReviveInterval);
  clearInterval(npcMovementInterval);
  clearInterval(healthRegenInterval);
  if (combatInterval) {
    clearInterval(combatInterval);
  }
  // Reset all game state variables
  npcReviveInterval = null;
  npcMovementInterval = null;
  healthRegenInterval = null;
  combatInterval = null;
  combatOrder = [];
  defeatedNPCs.clear();
  displayMessage("Game stopped. All timers have been cleared.");
}
// Start the server
const port = 6400;
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

/*

NPC Movement: Ensure that when NPCs move, all players in affected rooms are notified.

Combat Updates: Make sure all relevant players are updated about combat progress, especially for group combat scenarios.

Item Changes: When items are picked up, dropped, or transferred, ensure all players in the room are notified.

you have any suggestions for refactoring?  but be extreemely careful and make certaian to not change the codes original functionality.

code patterns

optimize loops and searches, especially in functions that iterate over all rooms or NPCs

organize all CSS properties within each selector to be in alphabetical order:

organize the selectors in order of specificity with classes above ids and group related selectors together. But keep CSS properties within each selector in alphabetical order:


organized in order of specificity, with element selectors first, then classes, and finally IDs.
Related selectors are grouped together (e.g., form elements, typography, layout containers).
CSS properties within each selector are kept in alphabetical order.

if there are properties in a more specific selector that are redundant (identical to) properties in a less specific selector, then remove those properties from the more specific selector:

*/

// quest items []
// quest log
// shurikens
// killer
