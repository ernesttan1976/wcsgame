// server/index.js
const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true
    }
});

app.use(cors());
app.use(express.json());

// Default scenarios if file loading fails
let scenarios = [
    "Jump from a moving car",
    "Taken hostage",
    "Chased by a gorilla",
    "Scuba tank runs out of air at 50-feet below",
    "Swim in shark-infested waters",
    "Armed robber in the house",
    "Stuck in a sinking car",
    "Jump from a building into a dumpster",
    "Spend one week in prison",
    "Surrounded by dozens of snakes"
];

// Load scenarios from file
function loadScenarios() {
    try {
        const data = fs.readFileSync(path.join(__dirname, 'scenarios.txt'), 'utf8');
        const loadedScenarios = data.split('\n').filter(line => line.trim());
        if (loadedScenarios.length > 0) {
            scenarios = loadedScenarios;
            console.log(`Loaded ${scenarios.length} scenarios from file`);
        }
    } catch (err) {
        console.log('Using default scenarios (scenarios.txt not found or error)');
    }
}

// Load scenarios on startup
loadScenarios();

// Game class to manage game state
class Game {
    constructor(code, totalRounds) {
        this.code = code;
        this.players = new Map();
        this.currentRound = 0;
        this.votes = new Map();
        this.state = 'waiting';
        this.currentScenarios = [];
        this.currentSpinner = null;
        this.totalRounds = totalRounds || 5; // Default to 5 if not specified
    }



    addPlayer(id, name) {
        this.players.set(id, { name, score: 0 });
        // First player to join becomes first spinner
        if (!this.currentSpinner && this.state === 'waiting') {
            this.currentSpinner = id;
        }
        return {
            players: this.getPlayersList(),
            currentSpinner: this.currentSpinner
        };
    }

    startRound() {
        if (this.currentRound >= this.getTotalRounds()) {
            return { gameOver: true, winner: this.getWinner() };
        }

        this.currentScenarios = [];
        // Get 5 random scenarios
        const usedIndices = new Set();
        while (this.currentScenarios.length < 5) {
            const index = Math.floor(Math.random() * scenarios.length);
            if (!usedIndices.has(index)) {
                usedIndices.add(index);
                this.currentScenarios.push(scenarios[index]);
            }
        }
        this.votes.clear();
        this.state = 'spinning';
        this.currentRound++;
        return {
            scenarios: this.currentScenarios,
            currentSpinner: this.currentSpinner,
            round: this.currentRound
        };
    }

    getWinner() {
        let maxScore = 0;
        let winner = null;
        this.players.forEach((player, id) => {
            if (player.score > maxScore) {
                maxScore = player.score;
                winner = { id, name: player.name, score: maxScore };
            }
        });
        return winner;
    }

    finishSpinning(multiplier) {
        // Move to next player for next round
        const playerIds = Array.from(this.players.keys());
        const currentIndex = playerIds.indexOf(this.currentSpinner);
        const nextIndex = (currentIndex + 1) % playerIds.length;
        this.currentSpinner = playerIds[nextIndex];

        this.state = 'playing';
        return {
            multiplier,
            currentSpinner: this.currentSpinner
        };
    }

    getPlayersList() {
        return Array.from(this.players.values());
    }

    getTotalRounds() {
        const playersList = this.getPlayersList();
        const playersCount = playersList.length
        return playersCount * this.totalRounds;
    }


    submitVote(playerId, playerVotes) {
        console.log(`Player ${playerId} submitted votes for game ${this.code}`);
        this.votes.set(playerId, playerVotes);

        // Check if all players have voted
        if (this.votes.size === this.players.size) {
            console.log('All players have voted, calculating scores...');
            return this.calculateScores();
        }
        return null;
    }

