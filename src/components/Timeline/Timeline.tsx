import clsx from 'clsx';
import type { TrackingEvent } from '../../types/ondc';
import styles from './Timeline.module.scss';

interface TimelineProps {
  items: TrackingEvent[];
}

const Timeline = ({ items }: TimelineProps) => (
  <div className={styles.timeline}>
    {items.map((item, index) => (
      <div className={styles.event} key={item.id}>
        <div
          className={clsx(
            styles.dot,
            item.state === 'done' && styles.done,
            item.state === 'pending' && styles.pending,
          )}
        >
          {index + 1}
        </div>
        <div>
          <strong>{item.title}</strong>
          <small>{item.description}</small>
        </div>
      </div>
    ))}
  </div>
);

export default Timeline;
