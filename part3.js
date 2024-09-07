//--- Prep essential constants needed for setup ---//

const canvas = document.getElementsByTagName('canvas')[0];
const context = canvas.getContext('2d');

const TANKS_COUNT = 4;
const BULLETS_COUNT = TANKS_COUNT; //one bullet per tank

const ENTITIES_COUNT = TANKS_COUNT + BULLETS_COUNT;
//treat the first indices as the tanks, and the last indices as their bullets, in the same order.

const GAP_BETWEEN_TANKS = canvas.width / TANKS_COUNT;

const BULLET_RADIUS = 3;

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

const hullPrototype =
{
	isActive: false,
	
	isOnFire: false,
	health: 0
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

function initTransformTank(transform, e)
{
	transform.x = parseInt((GAP_BETWEEN_TANKS * e) + GAP_BETWEEN_TANKS / 2);
}

function initHull(hull)
{
	hull.health = parseInt( lerp(HULL_HEALTH_MIN, HULL_HEALTH_MAX, Math.random()) );
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

//--- Set up Entities as groups of Components ---//
	
// Set up arrays representing tank entities.
// Notice how we divide the entities' components across multiple arrays.
// This is not like typical OOP Entities / GameObjects!
const transforms  = new Array(ENTITIES_COUNT);
const motions     = new Array(ENTITIES_COUNT);
const hulls       = new Array(ENTITIES_COUNT);
const turrets     = new Array(ENTITIES_COUNT);
const trackLefts  = new Array(ENTITIES_COUNT);
const trackRights = new Array(ENTITIES_COUNT);

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

//--- Game logic ---//

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