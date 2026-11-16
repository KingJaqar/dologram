import { Button } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import { strings } from '../../strings';
import styles from './ErrorState.module.css';

export function ErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return <section role="alert" className={styles.error}>
    <p className={styles.message}><Icon name="status.failed" size="sm" />{error}</p>
    {onRetry && <Button variant="secondary" onClick={onRetry}>{strings.common.retry}</Button>}
  </section>;
}
