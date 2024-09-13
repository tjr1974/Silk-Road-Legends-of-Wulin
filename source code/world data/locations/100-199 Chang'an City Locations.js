const locations = {
  // Key for new location:
  '100': new Location(
    // Location title:
    `Cháng'ān South Gate`,
    // Location description:
    `The massive South Gate of Cháng'ān looms above you, an impressive entrance to the walled city. Guards patrol the area, ensuring the safety of the city. Travelers and merchants bustle in and out, while the sound of lively chatter fills the air. To the north, you can see the city's main street stretching into the distance.`,
    // Exits {<direction> <key to linked location>}:
    {'north': '101'},
    // Items in Location:
    ['100'],
    // Container Items:
    ['100', '101'],
    // Weapon Items in Location:
    ['100'],
    // Zone:
    [`Cháng'ān City`]
  ), // Correctly close the location's definition
  // Key for new location:
  '101': new Location(
    // Location title:
    `Cháng'ān Main Street`,
    // Location description:
    `The wide, cobblestone main street of Cháng'ān is bustling with activity. Various shops, inns, and market stalls line the street, selling a plethora of goods from the far reaches of the Silk Road. The aroma of exotic spices and delicious street food fills the air. To the north is the city center, while the South Gate lies to the south.`,
    // Exits {<direction> <key to linked location>}:
    {'north': '102', 'south': '100'},
    // Zone:
    [`Cháng'ān City`]
  ), // Correctly close the location's definition
  // Key for new location:
  '102': new Location(
    // Location title:
    `Cháng'ān City Center`,
    // Location description:
    `The city center of Cháng'ān is a large, open square where people gather for various activities. Musicians play traditional instruments, while acrobats and martial artists perform impressive feats. At the center stands a grand statue of the city's founder. The main street extends to the south, and narrow alleys lead east and west.`,
    // Exits {<direction> <key to linked location>}:
    {'south': '101', 'east': '103', 'west': '104'},
    // Zone:
    [`Cháng'ān City`]
  ), // Correctly close the location's definition
  // Key for new location:
  '103': new Location(
    // Location title:
    `Cháng'ān Imperial Palace`,
    // Location description:
    `The Cháng'ān Imperial Palace is a grand, sprawling complex surrounded by towering walls. This is the residence of the emperor and the political center of the city. The palace is decorated with exquisite carvings and paintings, reflecting the wealth and power of the empire. The city center lies to the south.`,
    // Exits {<direction> <key to linked location>}:
    {'south': '102'},
    // Zone:
    [`Cháng'ān City`]
  ), // Correctly close the location's definition
  // Key for new location:
  '104': new Location(
    // Location title:
    `Cháng'ān East Market`,
    // Location description:
    `The East Market is a vibrant and chaotic place, where merchants and traders from all over the world gather to buy and sell their goods. The air is filled with the sounds of haggling and the enticing scents of various exotic wares. The city center is to the west.`,
    // Exits {<direction> <key to linked location>}:
    {'west': '102'},
    // Zone:
    [`Cháng'ān City`]
  ), // Correctly close the location's definition
  // Key for new location:
  '105': new Location(
    // Location title:
    `Cháng'ān West Garden`,
    // Location description:
    `The West Garden is a tranquil, lush haven amidst the bustling city. A meandering path leads through beautifully manicured lawns, ornamental ponds, and fragrant flowerbeds. The gentle sound of a nearby waterfall and the chirping of birds create a serene atmosphere. The city center can be reached by heading east.`,
    // Exits {<direction> <key to linked location>}:
    {'east': '102'},
    // Zone:
    [`Cháng'ān City`]
  ), // Correctly close the location's definition
};