import styles from './Header.module.scss';

interface HeaderProps {
  title: string;
  subtitle: string;
}

const Header = ({ title, subtitle }: HeaderProps) => (
  <div className={styles.topbar}>
    <div className={styles.copy}>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.subtitle}>{subtitle}</p>
    </div>
    <div className={styles.pill}>Demo Mode - Buyer NP Journey</div>
  </div>
);

export default Header;
