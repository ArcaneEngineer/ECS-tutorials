# ENTITY COMPONENT SYSTEMS: Part 5

[Last time](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part4.md),
, I stated that our ECS had been completely generalised.

Well, that is not quite true! We have yet to ECS-ify our rendering logic.

## Technical overview

We will treat rendering as a separate _phase_ of ECS processing. Our existing ECS functions from part 4, will support us in this endeavour. We'll just need to add some new systems to leverage those functions.

To the `TANK` and `BULLET` archetypes, we'll add some new components. These will serve two purposes: 

- differentiating our archetypes further (at the moment, `BULLET` is very generic, having only `transform` and `motion` components), and 
- setting the scene for new game logic in a future part of this series.

## Writing the Code

Rather than rendering being hardcoded in our main game loop, as we had it before, the root of systematising rendering begins here:

```
function gameLoop()
{
	console.log("Processing turn", turn, "...");
	
	processComponents(); //call our ECS to process everything.
	renderEntities();
	
	turn++;
}

renderEntities();
```

Go ahead and change that to:

```
function gameLoop()
{
	console.log("Processing turn", turn, "...");
	
	processComponents(); //call our ECS to process everything.
	
	turn++;
}

processComponents();
```



### Adding new components

We'll need a couple of new components, one for the tank, and one for the bullet. Actually, one has been talked about in the past, but has been missing for a while: the tank's hull.

```
const hullPrototype =
{
	isActive: false,
	
	health: 0
}
```

Let's also create a way to say damage a bullet can do, and of what type the charge is (incendiary or armour-penetrating). This will help with our game logic when a bullet hits, which we'll handle in a future part of this series.

For now, in fact we just want a valid prototype that differentiates a bullet from a tank:

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

These are _almost_ ready for use in our update and rendering loops. However, later in this tutorial, we'll set up our entity archtypes which will reference these new components.

Remember that the first archetypes array is used to denote the values (by variable name) in the second array. The second array is what is used to actually construct each entity at initialisation.

```
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

```

These entities and their new components are ready for use by our new ECS _systems_, which we'll implement next.
	
### Systematising rendering code

Our old render code is quite knotty:

```
//--- Draw / Render logic ---//

const HULL_WIDTH = 28;
const HULL_HEIGHT = 34;
const colors = ["red", "green", "blue", "cyan", "magenta", "yellow"];

function renderEntities()
{
	context.fillStyle = "white";
	context.clearRect(0, 0, canvas.width, canvas.height);
	context.fillRect (0, 0, canvas.width, canvas.height);
	
	for (let e = 0; e < ENTITIES_COUNT; e++)
	{
		context.fillStyle = colors[(e % TANKS_COUNT) % colors.length]; //loop the color index
		
		let xPos = transforms[e].x;
		let yPos = transforms[e].y;
		
		context.save();
		context.translate(xPos, yPos);
		
		if (e < TANKS_COUNT) //it is a tank
		{
			if (transforms[e].isActive) //it isn't dead
			{
				let turret = turrets[e];
				
				//draw a line from start transform to current transform.
				context.fillRect( 0, 0,
								  1, -yPos);
				
				//draw the tank's hull at current transform.
				context.fillRect( -HULL_WIDTH/2, -HULL_HEIGHT/2, //start drawing here 
								   HULL_WIDTH,    HULL_HEIGHT); //draw this far from start
				
				context.save(); //before drawing turret
				context.rotate(turret.angle);
			
				//draw the tank's turret.
				context.beginPath();
				context.arc(0,0, HULL_WIDTH/2, 0, 2 * Math.PI); //turret
				context.rect( -HULL_WIDTH/8, HULL_WIDTH/2,
							   HULL_WIDTH/4, HULL_WIDTH/2); //gunbarrel
				context.closePath();
				context.stroke();
				context.fill();
				
				context.restore(); //after drawing turret
			}
		}
		else //it is a bullet
		{
			if (transforms[e].isActive) //it isn't dead
			{
				context.beginPath();
				context.arc(0,0, BULLET_RADIUS, 0, 2 * Math.PI); //turret
				context.closePath();
				
				//context.fillStyle = "black"; //colors[e % colors.length]; //loop the color index
				context.fill();
			}
		}
		
		context.restore(); //after drawing whole tank OR bullet OR any other entity type.
	}
}
```

OK, it is more than knotty, it's horrific. Why?

- We are mixing the rendering of numerous types of entities by using nested `if-else` blocks. At best, if we insist on using conditionals inside this function, it should be a flat `switch` statement without nesting.
- Our code uses `if (e < TANKS_COUNT)` then it is a tank, `else` it is a bullet. This means we are relying on specific ranges in our entity-components arrays to decide what type an entity is.
- We are checking `.isActive`, which should now be the job of `processComponents()` via its call to `systemDependenciesMetByEntity()`.

So let's convert our render from one messy, monolithic function into numerous small and clean systems, one per component type being rendered.
 
Start by deleting the old `renderEntities()` entirely. Our new systems will replace it.

#### Bullets rendering system

Let's start with bullets, as they are small and simple, then we'll reuse this experience for the rendering the tank and its turret.

```
function renderBullet(e)
{
	let transform = transforms[e];
	
	context.fillStyle = colors[(e % TANKS_COUNT) % colors.length]; //loop the color index
	
	context.save();
	context.translate(transform.x, transform.y);
	
	context.beginPath();
	context.arc(0,0, BULLET_RADIUS, 0, 2 * Math.PI); //turret
	context.closePath();
	
	context.fill();
	
	context.restore();
}
```

