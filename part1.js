//--- Set up Entities as groups of Components ---//

const ENTITIES_COUNT = 12; // How many tanks we have
const SPEED_MAX = 5; // Tanks' tracks' max speed

// Set up arrays representing tank entities.
// Notice how we divide the entities' components across multiple arrays.
// This is not like typical OOP Entities / GameObjects!
const hulls       = new Array(ENTITIES_COUNT);
const turrets     = new Array(ENTITIES_COUNT);
const trackLefts  = new Array(ENTITIES_COUNT);
const trackRights = new Array(ENTITIES_COUNT);

// Populate arrays for components of all tanks.
for (let e = 0; e < ENTITIES_COUNT; e++)
{
	hulls      [e] = 0; //start line position.
	trackLefts [e] = Math.floor(Math.random() * SPEED_MAX);
	trackRights[e] = Math.floor(Math.random() * SPEED_MAX);
	//...Don't worry about turrets for now, they're not used yet.

	console.log("tank", e, "has position", hulls[e],
	                       "track left  speed", trackLefts [e],
	                       "track right speed", trackRights[e]);
}

//--- Game logic ---//

function oneTankTakesItsTurn(e, hulls, turrets, trackLefts, trackRights)
{
	let hullOld = hulls[e];
	let speed = trackLefts[e] + trackRights[e];
	hulls[e] += speed;
	
	console.log("position of tank hull", e, "was", hullOld, "and is now", hulls[e], "due to the speed of its tracks.");
	
	//...component values are used to derive other, new component values,
	//thereby advancing the simulation.
}

//Our simplistic, global "ECS" function.
function allTanksTakeTheirTurns(hulls, turrets, trackLefts, trackRights) 
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

//--- Draw / Render logic ---//

const HULL_WIDTH = 28;
const HULL_HEIGHT = 34;
const colors = ["red", "green", "blue", "cyan", "magenta", "yellow"];

const canvas = document.getElementsByTagName('canvas')[0];
const context = canvas.getContext('2d');

function renderAllTanks(hulls)
{
	context.fillStyle = "white";
	context.clearRect(0, 0, canvas.width, canvas.height);
	context.fillRect (0, 0, canvas.width, canvas.height);
	
	for (let e = 0; e < ENTITIES_COUNT; e++)
	{
		let xTrackWidth = canvas.width / ENTITIES_COUNT;
		let xPos = parseInt(xTrackWidth * (e) + xTrackWidth / 2);
		let yPos = hulls[e];
		
		context.fillStyle = colors[e % colors.length]; //loop the color index
		
		context.save();
		context.translate(xPos, yPos);
		
		//draw a line from start position to current position.
		context.fillRect( 0, 0,
		                  1, -yPos); 
		
		//draw the tank's hull at current position.
		context.fillRect( -HULL_WIDTH/2, -HULL_HEIGHT/2, //start drawing here 
						   HULL_WIDTH,    HULL_HEIGHT); //draw this far from start
						
		//draw the tank's turret.
		context.fillStyle = "black";
		context.beginPath();
		context.arc(0,0, HULL_WIDTH/2, 0, 2 * Math.PI); //turret
		context.rect( -HULL_WIDTH/8, HULL_WIDTH/2,
			           HULL_WIDTH/4, HULL_WIDTH/2); //gunbarrel
		context.closePath();
		context.fill();
		context.restore();
						   
		//...It will later be made clear why we draw like this!
	}
}

//--- Game Loop ---//

let turn = 0;
function updateGameLogic()
{
	console.log("Processing turn", turn, "...");
	
	allTanksTakeTheirTurns(hulls, turrets, trackLefts, trackRights); //call our ECS to process everything.
	renderAllTanks(hulls);
	
	turn++;
}

renderAllTanks(hulls);

document.addEventListener('keyup', event => { if (event.code === 'Space') updateGameLogic(); })