    calculateScores(wheelMultiplier) {
        console.log('\n=== Starting Score Calculation ===');
        const multiplier = Number(wheelMultiplier) || 1;

        const results = {
            votingResults: Array.from(this.votes.entries()),
            scores: {},
            roundPoints: {},
            multiplier: multiplier
        };

        let maxPoints = 0;

        // Calculate scores for non-spinner players
        this.players.forEach((playerData, playerId) => {
            if (playerId !== this.currentSpinner) {
                let roundScore = 0;
                const playerVotes = this.votes.get(playerId);

                this.votes.forEach((otherVotes, otherPlayerId) => {
                    if (playerId !== otherPlayerId && otherPlayerId !== this.currentSpinner) {
                        let matchesWithThisPlayer = 0;
                        for (let i = 0; i < 5; i++) {
                            if (playerVotes[i] === otherVotes[i]) {
                                matchesWithThisPlayer++;
                            }
                        }
                        roundScore += matchesWithThisPlayer;
                    }
                });

                const multipliedScore = roundScore * multiplier;
                maxPoints = Math.max(maxPoints, multipliedScore);

                results.roundPoints[playerId] = multipliedScore;
                const newScore = (this.players.get(playerId).score || 0) + multipliedScore;
                this.players.get(playerId).score = newScore;
                results.scores[playerId] = newScore;
            }
        });

        // Give spinner (victim) the highest score
        const spinnerScore = maxPoints;
        results.roundPoints[this.currentSpinner] = spinnerScore;
        const newSpinnerScore = (this.players.get(this.currentSpinner).score || 0) + spinnerScore;
        this.players.get(this.currentSpinner).score = newSpinnerScore;
        results.scores[this.currentSpinner] = newSpinnerScore;

        return results;
    }

    removePlayer(playerId) {
        this.players.delete(playerId);
        this.votes.delete(playerId);
        return this.getPlayersList();
    }
}

// Store active games
const games = new Map();

// Socket connection handler
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('createGame', ({ name, rounds }) => {
        try {
          const gameCode = Math.random().toString(36).substring(2, 8).toUpperCase();
          console.log(`Creating game ${gameCode} for player ${name} with ${rounds} rounds`);
      
          const game = new Game(gameCode, rounds);
          game.addPlayer(socket.id, name);
          games.set(gameCode, game);
      
          socket.join(gameCode);
          socket.emit('gameCreated', gameCode);
          io.to(gameCode).emit('playerJoined', {
            players: game.getPlayersList()
          });
        } catch (error) {
          console.error('Error creating game:', error);
          socket.emit('error', 'Failed to create game');
        }
      });

    socket.on('joinGame', ({ code, name }) => {
        try {
            const game = games.get(code);
            if (!game) {
                socket.emit('error', 'Game not found');
                return;
            }

            const gameState = game.addPlayer(socket.id, name);
            socket.join(code);
            io.to(code).emit('playerJoined', gameState);
        } catch (error) {
            console.error('Error joining game:', error);
            socket.emit('error', 'Failed to join game');
        }
    });

    socket.on('startGame', ({ code }) => {
        try {
            const game = games.get(code);
            if (!game) {
                socket.emit('error', 'Game not found');
                return;
            }

            const gameState = game.startRound();
            if (gameState.gameOver) {
                io.to(code).emit('gameOver', gameState);
            } else {
                io.to(code).emit('roundStarted', gameState);
            }
        } catch (error) {
            console.error('Error starting game:', error);
            socket.emit('error', 'Failed to start game');
        }
    });

    socket.on('spinComplete', ({ code, multiplier }) => {
        try {
            const game = games.get(code);
            if (!game) {
                socket.emit('error', 'Game not found');
                return;
            }

            const spinResult = game.finishSpinning(multiplier);
            io.to(code).emit('spinningComplete', spinResult);
        } catch (error) {
            console.error('Error processing spin:', error);
            socket.emit('error', 'Failed to process spin');
        }
    });

    // Update the submitVotes socket handler
    socket.on('submitVotes', ({ code, votes, wheelMultiplier }) => {
        try {
            console.log('\n=== Processing Vote Submission ===');
            console.log('Game code:', code);
            console.log('Player:', socket.id);
            console.log('Wheel multiplier:', wheelMultiplier);

            const game = games.get(code);
            if (!game) {
                console.log('Error: Game not found');
                socket.emit('error', 'Game not found');
                return;
            }

            const allVotesReceived = game.submitVote(socket.id, votes);
            if (allVotesReceived) {
                console.log('Calculating final scores with multiplier:', wheelMultiplier);
                const finalResults = game.calculateScores(wheelMultiplier || 1); // Provide default value
                console.log('Emitting results to room:', code);
                io.to(code).emit('roundResults', finalResults);
            }
        } catch (error) {
            console.error('Error in submitVotes:', error);
            socket.emit('error', 'Failed to submit votes');
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        // Remove player from their game if they're in one
        games.forEach((game, gameCode) => {
            if (game.players.has(socket.id)) {
                const updatedPlayers = game.removePlayer(socket.id);
                io.to(gameCode).emit('playerLeft', {
                    players: updatedPlayers
                });
                // If no players left, remove the game
                if (game.players.size === 0) {
                    games.delete(gameCode);
                }
            }
        });
    });
});

// Start server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});