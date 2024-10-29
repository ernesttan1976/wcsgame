// src/App.jsx
import { io } from 'socket.io-client';
import { WheelSpinner } from './components/WheelSpinner';
import { ScenarioCard } from './components/ScenarioCard';
import { ScoreCard } from './components/ScoreCard';
import { RoundResults } from './components/RoundResults';
import styles from './styles/App.module.css';
import { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { useSearchParams } from 'react-router-dom';

// Add sound effects
const sounds = {
  spin: new Audio('/mixkit-fast-bike-wheel-spin-1614.mp3'),  // You'll need to add these audio files
  // waiting: new Audio('/mixkit-tick-tock-clock-timer-1045.wav'),
  points: new Audio('/mixkit-game-experience-level-increased-2062.mp3')
};

const socket = io('http://localhost:3001', {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
});

export default function App() {
  const [gameCode, setGameCode] = useState('');
  const [name, setName] = useState('');
  const [gameState, setGameState] = useState('join');
  const [scenarios, setScenarios] = useState([]);
  const [votes, setVotes] = useState(Array(5).fill(0));
  const [players, setPlayers] = useState([]);
  const [spinning, setSpinning] = useState(false);
  const [error, setError] = useState('');
  const [wheelValue, setWheelValue] = useState(1);
  const [roundResults, setRoundResults] = useState(null);
  const [currentSpinner, setCurrentSpinner] = useState(null);
  const [round, setRound] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const waitingSoundRef = useRef(new Audio('/mixkit-tick-tock-clock-timer-1045.mp3'));
  const [numRounds, setNumRounds] = useState(5);
  const [searchParams] = useSearchParams();
  const [playerName, setPlayerName] = useState('');
  const [topScore, setTopScore] = useState(() => {
    return parseInt(localStorage.getItem('worstCaseScenarioTopScore')) || 0;
  });

  useEffect(() => {
    // Check for game code in URL
    const codeFromURL = searchParams.get('code');
    if (codeFromURL) {
      setGameCode(codeFromURL);
    }
  }, []);

  useEffect(() => {
    // Configure waiting sound to loop
    waitingSoundRef.current.loop = true;
    waitingSoundRef.current.volume = 0.3;

    return () => {
      waitingSoundRef.current.pause();
    };
  }, []);

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to server');
      setError('');
    });

    socket.on('connect_error', (err) => {
      console.error('Connection error:', err);
      setError('Failed to connect to server');
    });

    socket.on('gameCreated', (code) => {
      console.log('Game created with code:', code);
      setGameCode(code);
      setGameState('lobby');
    });

    socket.on('playerJoined', ({ players }) => {
      console.log('Players updated:', players);
      // Convert players data to the expected format
      const formattedPlayers = Array.isArray(players)
        ? players.map(player => ({
          name: player.name,
          score: player.score || 0
        }))
        : [];
      setPlayers(formattedPlayers);
    });

    socket.on('playerJoined', ({ players, currentSpinner }) => {
      console.log('Players updated:', players);
      setPlayers(players.map(player => ({
        name: player.name,
        score: player.score || 0
      })));
      setCurrentSpinner(currentSpinner);
    });

    socket.on('roundStarted', ({ scenarios, currentSpinner, round }) => {
      console.log('Round started:', { scenarios, currentSpinner, round });
      setScenarios(scenarios);
      setCurrentSpinner(currentSpinner);
      setRound(round);
      setGameState('spinning');
      waitingSoundRef.current.pause();

      // Only start spinning if it's your turn
      if (currentSpinner === socket.id) {
        setSpinning(true);
        sounds.spin.play();
      }
    });

    socket.on('spinningComplete', ({ multiplier, currentSpinner }) => {
      setWheelValue(multiplier);
      setCurrentSpinner(currentSpinner);
      setGameState('playing');
      sounds.waiting.play();
    });

    socket.on('roundResults', (results) => {
      sounds.points.play();

      // Update players and check for leader and top score
      const formattedPlayers = [];
      let maxScore = 0;
      let leader = null;

      Object.entries(results.scores).forEach(([playerId, score]) => {
        const playerData = players.find(p => p.id === playerId);
        if (score > maxScore) {
          maxScore = score;
          leader = playerId;
        }
        formattedPlayers.push({
          id: playerId,
          name: playerData?.name || 'Unknown Player',
          score: score
        });

        // Update top score if necessary
        if (score > topScore) {
          setTopScore(score);
          localStorage.setItem('worstCaseScenarioTopScore', score.toString());
        }
      });

      // Trigger confetti for the leader
      if (leader) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }

      setPlayers(formattedPlayers);
      setRoundResults(results);
      setGameState('results');
    });

    socket.on('gameOver', ({ winner }) => {
      setIsGameOver(true);
      setWinner(winner);
      confetti({
        particleCount: 500,
        spread: 100,
        origin: { y: 0.6 }
      });
    });

    return () => {
      socket.off('connect');
      socket.off('connect_error');
      socket.off('gameCreated');
      socket.off('playerJoined');
      socket.off('roundStarted');
      socket.off('roundResults');
      socket.off('spinningComplete');
      socket.off('gameOver')
      Object.values(sounds).forEach(sound => sound.pause());
    };
  }, [topScore, players]);

  // Start waiting sound when needed
  useEffect(() => {
    if (gameState === 'playing') {
      waitingSoundRef.current.play().catch(e => console.log('Audio play failed:', e));
    }
  }, [gameState]);

  // Modify the createGame function to include rounds
  const createGame = () => {
    if (!name) {
      setError('Please enter your name');
      return;
    }
    if (numRounds < 2 || numRounds > 20) {
      setError('Please enter between 2 and 20 rounds');
      return;
    }
    console.log('Creating game with name:', name, 'rounds:', numRounds);
    setPlayerName(name);
    socket.emit('createGame', { name, rounds: numRounds });
  };

  const joinGame = () => {
    if (!name || !gameCode) {
      setError('Please enter both name and game code');
      return;
    }
    console.log('Joining game:', gameCode, 'with name:', name);
    setPlayerName(name);
    socket.emit('joinGame', { code: gameCode, name });
  };

  const startGame = () => {
    console.log('Starting game:', gameCode);
    socket.emit('startGame', { code: gameCode });
  };

  const submitVotes = () => {
    if (votes.some(v => v === 0)) {
      setError('Please rank all scenarios before submitting');
      return;
    }
    waitingSoundRef.current.pause();
    console.log('Submitting votes with multiplier:', wheelValue);
    socket.emit('submitVotes', {
      code: gameCode,
      votes: votes,
      wheelMultiplier: wheelValue // Make sure we're sending the wheel value
    });
  };

  const handleSpinStop = () => {
    console.log('Spinner stopped');
    setSpinning(false);
  };

  const handleRankChange = (index, value) => {
    console.log('Rank changed:', { index, value });
    const newVotes = [...votes];
    newVotes[index] = value;
    setVotes(newVotes);
  };

  // Add this helper function for the share link
  const getShareLink = () => {
    return `${window.location.origin}?code=${gameCode}`;
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.gameTitle}>Worst Case Scenario</h1>
      <p className={styles.gameInstructions}>
        Welcome to Worst Case Scenario! Players take turns spinning the wheel to set
        the multiplier for the round. Then everyone ranks horrible scenarios from 1 (least bad)
        to 5 (worst). Match other players' rankings to score points! The victim (person who spun)
        gets the same score as the highest scoring player for that round.
      </p>
      {playerName && (
        <div className={styles.playerInfo}>
          Playing as: {playerName}
        </div>
      )}
      {error && <div className={styles.error}>{error}</div>}

      {gameState === 'join' && (
        <div className={styles.joinForm}>
          <input
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={styles.input}
          />
          {!searchParams.get('code') && (
            <input
              type="number"
              placeholder="Number of rounds (2-20)"
              value={numRounds}
              onChange={(e) => setNumRounds(parseInt(e.target.value))}
              min="2"
              max="20"
              className={styles.input}
            />
          )}
          <input
            type="text"
            placeholder="Enter game code"
            value={gameCode}
            onChange={(e) => setGameCode(e.target.value.toUpperCase())}
            className={styles.input}
          />
          <div className={styles.buttonGroup}>
            {!searchParams.get('code') && (
              <button onClick={createGame} className={styles.button}>
                Create Game
              </button>
            )}
            <button onClick={joinGame} className={styles.button}>
              Join Game
            </button>
          </div>
        </div>
      )}

      {gameState === 'lobby' && (
        <div className={styles.joinForm}>
          <h2>Game Code: {gameCode}</h2>
          <div className={styles.shareLink}>
            <p>Share this link with friends:</p>
            <input
              type="text"
              readOnly
              value={getShareLink()}
              className={styles.shareLinkInput}
              onClick={(e) => e.target.select()}
            />
          </div>
          <div>
            <h3>Players:</h3>
            <ScoreCard players={players} />
          </div>
          <div className={styles.roundCounter}>
            Round {round} of 5
          </div>
          <button onClick={startGame} className={styles.button}>
            Start Game
          </button>
        </div>
      )}

      {gameState === 'spinning' && (
        <div>
          <div className={styles.spinnerTurn}>
            {currentSpinner === socket.id
              ? "Your turn to spin!"
              : `Waiting for ${players.find(p => p.id === currentSpinner)?.name} to spin...`}
          </div>
          <WheelSpinner
            spinning={spinning && currentSpinner === socket.id}
            disabled={currentSpinner !== socket.id}
            onStop={() => {
              setSpinning(false);
              setTimeout(() => {
                socket.emit('spinComplete', {
                  code: gameCode,
                  multiplier: wheelValue
                });
              }, 3000); // 3 second pause after spin
            }}
            onValueSelected={setWheelValue}
          />
        </div>
      )}

      {gameState === 'playing' && (
        <div>
          {spinning ? (
            <WheelSpinner
              spinning={spinning}
              onStop={() => setSpinning(false)}
              onValueSelected={(value) => setWheelValue(value)}
            />
          ) : (
            <>
              <div className={styles.multiplierDisplay}>
                Current Multiplier: {wheelValue}x
              </div>
              {scenarios.map((scenario, index) => (
                <ScenarioCard
                  key={index}
                  scenario={scenario}
                  rank={votes[index]}
                  onRankChange={(value) => handleRankChange(index, value)}
                />
              ))}
              <button
                onClick={() => submitVotes({ votes, wheelMultiplier: wheelValue })}
                className={styles.button}
              >
                Submit Votes
              </button>
            </>
          )}
        </div>
      )}

      {gameState === 'results' && roundResults && (
        <div className={styles.resultsContainer}>
          <RoundResults
            players={players}
            roundPoints={roundResults.roundPoints}
            totalScores={roundResults.scores}
            multiplier={roundResults.multiplier}
            currentPlayer={socket.id}
          />
          <button
            onClick={startGame}
            className={styles.button}
            disabled={currentSpinner !== socket.id}
          >
            {currentSpinner === socket.id ? 'Start Next Round' : 'Waiting for spinner...'}
          </button>
        </div>
      )}

      {isGameOver && winner && (
        <div className={styles.gameOver}>
          <h2>Game Over!</h2>
          <h3>{winner.name} wins with {winner.score} points!</h3>
          <button
            onClick={() => window.location.reload()}
            className={styles.button}
          >
            Play Again
          </button>
        </div>
      )}

      {/* Add top score display */}
      <div className={styles.topScore}>
        All-Time Top Score: {topScore}
      </div>

      {/* Add new styles */}
      <style jsx>{`
        .gameTitle {
          font-size: 2.5rem;
          color: #ff4444;
          text-align: center;
          margin-bottom: 1rem;
          text-transform: uppercase;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }

        .gameInstructions {
          max-width: 600px;
          margin: 0 auto 2rem;
          text-align: center;
          line-height: 1.6;
          color: #666;
        }

        .shareLink {
          margin: 1rem 0;
          padding: 1rem;
          background: #f5f5f5;
          border-radius: 8px;
        }

        .shareLinkInput {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 0.9rem;
          cursor: pointer;
        }

        .playerInfo {
          background: #f0f0f0;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          margin: 1rem 0;
          text-align: center;
          font-weight: bold;
        }

        .topScore {
          position: fixed;
          bottom: 1rem;
          left: 50%;
          transform: translateX(-50%);
          background: #333;
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          font-weight: bold;
        }
      `}</style>
    </div>
  );
}