# ENTITY COMPONENT SYSTEMS: Part 4

By the end [part 3](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part3.md), we had set up our Entity-Component System (ECS) proof-of-concept -- Tiny Tanks -- that demonstrates generalised entity-component population and initialisation phases. It uses complex (object-based) and (de)activatable components.

In terms of game logic updates and rendering, our ECS is still tightly coupled and application-specific. In part 4, we will _refactor_ again: without changing existing functionality, we'll conclude making our existing ECS less application-specific.

 We'll do this using _systems_, the third part of the ECS triad.

## Technical overview

Our ECS update and rendering phases will each be generalised. We will continue to use our specialised `componentsByIndex` concrete data and type-information array, and type information provided by our `entityArcheTypes` array.

We will further differentiate the `TANK` and `BULLET` archetypes by adding some additional components to them, in preparation for the use of _systems_. This will not change existing functionality.
 
## Writing the Code

Download the project from [github](https://github.com/ArcaneEngineer/ECS-tutorials)
 and using a [diff](https://www.google.com/search?q=diff+meaning) tool to compare [`part3.js`](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part3.js) against [`part4.js`](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part4.js).
 
 I recommend using [kdiff3](https://kdiff3.sourceforge.net/) if you don't have a favourite diff tool -- it allows 3-way diffs meaning you could compare the last 3 parts, and see their evolution side by side. 

### Adding new components

We'll need a couple of new components, one for the tank, and one for the bullet. Actually, one has been talked about in the past, but has been missing for a while: the tank's hull.

```
const hullPrototype =
{
	isActive: false,
	
	health: 0
}
```

This is fairly straightforward; once you see how it is used, it should make complete sense.

Next, we need a way to denote how much damage a bullet can do, and of what type the charge is (incendiary or armour-penetrating). This will help with our game logic when a bullet hits.

```
const payloadPrototype =
{
	isActive: false,
	
	damage: 0
}

```

We'll add these `prototypes` to the existing entries in the `entityArcheTypes` array:

```
const entityArcheTypes = 
{
	[ARCHETYPE.TANK  ] : [COMPONENT.TRANSFORM, COMPONENT.MOTION, COMPONENT.TURRET,
						  COMPONENT.TRACK_LEFT, COMPONENT.TRACK_RIGHT, 
						  COMPONENT.HULL], // <-- added
	[ARCHETYPE.BULLET] : [COMPONENT.TRANSFORM, COMPONENT.MOTION, 
						  COMPONENT.PAYLOAD], // <-- added
};
```

and as new entries to the `componentsByIndex` array:

```
const componentsByIndex =
[
	//in each case, we have type info and the data array.
	//these could also be stored in 2 separate arrays.
	
	...
	
	{init: funcNull,      update: funcNull,        prototype:hullPrototype,      array: hulls},
	{init: funcNull,      update: funcNull,        prototype:payloadPrototype,   array: payloads},
];

```

Now these are ready for use in our update and rendering loops.

### Generalising the update loop

Let's next look at our update loop from [part 3](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part3.js), and evaluate what it's doing.

```
//Our ECS function.
function processComponents() 
{
    //process each entity in our game
    for (let e = 0; e < ENTITIES_COUNT; e++)
    {
		//any moving entity -- tank or bullet.
		if (transforms[e].isActive)
		{
			if (motions[e].isActive)
			{
				updateTransform(e);
			}
			//else it is a non-moving entity.
		}
		
		if (turrets[e].isActive)
		{
			updateTurret(e);
		}
    }
}

```

This code is still rather specific to Tiny Tanks. Let's change that. 

If we ignore the `if` statements for simplicity, all we're really doing is

```
function processComponents() 
{	
	for (let e = 0; e < ENTITIES_COUNT; e++)
	{
		for (let update of updaters)
		{
			update(e);
		}
	}
}
```

OK, but it's better if we do this:

```
function processComponents() 
{
	for (let update of updaters)
	{
		for (let e = 0; e < ENTITIES_COUNT; e++)
		{
			update(e);
		}
	}
}
```

Did you notice what changed? The loops. We no longer loop primarily by entity `e`; instead we now process primarily by `updaters`. In the original version, every time we ticked the simulation over (pressed spacebar) we processed as follows:

```
IF TANK   OR IF BULLET
entity[0]    entity[0]
-move        -move
-shoot
entity[1]    entity[1]
-move        -move
-shoot
entity[2]    entity[2]
-move        -move
-shoot
.
.
.

```

Whereas with the new version we'd be processing in this order:

```
All entities that can move
-move:  [0], [1], [2], [3] etc.
All entities that can shoot
-shoot: [0], [1], [2], [3] etc.
.
.
.
```

So we now have phased processing, and that's precisely what we need in a game engine: A defined order in which things occur makes reasoning about the simulation much simpler.

### System Dependencies 1: What they are

But we've skipped something very important. Remember those `if`s we just conveniently ignored? In part 3's `processComponents()`, we were checking `.isActive` on numerous components -- for our tanks (1st `if` block), then for our bullets (2nd `if` block).

Why do we do need those `if`s?

_It is because we need to know that the types of components used in each `update()`, are present  / active for the entity `[e]`._ These `if`s speak to _logic dependencies_. For example,

```
function updateTransform(e)
{
	let transform = transforms[e];
	let motion = motions[e];
	
	transform.x += motion.dx;
	transform.y += motion.dy;
}
```

This updater function needs at least to have a `transform` and a `motion` component. If we found an entity that had an active `transform`, but an inactive `motion`, then this logic could not work. For example, a tree just sits at a position, but doesn't move. By not giving trees an active `motion` component, we are saying "trees can't move".

Assuming trees existed in our game, how could we run `updateTransform` (literally, _move_) for bullets but not for trees?

Well.. we'd need to check our component dependencies. That is, for each _system_ we try to run, what components does it require to do its work? Does this entity `[e]` have those components active?

Imagine a tank whose turret has been destroyed. It no longer matches its archetype of `TANK`. It can still move, but it can longer turn its turret or shoot. But that tank won't stop doing `updateTransform` -- after all, it still has its `transform` and `motion` properties active. It can still move, even if it can't shoot.

So this leaves us with the question, how do we integrate those `if`s into our newly generalised code structure?

#### System dependencies 2: How to implement dependency in a generalised manner

We'll need to modify our proposed `update` loop a little more:

```
//Our ECS function.
function processComponents() 
{
	for (let system of systems)
	{
		for (let e = 0; e < ENTITIES_COUNT; e++)
		{
			if (systemDependenciesSatisfiedByEntity(system, e))
			{
				system.update(e);
			}
		}
	}
}
```

The function used to check the dependencies is simple: provided that no component we depend upon is inactive, we'll return `true`:

```
function systemDependenciesMetByEntity(system, e)
{
	let depsSatisfied = true; //assume true until proven false
	for (let c of system.componentDependencies)
	{
		depsSatisfied = depsSatisfied && componentsByIndex[c].array[e].isActive;
	}
	return depsSatisfied;
}
```

...It just keeps folding the boolean result into itself until it's done. If at any stage it hits `false`, the result will stay `false` due to the use of `&&` (logical AND).

So before we run the system's `update` function, we check whether it has the dependencies that its `update` function needs to do its work. This ensures that bullets don't, for example, try to shoot more bullets, acting as though they were a tank turret!

But how do we know what these dependencies are, that we need to check against?

#### System dependencies 3: Finding what they are, and specifying them for use

Dependencies are specific to each system. To find what they are, we look into each system function to see what it uses in the way of components, for example, in our existing `updateTurret` system:

```

function updateTurret(e)
{
	let turret = turrets[e]; // <--
	
	turret.angle += turret.angleDelta;
	
	turret.reloadCountdown--;
	
	//shoot if we can
	if (turret.reloadCountdown == 0)
	{
		let tankTransform = transforms[e]; // <--
		let tankMotion = motions[e]; // <--
		
		//spawn new bullet
		console.log(e, 'says bang!');
		
		...
	}
}
```

We're looking for each reference to a component array where we access element `[e]` (the current entity being processed).

In this way, we see what is needed on _the current_ tank, in order to update its `turret`. That is, we need `turrets[e]`, `transforms[e]` and `motions[e]`. (I've marked each with a `<--` comment.)

(Did you notice that we also access `transforms` and `motions` at `[TANKS_COUNT+e]`? However, these are for the bullet being fired, and _not_ for the turret/tank we are currently processing _in order to fire that bullet_. I did this to make the series easier to follow up until now; we'd not work this way in a fully-implemented ECS. We'll de-hack this in a later part.)

Now we know the dependencies for this system function, so how do we specify them in code?

```
//Systems are listed in the order in which they will run.
const systems = 
[
	...
	{update: updateTransform, componentDependencies: [COMPONENT.TRANSFORM, COMPONENT.MOTION]},
	{update: updateTurret   , componentDependencies: [COMPONENT.TRANSFORM, COMPONENT.MOTION, COMPONENT.TURRET]}, // <-- that's our guy
	...
];
```

With this in place, systems called in `processComponents` should be able to do their work according to the kind of entity that `[e]` is. Perfect. Actually, there is one more thing, let's rename that function, shall we?

```
//Our ECS function.
function ECSprocess() 
{
	for (let system of systems)
	{
		...
	}
}
```

#### Fixing updateTurret

There is one last thing to do.

You'll have noticed that `updateTurret` contains some code which should not be there, specifically, updating the tank's speed according to the speed of its tracks. Let's fix this architectural mistake by splitting the function in two.

```
function updateMotionFromTracks(e)
{
	let tankMotion = motions[e];
	tankMotion.dy = trackLefts[e].speed + trackRights[e].speed;
}
```
and
```
function updateTurret(e)
{
	let turret = turrets[e];
	
	turret.angle += turret.angleDelta;
	
	turret.reloadCountdown--;
	
	//shoot if we can
	if (turret.reloadCountdown == 0)
	{
		let tankTransform = transforms[e];
		let tankMotion = motions[e];
		
		//spawn new bullet
		console.log(e, 'says bang!');
		
		...
	}
}
```

And lastly, let's ensure both of these are run as independent systems (marked by `<--`):

```
//Systems are listed in the order in which they will run.
const systems = 
[
	{update: updateMotionFromTracks, componentDependencies: [COMPONENT.MOTION, COMPONENT.TRACK_LEFT, COMPONENT.TRACK_RIGHT]}, // <-- newly added
	
	{update: updateTransform, componentDependencies: [COMPONENT.TRANSFORM, COMPONENT.MOTION]},
	
	{update: updateTurret   , componentDependencies: [COMPONENT.TRANSFORM, COMPONENT.MOTION, COMPONENT.TURRET]}, // <-- existing
];
```

### Result

At this stage you can run the app and everything should be working exactly as before.

![part2_tiny_tanks.png](https://ucarecdn.com/c204fb62-5e6d-43b5-afc4-87980adc47f1/)

As this was a pure refactoring exercise, our output is indistinguishable from that of parts [2](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part2.md) and [3](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part3.md).

The final code can be found on [github](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part4.js).


## Conclusion

We've seen how to generalise our whole ECS, from initialisation through to runtime updates and rendering.

System dependencies are _not the same_ as entity archetype dependencies, even though they both talk about components... so don't get confused. Archetypes just say, "an ideal tank consists of a transform, a motion, a turret, two tracks, and a hull, so we'll initialise it like that". Instead, systems say, "I have some work to do, and I need to know that this entity -- regardless of its original archetype, and in its present state -- still has the capabilities to do this work".
