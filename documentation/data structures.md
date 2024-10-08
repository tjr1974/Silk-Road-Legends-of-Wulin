# Data Structure Types
JavaScript provides several types of data structures that are essential for handling and organizing data. These data structures can be categorized into two groups: **Primitive Data Structures** and **Non-Primitive Data Structures** (also known as complex or composite data structures). Below are the key types:

### 1. **Primitive Data Structures**
These are the basic building blocks of data handling in JavaScript. Each of these types holds a single value.

- **Number**: Represents both integer and floating-point numbers.
  ```javascript
  let age = 30;
  let price = 19.99;
  ```

- **String**: A sequence of characters used to represent text.
  ```javascript
  let name = "John Doe";
  ```

- **Boolean**: Represents a logical entity and can have only two values: `true` or `false`.
  ```javascript
  let isOnline = true;
  ```

- **Null**: A special value representing "no value."
  ```javascript
  let result = null;
  ```

- **Undefined**: Represents an uninitialized variable or the absence of a value.
  ```javascript
  let count;
  console.log(count); // undefined
  ```

- **Symbol**: A unique and immutable data type, often used as object keys.
  ```javascript
  let sym = Symbol('identifier');
  ```

- **BigInt**: A special data type for working with large integers beyond the safe integer range.
  ```javascript
  let bigNumber = BigInt(9007199254740991);
  ```

### 2. **Non-Primitive Data Structures**
These are more complex structures that allow storing and organizing collections of data.

#### a. **Arrays**
- **Arrays** are ordered lists of values, and these values can be of any type. Arrays in JavaScript are dynamic and can grow or shrink in size.
  ```javascript
  let numbers = [1, 2, 3, 4, 5];
  let mixedArray = [1, 'two', true, null];
  ```

- Arrays provide several built-in methods like `push()`, `pop()`, `shift()`, `unshift()`, `slice()`, `map()`, `filter()`, etc.

#### b. **Objects**
- **Objects** are collections of key-value pairs, where the keys are strings (or Symbols) and the values can be of any type.
  ```javascript
  let person = {
      name: "Alice",
      age: 30,
      isAdmin: true
  };
  ```

- Objects allow flexible access and manipulation using dot notation or bracket notation.
  ```javascript
  console.log(person.name); // Alice
  console.log(person['age']); // 30
  ```

#### c. **Maps**
- **Maps** are collections of key-value pairs similar to objects, but they provide more flexibility in terms of the type of keys. Keys can be of any type, not just strings.
  ```javascript
  let map = new Map();
  map.set('name', 'John');
  map.set(42, 'The answer');
  console.log(map.get('name')); // John
  console.log(map.get(42)); // The answer
  ```

#### d. **Sets**
- **Sets** are collections of unique values. Each value in a set must be unique, and there are no duplicate elements allowed.
  ```javascript
  let set = new Set([1, 2, 3, 3, 4]);
  console.log(set); // Set {1, 2, 3, 4}
  ```

#### e. **WeakMap**
- **WeakMaps** are similar to Maps, but the keys must be objects and are weakly held, meaning they can be garbage-collected if no other reference to the key exists.
  ```javascript
  let weakMap = new WeakMap();
  let obj = {};
  weakMap.set(obj, "value");
  ```

#### f. **WeakSet**
- **WeakSets** are similar to Sets, but their elements must be objects, and they are weakly held, allowing garbage collection of the objects if no other references exist.
  ```javascript
  let weakSet = new WeakSet();
  let obj = {name: "Alice"};
  weakSet.add(obj);
  ```

### 3. **Special Data Structures**

#### a. **Typed Arrays**
- **Typed Arrays** allow handling of binary data and are primarily used in situations where performance is critical, such as manipulating raw binary data.
  ```javascript
  let buffer = new ArrayBuffer(16);
  let intView = new Int32Array(buffer);
  ```