As you can see, the conditionals we had before have been completely eliminated. This is because the way we set up our archetypes and process them via `processComponents()`, will fulfill any component dependencies we need to know that entity `[e]` is, in fact, a bullet. We no longer need to check `.isActive` here. Also, because a bullet is clearly a bullet by the fact that it has a `PAYLOAD`, we can be sure that we are drawing a bullet.

We save the drawing context, translate to the bullet's position, then draw it, then restore the drawing context (as future calls to draw will need the "identity matrix" context without any transformations applied).

Create a new system _at the top_ of our `systems` array, that references `renderBullet`:

```
//Systems are listed in the order in which they will run.
const systems = 
[
	//render systems
	{update: renderBullet   , componentDependencies: [COMPONENT.TRANSFORM, COMPONENT.PAYLOAD]},

	//simulate (game logic) systems
	{update: updateMotionFromTracks, ...
	...
]
```


#### Hull rendering system

Similarly, let's render the hull of the tank. This is much the same as the code in the original `renderEntities()`, but we have stripped out the turret-drawing part. Notice, again, no conditionals:

```
function renderHull(e)
{
	let transform = transforms[e];
	
	context.fillStyle = colors[(e % TANKS_COUNT) % colors.length]; //loop the color index
	
	context.save(); //before translation
	context.translate(transform.x, transform.y);
		
	//draw line from start to current position.
	context.fillRect( 0, 0,
					  1, -transform.y);
	
	//draw hull at current position.
	context.fillRect( -HULL_WIDTH/2, -HULL_HEIGHT/2, //start drawing here 
					   HULL_WIDTH,    HULL_HEIGHT); //draw this far from start

	context.restore(); //undo translation
}
```

Like the bullet, we save the context, then translate to the hulls's position, then restore the saved drawing context. Simple.

Create another new system _at the top_ of our `systems` array, that references `renderHull`:

```
//Systems are listed in the order in which they will run.
const systems = 
[
	//render systems
	{update: renderBullet   , componentDependencies: [COMPONENT.TRANSFORM, COMPONENT.PAYLOAD]},
	{update: renderHull     , componentDependencies: [COMPONENT.TRANSFORM, COMPONENT.HULL]},
	
	//simulate (game logic) systems
	{update: updateMotionFromTracks, ...
	...
]
```

#### Turret rendering system

Lastly, for the turret, again we have no conditionals, it's a simple, flat code structure:

```
function renderTurret(e)
{
	let transform = transforms[e];
	let turret = turrets[e];
	
	context.fillStyle = colors[(e % TANKS_COUNT) % colors.length]; //loop the color index
	
	context.save(); //before translation
	context.translate(transform.x, transform.y);

	context.save(); //before rotation
	context.rotate(turret.angle);
	
	context.beginPath();
	context.arc(0,0, HULL_WIDTH/2, 0, 2 * Math.PI); //turret
	context.rect( -HULL_WIDTH/8, HULL_WIDTH/2,
				   HULL_WIDTH/4, HULL_WIDTH/2); //gunbarrel
	context.closePath();
	context.stroke();
	context.fill();
	
	context.restore(); //undo rotation
		
	context.restore(); //undo translation
}
```

This time we save the context, translate to the turret's position, save the context again, rotate to the turret's angle, draw, then restore _twice_ to get back completely clear up the drawing context back to its original state. Remember that the drawing context works like a [stack] whenever we `save()` and `restore()` (push and pop), that is, if we saved twice, we must restore twice.

Create our final new system _at the top_ of our `systems` array, that references `renderTurret`:

```
//Systems are listed in the order in which they will run.
const systems = 
[
	//render systems
	{update: renderBullet   , componentDependencies: [COMPONENT.TRANSFORM, COMPONENT.PAYLOAD]},
	{update: renderHull     , componentDependencies: [COMPONENT.TRANSFORM, COMPONENT.HULL]},
	{update: renderTurret   , componentDependencies: [COMPONENT.TRANSFORM, COMPONENT.TURRET]},
	
	//simulate (game logic) systems
	{update: updateMotionFromTracks, ...
	...
]
```

### Result

Since what we did was _almost_ pure refactoring, if we now run the code, the output does not differ (the only difference being that the simulation starts advanced by one tick) from parts [2](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part2.md), [3](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part3.md), and [4](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part4.md). While it looks the same, we have made _many_ improvements since part 2!

![part2_tiny_tanks.png](https://ucarecdn.com/c204fb62-5e6d-43b5-afc4-87980adc47f1/)

However, although the end result _looks_ exactly the same, note that we advanced the simulation at the end of the very first frame in our call to `processComponents()` outside the game loop. Thus, _this was not pure refactoring_, since we subtly changed the program's behaviour.

The final code can be found on [github](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part4.js).


## Conclusion

We've seen how to generalise our entire ECS, from initialisation through to game logic _and_ render updates, by treating rendering as a set of additional systems (`hull`, `turret`, and `bullet` / `payload`). While this is not the only way to approach rendering, it does give a simple example of how versatile systems can be.

All those conditionals we previously had in the `renderEntities()` function we deleted, have been replaced by functionality provided by `processComponents()` via its call to `systemDependenciesMetByEntity()`. This makes our game's code far easier to reason about.

This is _beginning_ to look like a real ECS, although there is no shortage of improvements still to be made,

In the next part, we will look at how we can better organise our code, and we'll add the ability for tanks' bullets to hit other tanks!