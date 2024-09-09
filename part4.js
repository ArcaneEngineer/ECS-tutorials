//--- Prep essential constants needed for setup ---//

const canvas = document.getElementsByTagName('canvas')[0];
const context = canvas.getContext('2d');

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

//--- Declare lerp function ---//

function lerp(min, max, t)
{
	let diff = max - min;
	return min + diff * t;
}

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

function funcNull(component, data) {} //"null pattern"


//--- Set up Entities as groups of Components ---//
	
// Set up arrays representing tank entities.
// Notice how we divide the entities' components across multiple arrays.
// This is not like typical OOP Entities / GameObjects!
const transforms  = new Array(ENTITIES_COUNT);
const motions     = new Array(ENTITIES_COUNT);
const turrets     = new Array(ENTITIES_COUNT);
const trackLefts  = new Array(ENTITIES_COUNT);
const trackRights = new Array(ENTITIES_COUNT);

//--- Components ---///

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
	{init: initTransform, prototype: transformPrototype, array: transforms},
	{init: funcNull,      prototype: motionPrototype,    array: motions},
	{init: initTurret,    prototype: turretPrototype,    array: turrets},
	{init: initTrack,     prototype: trackPrototype,     array: trackLefts},
	{init: initTrack,     prototype: trackPrototype,     array: trackRights},
];


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

// Initialise conditionally depending on each entity's given archetype.
for (let e = 0; e < ENTITIES_COUNT; e++)
{
	let entityArcheTypeIndex = entitiesRawData[e].archeType;
	let entityArcheType      = entityArcheTypes[entityArcheTypeIndex];
	
	for (let c of entityArcheType)//.componentDeps)
	{
		let component = componentsByIndex[c];
		component.init(component.array[e], entitiesRawData[e][c]);
		component.array[e].isActive = true;
	}
}

//--- Game logic ---//

function updateMotionFromTracks(e)
{
	let tankMotion = motions[e];
	tankMotion.dy = trackLefts[e].speed + trackRights[e].speed;
}

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
	let transform = transforms[e];
	let motion = motions[e];
	
	transform.x += motion.dx;
	transform.y += motion.dy;
}

//Systems are listed in the order in which they will run.
const systems = 
[
	{update: updateMotionFromTracks, componentDependencies: [COMPONENT.MOTION, COMPONENT.TRACK_LEFT, COMPONENT.TRACK_RIGHT]},
	{update: updateTransform, componentDependencies: [COMPONENT.TRANSFORM, COMPONENT.MOTION]},
	{update: updateTurret   , componentDependencies: [COMPONENT.TRANSFORM, COMPONENT.MOTION, COMPONENT.TURRET]},
	//{update: renderTank     , componentDependencies: [COMPONENT.TRANSFORM, COMPONENT.TURRET]},
];

function systemDependenciesMetByEntity(system, e)
{
	let depsMet = true; //assume true until proven false
	for (let c of system.componentDependencies)
	{
		depsMet = depsMet && componentsByIndex[c].array[e].isActive;
	}
	return depsMet;
}

//Our ECS function.
function processComponents() 
{
	for (let system of systems)
	{
		for (let e = 0; e < ENTITIES_COUNT; e++)
		{
			if (systemDependenciesMetByEntity(system, e))
			{
				system.update(e);
			}
		}
	}
}

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

//--- Game Loop ---//

let turn = 0;
function updateGameLogic()
{
	console.log("Processing turn", turn, "...");
	
	processComponents(); //call our ECS to process everything.
	renderEntities();
	
	turn++;
}

renderEntities();

document.addEventListener('keyup', event => { if (event.code === 'Space') updateGameLogic(); })