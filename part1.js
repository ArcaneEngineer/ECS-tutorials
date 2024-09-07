//--- Prep essential constants needed for setup ---//

const canvas = document.getElementsByTagName('canvas')[0];
const context = canvas.getContext('2d');

const ENTITIES_COUNT = 12; // How many tanks we have

const GAP_BETWEEN_TANKS = canvas.width / ENTITIES_COUNT;
const SPEED_MAX = 5; // Tanks' tracks' max speed

//--- Set up Entities as groups of Components ---//

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

function oneTankTakesItsTurn(e)
{
	let hullOld = hulls[e];
	let speed = trackLefts[e] + trackRights[e];
	hulls[e] += speed;
	
	console.log("position of tank hull", e, "was", hullOld, "and is now", hulls[e], "due to the speed of its tracks.");
	
	//...component values are used to derive other, new component values,
	//thereby advancing the simulation.
}

//Our simplistic, global "ECS" function.
function allTanksTakeTheirTurns() 
{
    //process each entity in our game
    for (let e = 0; e < ENTITIES_COUNT; e++)
    {
        oneTankTakesItsTurn(e);
    }
}

//--- Draw / Render logic ---//

const HULL_WIDTH = 28;
const HULL_HEIGHT = 34;
const colors = ["red", "green", "blue", "cyan", "magenta", "yellow"];

function renderAllTanks()
{
	context.fillStyle = "white";
	context.clearRect(0, 0, canvas.width, canvas.height);
	context.fillRect (0, 0, canvas.width, canvas.height);
	
	for (let e = 0; e < ENTITIES_COUNT; e++)
	{
		let xPos = parseInt(GAP_BETWEEN_TANKS * e + GAP_BETWEEN_TANKS / 2);
		let yPos = hulls[e];
		
		context.fillStyle = colors[e % colors.length]; //loop the color index
		
		context.save(); //before drawing individual tank.
		context.translate(xPos, yPos); //works with save() / restore()
		
		//draw a line from start position to current position.
		context.fillRect( 0, 0,
		                  1, -yPos); 
		
		//draw the tank's hull at current position.
		context.fillRect( -HULL_WIDTH/2, -HULL_HEIGHT/2, //start drawing here 
						   HULL_WIDTH,    HULL_HEIGHT); //draw this far from start
						
		//draw the tank's turret.
		context.beginPath();
		context.arc(0,0, HULL_WIDTH/2, 0, 2 * Math.PI); //turret
		context.rect( -HULL_WIDTH/8, HULL_WIDTH/2,
			           HULL_WIDTH/4, HULL_WIDTH/2); //gunbarrel
		context.closePath();
		context.stroke();
		context.fill();
		
		context.restore(); //after drawing individual tank.
						   
		//...It will later be made clear why we draw like this (save/restore)!
	}
}

//--- Game Loop ---//

let turn = 0;
function updateGameLogic()
{
	console.log("Processing turn", turn, "...");
	
	allTanksTakeTheirTurns(); //call our ECS to process everything.
	renderAllTanks();
	
	turn++;
}

renderAllTanks();

document.addEventListener('keyup', event => { if (event.code === 'Space') updateGameLogic(); })