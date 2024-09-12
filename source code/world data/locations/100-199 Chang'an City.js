
// Define locations
LocationEntries = {
  '100': {
    name: `Cháng'ān South Gate`,
    description: `The massive South Gate of Cháng'ān looms above you, an impressive entrance to the walled city. Guards patrol the area, ensuring the safety of the city. Travelers and merchants bustle in and out, while the sound of lively chatter fills the air. To the north, you can see the city's main street stretching into the distance.`,
    exits: {
      n: '101',
      u: '0',
    },
    inventory: [items['100'], items['101'], items['102'], items['103']],
    zone: 100,
  },
  '101': {
    name: `Cháng'ān Main Street`,
    description: `The wide, cobblestone main street of Cháng'ān is bustling with activity. Various shops, inns, and market stalls line the street, selling a plethora of goods from the far reaches of the Silk Road. The aroma of exotic spices and delicious street food fills the air. To the north is the city center, while the South Gate lies to the south.`,
    exits: {
      n: '102',
      s: '100',
    },
    inventory: [],
    zone: 100,
  },
  '102': {
    name: `Cháng'ān City Center`,
    description: `The city center of Cháng'ān is a large, open square where people gather for various activities. Musicians play traditional instruments, while acrobats and martial artists perform impressive feats. At the center stands a grand statue of the city's founder. The main street extends to the south, and narrow alleys lead east and west.`,
    exits: {
      n: '103',
      e: '104',
      w: '105',
      s: '101',
    },
    inventory: [],
    zone: 100,
  },
  '103': {
    name: `Cháng'ān Imperial Palace`,
    description: `The Cháng'ān Imperial Palace is a grand, sprawling complex surrounded by towering walls. This is the residence of the emperor and the political center of the city. The palace is decorated with exquisite carvings and paintings, reflecting the wealth and power of the empire. The city center lies to the south.`,
    exits: {
      s: '102',
    },
    inventory: [],
    zone: 100,
  },
  '104': {
    name: `Cháng'ān East Market`,
    description: `The East Market is a vibrant and chaotic place, where merchants and traders from all over the world gather to buy and sell their goods. The air is filled with the sounds of haggling and the enticing scents of various exotic wares. The city center is to the west.`,
    exits: {
      w: '102',
    },
    inventory: [],
    zone: 100,
  },
  '105': {
    name: `Cháng'ān West Garden`,
    description: `The West Garden is a tranquil, lush haven amidst the bustling city. A meandering path leads through beautifully manicured lawns, ornamental ponds, and fragrant flowerbeds. The gentle sound of a nearby waterfall and the chirping of birds create a serene atmosphere. The city center can be reached by heading east.`,
    exits: {
      e: '102',
    },
    inventory: [],
    zone: 100,
  },
};
// Add these entries to locations
locations = { ...locations, ...newLocationEntries };