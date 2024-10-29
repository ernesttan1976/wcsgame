// src/components/ScenarioCard.jsx
import styles from '../styles/ScenarioCard.module.css';

export const ScenarioCard = ({ scenario, rank, onRankChange }) => {
  return (
    <div className={styles.card}>
      <h3 className={styles.title}>{scenario}</h3>
      <div className={styles.votingButtons}>
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            onClick={() => onRankChange(value)}
            className={rank === value ? styles.voteButtonSelected : styles.voteButtonUnselected}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  );
};