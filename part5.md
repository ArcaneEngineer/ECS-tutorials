# ENTITY COMPONENT SYSTEMS: Part 5

[Last time](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part4.md),
, I stated that our ECS had been completely generalised.

Well, that is not quite true! We have yet to ECS-ify our renderer logic.

We will further differentiate the `TANK` and `BULLET` archetypes by adding some additional components to them, in preparation for this task. 

## Technical overview

We will begin to treat our renderer as a separate _phase_ of our ECS processing, as set up in the last part. This allows us to generalise rendering, just like any other system, rather than having it hardcoded in our main game loop:

```
function gameLoop()
{
	console.log("Processing turn", turn, "...");
	
	processComponents(); //call our ECS to process everything.
	renderEntities();
	
	turn++;
}
```
 
## Writing the Code

Let's start by adding some new components. These will serve two purposes: differentiating our archetypes further (at the moment, `BULLET` is very generic, having only `transform` and `motion` components), and setting the scene for the next part.

### Adding new components

We'll need a couple of new components, one for the tank, and one for the bullet. Actually, one has been talked about in the past, but has been missing for a while: the tank's hull.

```
const hullPrototype =
{
	isActive: false,
	
	health: 0
}
```

We also need a way to denote how much damage a bullet can do, and of what type the charge is (incendiary or armour-penetrating). This will help with our game logic when a bullet hits.

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


/////////////////////////////////////////////////

const hullPrototype =
{
	isActive: false,
	
	health: 0
}

const payloadPrototype =
{
	isActive: false,
	
	damage: 0
}


const hulls       = new Array(ENTITIES_COUNT);
const payloads    = new Array(ENTITIES_COUNT);


	
	{init: funcNull,      update: funcNull,        prototype:hullPrototype,      array: hulls},
	{init: funcNull,      update: funcNull,        prototype:payloadPrototype,   array: payloads},
	
	
const ARCHETYPE = 
{
	NONE: 0,
	TANK: 1,
	BULLET: 2,
	
	
	HULL: 5,
	PAYLOAD: 6,
};

const entityArcheTypes = 
{
	[ARCHETYPE.TANK  ] : [COMPONENT.TRANSFORM, COMPONENT.MOTION, COMPONENT.TURRET,
						  COMPONENT.TRACK_LEFT, COMPONENT.TRACK_RIGHT, COMPONENT.HULL],
	[ARCHETYPE.BULLET] : [COMPONENT.TRANSFORM, COMPONENT.MOTION, COMPONENT.PAYLOAD],
};

//////////////////////////////////////////////////



### Result

![part2_tiny_tanks.png](https://ucarecdn.com/c204fb62-5e6d-43b5-afc4-87980adc47f1/)

The final code can be found on [github](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part4.js).


## Conclusion

We've seen how to generalise our whole ECS, from initialisation through to game logic updates.

It's worth noting that there are two types of dependencies in our ECS: System dependencies are _not the same_ as entity archetype dependencies, even though they both talk about components. Archetypes just say, "an ideal tank consists of a transform, a motion, a turret, two tracks, and a hull, so we'll initialise it like that". Whereas systems say, "I have some work to do, and I need to know that this entity -- regardless of its original archetype, and in its present state, whatever that may be -- still has the capabilities to do this work".

In the next part, we will add some new components, and generalise our rendering system.
