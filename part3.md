# ENTITY COMPONENT SYSTEMS: Part 3

[In the first two parts](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part2.md), we set up Tiny Tanks a proof-of-concept that demonstrates an Entity-Component System (ECS) with complex, (de)activatable components, and inter-component activity _within a single entity_.

However, our ECS is still very tightly coupled and application-specific in numerous areas, which is less than ideal.

In part 3, we will _refactor_: without changing existing functionality or adding anything new, we'll begin to generalise our existing ECS.

## Technical overview

Our ECS initialisation phase will become more general and less specific to our particular game, so that it might be reused for another game.

As part of this process, we will also begin to support the idea of _entity archetypes_.
 
### Archetypes: what are they?

An archetype is basically the unique collection of active components which defines an entity.

For example, a tank is something that has active `hull`, `turret`, `trackLeft` and `trackRight`components, in addition to the ubiquitous `transform` and `motion` components being active. That collection of active component types is the tanks _archetype_. Anything that shares these active components can also be considered to be a tank.

## Writing the Code

I suggest downloading the project from [github](https://github.com/ArcaneEngineer/ECS-tutorials)
 and using a [diff](https://www.google.com/search?q=diff+meaning) tool to compare [`part2.js`](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part2.js) against [`part3.js`](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part3.js). I love using [kdiff3](https://kdiff3.sourceforge.net/) -- it allows 3-way diffs meaning you could compare parts [1](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part1.js), [2](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part2.js), and [3](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part3.js) side by side. 

### Generalising the populate / initialise loop

Let's look at the whole initialisation loop, and evaluate what it's really doing.

```
// Populate arrays for components of all tanks.
for (let e = 0; e < ENTITIES_COUNT; e++)
{
	//define the object (structure) of each element of the entity-component table.
	transforms [e] = structuredClone(transformPrototype);
	motions    [e] = structuredClone(motionPrototype);
	hulls      [e] = structuredClone(hullPrototype);
	turrets    [e] = structuredClone(turretPrototype);
	trackLefts [e] = structuredClone(trackPrototype);
	trackRights[e] = structuredClone(trackPrototype);
	
	if (e < TANKS_COUNT) //it will be a tank
	{
		transforms[e].isActive = true;
		initTransformTank(transforms[e], e);
		
		motions    [e].isActive = true;
		//do not init motion here, instead calculate it from the tracks, each tick.
		
		hulls	   [e].isActive = true; //<---
		initHull(transforms[e]);
		
		turrets    [e].isActive = true;
		initTurret(turrets[e]);
		
		trackLefts [e].isActive = true;
		initTrack(trackLefts[e]);
		
		trackRights[e].isActive = true;
		initTrack(trackRights[e]);
	}
	//else it will be a bullet (later indices where TANKS_COUNT <= e < ENTITIES_COUNT)
}
```

There are many application specifics here, most of which we'd only care about in the context of Tiny Tanks.

We can however see clear sections in this code, where different types of tasks are being handled. Roughly speaking, the pseudocode we can derive from this is:

```
for (let e = 0; e < ENTITIES_COUNT; e++)
{
	declare / assign all possible component objects for each entity

	if this counts as a tank entity
	{
		initialise every such entity
	
		set active every such entity
	}
	else if this counts as a bullet entity
	{
		do nothing
	}
}
```

We should split this up into two separate phases for clarity. (If this were implemented in C, we wouldn't even need the population section, due to the way arrays-of-`struct` are allocated, zeroed automatically, and accessed.)

```
//array contents definition / population (all)
for (let e = 0; e < ENTITIES_COUNT; e++)
{
	declare / assign to array, all possible component objects for each entity
}

//array contents initialisation (some)
for (let e = 0; e < ENTITIES_COUNT; e++)
{
	if this counts as a tank entity
	{
		initialise every such entity
	
		set active every such entity
	
	}
	else if this counted as a bullet entity
	{
		do nothing
	}
}
```

### Generalising the populate loop

Right. From that pseudocode, let's write the actual population code, which is now way more concise:

```
// Populate component data arrays unconditionally for all entities (object instances).
// In C we could skip this loop, just malloc() array-of-struct correctly and be done.
for (let e = 0; e < ENTITIES_COUNT; e++)
{
	//define the object (structure) of each element of the entity-component table.
	for (let c = 0; c < componentsByIndex.length; c++)
	{
		let component = componentsByIndex[c];
		component.array[e] = structuredClone(component.prototype);
	}
}
```

For each line of code here, you should be able to see clear analogues with the first few lines of code in the original version (`transforms [e] = structuredClone(transformPrototype);` etc.).

We debut a new array, `componentsByIndex`, which contains a `prototype` e.g. `turretPrototype` (I've avoided using the exact word `prototype`, since Javascript uses this internally), and an `array` e.g. `turrets`. The first (`prototype`) is used to instantiate and assign to the second (`array`).

`componentsByIndex` is central to how we will generalise our ECS now and in the future, so pay close attention to its structure (which we'll describe shortly) and its usage in the sections below.

### Interlude for Javascript afficionados

I apologise for using the member name `prototype` here. You will know that this can cause confusion with the various under-the-hood uses of `[[Prototype]]`, `__proto__` etc. by Javascript.

_However_, since this word accurately describes what we're doing, and is what was used in part 2, as well as the fact that diffing `part [n-1].js` with `part [n].js` is the best way to follow these tutorials, I have decided to keep the name as it is. You could use the term `blueprint` if you prefer, although I see this as more of a `class` than of an `object` prototype.

Thanks for understanding.
 
### Generalising the initialise loop

The initialisation section from [part 2](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part2.md) was quite tank-specific (as opposed to bullet-specific), now it generalises to:

```
// Initialise conditionally depending on each entity's given archetype.
for (let e = 0; e < ENTITIES_COUNT; e++)
{
	let entityArcheTypeIndex = entitiesRawData[e].archeType;
	let entityArcheType      = entityArcheTypes[entityArcheTypeIndex];
	
	for (let c of entityArcheType)
	{
		let component = componentsByIndex[c];
		component.init(component.array[e], entitiesRawData[e][c]);
		component.array[e].isActive = true;
	}
}
```

OK, this is where we touch on archetypes.

First we pull an archetype from an `entityRawData` which represents the hard-coded, randomly generated, or loaded ("raw") data, which we will parse into actual entities / components, and which holds the archetype index as `.archeType`.

The archetype itself is then retrieved using that index. It contains the _component (type) dependencies_ which define the archetype. For each of those component types, 
- we retrieve the necessary `component` from the array of `componentsByIndex` (in its second appearance);
- we initialise the `component` using a specialised `init` function stored on that `component`;
- we set that component active for this entity `[e]`, so that this entity `[e]`'s component `[c]` will be processed once we start to `update` the simulation.

In order to understand this more clearly, let's look at what the component-related arrays look like.

```
///--- Components ---///

const COMPONENT =
{
	TRANSFORM: 0,
	MOTION: 1,
	TURRET: 2,
	TRACK_LEFT: 3,
	TRACK_RIGHT: 4,
};

const componentsByIndex =
[
	//in each case, we have type info and the data array.
	//these could also be stored in 2 separate arrays.
	{init: initTransform, update: updateTransform, prototype:transformPrototype, array: transforms},
	{init: funcNull,      update: funcNull,        prototype:motionPrototype,    array: motions},
	{init: initTurret,    update: updateTurret,    prototype:turretPrototype,    array: turrets},
	{init: initTrack,     update: funcNull,        prototype:trackPrototype,     array: trackLefts},
	{init: initTrack,     update: funcNull,        prototype:trackPrototype,     array: trackRights},
];
```

See those `funcNull` references? We'll come back to those at the end of this article.

You can see references to our old ([part 1](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part1.md) and [2](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part2.md)) `init*` functions, our old `*Prototype` objects, and our various old component arrays that we've always used. These are now assembled in one place in the code.

By indexing into this components array using `[c]` in both the population and initialisation phases (and in an upcoming part of this series, the update phase), we can select a component by its (archetype) index, without knowing any specific names of functions or arrays. This allows us to do generalised, list-style processing, and abstracts us away from any Tiny Tanks specifics, meaning we could potentially use this code in other games or simulations.

We just mentioned archetype indices. So let's review the archetype arrays, which reference into the `COMPONENT` enum array we've just looked at:

```
///--- Archetypes ---///

const ARCHETYPE = 
{
	NONE: 0,
	TANK: 1,
	BULLET: 2,
};

const entityArcheTypes = 
{
	[ARCHETYPE.TANK  ] : [COMPONENT.TRANSFORM, COMPONENT.MOTION, COMPONENT.TURRET,
						  COMPONENT.TRACK_LEFT, COMPONENT.TRACK_RIGHT],
	[ARCHETYPE.BULLET] : [COMPONENT.TRANSFORM, COMPONENT.MOTION],
};
```

The `entityArcheTypes` clearly defines what we mean when we say `TANK` or `BULLET`, that is, of what components each of these entity archetypes is comprised.

The `ARCHETYPE` enum array defines archetypes by name, pointing to the index in the second array. These archetypes are used in some custom code at the end of our initialisation phase:

```
const entitiesRawData = 
[
	//TANKS
	{ archeType: ARCHETYPE.TANK,   [COMPONENT.TRANSFORM]: {x: 0, y: 0} },
	{ archeType: ARCHETYPE.TANK,   [COMPONENT.TRANSFORM]: {x: 0, y: 0} },
	{ archeType: ARCHETYPE.TANK,   [COMPONENT.TRANSFORM]: {x: 0, y: 0} },
	{ archeType: ARCHETYPE.TANK,   [COMPONENT.TRANSFORM]: {x: 0, y: 0} },
	
	//BULLETS
	{ archeType: ARCHETYPE.BULLET, [COMPONENT.TRANSFORM]: {x: 0, y: 0} },
	{ archeType: ARCHETYPE.BULLET, [COMPONENT.TRANSFORM]: {x: 0, y: 0} },
	{ archeType: ARCHETYPE.BULLET, [COMPONENT.TRANSFORM]: {x: 0, y: 0} },
	{ archeType: ARCHETYPE.BULLET, [COMPONENT.TRANSFORM]: {x: 0, y: 0} },
];

//...and modify the tanks' raw data x positions by index e (spread across playfield).
for (let e = 0; e < TANKS_COUNT; e++)
{
	let transform = entitiesRawData[e][COMPONENT.TRANSFORM];
	transform.x = parseInt((GAP_BETWEEN_TANKS * e) + GAP_BETWEEN_TANKS / 2);

```

(I added the second block (`//...and modify`) to keep `entitiesRawData` block neat and concise, rather than adding the `.x` modifications inline and making the code messy to read.)

If we need to in future, we can set up more raw data in each element of `entitiesRawData`, like so:

```
{ archeType: ARCHETYPE.TANK,   [COMPONENT.TRANSFORM]: {x: 0, y: 0}, [COMPONENT.MOTION]: {dx: 5, dy: 10}, ... },
```

...Such data will then be auto-parsed into actual component data by `component.init`, and used during runtime updates, assuming it uses exactly the same structure as the component prototypes. More on this shortly.

While I assume familiarity with Javascript in these tutorials, you may not be familiar with this syntax:
- `{ [ARCHETYPE.BULLET] : [COMPONENT.TRANSFORM, COMPONENT.MOTION] }`
- `{ [COMPONENT.TRANSFORM]: {x: 0, y: 0} }`

If not familiar, see [ES6 computed property names](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Object_initializer#computed_property_names). It's pretty straightforward. `[COMPONENT.TRANSFORM]` translates to a property name (index) of `0`, `[COMPONENT.MOTION]` to `1`, etc., as per the `COMPONENT` enum array we set up.

This is so that in our component array initialisation and activation phase (repeated here),

```
// Initialise conditionally depending on each entity's given archetype.
for (let e = 0; e < ENTITIES_COUNT; e++)
{
	let entityArcheTypeIndex = entitiesRawData[e].archeType;
	let entityArcheType      = entityArcheTypes[entityArcheTypeIndex];
	
	for (let c of entityArcheType)
	{
		let component = componentsByIndex[c];
		component.init(component.array[e], entitiesRawData[e][c]);
		component.array[e].isActive = true;
	}
}
```

...we can easily and _numerically_ index into the various aspects of our `entitiesRawData` (input) and `entityArcheTypes` (secondary input) arrays in order to accurately produce the contents of our `component.array` (output, that is, our components for the current entity `[e]`).

I prefer numeric indexing to name-based indexing, as [in most cases](https://stackoverflow.com/questions/10639488/faster-to-access-numeric-property-by-string-or-integer), since comparisons can occur faster than `string` name based indexing. (I'm unsure how true this remains in 2024 across different browsers, but as you the reader could implement such an ECS in your language of choice, it's best to opt for the most language-agnostic approach, in case you don't have string-keyed map support.)

### A change to individual component initialisation functions

Above, I mentioned "more on this shortly" when talking about `component.init`, or more specifically, the `initTransform`, `initTurret` etc. concrete functions that back our generalised `component.init`.

To get these `init*` functions to read in the necessary raw data, we have to change them slightly:

```
//--- Declare component initialisation functions ---//

function initTransform(transform, data)
{
	if (data)
	{
		for (let prop in data)
		{
			transform[prop] = data[prop];
		}
	}
	else
	{
		//nothing, leave as is
	}
}

function initTurret(turret, data)
{
	if (data)
	{
		for (let prop in data)
		{
			turret[prop] = data[prop];
		}
	}
	else
	{
		turret.angle = parseInt( lerp(TURRET_ANGLE_MIN, TURRET_ANGLE_MAX, Math.random()) );
		turret.angleDelta = (Math.random() - 0.5) / 5; //range: -0.1 .. +0.1 radians
		turret.reloadTime = parseInt( lerp(TURRET_RELOADTIME_MIN, TURRET_RELOADTIME_MAX, Math.random()) );
		turret.reloadCountdown = turret.reloadTime;
		turret.gunPower = parseInt( lerp(TURRET_GUNPOWER_MIN, TURRET_GUNPOWER_MAX, Math.random()) );
	}
}

function initTrack(track, data)
{
	if (data)
	{
		for (let prop in data)
		{
			track[prop] = data[prop];
		}
	}
	else
	{
		track.speed = parseInt( lerp(TRACK_SPEED_MIN, TRACK_SPEED_MAX, Math.random()) );
	}
}
```

Notice that both their function signature (arguments list) and content has changed (conditional blocks added). However, within each `else` block, the code is exactly the same as in [part 2](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part2.md)](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part2.md).

The upshot is that if raw data is provided in the function call, use it -- else randomly generate data within acceptable ranges.

In future, I would like to abstract this logic so we don't need `if-else` blocks between every single `init*` concrete function. But as there are only three of them at present, this suffices for now. (In OOP, this change could be made using either a base `class` / virtual method, or by the use of `interfaces` or `traits`.)


### The Null Design Pattern

Finally, there is a function we use if no initialiser exists.

```
function funcNull(component, data) {} //"null pattern"
```
This strange goodie is known as the [null pattern](https://en.wikipedia.org/wiki/Null_object_pattern). You could also see it as an empty [stub](https://en.wikipedia.org/wiki/Method_stub). It exists when we have no initialiser or update logic to run, for a given component type. It avoids us having to do something like this:

```
if (component.init != undefined)
{
	component.init();
}
else
{
	//do something else, or error
}
```
We avoid this because conditionals are costly, and null functions (or objects) take up very little space in CPU instruction (or data) cache, respectively. So it's cheaper to just run an empty function here than to check if a valid one exists.

In future lesson, we will also use empty object literals where no prototype exists:

```
const nullPrototype = {};
```

But for now, that's all, folks!

### Result

![part2_tiny_tanks.png](https://ucarecdn.com/c204fb62-5e6d-43b5-afc4-87980adc47f1/)

As this was a pure refactoring exercise, our output has is indistinguishable from that of [part 2](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part2.md).

The final code can be found on [github](https://github.com/ArcaneEngineer/ECS-tutorials).

## Conclusion

In this lesson, we've seen how we can begin to generalise he intialisation phase of the ECS, by having it take generalised components and entity archetypes, and turn these into a running system.

While things have definitely become more difficult to understand -- this is usually the curse of [abstraction](https://en.wikipedia.org/wiki/Abstraction_(computer_science)) -- the power of our ECS has also grown enormously, such that we could already begin to see how it might be used for different games, and an endless array of different component types.

In so doing, our runtime code has become more abstract and a tad more difficult to understand, as parts of that code moved into the initialisation section as (soon to be) pure data. Thus, the _density_ of the different sections of our code has changed, which indicates a shift towards a [data driven design](#). 

In time, all initialisation data will come from data sources, e.g. JSON files or a database, representing either serialised savegames or data produced by game designers, either by hand or by say, a custom-built editor. That is one of our medium-terms goals as we continue this series.

In the next lesson, we will look at further differentiating our two entity archetypes, adding a third archetype, and begin to generalise the second part of our code: runtime updates.

