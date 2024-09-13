# Classes and Methods

## 1. Server
- `initializeModules()`
- `createServer()`
- `start()`
- `setupMiddleware()`
- `setupRoutes()`
- `setupSocketListeners()`
- `setupSocketEmitters()`
- `loadGameData()`
- `initializeQueue()`
- `initializeServer()`

## 2. ObjectPool
- `acquire()`
- `release(object)`

## 3. Task
- `run()`

## 4. QueueManager
- `addTask(task)`
- `processQueue()`
- `executeTask(task)`
- `addDataLoadTask(filePath, key)`
- `addDataSaveTask(filePath, key, data)`
- `addCombatActionTask(player, target)`
- `addEventProcessTask(event)`
- `addHealthRegenerationTask(player)`
- `addInventoryManagementTask(player, action, item)`
- `addNotificationTask(player, message)`
- `cleanup()`

## 5. DatabaseManager
- `loadData(filePaths)`
- `saveData(filePath, key, data)`
- `loadPlayerData(username)`
- `savePlayerData(playerData)`
- `loadLocationData(locationId)`
- `saveLocationData(locationData)`
- `loadNpcData(npcId)`
- `saveNpcData(npcData)`
- `loadItemData(itemId)`
- `saveItemData(itemData)`

## 6. GameManager
- `getGameTime()`
- `setGameTime(newTime)`
- `startGame()`
- `shutdownGame()`
- `addPlayer(player)`
- `getPlayer(playerId)`
- `removePlayer(playerId)`
- `addLocation(location)`
- `getLocation(locationId)`
- `addNpc(npc)`
- `getNpc(npcId)`
- `removeNpc(npcId)`
- `startGame()`
- `stopGameLoop()`
- `incrementGameTime()`
- `getCurrentGameTime()`
- `startGameLoopInternal()`
- `stopGameLoopInternal()`
- `incrementGameTimeInternal()`
- `_startGameLoop()`
- `_stopGameLoop()`
- `_gameTick()`
- `_updateGameTime()`
- `_updateNpcs()`
- `_updatePlayerAffects()`
- `_updateWorldEvents()`
- `_hourlyUpdate()`
- `_dailyUpdate()`
- `_updateNpcSchedules()`
- `disconnectPlayer(playerId)`
- `getGameTime()`
- `autoLootNpc(npc, player)`
- `findEntity(target, collection, type)`
- `fullStateSync(player)`
- `checkLevelUp(player)`
- `moveEntity(entity, newLocationId)`

## 7. EventEmitter
- `on(event, listener)`
- `emit(event, ...args)`
- `off(event, listener)`

## 8. CreateNewPlayer
- `fromPlayerData(uid, playerData, bcrypt)`
- `updateData(updatedData)`

## 9. Character
- `getName()`
- `getHealth()`
- `setHealth(newHealth)`

## 10. Player
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
- `notify(message)`
- `resetFailedLoginAttempts()`
- `save()`
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

## 11. HealthRegenerator
- `start()`
- `regenerate()`
- `getRegenAmountPerMinute()`
- `stop()`

## 12. LookAt
- `look(target)`
- `lookAtSelf()`

## 13. UidGenerator
- `generateUid()`

## 14. DirectionManager
- `getDirectionTo(newLocationId)`
- `getDirectionFrom(oldLocationId)`

## 15. Location
- `addExit(direction, linkedLocation)`
- `addItem(item)`
- `addNpc(npc)`
- `addPlayer(player)`
- `removePlayer(player)`
- `getDescription()`
- `getName()`

## 16. Npc
- `startMovement()`
- `moveRandomly()`
- `hasChangedState()`

## 17. BaseItem
- (no methods)

## 18. Item
- (no methods)

## 19. ContainerItem
- (no methods)

## 20. WeaponItem
- (no methods)

## 21. PlayerActions
- `attackNpc(target)`

## 22. CombatActions
- `initiateCombat(npcId)`

## 23. InventoryManager
- `addToInventory(item)`
- `removeFromInventory(item)`
- `getAllItemsFromSource(source, sourceType, containerName)`
- `getAllItemsFromLocation()`
- `getAllItemsFromContainer(containerName)`
- `getSingleItemFromContainer(itemName, container)`
- `getSingleItemFromLocation(target1)`
- `dropAllItems()`
- `dropAllSpecificItems(itemType)`
- `dropSingleItem(target1)`
- `putSingleItem(itemName, containerName)`
- `putAllItems(containerName)`
- `putAllSpecificItemsInContainer(itemType, containerName)`
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

