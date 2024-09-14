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
	
	static setUpComponents(componentTypesByIndex)
	{
		for (let componentType of componentTypesByIndex)
		{
			const component = {init: componentType.init, prototype: componentType.prototype, array: new Array(ENTITIES_COUNT)};
			
			ECS.componentsByIndex.push(component);
		}
	}
}

//--- Constants ---//

const canvas = document.getElementsByTagName('canvas')[0];
const context = canvas.getContext('2d');
const colors = ["red", "green", "blue", "cyan", "magenta", "yellow"];

const TANKS_COUNT = 4;
const BULLETS_COUNT = TANKS_COUNT; //one bullet per tank

const ENTITIES_COUNT = TANKS_COUNT + BULLETS_COUNT;
//treat the first indices as the tanks, and the last indices as their bullets, in the same order.

const GAP_BETWEEN_TANKS = canvas.width / TANKS_COUNT;

const BULLET_RADIUS = 3;

const TURRET_ANGLE_MIN = 0;
const TURRET_ANGLE_MAX = 2 * Math.PI;
const TURRET_RELOADTIME_MIN = 10;
const TURRET_RELOADTIME_MAX = 30;
const TURRET_GUNPOWER_MIN = 7;
const TURRET_GUNPOWER_MAX = 20;
const TRACK_SPEED_MIN = 1;
const TRACK_SPEED_MAX = 5;

const HULL_WIDTH = 28;
const HULL_HEIGHT = 34;

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
};

//--- Systems functions (only) ---//

function updateMotionFromTracks(e)
{
	let trackLefts  = ECS.componentsByIndex[COMPONENT.TRACK_LEFT ].array;
	let trackRights = ECS.componentsByIndex[COMPONENT.TRACK_RIGHT].array;
	let motions = ECS.componentsByIndex[COMPONENT.MOTION].array;
	let tankMotion = motions[e];
	tankMotion.dy = trackLefts[e].speed + trackRights[e].speed;
}

function updateTurret(e)
{	
	let turrets = ECS.componentsByIndex[COMPONENT.TURRET].array;
	let turret = turrets[e];
	
	turret.angle += turret.angleDelta;
	
	turret.reloadCountdown--;
	
	//shoot if we can
	if (turret.reloadCountdown == 0)
	{
		let transforms = ECS.componentsByIndex[COMPONENT.TRANSFORM].array;
		let tankTransform = transforms[e];
		let motions = ECS.componentsByIndex[COMPONENT.MOTION].array;
		let tankMotion = motions[e];
		
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
}

function updateTransform(e)
{
	let transforms = ECS.componentsByIndex[COMPONENT.TRANSFORM].array;
	let transform = transforms[e];
	let motions = ECS.componentsByIndex[COMPONENT.MOTION].array;
	let motion = motions[e];
	
	transform.x += motion.dx;
	transform.y += motion.dy;
}

function renderHull(e)
{
	let transforms = ECS.componentsByIndex[COMPONENT.TRANSFORM].array;
	
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

function renderTurret(e)
{
	let transforms = ECS.componentsByIndex[COMPONENT.TRANSFORM].array;
	let transform = transforms[e];
	let turrets = ECS.componentsByIndex[COMPONENT.TURRET].array;
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

function renderBullet(e)
{
	let transforms = ECS.componentsByIndex[COMPONENT.TRANSFORM].array;
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

//--- Components ---//

//must be specified in desired order of processing!

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

ECS.setUpComponents(componentTypesByIndex);

//--- Archetypes ---//

const ARCHETYPE = 
{
	NONE: 0,
	TANK: 1,
	BULLET: 2,
};

ECS.entityArcheTypes = 
{
	[ARCHETYPE.TANK  ] : [COMPONENT.TRANSFORM, COMPONENT.MOTION, COMPONENT.TURRET,
						  COMPONENT.TRACK_LEFT, COMPONENT.TRACK_RIGHT, COMPONENT.HULL],
	[ARCHETYPE.BULLET] : [COMPONENT.TRANSFORM, COMPONENT.MOTION, COMPONENT.PAYLOAD],
};

//--- Systems (funtions + their dependencies) ---//

//Systems are listed in the order in which they will run.
ECS.systems = 
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

//--- Prepped / loaded entity data ---//

//TODO	we could also just populate this procedurally by range.
//		it really doesn't matter as this represents arbitrary, loaded user or save data.
//		can hold loaded or generated data for all tanks, could be loaded JSON.
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

//--- Kick off processing ---//

ECS.populateComponentArrays();
ECS.initialiseComponentArrays(entitiesRawData);
ECS.processComponents(); //to ensure initial render.
	
document.addEventListener('keyup', event => { if (event.code === 'Space') gameLoop(); })