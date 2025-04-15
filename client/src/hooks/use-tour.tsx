import { useState, useCallback } from 'react';

type TourName = 'locationManagement' | 'batchManagement' | 'userManagement' | 'dashboard';

export function useTour(tourName: TourName) {
  // Check if tour was previously completed
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const startTour = useCallback(() => {
    setIsOpen(true);
  }, []);

  const completeTour = useCallback(() => {
    localStorage.setItem(`${tourName}TourComplete`, 'true');
    setIsOpen(false);
  }, [tourName]);

  const skipTour = useCallback(() => {
    localStorage.setItem(`${tourName}TourComplete`, 'true');
    setIsOpen(false);
  }, [tourName]);

  const resetTour = useCallback(() => {
    localStorage.removeItem(`${tourName}TourComplete`);
  }, [tourName]);

  const hasTourBeenCompleted = useCallback(() => {
    return !!localStorage.getItem(`${tourName}TourComplete`);
  }, [tourName]);

  return {
    isOpen,
    startTour,
    completeTour,
    skipTour,
    resetTour,
    hasTourBeenCompleted
  };
}