## 24. CombatManager
- `initiateCombatWithNpc(npcId, player, playerInitiated)`
- `endCombatForPlayer(player)`
- `checkForAggressiveNpcs(player)`
- `checkAggressiveNpcs(player)`
- `startCat(npcId, player, playerInitiated)`
- `initiateCombat(player, npc, playerInitiated)`
- `notifyCombatJoin(npc, player)`
- `CombatLoop(player)`
- `executeCombatRound(player)`
- `handlePlayerDefeat(defeatingNpc, player)`
- `handleNpcDefeat(npc, player)`
- `generateDefeatMessages(player, npc)`
- `endCombat(player)`
- `_checkForAggressiveNpcs(player)`
- `_isAggressiveNpc(npc, player)`
- `performCombatAction(attacker, defender, isPlayer)`
- `getCombatDescription(outcome, attacker, defender, technique)`
- `attackNpc(player, target1)`
- `getAvailableNpcId(npcs)`
- `getCombatOrder()`
- `getNextNpcInCombatOrder()`
- `notifyPlayersInLocation(locationId, content)`
- `notifyHealthStatus(player, npc)`

## 25. DescribeLocationManager
- `describe()`
- `formatDescription(location)`
- `getExitsDescription(location)`
- `getItemsDescription(location)`
- `getNpcsDescription(location)`
- `getPlayersDescription(location)`

## 26. FormatMessageManager
- `createMessageData(cssid, message)`
- `getIdForMessage(type)`

## 27. MessageManager
- `notify(player, message, cssid)`
- `notifyLoginSuccess(player)`
- `notifyIncorrectPassword(player)`
- `notifyDisconnectionDueToFailedAttempts(player)`
- `notifyPlayersInLocation(location, message)`
- `notifyInventoryStatus(player)`
- `notifyPickupItem(player, itemName)`
- `notifyDropItem(player, itemName)`
- `notifyInventoryFull(player)`
- `notifyItemNotFoundInInventory(player)`
- `notifyInvalidItemAddition(player, itemName)`
- `notifyCombatInitiation(attacker, defenderName)`
- `notifyCombatJoin(npc, player)`
- `createCombatHealthMessage(player, playerHealthPercentage, npc, npcHealthPercentage)`
- `notifyDefeat(player, defeatingNpcName)`
- `notifyVictory(player, defeatedNpcName)`
- `notifyCombatActionMessage(player, message)`
- `notifyNpcAlreadyInStatus(player, npc)`
- `notifyNoItemInContainer(player, itemName, containerName)`
- `notifyNoItemHere(player, itemName)`
- `notifyNoItemToDrop(player, itemName)`
- `notifyItemPutInContainer(player, itemName, containerName)`
- `notifyNoItemsToPut(player, containerName)`
- `notifyItemsPutContainer(player, items, containerName)`
- `notifyNoSpecificItemsToPut(player, itemType, container)`
- `notifyItemsTaken(player, items)`
- `notifyNoSpecificItemsHere(player, itemType)`
- `notifyNoItemsHere(player, itemType)`
- `notifyItemsTakenFromContainer(player, items, containerName)`
- `notifyNoSpecificItemsInContainer(player, itemType, containerName)`
- `createAutoLootMessage(player, npc, lootedItems)`
- `notifyLootedNPC(player, npc, lootedItems)`
- `notifyNothingToLoot(player, npc)`
- `notifyCannotLootNPC(player, npc)`
- `notifyNoNPCToLoot(player, target)`
- `notifyNoNPCsToLoot(player)`
- `notifyLootedAllNPCs(player, lootedNPCs, lootedItems)`
- `notifyNothingToLootFromNPCs(player)`
- `notifyItemsDropped(player, items)`
- `notifyNoItemsToDrop(player, type, itemType)`
- `notifyNoContainer(player, containerName)`
- `notifyNotAContainer(player, itemName, action)`
- `notifyItemNotInInventory(player, itemName, location)`
- `notifyItemTaken(player, itemName)`
- `notifyLookAtSelf(player)`
- `notifyLookAtItemInInventory(player, item)`
- `notifyLookAtItemInLocation(player, item)`
- `notifyLookAtN(player, npc)`
- `notifyLookAtOtherPlayer(player, otherPlayer)`
- `notifyLookInContainer(player, containerName, items)`
- `notifyNoContainerHere(player, containerName)`
- `notifyNotAContainer(player, containerName)`
- `notifyMeditationAction(player)`
- `notifyMeditationStart(player)`
- `notifySleepAction(player)`
- `notifyStandingUp(player)`
- `notifyWakingUp(player)`
- `notifyAlreadySitting(player)`
- `notifyAlreadyStanding(player)`
- `notifyLeavingLocation(player, oldLocationId, newLocationId)`
- `notifyEnteringLocation(player, newLocationId)`
- `notifyDataLoadError(manager, logger, key, error)`
- `notifyDataSaveError(manager, logger, filePath, error)`
- `notifyError(manager, logger, message)`
- `notifyNpcDeparture(npc, direction)`
- `notifyNpcArrival(npc, direction)`

## 28. Utility
- `getRandomElement(array)`
- `findEntity(target, collection, type)`
- `calculateHealthPercentage(currentHealth, maxHealth)`
- `transferItem(itemId, source, sourceType, player)`
- `calculateAttackValue(attacker, defender, roll)`
- `calculateAttackOutcome(attacker, defender)`
- `notifyPlayerMovement(entity, oldLocationId, newLocationId)`
- `addToInventory(player, item)`
- `removeFromInventory(player, item)`