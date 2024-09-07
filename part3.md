# ENTITY COMPONENT SYSTEMS: Part 3

[In the first two parts](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part2.md), we set up Tiny Tanks a proof-of-concept that demonstrates an Entity-Component System (ECS) with complex, deactivatable components, and inter-component activity _within a single entity_.

Now in part 3, we will further generalise the existing system, as well as making it the computer-controlled tanks (entities) more interactive.

## Technical overview

In part 3, we will elaborate our ECS demo further by adding inter-entity, inter-component interactions. This will take the form of bullets that can hit other tanks and disable them.

We will also start looking into how we can make our main ECS loop function be more general and less specific to our particular game, so that it might be reused for another game.
 
### Archetypes: what are they?

A key word we will need to use in this lesson is _archetype_. An archetype is basically the unique collection of active components which defines an entity.

For example, a tank is something that has a `hull`, `turret`, `trackLeft` and `trackRight`, in addition to the ubiquitous `transform` and `motion` components being active. That collection of active component types is the tanks _archetype_. Anything that shares these active components can also be considered a tank.

For this reason, we will also be further defining a bullet, so that it is clear that a bullet is not just some generic object that has a `transform` (position) and can effect `motion`, but is in fact something discrete from all other objects that contain only a  `transform` and `motion` component (basically, anything you can imagine that has a position and can move).

## Writing the Code

### Adding back the tank's hull

One of the things we got rid of previously was our tank `hull`. I would now like to put this back, since we will use it to see whether a tank is alive or dead. A tank can still be a tank without `tracks` or a `turret`, but without a `hull` (body), it's bye-bye tank.

```
const hullPrototype =
{
	isActive: false,
	
	isOnFire: false,
	health: 0
}
```

We'll also need the associated constants,

```
const HULL_HEALTH_MIN = 0;
const HULL_HEALTH_MAX = 10;
```

And the initialisation function, 

```
function initHull(hull)
{
	hull.health = parseInt( lerp(HULL_HEALTH_MIN, HULL_HEALTH_MAX, Math.random()) );
}

```

As you should have realised, we need to set this up along with all the rest of the components.

```
// Populate arrays for components of all tanks.
for (let e = 0; e < ENTITIES_COUNT; e++)
{
	//define the object (structure) of each element of the entity-component table.
	...
	hulls      [e] = structuredClone(hullPrototype); // <--- added
	...
	
	if (e < TANKS_COUNT) //it will be a tank
	{
		...
	
		hulls[e].isActive = true; //<---
		initHull(transforms[e]);
		
		...
```
`...` being where we set up all the other component arrays and their elements.

### Generalising the populate / initialise loop

As we just touched on this loop, let's now refactor it into something that doesn't care about component types. For this, we'll use some more dynamic (runtime) features of Javascript, which are more difficult to achieve in a language like C. Hey, we get the best of both worlds here!

Let's look at the whole loop, and evaluate what it's really doing.

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

Roughly speaking, the pseudocode I'm seeing from this is:

```
for (let e = 0; e < ENTITIES_COUNT; e++)
{
	define / assign all possible component objects for each entity

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

So let's try to make it that short with actual code:

```
for (let e = 0; e < ENTITIES_COUNT; e++)
{
	//define / assign all possible component objects for each entity, regardless of archetype
	for (let t = 0; t < componentTypes.length; t++)
	{
		let componentArray = componentArrays[t];
		componentArray[e] = structuredClone(componentTypes[t].prototype_);
	}
}
```

Great, that's the first part done. But what about the second part? It's very tank-specific, so let's try to generalise that further:

```
for (let e = 0; e < ENTITIES_COUNT; e++)
{
	//define / assign all possible component objects for each entity, regardless of archetype
	...

	if this counts as a particular archetype
	{
		initialise as per that archetype's init rules
	
		set active every entity of that archetype
	}
```

That's better. But how do we know if something qualifies as a given archetype? Probably, it has to satisfy having active components for as per what that archetype requires. For example, a tank requires an active `hull`, `turret`, `tracks` etc.

In concrete code that should look something like:

```
	let archetypeDeps = [...]; 
	let isOfArchetype = true; //until proven false
	for (let t of archetypeDeps)
	{
		isOfArchetype = isOfArchetype && componentArray[t].isActive;
	}

	if this counts as a particular archetype
	{
		initialise as per that archetype's init rules
	
		set active every entity of that archetype
	}

```


### Avoiding the use of counts to decide entity type

Last time, we did this in our entity definition and initialisation loop:

```
for (let e = 0; e < ENTITIES_COUNT; e++)
{
	//define the object (structure) of each element of the entity-component table.
	transforms [e] = structuredClone(transformPrototype);
	motions    [e] = structuredClone(motionPrototype);
	turrets    [e] = structuredClone(turretPrototype);
	trackLefts [e] = structuredClone(trackPrototype);
	trackRights[e] = structuredClone(trackPrototype);
	
	if (e < TANKS_COUNT) //it will be a tank
	{
		transforms[e].isActive = true;
		initTransformTank(transforms[e], e);
		
		...
		
	}
```

Because we don't want to fully define all entities as a list of data yet, and would rather just randomly generate them for now, this is OK, we're just saying that the first `TANKS_COUNT` are tanks, not bullets. (We may want to address this later, but it's fine for now.)

However, what is not fine is this hack:


```
function renderEntities()
{
	...
	
	for (let e = 0; e < ENTITIES_COUNT; e++)
	{
		...
		
		if (e < TANKS_COUNT) //HACK!
		{
			if (transforms[e].isActive)
			{
```

A good ECS should never assume specifics about ranges within mutable lists or arrays, so using `if (e < TANKS_COUNT)` here is terrible architecture. An entity's _archetype_ should be based purely on what we observe about the `isActive` states of its various components.

To change this, we'll rather check whether the `hull` is active, since this is a component that will be unique to tanks and cannot be active if the tank is still "alive" (driving around).

```
	for (let e = 0; e < ENTITIES_COUNT; e++)
	{
		...
		
		if (hulls[e].isActive) //much better.
		{
			if (transforms[e].isActive)
			{
```

###



### Result

![part2_tiny_tanks.png](https://ucarecdn.com/c204fb62-5e6d-43b5-afc4-87980adc47f1/)

The final code can be found on [github](https://github.com/ArcaneEngineer/ECS-tutorials).

## Conclusion



...

In the next lesson, we will look at pre-filtering our global entities list into sub-lists by component type. This will reduce the number of (nested) conditional branches where we perform our game logic, by moving these out into a pre-step.

The performance impact of this should be evident when dealing with thousands of entities.

