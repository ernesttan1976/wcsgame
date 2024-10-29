// src/components/WheelSpinner.jsx
import { motion } from 'framer-motion';
import styles from '../styles/WheelSpinner.module.css';

const WHEEL_SEGMENTS = [
  { value: 2, label: 'DOUBLE UP', color: '#FFB74D', startAngle: 0 },
  { value: 4, label: 'THE 4 IS MORE!', color: '#FFA726', startAngle: 60 },
  { value: 5, label: 'ALL BONUS', color: '#FF9800', startAngle: 120 },
  { value: 1, label: 'BAD IS GOOD', color: '#FB8C00', startAngle: 180 },
  { value: 3, label: 'TRIPLE HIT', color: '#F57C00', startAngle: 240 },
  { value: 8, label: 'CRAZY 8', color: '#EF6C00', startAngle: 300 }
];

export const WheelSpinner = ({ spinning, onStop, onValueSelected, currentSpinner, playerId }) => {
  const getRandomRotation = () => {
    // Get a random segment
    const segmentIndex = Math.floor(Math.random() * WHEEL_SEGMENTS.length);
    // Calculate the rotation needed to land on this segment
    const baseRotation = segmentIndex * (360 / WHEEL_SEGMENTS.length);
    // Add some random offset within the segment
    const offset = Math.random() * (360 / WHEEL_SEGMENTS.length);
    // Add multiple full rotations
    return 1800 + baseRotation + offset;
  };

  const handleAnimationComplete = () => {
    if (spinning) {
      const rotation = getRandomRotation();
      // Calculate which segment we landed on
      const segment = Math.floor((rotation % 360) / (360 / WHEEL_SEGMENTS.length));
      onValueSelected(WHEEL_SEGMENTS[segment].value);
      onStop();
    }
  };

  return (
    <div className={styles.wheelContainer}>
      <h2 className={styles.wheelTitle}>The Victim Wheel</h2>
      <div className={styles.wheelWrapper}>
        <div className={styles.pointer}>↓</div>
        <motion.div
          className={styles.wheel}
          animate={{ rotate: spinning ? getRandomRotation() : 0 }}
          transition={{
            duration: 3,
            type: "spring",
            damping: 10
          }}
          onAnimationComplete={handleAnimationComplete}
        >
          {WHEEL_SEGMENTS.map((segment, index) => (
            <div
              key={index}
              className={styles.segment}
              style={{
                transform: `rotate(${segment.startAngle}deg)`,
                backgroundColor: segment.color
              }}
            >
              <div className={styles.segmentContent}>
                <div className={styles.value}>{segment.value}x</div>
                <div className={styles.label}>{segment.label}</div>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
      <div className={styles.spinnerInfo}>
        {currentSpinner === playerId ? (
          "Your turn to spin!"
        ) : (
          "Watch the wheel spin..."
        )}
      </div>
      <div className={styles.note}>
        The victim always gets the same number of points as the player(s) with the most matches!
      </div>
    </div>
  );
};