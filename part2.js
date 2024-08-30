//--- Set up Entities as groups of Components ---//

// How many tanks we will have in our simulation.
//if you want more tanks, you need to supply the data, below!
const ENTITIES_COUNT = 3;
const SPEED_MAX = 5;

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
	                       "track left speed", trackLefts [e],
	                       "track left speed", trackRights[e]);
}

//--- Game logic ---//

function oneTankTakesItsTurn(e, hulls, turrets, trackLefts, trackRights)
{
    let result = 0;
    
	let hullOld = hulls[e];
    //TODO Game logic calculations based on component members, e.g.
	//
	let speed = trackLefts[e] + trackRights[e];
	hulls[e] += speed;
	console.log("position of tank hull", e, "was", hullOld, "and is now", hulls[e], "due to the speed of its tracks.");
	//
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

const W = 28;
const H = 34;
const colors = ["magenta", "cyan", "yellow"];

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
		
		context.save();
		context.translate(xPos, yPos);
		
		context.fillStyle = colors[e];
		context.fillRect( -W/2, -H/2, W, H);
		context.fill();
						
		context.restore();
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