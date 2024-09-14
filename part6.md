# ENTITY COMPONENT SYSTEMS: Part 6

[Last time](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part5.md), we had our ECS completely generalised.

In this lesson, we will look at encapsulating ECS-specific logic and collections, while thoroughly cleaning up the rest of our single-file project script.

## Technical overview

For each part of this tutorial series, I prefer to keep source code in a _single_ `.js` file.

Because of this, organisation using blocks of code (`{...}`) is important; without these, you cannot use your favourite editor (VS Code, Notepad++, or what have you) to focus on the relevant code via [_code folding_](https://en.wikipedia.org/wiki/Code_folding). As our source file has become quite long, this has become urgent. This refactoring will allow us to move more quickly in future tutorials, instead of scrolling through reams of code.

As usual, I suggest downloading the project from [github](https://github.com/ArcaneEngineer/ECS-tutorials) and using a [diff](https://www.google.com/search?q=diff+meaning) tool to compare [`part5.js`](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part5.js) against [`part6.js`](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part6.js). I love using [kdiff3](https://kdiff3.sourceforge.net/) -- it allows 3-way diffs. The diff between parts 5 and 6 is substantial, as much code is reorded, or nested, in part 6 -- however, aside from a few references in our system functions, the internal logic of functions and the definition of component prototypes has not changed _at all_.

## Refactoring the Code

#### Minor chores

Let's move some `const`ants to the top of our file, to live with the rest:

```
const canvas = document.getElementsByTagName('canvas')[0];
const context = canvas.getContext('2d');
const colors = ["red", "green", "blue", "cyan", "magenta", "yellow"]; // <--- moved
```

And

```
...
const TURRET_GUNPOWER_MAX = 20;
...
const TRACK_SPEED_MAX = 5;

const HULL_WIDTH = 28; // <--- moved
const HULL_HEIGHT = 34; // <--- moved
```

Directly below those, let's put our general purpose functions (or functions that don't qualify as either ECS, component-related, or systems) together in one place, directly below the above `const`ants:

```
//--- General purposes functions ---//

let turn = 0;
function gameLoop()
{
	console.log("Processing turn", turn, "...");
	
	context.fillStyle = "white";
	context.clearRect(0, 0, canvas.width, canvas.height);
	context.fillRect (0, 0, canvas.width, canvas.height);
	
	ECS.processComponents(); //call our ECS to process everything.
	
	turn++;
}

function lerp(min, max, t)
{
	let diff = max - min;
	return min + diff * t;
}

function funcNull(component, data) {} //"null pattern"


```

Right, now we can proceed with the real meat and bones of this refactoring!


#### Components

Let us organise our component prototypes with their related initialisers. This is purely cosmetic, and allows us to do code folding when we need it.

First, let's remove entirely all instances of `*Prototype` (`transformPrototype`, `turretPrototype`, etc.).
Second, let's remove entirely all instances of `init*` (`initTransform`, `initTurret`, etc.).

We will then replace those with this new structure which combines both:

```
//--- Component (proto)types and initialisers ---//

const transform =
{
	prototype:
	{
		isActive: false,
		
		x: 0,
		y: 0,
	},
	
	init: function(transform, data)
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
};

const motion =
{
	prototype:
	{
		isActive: false,
		
		dx: 0,
		dy: 0,
	},
	
	init: funcNull
};

const hull = 
{
	prototype:
	{
		isActive: false,
		
		health: 0
	},
	
	init: funcNull
};

const payload = 
{
	prototype:
	{
		isActive: false,
		
		damage: 0
	},
	
	init: funcNull
};

const turret =
{
	prototype:
	{
		isActive: false,
		
		angle: 0, //in radians
		reloadTime: 0, //time it always takes this tank to reload
		reloadCountdown: 0, //time until current reload completes
		
		gunPower: 0
	},
	
	init: function (turret, data)
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
};

const track =
{
	prototype:
	{
		isActive: false,
	
		speed: 0
	},

	init: function(track, data)
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
}
```

As you can see, each initialiser is now with its associated [POD](https://en.wikipedia.org/wiki/Passive_data_structure) prototype in a kind of organisational "folder" object (`transform`, `hull` etc.). We do not put the initialiser function into the prototype because this function does not need to be copied or take up space for every instantiated data component: it is a single, universal function that is used identically by our ECS, for all entities.

Now, further down the source file, you will recall that we previously had a section about components, which we will change from

```
//--- Set up Entities as groups of Components ---//	
...
const transforms  = new Array(ENTITIES_COUNT);
const motions     = new Array(ENTITIES_COUNT);
const turrets     = new Array(ENTITIES_COUNT);
const trackLefts  = new Array(ENTITIES_COUNT);
const trackRights = new Array(ENTITIES_COUNT);
const hulls       = new Array(ENTITIES_COUNT);
const payloads    = new Array(ENTITIES_COUNT);

//--- Components ---///

const COMPONENT =
{
	TRANSFORM: 0,
	MOTION: 1,
	TURRET: 2,
	TRACK_LEFT: 3,
	TRACK_RIGHT: 4,
	HULL: 5,
	PAYLOAD: 6,
};

const componentsByIndex =
[
	//in each case, we have type info and the data array.
	//these could also be stored in 2 separate arrays.
	{init: initTransform, prototype: transformPrototype, array: transforms},
	{init: funcNull,      prototype: motionPrototype,    array: motions},
	{init: initTurret,    prototype: turretPrototype,    array: turrets},
	{init: initTrack,     prototype: trackPrototype,     array: trackLefts},
	{init: initTrack,     prototype: trackPrototype,     array: trackRights},
	{init: funcNull,      prototype: hullPrototype,      array: hulls},
	{init: funcNull,      prototype: payloadPrototype,   array: payloads},
];

```

We are now going to shorten that to:

```
const COMPONENT =
{
	TRANSFORM: 0,
	MOTION: 1,
	TURRET: 2,
	TRACK_LEFT: 3,
	TRACK_RIGHT: 4,
	HULL: 5,
	PAYLOAD: 6,
};
//...must have the same order as...
const componentTypesByIndex =
[
	transform,
	motion,
	turret,
	track,
	track,
	hull,
	payload
];

for (let componentType of componentTypesByIndex)
{
	ECS.componentsByIndex.push({init: componentType.init, prototype: componentType.prototype, array: new Array(ENTITIES_COUNT));
}
```

As you can see, the loop at the end, sets everything up automatically for each type: the initialiser, the protototype, and the `new Array()` of components.

#### Encapsulating the ECS itself

Let's encapsulate our ECS in a `class`. While you'll recall that I've been very OOP-avoidant thus far in this series -- to avoid ECS newcomers from being confused about how inheritance is used in ECS -- the time has come to change the rules a bit in the name of better organisation.

```
class ECS
{
	static componentsByIndex = [] //gets replaced.
	static entityArcheTypes  = {} //gets replaced.
	static systems = [] //gets replaced.
	
	static processComponents() 
	{
		for (let system of ECS.systems)
		{
			for (let e = 0; e < ENTITIES_COUNT; e++)
			{
				if (ECS.systemDependenciesMetByEntity(system, e))
				{
					system.update(e);
				}
			}
		}
	}
	
	static systemDependenciesMetByEntity(system, e)
	{
		let depsMet = true; //assume true until proven false
		for (let c of system.componentDependencies)
		{
			depsMet = depsMet && ECS.componentsByIndex[c].array[e].isActive;
		}
		return depsMet;
	}
	
	// Populate component data arrays unconditionally for all entities (object instances).
	// In C we could skip this loop, just malloc() array-of-struct correctly and be done.
	static populateComponentArrays()
	{
				//define the object (structure) of each element of the entity-component table.
		for (let c = 0; c < ECS.componentsByIndex.length; c++)
		{
			let component = ECS.componentsByIndex[c];
			let prototype_ = component.prototype;
			let array = component.array;
			for (let e = 0; e < ENTITIES_COUNT; e++)
			{
				array[e] = structuredClone(prototype_);
			}
		}
	}
	
	// Initialise conditionally depending on each entity's given archetype.
	static initialiseComponentArrays(entitiesRawData)
	{
		for (let e = 0; e < ENTITIES_COUNT; e++)
		{
			let entityArcheTypeIndex = entitiesRawData[e].archeType;
			let entityArcheType = ECS.entityArcheTypes[entityArcheTypeIndex];
			
			for (let c of entityArcheType)//.componentDeps)
			{
				let component = ECS.componentsByIndex[c];
				component.init(component.array[e], entitiesRawData[e][c]);
				component.array[e].isActive = true;
			}
		}
	}
}
```

These members, which have migrated into `[class](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/class) ECS`, previously existed in the population and intialisation phase and near the bottom of [`part5.js`](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part5.md). Their contents remain identical. Go ahead and cull the original functions now.

They have lost the keyword `function` (as [ES6 class](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/class) methods must do) and have become [`static`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/static) `class` methods, but otherwise they remain identical. `static` means we will not need to instantiate `class ECS` in order to use them.

Instead, this `class` acts as a kind of singleton, with singleton functions, and some singleton arrays and object literals, all usable as follows:

```
ECS.systems = [...];
...
ECS.processComponents();

```

(Note to Javascript developers: Our goal here is not to worry about private class members, but rather to focus on ECS architecture, which is very much a C-like programming paradigm -- remembering that C lacks access control modifiers entirely.)

The last thing we want to do here is to move the loop we created in the section above, into its own ECS method:

```
for (let componentType of componentTypesByIndex)
{
	ECS.componentsByIndex.push({init: componentType.init, prototype: componentType.prototype, array: new Array(ENTITIES_COUNT));
}
```

This goes into a new method `setUpComponents` at the end of the ECS class, like so:

```
class ECS
{
	...
	
	setUpComponents(componentTypesByIndex)
	{
		for (let componentType of componentTypesByIndex)
		{
			ECS.componentsByIndex.push({init: componentType.init, prototype: componentType.prototype, array: new Array(ENTITIES_COUNT));
		}
	}
}
```

Which we call as follows:

```
...
//...must have the same order as...
const componentTypesByIndex =
[
	transform,
	motion,
	turret,
	track,
	track,
	hull,
	payload
];

ECS.setUpComponents(componentTypesByIndex);

```

...where the loop used to be.

Our ECS is putting on some fat; this is good, as in doing so we are de-cluttering our application's initialisation code!


#### Systems

You'll recall that our systems array in part 5, was as follows:

```
//--- Systems (funtions + their dependencies) ---//

//Systems are listed in the order in which they will run.
const systems = 
[
	//render systems
	{update: renderHull     , componentDependencies: [COMPONENT.TRANSFORM, COMPONENT.HULL]},
	{update: renderTurret   , componentDependencies: [COMPONENT.TRANSFORM, COMPONENT.TURRET]},
	{update: renderBullet   , componentDependencies: [COMPONENT.TRANSFORM, COMPONENT.PAYLOAD]},

	//simulate (game logic) systems
	{update: updateMotionFromTracks, componentDependencies: [COMPONENT.MOTION, COMPONENT.TRACK_LEFT, COMPONENT.TRACK_RIGHT]},
	{update: updateTransform, componentDependencies: [COMPONENT.TRANSFORM, COMPONENT.MOTION]},
	{update: updateTurret   , componentDependencies: [COMPONENT.TRANSFORM, COMPONENT.MOTION, COMPONENT.TURRET]},
];
```

All we'll do is assign this same array onto our `ECS` (replacing the array assigned therein):
```
ECS.systems = //replaces the array object assigned to ECS's initial member
[
	...array contents remain the same...
]
```

This could also have been done via `Array.push()` if you prefer keeping the original array in place.

#### Fixing systems to work with the new ECS

If you run the code now, you should see some errors, as there are some small bumps to address: Because we removed all named `transforms`, `turrets`, `trackLefts` etc., we now have broken references to these in our systems functions.  You can solve this in one of two ways:

(1) Change the references to pull these arrays off the `ECS` itself (where they were stored on population and initialisation). This adds some overhead lines to system functions, but it means we don't need to store multiple references to the same array. For example:

```
function updateMotionFromTracks(e)
{
	let trackLefts  = ECS.componentsByIndex[COMPONENT.TRACK_LEFT ].array;
	let trackRights = ECS.componentsByIndex[COMPONENT.TRACK_RIGHT].array;
	let motions = ECS.componentsByIndex[COMPONENT.MOTION].array;
	let tankMotion = motions[e];
	tankMotion.dy = trackLefts[e].speed + trackRights[e].speed;
}

```

(2) Assign the same names in the global space (i.e.  `window`), from the `ECS`. This way you don't need to update the functions references inside the system functions, because you've got them back. For example, somewhere after calling `populateComponentArrays()`, grab the named references:

```
const transforms = ECS.componentsByIndex[COMPONENT.TRANSFORM].array;
const motions    = ECS.componentsByIndex[COMPONENT.MOTION]   .array;
...etc.

```

I've chosen approach (1), as it eliminates reliance on objects that exist outside the scope of `ECS`. This is probably the better architectural approach as the project grow more complex. Also, it is usually wisest to access data that is identical _from a single source (variable) only_, to avoid potential headaches. In your own projects, it's up to you.

Do this for all the broken component references, which you can find by a combination of looking and hitting F5 to refresh your browser page to test-run the code. Check the various `update*` and `render*` systems, or if you get stuck, have a look at [`part6.js`](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part6.js).

#### Getting it running

At the very end of our code, where we used to have 

```
//--- Game Loop ---//

function gameLoop()
{
	...
}

processComponents(); //to ensure initial render.
	
document.addEventListener('keyup', event => { if (event.code === 'Space') gameLoop(); })
```

...we'll put the following (you'll recall our `gameLoop` function has already been moved somewhere else): 

```
//--- Kick off processing ---//

ECS.populateComponentArrays();
ECS.initialiseComponentArrays(entitiesRawData);
ECS.processComponents(); //to ensure initial render.
	
document.addEventListener('keyup', event => { if (event.code === 'Space') gameLoop(); })
```

### Result

Since what we did was pure refactoring, if we now run the code, the output does not differ from parts [2](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part2.md) through [5](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part5.md).

![part2_tiny_tanks.png](https://ucarecdn.com/c204fb62-5e6d-43b5-afc4-87980adc47f1/)

The final code can be found on [github](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part6.js).

## Conclusion

Finally, our ECS has become a standalone system which, if so desired, could be pasted into it own source file and loaded by our main script, [`part6.js`](https://github.com/ArcaneEngineer/ECS-tutorials/blob/main/part6.js).

The rest of our code has been organised in such a way that it should clear up all doubts about what is what (and thus, what belongs where). While it is by no means the end of the evolution of our ECS, it gives us some elbow room to work with, in future parts.

In the next part, we will look at implementing some new gameplay features.