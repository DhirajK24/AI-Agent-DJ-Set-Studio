import Link from 'next/link';
import AudioFileMix from '@/components/Studio/AudioFileMix';
import Icon from '@/components/Studio/Icon';
import styles from '../page.module.css';

export default function MixPage() {
  return (
    <div className={styles.studio}>
      <header className={styles.header}>
        <div className={styles.brand}><span className={styles.brandMark}><Icon name="wave" size={23} /></span>Set Studio</div>
        <Link href="/" className={styles.manualLink}><Icon name="youtube" size={17} /> YouTube sets</Link>
      </header>
      <AudioFileMix />
    </div>
  );
}
