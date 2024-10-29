import styles from '../styles/RoundResults.module.css';

export const RoundResults = ({ players, roundPoints, totalScores, multiplier }) => {
  return (
    <div className={styles.results}>
      <h2 className={styles.title}>Round Results</h2>
      <div className={styles.multiplier}>
        Multiplier: {multiplier}x
      </div>
      
      <div className={styles.scoreTable}>
        <div className={styles.header}>
          <span>Player</span>
          <span>Round Points</span>
          <span>Total Score</span>
        </div>
        
        {players.map((player) => {
          // Find the player's ID by matching their name in the totalScores object
          const playerId = Object.entries(totalScores).find(([_, score]) => 
            score === player.score
          )?.[0];
          
          return (
            <div key={player.name} className={styles.row}>
              <span>{player.name}</span>
              <span className={styles.points}>
                +{playerId ? roundPoints[playerId] : 0}
              </span>
              <span>{player.score}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};