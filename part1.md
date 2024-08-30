# ENTITY COMPONENT SYSTEMS: Part 1

What is an Entity-Component System (ECS)? What is it for?

As we know, games contain _many_ moving parts. Things like player characters, animals, vehicles, buildings, treasure chests, swords, bullets, spells, traps, triggers, explosions and more. When we need a lot of these complex _entities_ -- loosely synonymous with "actors", "props" or "game objects" -- then we also need an efficient way to organise them, and to process them.

Imagine a treasure chest that can hold treasure, but can also attack by biting the player's character! This mimic chest _entity_ has more than one function / purpose, and as a consequence, it will hold at least two _components_ to reflect its two, totally different capabilities: _holding things_ and _biting_.

Now imagine a single military unit in a Real Time Strategy game (RTS): an upgradeable spearman, or a complex jet fighter. There can be thousands of each of these, each instance of which could contain tens or even hundreds of behaviours, which we must both add and maintain easily. Furthermore, interactions between one entity's many components can be complex indeed. Tall order, right?

# ECS to the rescue!

ECS is the solution. This architecture or _design pattern_ has become very popular since 2007, [when it was first described](https://cowboyprogramming.com/2007/01/05/evolve-your-heirachy/). As it has grown in popularity, its implementation styles have grown diverse, leading to differing opinions on how ECS _should_ be implemented.

One thing that is clear about entity management in general, is that standard Object-Oriented Programming (OOP) practices, which use inheritance to create entity-component detail, do not fit the bill. ECS prefers an approach based on _[composition over inheritance](https://en.wikipedia.org/wiki/Composition_over_inheritance)_. On this point, all agree.

There are many points which are _not_ agreed upon. In this series, I strive to avoid contentious issues, and focus on a way to build a simple ECS that can easily be ported to various languages / platforms.

In these articles, I aim to answer a frequent question: _How_ do we build a simple ECS?

# A small technical outline

What we need first is a way to create lists of _entities_ (game characters or objects). Entities' existence is dependent on the state of its _components_, where each of these components is optionally active.

Each entity (slot) exists as some subset of the superset of all possible components available in the game; this is how an entity is defined, by its (active) components (various components are considered to be _on_ or _off_ for that entity).

This use of [composition over inheritance](https://en.wikipedia.org/wiki/Composition_over_inheritance) offers a highly configurable system, in a way that deriving base classes via OOP inheritance **cannot** easily offer (particularly without multiple inheritance).


# Tiny Tanks: A Trivial Example

If we imagine a simple tanks game, where tanks can lose bits and pieces and thereby fail to drive and shoot, we see how this could have been done with arrays, functions, and _no OOP_. We'll later evolve this contrived example into something more playable.

## Data initialisation

Let's get some data ready, representing some _entities as the sum of their components_:

```
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

```
We have the component arrays... now we must (auto) populate each tank's components with data:
```

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
```

Running just this code, you should see similar initialisation taking place in the browser's console:

![part1_tanks_init_log.png](https://ucarecdn.com/4fbc7579-1bf5-4024-bbff-f354979799e1/)

As you see, each component (except the `turret`) will have some numeric value associated with it. Components will become more complex than just a single value, later on in this series.

## Game Logic

Now... How do we process these entities-represented-as-sets-of-components?

```

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
```

OK, that processes (moves) a single tank, but how do we process all tank entities?

```
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

```

This is does a single frame (_turn_) of processing, for all entities we have created. 

We run it by setting up all the code above in a `.js` file, and calling that function:

```
allTanksTakeTheirTurns(hulls, turrets, trackLefts, trackRights);
```

...This steps the simulation just once. Let's gives ourselves the ability to step the whole simulation by hitting the spacebar:

```
let turn = 0;
function updateGameLogic()
{
	console.log("Processing turn", turn, "...");
	
	allTanksTakeTheirTurns(hulls, turrets, trackLefts, trackRights); //call our ECS to process everything.
	
	turn++;
}

document.addEventListener('keyup', event => { if (event.code === 'Space') updateGameLogic(); })
```

As you press spacebar repeatedly, you should see messages appearing in your browser's console, stating the speed and position of each tank.

![part1_tanks_move_log.png](https://ucarecdn.com/9b5eae1e-4691-4595-b941-6b1c93da2d4d/)

We've confirmed that our tanks' positions are updating, so let's draw them, and see them moving!

## Drawing the tanks

```
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

```

To use that, our game loop must now call `renderAllTanks()` on every update (and on startup):

```
//--- Game Loop ---//

let turn = 0;
function updateGameLogic()
{
	console.log("Processing turn", turn, "...");
	
	allTanksTakeTheirTurns(hulls, turrets, trackLefts, trackRights); //call our ECS to process everything.
	renderAllTanks(hulls);
	
	turn++;
}

renderAllTanks(hulls); //pre-draw, for when we load the HTML page.

document.addEventListener('keyup', event => { if (event.code === 'Space') updateGameLogic(); })
```

Hitting spacebar repeatedly will have your tanks racing down the screen, some faster than others!

![part1_tanks_race.png](https://ucarecdn.com/4a90cc33-e044-405a-bcb0-b38bff0368ac/)

# Conclusion

The final code can be found on [github](https://github.com/ArcaneEngineer/ECS-tutorials).

So, can we call this an ECS?  It's has some key elements, but it's not there yet. AAA games industry ECS's are vastly more complex and support a wide variety of use cases and interactions between components, entities, and other _systems_ (rendering, sound, networking, physics etc.).

Fundamentally, an ECS supports a superset of components, that is, all possible components for a given game design. Of that superset, each entity uses (has active) only some subset, thereby defining what that entity is and what it's capable of. Think of it like a switchboard.

In the next article, we'll look at this _optionality_ aspect of each entity's components.
