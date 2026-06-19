---
title: JavaScript 原型链：把 prototype、__proto__ 和 instanceof 讲透
excerpt: 从 new 的执行过程开始，串起对象、构造函数、prototype、__proto__ 和原型链查找，顺手拆掉几个常见误区。
publishDate: '2026-06-17'
isFeatured: false
cover: ../../assets/images/blog/javascript-prototype-chain.png
tags:
  - JavaScript
  - 原型链
  - 前端
seo:
  title: JavaScript 原型链：把 prototype、__proto__ 和 instanceof 讲透
  description: 从 new、prototype、__proto__ 和 instanceof 出发，梳理 JavaScript 原型链的查找规则、常见误区和实战写法。
  image:
    src: ../../assets/images/blog/javascript-prototype-chain.png
    alt: JavaScript 原型链文章封面
  pageType: article
---

JavaScript 的原型链经常被画成一张图，但真正有用的理解方式，不是背图，而是回答两个问题：

1. 对象是怎么连到原型上的
2. 属性查找时，为什么会一路往上找

只要把这两件事讲清楚，`prototype`、`__proto__`、`constructor`、`instanceof` 就都不会再像一团雾。

## 先把三个名词分清

最容易混的是这三个东西：

- `prototype` 是函数身上的属性，通常用来放“共享方法”
- `[[Prototype]]` 是对象内部的原型指针，平时可以用 `Object.getPrototypeOf()` 读出来
- `constructor` 往往是在原型对象上的一个普通属性，通常指回构造函数

看个最小例子：

```js
function Person(name) {
  this.name = name;
}

Person.prototype.sayHi = function () {
  return `Hi, ${this.name}`;
};

const alice = new Person('Alice');

console.log(alice.sayHi()); // Hi, Alice
console.log(Object.getPrototypeOf(alice) === Person.prototype); // true
console.log(alice.__proto__ === Person.prototype); // true, 但不建议直接用
```

这里最关键的一句是：`new Person()` 创建出来的对象，会把自己的原型指向 `Person.prototype`。

也就是说，`prototype` 不是“实例自己的属性”，而是“实例往上找的那一层”。

## `new` 到底做了什么

很多原型链的问题，其实都能追到 `new`。

可以把 `new` 理解成四步：

1. 创建一个空对象
2. 把这个对象的原型指向构造函数的 `prototype`
3. 把构造函数里的 `this` 绑定到这个对象
4. 如果构造函数显式返回了一个对象，就返回那个对象，否则返回新建对象

手写一个简化版：

```js
function myNew(Ctor, ...args) {
  const obj = Object.create(Ctor.prototype);
  const result = Ctor.apply(obj, args);

  const isObject = result !== null && (typeof result === 'object' || typeof result === 'function');
  return isObject ? result : obj;
}
```

所以 `new` 本质上不是“魔法创建类实例”，而是“创建对象 + 建立原型连接 + 执行构造逻辑”。

这也是为什么原型链不是 class 才有的东西。即使不用 `class`，只要对象之间存在这种委托关系，原型链就已经成立了。

## 属性为什么会沿着链往上找

原型链最核心的行为，其实是属性读取：

```js
const animal = {
  speak() {
    return `${this.name} makes a sound`;
  }
};

const dog = Object.create(animal);
dog.name = 'Momo';

console.log(dog.speak()); // Momo makes a sound
```

这里 `dog` 自己没有 `speak`，于是 JS 会继续去 `dog` 的原型 `animal` 上找。

如果 `animal` 也没有，就继续往 `animal` 的原型上找，也就是：

```text
dog -> animal -> Object.prototype -> null
```

这个“找不到就往上找”的过程，就是原型链。

所以原型链不是一条神秘的概念链，而是一个非常朴素的查找规则。

### `in` 和 `hasOwn` 不一样

属性在不在对象里，和属性是不是对象“自己定义的”，是两回事：

```js
const proto = { shared: true };
const obj = Object.create(proto);
obj.own = 123;

console.log('shared' in obj); // true
console.log('own' in obj); // true
console.log(Object.hasOwn(obj, 'shared')); // false
console.log(Object.hasOwn(obj, 'own')); // true
```

- `in` 会沿原型链查找
- `Object.hasOwn()` 只看对象自己有没有这个属性

如果你在写字典对象、配置对象、缓存对象，通常更应该关心“是不是自己有”，而不是“原型上有没有”。

## `instanceof` 实际上在问什么

`instanceof` 也很容易被误解。

它问的不是“这个对象长得像不像某个类”，而是：

> 某个构造函数的 `prototype`，是否出现在这个对象的原型链上

比如：

```js
function Foo() {}

const foo = Object.create(Foo.prototype);

console.log(foo instanceof Foo); // true
```

这意味着 `instanceof` 本质上还是在查原型链。

不过它也有局限：

- 你手动改过原型，`constructor` 就不一定可信了
- 跨 realm 的对象，比如 iframe 里的数组，`instanceof Array` 可能会失效

所以我现在更倾向于：

- 需要判断“是不是数组”，用 `Array.isArray()`
- 需要判断“是不是自己有这个属性”，用 `Object.hasOwn()`
- 需要看原型，直接用 `Object.getPrototypeOf()`

`instanceof` 依然有用，但它不是万能答案。

## `class` 只是更顺手的语法

很多人第一次学 `class` 时，会以为 JS 终于有了和别的语言一样的类系统。

其实不是。`class` 更像是 prototype 语法上的糖衣。

```js
class Animal {
  constructor(name) {
    this.name = name;
  }

  speak() {
    return `${this.name} makes a sound`;
  }
}

const cat = new Animal('Mimi');
console.log(cat.speak());
console.log(Object.getPrototypeOf(cat) === Animal.prototype); // true
```

`class` 的方法仍然会挂在 `Animal.prototype` 上，实例还是沿着原型链去找这些方法。

所以你学 `class`，最终还是会回到原型链。

## 两个很常见的坑

### 1. 不要把可变数据放在原型上

原型适合放共享方法，不适合放每个实例都要独立拥有的可变数据。

```js
function User() {}

User.prototype.tags = [];

const a = new User();
const b = new User();

a.tags.push('frontend');

console.log(b.tags); // ['frontend']
```

这是因为 `tags` 只有一份，所有实例共享它。

如果这份数据会变，就应该放到实例自身上，而不是放在原型上。

### 2. 尽量别直接碰 `__proto__`

`__proto__` 基本能用，但我一般只把它当成历史遗留接口，不当成正式 API。

更稳的写法是：

```js
const proto = Object.getPrototypeOf(obj);
Object.setPrototypeOf(obj, anotherProto);
```

尤其是在热路径里，频繁改原型会让引擎优化变差，没必要为了“看起来酷”去这么写。

## 如果只记一句话

我现在理解原型链时，会把它压缩成一句话：

> `prototype` 是共享能力的来源，`[[Prototype]]` 是查找路径，`new` 负责把两者连起来。

再展开一点就是：

- 构造函数负责创建对象
- `prototype` 负责提供共享方法
- 实例对象沿着原型链查找属性
- `instanceof` 本质上也是在查链

如果把这四点记牢，JavaScript 里大部分“原型链玄学”都会变得很普通。
