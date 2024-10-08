# Classes
List of all classes in 'server.js':

## Interface Classes
01. **ILogger**
02. **ISocketEventEmitter**
03. **IBaseManager**
04. **IDatabaseManager**
05. **IGameManager**

## Logging
05. **Logger**

## Configuration Management
06. **ConfigManager**

## Server Core Components
07. **Server**
08. **ServerInitializer**
09. **ServerConfigurator**
10. **SocketEventManager**
11. **SocketEventEmitter**
12. **ReplicationManager**
13. **AsyncLock**

## Task and Queue Management
14. **QueueManager**
15. **ObjectPool**
16. **TaskManager**
17. **MessageQueueSystem**

## Database and Data Management
18. **DatabaseManager**
19. **GameDataLoader**
20. **UidGenerator**

## Game Management
21. **GameManager**
22. **GameComponentInitializer**

## Entity Management
23. **Entity**
24. **Character**

## Player Management
25. **CreateNewPlayer**
26. **Player**
27. **AuthenticationManager**
28. **SessionManager**
29. **HealthRegenerator**

## Command Management
30. **GameCommandManager**
31. **LookAtCommandHandler**

## Combat Management
32. **CombatManager**
33. **CombatAction**

## Locations and Navigation Management
34. **Locations**
35. **LocationCoordinateManager**
36. **DescribeLocationManager**
37. **DirectionManager**

## Npc Management
38. **Npc**
39. **MobileNpc**
40. **QuestNpc**
41. **MerchantNpc**
42. **NpcMovementManager**

## Item Management
40. **BaseItem**
43. **Item**
44. **ConsumableItem**
45. **ContainerItem**
46. **WeaponItem**
47. **ItemManager**
48. **InventoryManager**
49. **Currency**
50. **TransactionManager**
51. **TradeSession**
52. **AtomicTransaction**

## Messaging Management
53. **FormatMessageManager**
54. **MessageManager**