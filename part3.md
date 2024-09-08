# ENTITY COMPONENT SYSTEMS: Part 3

[In the first two parts](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part2.md), we set up Tiny Tanks a proof-of-concept that demonstrates an Entity-Component System (ECS) with complex, (de)activatable components, and inter-component activity _within a single entity_.

However, our ECS is still very tightly coupled and application-specific. So in part 3, we will _refactor_: without changing existing functionality or adding anything new, we'll begin to make our existing ECS less application-specific and more general or agnostic in the way it views entity-component data.

## Technical overview

Our ECS initialisation phase will be generalised. As part of this process, we will also implement support for _entity archetypes_.
 
### Archetypes: what are they?

An archetype is the unique collection of active components which defines an entity.

For example, a tank is something that has active `hull`, `turret`, `trackLeft` and `trackRight`components, in addition to the ubiquitous `transform` and `motion` components being active. That collection of active component types is the tank _archetype_. Anything that shares these active components can also be considered to be a tank.

## Writing the Code

I suggest downloading the project from [github](https://github.com/ArcaneEngineer/ECS-tutorials)
 and using a [diff](https://www.google.com/search?q=diff+meaning) tool to compare [`part2.js`](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part2.js) against [`part3.js`](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part3.js).
 
 I love using [kdiff3](https://kdiff3.sourceforge.net/) -- it allows 3-way diffs meaning you could compare parts [1](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part1.js), [2](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part2.js), and [3](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part3.js) side by side. 
 
The diff between parts 2 to 3 is much clearer this time (part 1 to 2 was a bit messy). I will try to keep it so between future parts, where possible.

### Generalising the populate / initialise loop

Let's look at our existing initialisation loop from [part 2](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part1.js), and evaluate what it's doing.

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

There are many application specifics here, which we'd only care about in the context of Tiny Tanks.

We see clear sections in the above code, where different types of tasks are being handled. The pseudocode we can derive from this is:

```
for (let e = 0; e < ENTITIES_COUNT; e++)
{
	declare / assign all possible component objects for each entity

	if this counts as a tank entity
	{
		initialise this entity's applicable components
	
		set active this entity's applicable components
	}
	else if this counts as a bullet entity
	{
		do nothing
	}
}
```

We should split this up into two separate phases for clarity.

(If this were implemented in C, we wouldn't even need the population section, due to the way arrays-of-`struct` are allocated, zeroed automatically, and accessed.)

Phase 1 is population:

```
//array contents definition / population (all)
for (let e = 0; e < ENTITIES_COUNT; e++)
{
	declare / assign to array, all possible component objects for each entity
}
```

Phase 2 is initialisation and activation:

```
//array contents initialisation (some)
for (let e = 0; e < ENTITIES_COUNT; e++)
{
	if this counts as a tank entity
	{
		initialise this entity's applicable components
	
		set active this entity's applicable components
	
	}
	else if this counted as a bullet entity
	{
		do nothing
	}
}
```

### Generalising the population loop (only)

Right. From our population (phase 1) pseudocode, let's write the actual population code, which is now way more concise:

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

For each line of code here, we see clear analogues with the first few lines of code in the original version, i.e. `transforms [e] = structuredClone(transformPrototype);` etc.

We debut a new array, `componentsByIndex`, which contains a `prototype` e.g. `turretPrototype`, and an `array` e.g. `turrets`. The `component.prototype` is used to instantiate and assign to the `component.array`.

`componentsByIndex` is central to how we will generalise our ECS now and in the future, so pay close attention to its structure and its usage, both of which are described in the sections below.

### A side note for Javascript afficionados

I used the member name `prototype` here. This could potentially cause confusion with the various under-the-hood uses of `[[Prototype]]`, `__proto__` etc. by Javascript's type system.

_However_, this word accurately describes what we're doing, and is what was used in part 2. Also, diffing `part [n-1].js` with `part [n].js` is the best way to follow these tutorials.

For these two reasons I have decided to keep the name as it is. Your understanding is appreciated.
 
### Generalising the initialisation loop (only)

The initialisation section from [part 2](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part2.md) was quite tank-specific (as opposed to bullet-specific). Now it generalises completely, knowing nothing (being _agnostic_) as regards either tanks or bullets:

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

OK, here, archetypes become code. Let's explain.

First, we pull an archetype index from an `entityRawData`, which represents the hard-coded, randomly generated, or loaded ("raw") data, which we'll parse into actual entities / components.

The archetype itself is retrieved using that index. It contains the _component (type) dependencies_ which define the archetype. For each of the archetype's component types,
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

See those `funcNull` references? We'll come back to those at the end of this article. Just know for now that they do _nothing at all_.

You can see references to our old ([part 1](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part1.md) and [2](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part2.md)) `init*` functions, our old `*Prototype` objects, and our various old component arrays. These are now neatly assembled in one place in our code.

By indexing into this components array using `[c]` in both the population and initialisation phases (and in an upcoming part of this series, also the update phase), we are able to select a component by its index, without knowing any specific names of functions or arrays (unlike parts 1 & 2).

This allows us to do generalised, list-style processing, and abstracts us away from Tiny Tanks specifics, meaning we could potentially use this code in other games or simulations!

### Archetypes: How they are defined

We just mentioned archetype indices. Let's review them in full.

The archetype arrays, which reference into the `COMPONENT` enum array we've just looked at, are simple:

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

`entityArcheTypes` clearly define what we mean when we say `TANK` or `BULLET`, that is, of what components each of these entity archetypes is comprised.

The `ARCHETYPE` enum array defines archetypes by numeric index, and indicate the index used for the archetype in the `entityArcheTypes` array. Archetypes are used in some custom code at the end of our initialisation phase:

```
const entitiesRawData = 
[
	//TANKS
	{ archeType: ARCHETYPE.TANK,   [COMPONENT.TRANSFORM]: {x: 64,  y: 0} },
	{ archeType: ARCHETYPE.TANK,   [COMPONENT.TRANSFORM]: {x: 192, y: 0} },
	{ archeType: ARCHETYPE.TANK,   [COMPONENT.TRANSFORM]: {x: 320, y: 0} },
	{ archeType: ARCHETYPE.TANK,   [COMPONENT.TRANSFORM]: {x: 448, y: 0} },
	
	//BULLETS
	{ archeType: ARCHETYPE.BULLET, [COMPONENT.TRANSFORM]: {x: 0, y: 0} },
	{ archeType: ARCHETYPE.BULLET, [COMPONENT.TRANSFORM]: {x: 0, y: 0} },
	{ archeType: ARCHETYPE.BULLET, [COMPONENT.TRANSFORM]: {x: 0, y: 0} },
	{ archeType: ARCHETYPE.BULLET, [COMPONENT.TRANSFORM]: {x: 0, y: 0} },
];
```

Why do we do use archetypes here? Well, defining just `ARCHETYPE.TANK` and `ARCHETYPE.BULLET` for each element of the array, we avoid having to list the full set of required components these would need, each and every time we define a new entity. That would be 4x for tanks, and 4x for bullets in this simple example.

But in a real game, there could be hundreds, thousands or tens of thousands of entities we need to process at startup. Even if the data is saved and loaded, the data could become enormous, putting more strain on the CPU.

I'm sure you'll agree then, that archetypes serve a useful purpose!

Note that if we need to in future, we can set up more raw data in each element of `entitiesRawData`, like so:

```
{ archeType: ARCHETYPE.TANK,   [COMPONENT.TRANSFORM]: {x: 0, y: 0}, [COMPONENT.MOTION]: {dx: 5, dy: 10}, ... },
```

...Such data will then be auto-parsed into actual component data by `component.init`, and used during runtime updates, assuming it has _exactly_ the same structure as the component prototypes. More on this shortly. This is a potential cause of runtime errors that we should address in future.

While I assume familiarity with Javascript in these tutorials, you may not be familiar with this exact syntax:
- `{ [ARCHETYPE.BULLET] : [COMPONENT.TRANSFORM, COMPONENT.MOTION] }`
- `{ [COMPONENT.TRANSFORM]: {x: 0, y: 0} }`

If not familiar, see [ES6 computed property names](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Object_initializer#computed_property_names). as per the `COMPONENT` enum array we set up, `[COMPONENT.TRANSFORM]` translates to a property name (index) of `[0]`, `[COMPONENT.MOTION]` to `[1]`, etc.

### Archetypes: How they are used

We have set up archetypes using only numeric indices, for good reason: In our component arrays initialisation and activation phase which we looked at earlier (repeated here),

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

...we can _numerically_ index into the various aspects of our `entitiesRawData` (input) and `entityArcheTypes` (secondary input) arrays in order to accurately produce the contents of our `component.array` (output, that is, our components for the current entity `[e]`).

I prefer numeric indexing to name-based indexing, for two reasons:

- it is more efficient [in most cases](https://stackoverflow.com/questions/10639488/faster-to-access-numeric-property-by-string-or-integer) -- comparisons occur faster than `string` name based indexing.
- Since you could implement an ECS in your language of choice, it's best to opt for the most language-agnostic approach, in case you don't have string-keyed map support, which Javascript objects have by default.

### Updating our component initialisation functions

Above, I said "more on this shortly" when talking about `component.init`, or more specifically, the `initTransform`, `initTurret` etc. functions that back our generalised `component.init`.

To get these `init*` functions to read in the necessary raw data (which we pass as the second argument / parameter), we have to change them slightly:

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

...This logic was included because we need a way to initially set up the `transform.x` positions of our tanks, and not of the bullets. However, this logic generalises across any component and any data member (field) of that component. Definitely a net win to add it to our code, then!

Notice that both their function signature (arguments list) and content has changed (conditional blocks added). However, within each `else` block, the code is exactly the same as in [part 2](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part2.js).

The upshot? If raw data is provided in the function call, we use it -- else we randomly generate data within acceptable ranges.

In future, I would like to abstract this logic so we don't need `if-else` blocks between every single `init*` concrete function (`initTransform`, `initMotion` etc.).

### The Null Design Pattern

Finally, there is a special function which we use if no initialiser or updater function exists for a given component type.

```
function funcNull(component, data) {} //"null pattern"
```
This strange function a form of the [null design pattern](https://en.wikipedia.org/wiki/Null_object_pattern). You could also see it as an empty [stub](https://en.wikipedia.org/wiki/Method_stub). It exists for when we have no initialiser or update logic to run, for a given component type. It avoids us having to do something like this:

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
We avoid this `if` block because branching conditionals like this are costly, and null functions (or objects) take up very little space in CPU instruction (or data) cache, respectively. So it's cheaper to just run an empty function here, than to always check if a valid one exists for that component. And remember, for updates at least, this can happen may times a second (20, 30, 60 FPS are common logic refresh rates).

In future, we will also use empty object literals where no prototype exists:

```
const nullPrototype = {};
```

But that will be for a future part of this series!

### Result

![part2_tiny_tanks.png](https://ucarecdn.com/c204fb62-5e6d-43b5-afc4-87980adc47f1/)

As this was a pure refactoring exercise, our output is indistinguishable from that of [part 2](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part2.md).

The final code can be found on [github](https://github.com/ArcaneEngineer/ECS-tutorials/part3.js).

## Conclusion

We've seen how to generalise the intialisation phase of our ECS, by having it take generalised components and entity archetypes, and (almost magically) turn these into a running system.

While initialisation code has become more obscure to understand -- this is usually the curse of [abstraction](https://en.wikipedia.org/wiki/Abstraction_(computer_science)) -- the power of our ECS has also grown enormously, such that we could already begin to see how it might be used for different games, and an endless array of different entity and component types. The _density_ of the different sections of our code has changed, indicating a shift towards a [data driven design](#). 

In time, all initialisation data will come from data sources, e.g. JSON files or a database, representing either serialised savegames or data produced by game designers, by hand or by custom-built editor. To have our ECS _purely data-driven_ is one of our goals as we continue this series.

We saw that the `componentsByIndex` holds not only the concrete data for each component type, but also a kind of _general component type information_. Archetypes, too, provide something akin to the info that the [builder pattern](http://en.wikipedia.org/wiki/Builder_pattern) needs to build its composite objects in OOP. For those who wonder how OOP was invented (i.e. how C evolved into C++), we begin to see how primitive type systems were written in C (or C-like) environments in the not-so-distant past.

In the next part, we'll further differentiate our two entity archetypes, add a third archetype, and generalise our game logic updates and render code.

