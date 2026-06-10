import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Header from '../Header/Header';
import Sidebar from '../Sidebar/Sidebar';
import SummaryPanel from '../SummaryPanel/SummaryPanel';
import { useStepNavigation } from '../../hooks/useStepNavigation';
import { useMfJourneyStore } from '../../store/mfJourneyStore';
import styles from './Layout.module.scss';

const Layout = () => {
  const { activeStep } = useStepNavigation();
  const setCurrentStep = useMfJourneyStore((state) => state.setCurrentStep);

  useEffect(() => {
    setCurrentStep(activeStep.index);
  }, [activeStep.index, setCurrentStep]);

  return (
    <div className={styles.app}>
      <Sidebar />
      <main className={styles.main}>
        <Header title={activeStep.title} subtitle={activeStep.subtitle} />
        <div className={styles.layout}>
          <div className={styles.content}>
            <Outlet />
          </div>
          <SummaryPanel />
        </div>
      </main>
    </div>
  );
};

export default Layout;
