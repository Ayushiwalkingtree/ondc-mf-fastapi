import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { journeySteps } from '../routes/steps';
import { useMfJourneyStore } from '../store/mfJourneyStore';

export const useStepNavigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const setCurrentStep = useMfJourneyStore((state) => state.setCurrentStep);

  const activeStep = useMemo(
    () => journeySteps.find((step) => step.path === location.pathname) ?? journeySteps[0],
    [location.pathname],
  );

  const goToStep = (index: number) => {
    const step = journeySteps[index];
    if (!step) {
      return;
    }

    setCurrentStep(index);
    navigate(step.path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return { activeStep, goToStep, steps: journeySteps };
};
