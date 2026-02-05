import styles from "./styles.module.scss";

interface OfflineStatusProps {
  size?: "small" | "default";
}

const OfflineStatus = ({ size = "default" }: OfflineStatusProps) => {
  return (
    <p className={styles.offline_status} data-size={size}>
      Stație posibil indisponibilă
    </p>
  );
};

export default OfflineStatus;
