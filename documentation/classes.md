# Server Classes

1. Server
2. BaseManager
3. SocketEventManager
4. ModuleImporter
5. ServerConfigurator
6. GameComponentInitializer
7. ILogger
8. IDatabaseManager
9. IEventEmitter
10. Logger
11. EventEmitter
12. DatabaseManager
13. GameManager
14. GameDataLoader
15. ObjectPool
16. Task
17. QueueManager
18. ConfigManager
19. CreateNewPlayer
20. Entity
21. Character
22. Player
23. HealthRegenerator
24. LookAt
25. UidGenerator
26. DirectionManager
27. Location
28. Npc
29. BaseItem
30. Item
31. ContainerItem
32. WeaponItem
33. InventoryManager
34. CombatAction
35. CombatManager
36. LocationCoordinateManager
37. DescribeLocationManager
38. FormatMessageManager
39. MessageManager

There are 39 classes in total listed in this documentation.

# Server Classes and Methods

## 1. Server
- `constructor({ logger })`
- `init()`
- `handlePlayerConnected(player)`
- `setupHttpServer()`
- `cleanup()`

## 2. BaseManager
- `constructor({ server, logger })`

## 3. SocketEventManager
- `constructor({ server, logger })`
- `initializeSocketEvents()`
- `handlePlayerAction(actionData)`
- `initializeSocketListeners(socket, sessionId)`
- `handleAction(socket, { type, content, targetId, actionType, payload })`
- `movePlayer(socket, { playerId, newLocationId })`
- `attackNpc(socket, { playerId, targetId })`
- `cleanup()`

## 4. ModuleImporter
- `constructor({ server })`
- `loadModules()`

## 5. ServerConfigurator
- `constructor({ config, logger, server, socketEventManager })`
- `configureServer()`
- `setupExpress()`
- `configureMiddleware()`

## 6. GameComponentInitializer
- `constructor({ server })`
- `setupGameComponents()`
- `loadLocationsData()`

## 7. ILogger
- `log()`
- `debug()`
- `info()`
- `warn()`
- `error()`

## 8. IDatabaseManager
- `constructor({ server, logger })`
- `loadLocationData()`
- `loadNpcData()`
- `loadItemData()`
- `saveData()`
- `initialize()`

## 9. IEventEmitter
- `on()`
- `emit()`
- `off()`

## 10. Logger
- `constructor(config)`
- `log(level, message)`
- `shouldLog(level)`
- `writeToConsole(logString)`
- `debug(message)`
- `info(message)`
- `warn(message)`
- `error(message)`

## 11. EventEmitter
- `constructor()`
- `on(event, listener)`
- `emit(event, ...args)`
- `off(event, listener)`

## 12. DatabaseManager
- `constructor({ server, logger })`
- `initialize()`
- `loadLocationData()`
- `loadNpcData()`
- `loadItemData()`
- `loadData(dataPath, type)`
- `getFilesInDirectory(directory)`
- `saveData(filePath, key, data)`
- `cleanup()`

## 13. GameManager
- `constructor({ eventEmitter })`
- `initializeLocations(locationsData)`
- `addLocation(location)`
- `getLocation(locationId)`
- `startGame()`
- `isGameRunning()`
- `shutdownGame()`
- `shutdownServer()`
- `startGameLoop()`
- `stopGameLoop()`
- `gameTick()`
- `updateGameTime()`
- `moveEntity(entity, newLocationId)`
- `updateNpcs()`
- `updatePlayerAffects()`
- `updateWorldEvents()`
- `isTimeForWorldEvent()`
- `triggerWorldEvent()`
- `newDayHandler()`
- `disconnectPlayer(uid)`
- `createNpc(name, sex, currHealth, maxHealth, attackPower, csml, aggro, assist, status, currentLocation, mobile, zones, aliases)`
- `getNpc(npcId)`

## 14. GameDataLoader
- `constructor(server)`
- `fetchGameData()`
- `saveLocationData(filenames)`

## 15. ObjectPool
- `constructor(createFunc, size)`
- `acquire()`
- `release(object)`

## 16. Task
- `constructor(name)`
- `run()`

## 17. QueueManager
- `constructor(objectPool)`
- `addTask(task)`
- `processQueue()`
- `addDataLoadTask(filePath, key)`
- `handleLoadedData(key, data)`
- `addDataSaveTask(filePath, key, data)`
- `addCombatActionTask(player, target)`
- `addEventProcessingTask(event)`
- `addHealthRegenerationTask(player)`
- `addInventoryManagementTask(player, action, item)`
- `addNotificationTask(player, message)`
- `cleanup()`

## 18. ConfigManager
- `constructor()`
- `loadConfig()`
- `get(key)`

## 19. CreateNewPlayer
- `constructor(name, age)`
- `static fromPlayerData(uid, playerData, bcrypt)`
- `updateData(updatedData)`

## 20. Entity
- `constructor(name, health)`
- `getName()`
- `getHealth()`
- `setHealth(newHealth)`

## 21. Character
- `constructor(name, health)`

