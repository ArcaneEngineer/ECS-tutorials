Previously, we set up a trivial example game called Tiny Tanks, that demonstrates Entity-Component System (ECS) basics, while using only C-like Javascript, i.e. we wrote the code without involving _OOP inheritance hierarchies_ of any kind.

We did so because OOP inheritance is the most frequent and major stumbling block for many newcomers to ECS. We aim to continue along that path in this part, while further evolving our ECS.

## Technical overview

In [part 1](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part1.md), we used only simple data: a single value for each component, for example the speed of each track contributed to the position of the whole tank (well actually, the hull).

In part 2, we will elaborate our ECS further by adding the following aspects to the code.

1. Complex components using `object` instances.
2. Treating components as _active_ or _inactive_ (in the last part, they were _always active_).

We'll do this by implementing the following gameplay features:

1. Turrets can turn (change heading) as tanks drive straight.
2. Turrets can occasionally fire a bullet according to the heading of their gun.

Our code in this part will grow to over 2.5x the original size (120 -> 300+ lines of code) as we generalise our ECS framework! So be warned, there is some typing ahead.

### How we'll beef up Component data

Do you recall from [part 1](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part1.md), that each component was no more than a single number in the arary of that component type? e.g. in the `hulls` array, at a given index (i.e. for one entity's hull), we had a single value representing the tank's `y` position, and e.g. each `track`'s single value represented its turning speed.

Well, we now need to evolve our ECS: we'll make each component be an `object`, so that it can contain multiple values, allowing for complex components.

Have you noticed that our tank has two tracks, and that they are identical in terms of data? This means they are two `objects` of the same `type` (roughly, a `class`), that is, two instances of something created from the same blueprint.

In C, a tank's `Hull` could be implemented using a `struct`, like so:

```
struct Hull
{
	int16_t position;
	uint8_t health;
	bool isonFire;
}

struct Hull hull; //stack allocated
//OR
struct Hull * hull = malloc(sizeof(struct Hull)); //heap allocated

```

In OOP Javascript, (for now) no such thing as `struct` exists. We _could_ use a `class` instead:

```
class Hull
{
	position = 0;
	health = 0;
	isOnFire = false;
}

let myHull = new Hull();

```

But I'm going to insist that we use copiable `object` literals (`{...}`):

```

let hullPrototype =
{
	position: 0,
	health: 0,
	isOnFire: false
}

let myHull =  structuredClone(hullPrototype);


```

Why use `object` literals + `structuredClone()` rather than `class` + `new Hull()`? Two reasons:

1. **Because I do not want you getting confused by OOP inheritance, and without `class`es, there is no inheritance.** Inheritance is the single main stumbling block of ECS newbies.
2. In C, where ECS had its roots originally, _inheritance doesn't exist_. I want you to learn the C way, so that you can implement an ECS in any language, regardless of whether or not it has OOP. OOP is _not needed_ for ECS, and indeed it is a good exercise for any programmer to learn to write code that is non-OOP.

With `object` literals `{...}` as our [POD](https://en.wikipedia.org/wiki/Passive_data_structure)s, our components from [part 1](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part1.md) would look so:

```
let hull = { y: 0 };
let trackLeft  = { speed: 0 };
let trackRight = { speed: 0 };

```

But we can now add more than one field (data member) to each object literal, meaning our hull can be more complex:

```
let hull =
{
	y: 0, //as from [part 1](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part1.md)

	//plus our new values:
	health: 0, 
    isOnFire: false,
};

```

Naturally, there is an impact: this means the lines of code where we updated our tank's position from its tracks' speed would go from this:

```
	let speed = trackLefts[e] + trackRights[e];
	hulls[e] += speed;
```

...to this:

```
	let speed = trackLefts[e].speed + trackRights[e].speed;
	hulls[e].position += speed;

```

...and in other places in the code, like at component initialisation. You will see this new structure throughout the new code.

## Coding up some ECS enhancements

### Renaming things

If you want to work along with me, you can start by copying `part1`, both the `.js` and `.html` files, and renaming them to `part2`, respectively.

Or (and), assuming you have downloaded the code from github (`git pull` again if not up to date with part 2), you can [diff](https://www.google.com/search?q=to+diff+definition) `part1.js` against `part2.js` so that you can see exactly what has changed.

Let's get started going through the necessary changes from `part1.js`. First, some renames, global find and replace:

- `oneTankTakesItsTurn()` to `updateTurret()` and
- `allTanksTakeTheirTurns()` to `processComponents()`, and
- `renderAllTanks()` to `renderEntities()`, and
- `hull[s]` to `transform[s]`.

Also, duplicate the line `const transforms = new Array(ENTITIES_COUNT)`, and change its copy to
`const motions = new Array(ENTITIES_COUNT);`

It should be clear by the end of this part of the series, why these names are changing.

### Setting up component prototype objects

If you'ved [diffed](https://www.google.com/search?q=to+diff+definition) `part1.js` against `part2.js`, you'll see that the next bit is where we change our constants section a little:

```
//--- Prep essential constants needed for setup ---//

const canvas = document.getElementsByTagName('canvas')[0];
const context = canvas.getContext('2d');

const ENTITIES_COUNT = 12; // How many tanks we have

const GAP_BETWEEN_TANKS = canvas.width / ENTITIES_COUNT;
const SPEED_MAX = 5; // Tanks' tracks' max speed
```

becomes

```
//--- Prep essential constants needed for setup ---//

const canvas = document.getElementsByTagName('canvas')[0];
const context = canvas.getContext('2d');

const TANKS_COUNT = 4;
const BULLETS_COUNT = TANKS_COUNT; //one bullet per tank

const ENTITIES_COUNT = TANKS_COUNT + BULLETS_COUNT; // How many tanks we have
//we will treat the first indices as the tanks, and the last indices as their bullets.

const GAP_BETWEEN_TANKS = canvas.width / TANKS_COUNT;
const BULLET_RADIUS = 3;

```

As we now need one bullet per tank in addition to the tanks themselves, we are doubling the size of the array. We will store all tanks first, then all bullets afterward, in the same order, as per the tank that owns that bullet. e.g. for 4 tanks total,
- tank [0] has a bullet at index 4+0=[4]
- tank [1] has a bullet at index 4+1=[5]
- tank [2] has a bullet at index 4+2=[6]
etc.

Directly after those lines, we have a bunch of new constants that will be used for (randomly) initialising components per individual tank, each of these pairs (`*MIN`..`*MAX`) forms a numeric _range_:

```
const HULL_HEALTH_MIN = 0;
const HULL_HEALTH_MAX = 10;

const TURRET_ANGLE_MIN = 0;
const TURRET_ANGLE_MAX = 2 * Math.PI;

const TURRET_RELOADTIME_MIN = 10;
const TURRET_RELOADTIME_MAX = 30;

const TURRET_GUNPOWER_MIN = 7;
const TURRET_GUNPOWER_MAX = 20;

const TRACK_SPEED_MIN = 1;
const TRACK_SPEED_MAX = 5;
```

Next, we set up our component types:

```
//--- Declare component (proto)types ---//

const transformPrototype = 
{
	isActive: false,
	
	x: 0,
	y: 0,
}

const motionPrototype = 
{
	isActive: false,
	
	dx: 0,
	dy: 0,
}

const turretPrototype =
{
	isActive: false,
	
	angle: 0, //in radians
	reloadTime: 0, //time it always takes this tank to reload
	reloadCountdown: 0, //time until current reload completes
	
	gunPower: 0
}

const trackPrototype =
{
	isActive: false,
	
	speed: 0
}
```

Because we used arrays of plain JS `Number` in [part 1](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part1.md), we didn't need any of this. But now, we need -- and have -- a schema which describes the data in each new component we will use. (Of course, it would be better if these were strictly typed as in C or TypeScript, but this is descriptive enough for now.)

It is key to note that each of these component prototypes includes an `isActive` member. (If we were using OOP, we could specify this member as required by an `interface` or `trait`; but what we have here will suffice, as long as we remember to include this member on each new component prototype that we create in the future.)

### Component initialisation functions

Firstly, an important function will be shared by the various component initialiser functions:

```
function lerp(min, max, t)
{
	let diff = max - min;
	return min + diff * t;
}
```

The `lerp` or "linearly interpolate" function is simple: by taking a range (`min` and `max`) and a value `t` whose value is always between `0.0` and `1.0`, we get back a number that is a `t`-th fraction between `min` and `max`.  So if we called `lerp(5, 10, 0.2)`, we would get back a value of `6`, which is 20% (or as a fraction, `0.2`) between 5 and 10. If you look at the arithmetic, it is easy to understand.

The initialisation functions that use `lerp`, are as follows:

```
function initTransformTank(transform, e)
{
	transform.x = parseInt((GAP_BETWEEN_TANKS * e) + GAP_BETWEEN_TANKS / 2);
}

function initTurret(turret)
{
	turret.angle = parseInt( lerp(TURRET_ANGLE_MIN, TURRET_ANGLE_MAX, Math.random()) );
	turret.angleDelta = (Math.random() - 0.5) / 5; //range: -0.1 .. +0.1 radians
	turret.reloadTime = parseInt( lerp(TURRET_RELOADTIME_MIN, TURRET_RELOADTIME_MAX, Math.random()) );
	turret.reloadCountdown = turret.reloadTime;
	turret.gunPower = parseInt( lerp(TURRET_GUNPOWER_MIN, TURRET_GUNPOWER_MAX, Math.random()) );
}

function initTrack(track)
{
	track.speed = parseInt( lerp(TRACK_SPEED_MIN, TRACK_SPEED_MAX, Math.random()) );
}
```

As you can see, some of these `init*` functions take the `MIN` and `MAX` ranges we already set up, and uses them to derive values that are a randomly set within each range. These ranges allow the simulation to look fairly normal when its running.

Notice that `parseInt()` is used to round down to an integer value where desired, rather than using `Math.random()`'s default floating point output. (Using integers also makes numbers more readable in the browser console using `console.log()`, which is useful when programming in JS).

On the other hand, you will notice that one member, `turret.reloadCountdown`, is actually set from a pre-initialised value on the same component, `turret`.

Lastly, notice that not every component type _has_ an initialisation function. From the perspective of our ECS, these are entirely optional, and depend on what -- if anything -- you need to do to your components at startup.

### Components Initialisation: Overhauling the exiting Loop

We're going to gut our [part 1](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part1.md) initialisation loop, which was tiny:

```
// Populate arrays for components of all tanks.
for (let e = 0; e < ENTITIES_COUNT; e++)
{
	hulls      [e] = 0; //start line position.
	trackLefts [e] = Math.floor(Math.random() * SPEED_MAX);
	trackRights[e] = Math.floor(Math.random() * SPEED_MAX);
	
	...
}
```

And replace it with this:

```
// Populate arrays for components of all tanks.
for (let e = 0; e < ENTITIES_COUNT; e++)
{
	//set up the whole 2D array of components-by-entities:
	transforms [e] = structuredClone(transformPrototype);
	motions    [e] = structuredClone(motionPrototype);
	turrets    [e] = structuredClone(turretPrototype);
	trackLefts [e] = structuredClone(trackPrototype);
	trackRights[e] = structuredClone(trackPrototype);
	
	if (e < TANKS_COUNT) //it will be a tank
	{
		transforms[e].isActive = true;
		initTransformTank(transforms[e], e);
		
		motions    [e].isActive = true;
		//do not init motion here, instead calculate it from the tracks, each tick.
		
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

Right, _that's_ interesting.

The first part, outside of the if block, sets up each component in every component type array, thereby ensuring all are usable, _even if (at runtime) they are never used_. This is central to the way ECS operates. Note that in C, we would never need these `structuredClone` lines -- zeroed structs automatically exist once an array is allocated on the heap or stack. In JS however, we carefully define the object structure of each element of the 2D entity-component table (the rows of which are the component arrays themselves, and the columns of which are the individual entity indices), or ekse we will be referencing into `undefined` objects, which causes the program to error when it is run. 

In either case, C or JS, we'd still need functions to initialise our objects to the desired starting values, however.

You will notice not only the new way of setting up each component using `structuredClone(prototype)`, but also how we set `isActive` to `true` explicitly on each component where that is required:

1. if an entity will be a tank, it has its `transform` (position), `motion`, `turret`, and each `track` set active.

2. if an entity will be a bullet, then _nothing_ is set active initially.

Why is this? Because bullets aren't active to start with. We neither want to process them nor see them until a bullet is fired by one or more tanks. They basically don't exist in our simulation until then. For a good example of this, see how bullet rendering is processed, further down, in `renderEntities()`.

### Running Game logic over complex components

Now for a very important step in our ECS' evolution. Our global ECS processing function changes from this:

```
function allTanksTakeTheirTurns() 
{
    //process each entity in our game
    for (let e = 0; e < ENTITIES_COUNT; e++)
    {
        oneTankTakesItsTurn(
			e,
            hulls,
            turrets,
            trackLefts,
            trackRights,
        );
    }
}
```

to this:

```
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

We see the same old loop over all entities (component indices), but the logic _inside_ the loop has changed completely. The magic here is that `updateTransform()` is no longer entity-type specific. _It is applicable to any kind of entity_ (all entities need at least a `transform` in a typical ECS).

Looking at the first `if` block, we check the `isActive` status of various component arrays, `transforms` and `motions`, to see whether we can, in fact, move our current entity `e`.

In the second `if` block, we check whether the current entity `e` has an active `turret`, and if it does, we call that `turret` to update, potentially firing a bullet, or at least reducing the firing countdown until we can shoot again.

Now let's look at these two new functions called inside that loop. `updateTurret` was formerly `oneTankTakesItsTurn` in [part 1](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part1.md), but we've taken out the tank movement logic and moved it into a separate funtion, `updateTransform`:

```
function updateTurret(e)
{
	let yOld = transforms[e].y;
	let speed = trackLefts[e].speed + trackRights[e].speed;
	let tankTransform = transforms[e];
	tankTransform.y += speed;
	let tankMotion = motions[e];
	let turret = turrets[e];
	
	turret.angle += turret.angleDelta;
	
	turret.reloadCountdown--;
	
	//shoot if we can
	if (turret.reloadCountdown == 0)
	{
		//spawn new bullet
		console.log(e, 'says bang!');
		let bulletTransform = transforms[TANKS_COUNT+e];
		let bulletMotion    = motions   [TANKS_COUNT+e];
		bulletTransform.x = tankTransform.x;
		bulletTransform.y = tankTransform.y;
		
		//normalised muzzle velocity (vec length = 1.0, i.e. on unit circle)
		let muzzleDx = -Math.sin(turret.angle);
		let muzzleDy = Math.cos(turret.angle);
		
		//muzzle velocity with multiplier applied
		muzzleDx *= turret.gunPower;
		muzzleDy *= turret.gunPower;
		
		//final bullet velocity = tank velocity + muzzle velocity
		//"muzzle velocity" is the speed of a bullet as it leaves the gun barrel, relative to the barrel.
		bulletMotion.dx = tankMotion.dx + muzzleDx;
		bulletMotion.dy = tankMotion.dy + muzzleDy;
		
		bulletTransform.isActive = true;
		bulletMotion   .isActive = true;
		
		turret.reloadCountdown = turret.reloadTime;
	}
	
	console.log("y position of tank", e, "was", yOld, "and is now", transforms[e].y, "due to the speed of its tracks.");
	
	//...component values are used to derive other, new component values,
	//thereby advancing the simulation.
}

function updateTransform(e)
{
	let transform = transforms[e];
	let motion = motions[e];
	
	transform.x += motion.dx;
	transform.y += motion.dy;
}
```

You can see that each of these methods has a very specific scope and purpose -- they each relate to different aspects of the tank's form and its operation. That is, to its component _composition_.

So, bullets eh? How will we process them? The second function  `updateTransform()` shows the entirety of what happens for bullets. It applies a basic equation of motion (velocity without acceleration) to each entity's position (`transform`), each tick of the simulation. This is another example of _inter-component, intra-entity_ interaction. In part 3, we will look also at _inter-entity_ interactions.

Most interestingly, this  `updateTransform()`  is used _for both tanks and bullets_, with no knowledge of the other differences between them. It could be used for any other type of moving entity we can dream up, too. This is a strength of [composition-based]() systems like ECS. 

As it happens, the conditional logic in our new `processComponents()` ECS master function neatly handles things for us: It carefully selects components that are applicable to the two different kinds of processing represented by `updateTransform` vs. `updateTurret` respectively. We will not ask a tank's `transform` to fire a bullet, nor will we ask a `turret` to move along a straight line. Instead, we process according to what kind of entity we have in hand. In future, we will generalise this code even further.

### Running Rendering logic over complex components

Finally, we're going to need to update how we render things. All we really do here is set up a nested `if` block to catch whether this is a tank or a bullet. If it's a tank, the logic is largely the same as in [[part 1](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part1.md)](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part1.md). If it's a bullet, there is a small new block of logic to draw it differently from how we draw tanks, of course.

```
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
### Drawing transforms explanation

Some explanation of the drawing function is due, as this was promised (in a code comment) in [part 1](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part1.md).

The HTML5 `canvas`'s `context` object is a stateful object which remembers what kind of spatial transforms we have applied to it. These transforms are stacked up so that we can apply one _or more_ transforms (positioning, rotational) before drawing a given element (shape or text or image), after which we can pop the topmost transform off the stack wof transformations.

Concrete explanation: before drawing each tank (any of it, body or turret) we save the current context (which is the default context lacking any specific transformations, i.e. the represented by an identity matrix) and then immediately `translate()` to the tank's position. We draw the tank's body, then we save _this_ context (i.e. where we are translated to the tank's position _only_) and then apply another transform by `rotate()`ing as per the turret's current rotation. We then draw the turret (which appears rotated), and when finished, we do `context.restore()` which pops the turret's rotation off the stack, and restores us back to the last saved 2D transformation state (which was where we had `translate()`d to the tank's position, _only_). We could now, if we chose, draw other parts of the tank's _body_ without them being rotated like the turret was. Finally, after a whole tank is drawn, we `restore()` to the default context  state that has _no_ transformations, and move onto the next tank,  `translate()` to it's specific position, and so on.

### How it looks

You should now be able to 

## Conclusion

This has been our first look at how an ECS can do selective processing on components, in either simluation (game) logic and in rendering logic. Hopefully you begin to see how enity composition can do the same or more, and indeed more easily (without deep inheritance hierarchies), than restrictive and fragile OOP approaches that some programmers use to do entity management.

In future parts, we will look at how we can do this even more efficiently, by breaking the global entities list we're using now (of all indices into the various components arrays, regardless of entity type, be it tank or bullet) down into smaller sub-lists, suitable for different kinds of processing.

In the next part, we're going to see how we can generalise our ECS even further, avoiding any component-specific logic or references in our main ECS processing function.