#### b. **Date**
- **Date** objects represent points in time and provide methods for manipulating dates and times.
  ```javascript
  let today = new Date();
  ```

#### c. **JSON (JavaScript Object Notation)**
- While not strictly a data structure, JSON is a text format for representing structured data. It is widely used for transmitting data between servers and clients.
  ```javascript
  let jsonData = JSON.stringify(person);
  ```

### 4. **Advanced Data Structures (ES6+)**

#### a. **Classes**
- **Classes** are syntactical sugar over JavaScript's prototypal inheritance, providing a more structured and familiar object-oriented way to create objects and manage inheritance.
  ```javascript
  class Person {
      constructor(name, age) {
          this.name = name;
          this.age = age;
      }
  }
  ```

#### b. **Promises**
- **Promises** represent a value that may be available now, or in the future, or never. They are used to handle asynchronous operations.
  ```javascript
  let promise = new Promise((resolve, reject) => {
      setTimeout(() => resolve("done"), 1000);
  });
  ```

### Summary of Data Structures in JavaScript:
- **Primitive**: Number, String, Boolean, Null, Undefined, Symbol, BigInt.
- **Non-Primitive**: Arrays, Objects, Maps, Sets, WeakMaps, WeakSets, Typed Arrays.
- **Special**: Dates, Promises, and JSON.
- **Advanced**: Classes and Promises for handling object-oriented and asynchronous programming.

These structures allow for diverse ways to store and manipulate data efficiently in JavaScript applications.

# Efficient Data Structures
Using efficient data structures like **Set** and **Map** in JavaScript can significantly improve the performance of your code, especially when dealing with large datasets or frequent data manipulations. These structures offer more specialized and optimized operations compared to traditional arrays and objects. Here's how and when to use these data structures effectively:

### 1. **Set**
A **Set** is an unordered collection of unique values. This structure is highly efficient for cases where uniqueness is required and operations like checking for the existence of an item, adding, or removing items need to be optimized.

#### Key Features:
- **Unique Values**: A set automatically enforces uniqueness. Attempting to add a duplicate value to the set will be ignored.
- **Faster Lookups**: `Set.has(value)` is more efficient than checking if an array contains an element using `Array.includes()`, especially for large datasets.

#### Common Use Cases:
- **Removing duplicates from an array**:
  ```javascript
  let arrayWithDuplicates = [1, 2, 3, 3, 4, 5, 5];
  let uniqueArray = [...new Set(arrayWithDuplicates)]; // [1, 2, 3, 4, 5]
  ```

- **Efficient membership checks**:
  If you frequently need to check if an element is present in a collection, using a set is more efficient than using an array.
  ```javascript
  let mySet = new Set([1, 2, 3, 4]);
  console.log(mySet.has(3)); // true (O(1) complexity)
  ```

#### Efficiency:
- **Time Complexity**:
  - **Insertion**: O(1)
  - **Deletion**: O(1)
  - **Search/Has**: O(1)

  These operations in arrays (`push`, `splice`, `includes`) have O(n) time complexity due to linear searches.

#### Example:
If you have to process a large dataset where you want to ensure each item is unique and quickly check whether an item is present, `Set` offers much better performance compared to arrays.
```javascript
let largeDataset = new Set([/* large amount of data */]);
if (largeDataset.has('specificValue')) {
  // Do something
}
```

---

### 2. **Map**
A **Map** is a collection of key-value pairs where keys can be of any type (including objects and functions). Unlike regular JavaScript objects, Maps maintain the insertion order and offer efficient operations for both retrieving and setting key-value pairs.

#### Key Features:
- **Any Data Type as Key**: Maps allow you to use any type of value (not just strings) as keys, including objects, arrays, or functions.
- **Preserves Insertion Order**: Maps remember the original order of key insertions, which can be useful if you need to maintain a specific order.
- **Fast Lookups**: The `Map.get(key)` and `Map.has(key)` methods are faster and more optimized than accessing object properties, especially for large datasets.

