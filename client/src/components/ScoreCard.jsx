// src/components/Scorecard.jsx
import styles from '../styles/ScoreCard.module.css';

export const ScoreCard = ({ players = [] }) => {
  if (!players || players.length === 0) {
    return (
      <div className={styles.scorecard}>
        <h2 className={styles.scoreTitle}>Scores</h2>
        <p>No players yet</p>
      </div>
    );
  }

  // Sort players by score in descending order
  const sortedPlayers = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));

  return (
    <div className={styles.scorecard}>
      <h2 className={styles.scoreTitle}>Scores</h2>
      <div className={styles.scoreList}>
        {sortedPlayers.map((player, index) => (
          <div key={index} className={styles.scoreRow}>
            <span className={styles.playerName}>
              {player.name || 'Unknown Player'}
            </span>
            <span className={styles.score}>
              {player.score || 0}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