## 22. Player
- `constructor(uid, name, bcrypt)`
- `initializePlayerAttributes()`
- `getId()`
- `getPossessivePronoun()`
- `addToInventory(item)`
- `removeFromInventory(item)`
- `canAddToInventory(item)`
- `getInventoryCapacity()`
- `authenticate(password)`
- `attackNpc(target)`
- `incrementFailedLoginAttempts()`
- `showInventory()`
- `lootSpecifiedNpc(target)`
- `moveToLocation(newLocationId)`
- `notifyPlayer(message)`
- `resetFailedLoginAttempts()`
- `save()`
- `collectPlayerData()`
- `static loadBatch(playerIds)`
- `score()`
- `updateData(updatedData)`
- `hashUid()`
- `login(inputPassword)`
- `startHealthRegeneration()`
- `checkAndRemoveExpiredAffects()`
- `meditate()`
- `sleep()`
- `sit()`
- `stand()`
- `wake()`
- `autoLootToggle()`
- `lookIn(containerName)`
- `hasChangedState()`
- `getInventoryList()`
- `describeCurrentLocation()`
- `lookAt(target)`
- `addWeapon(weapon)`
- `removeWeapon(weapon)`
- `static createNewPlayer(name, age)`

## 23. HealthRegenerator
- `constructor(player)`
- `start()`
- `regenerate()`
- `getRegenAmountPerMinute()`
- `stop()`

## 24. LookAt
- `constructor(player)`
- `look(target)`
- `lookAtSelf()`

## 25. UidGenerator
- `static generateUid()`

## 26. DirectionManager
- `static getDirectionTo(newLocationId)`
- `static getDirectionFrom(oldLocationId)`

## 27. Location
- `constructor(name, description)`
- `addExit(direction, linkedLocation)`
- `addItem(item)`
- `addNpc(npc)`
- `addPlayer(player)`
- `removePlayer(player)`
- `getDescription()`
- `getName()`
- `getNpcs()`

## 28. Npc
- `constructor(name, sex, currHealth, maxHealth, attackPower, csml, aggro, assist, status, currentLocation, mobile, zones, aliases)`
- `startMovement()`
- `moveRandomly()`
- `hasChangedState()`

## 29. BaseItem
- `constructor(name, description, aliases)`

## 30. Item
- `constructor(name, description, aliases)`

## 31. ContainerItem
- `constructor(name, description, aliases)`

## 32. WeaponItem
- `constructor(name, description, aliases)`

## 33. InventoryManager
- `constructor(player)`
- `addToInventory(item)`
- `removeFromInventory(item)`
- `getAllItemsFromSource(source, sourceType, containerName)`
- `getAllItemsFromLocation()`
- `getAllItemsFromContainer(containerName)`
- `getSingleItemFromContainer(itemName, containerName)`
- `getSingleItemFromLocation(target1)`
- `dropAllItems()`
- `dropAllSpecificItems(itemType)`
- `dropSingleItem(target1)`
- `putSingleItem(itemName, containerName)`
- `putAllItems(containerName)`
- `putAllSpecificItemsIntoContainer(itemType, containerName)`
- `getAllSpecificItemsFromLocation(itemType)`
- `getAllSpecificItemsFromContainer(itemType, containerName)`
- `autoLootNPC(npc)`
- `lootNPC(target1)`
- `lootAllNPCs()`
- `containerErrorMessage(containerName, action)`
- `itemNotFoundMessage(itemName, location)`
- `dropItems(itemsToDrop, type, itemType)`
- `getContainerId(containerName)`
- `getItemFromInventory(itemName)`
- `transferItem(itemId, source, sourceType)`
- `getContainerIdFromInventory(containerName)`
- `getNpcIdFromLocation(npcName, npcs)`
- `getItemIdFromLocation(target, items)`
- `getItemIdFromContainer(itemName, container)`
- `itemMatchesType(item, itemType)`
- `addWeaponToInventory(weapon)`

## 34. CombatAction
- `constructor(logger)`
- `perform(attacker, defender)`
- `calculateDamage(attacker, defender)`
- `notifyCombatResult(attacker, defender, damage)`
- `handleDefeat(defender)`

## 35. CombatManager
- `constructor(server)`
- `initializeTechniques()`
- `initiateCombatWithNpc(npcId, player, playerInitiated)`
- `endCombatForPlayer(player)`
- `startCombat(npcId, player, playerInitiated)`
- `initiateCombat(player, npc, playerInitiated)`
- `notifyCombatJoin(npc, player)`
- `startCombatLoop(player)`
- `executeCombatRound(player)`

## 36. LocationCoordinateManager
- `constructor(server)`
- `loadLocations()`
- `assignCoordinates()`
- `_assignCoordinatesRecursively(locationId, coordinates, x, y, z)`
- `_updateLocationsWithCoordinates(coordinates)`

## 37. DescribeLocationManager
- `constructor(player, server)`
- `describe()`
- `formatDescription(location)`
- `getExitsDescription(location)`
- `getItemsDescription(location)`
- `getNpcsDescription(location)`
- `getPlayersDescription(location)`

## 38. FormatMessageManager
- `static createMessageData(cssid, message)`
- `static getIdForMessage(type)`

## 39. MessageManager
- `static setSocket(socketInstance)`
- `static notify(player, message, cssid)`
- `static notifyPlayersInLocation(location, message)`
- `static notifyAction(player, action, targetName, cssid)`
- `static notifyLoginSuccess(player)`
- `static notifyIncorrectPassword(player)`
- `static notifyDisconnectionDueToFailedAttempts(player)`
- `static notifyPickupItem(player, itemName)`
- `static notifyDropItem(player, itemName)`