#### Common Use Cases:
- **Storing object keys**: With regular objects, keys are always strings or symbols. If you need to map an object to a value, `Map` allows this:
  ```javascript
  let obj = {id: 1};
  let map = new Map();
  map.set(obj, 'Object Value');
  console.log(map.get(obj)); // 'Object Value'
  ```

- **Frequent key-value lookups**: If you're performing many key-value lookups (e.g., caching data), `Map` is more efficient than regular objects.
  ```javascript
  let cache = new Map();
  cache.set('item1', { data: 'data1' });
  console.log(cache.get('item1')); // { data: 'data1' }
  ```

- **Counting frequencies**:
  If you need to count occurrences of items in an array, `Map` can be an efficient choice.
  ```javascript
  let arr = ['apple', 'banana', 'apple'];
  let countMap = new Map();

  arr.forEach(item => {
    countMap.set(item, (countMap.get(item) || 0) + 1);
  });

  console.log(countMap); // Map { 'apple' => 2, 'banana' => 1 }
  ```

#### Efficiency:
- **Time Complexity**:
  - **Insertion**: O(1)
  - **Deletion**: O(1)
  - **Search/Get**: O(1)

  Compared to object property lookups, which are often O(n) for larger datasets, Map offers much better performance when dealing with a large number of keys.

#### Example:
```javascript
let userRoles = new Map();
userRoles.set('admin', { access: 'all' });
userRoles.set('editor', { access: 'edit' });

console.log(userRoles.get('editor')); // { access: 'edit' }
```

---

### 3. **WeakSet**
A **WeakSet** is similar to a regular Set, but it only stores objects, and the references to these objects are weak. This means that if the object is no longer referenced elsewhere, it can be garbage collected.

#### Key Features:
- **Holds only objects**.
- **No duplicates allowed**.
- **Garbage collection**: Objects in a `WeakSet` are weakly referenced, meaning they can be garbage collected if they are no longer referenced elsewhere.

#### Use Cases:
- **Tracking objects without preventing garbage collection**: Use `WeakSet` when you need to track objects but don’t want to prevent their garbage collection.
  ```javascript
  let weakset = new WeakSet();
  let obj = { name: "John" };
  weakset.add(obj);
  obj = null; // The object is garbage collected
  ```

#### Efficiency:
Similar to `Set`, but optimized for memory management in cases where you only need to track object references.

---

### 4. **WeakMap**
A **WeakMap** is a variant of `Map` where keys must be objects, and these keys are weakly referenced. Similar to `WeakSet`, this means that if there are no other references to the key object, it can be garbage collected.

#### Key Features:
- **Only objects as keys**: Primitive data types cannot be used as keys in a `WeakMap`.
- **Garbage collection**: Objects in the map can be garbage collected if there are no other references to them.

#### Use Cases:
- **Managing private data in classes**: `WeakMap` is often used to hold private data related to specific objects without risking memory leaks.
  ```javascript
  let privateData = new WeakMap();

  class User {
      constructor(name) {
          privateData.set(this, { name });
      }

      getName() {
          return privateData.get(this).name;
      }
  }

  let user = new User("Alice");
  console.log(user.getName()); // Alice
  ```

#### Efficiency:
Provides O(1) lookup for object keys while also allowing memory to be managed efficiently through garbage collection.

---

### Summary: Choosing the Right Data Structure
- **Use `Set`** when you need to store unique values and want faster operations like checking for existence or removing duplicates from an array.
- **Use `Map`** when you need to associate values with keys (especially non-string keys), and you need fast lookup, insertion, or deletion operations.
- **Use `WeakSet`** and **`WeakMap`** for memory-efficient scenarios where you want to track objects without preventing garbage collection.

Each of these structures provides optimizations for specific scenarios, leading to more efficient code both in terms of performance and memory usage.