import { createContext, useContext, ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";

// Define the feature categories
export type FeatureType = "LMS" | "QMS" | "BOTH";

// Define specific features and their categories
export const FEATURES = {
  // LMS features
  BATCH_MANAGEMENT: "LMS",
  TRAINEE_MANAGEMENT: "LMS", 
  QUIZ_MANAGEMENT: "LMS",
  MY_QUIZZES: "LMS",
  BATCH_MONITORING: "LMS",
  
  // QMS features
  EVALUATION_TEMPLATES: "QMS",
  CONDUCT_EVALUATION: "QMS",
  MOCK_CALL_SCENARIOS: "QMS",
  
  // Features available in both
  DASHBOARD: "BOTH",
  PROFILE: "BOTH",
  SETTINGS: "BOTH",
  USER_MANAGEMENT: "BOTH"
} as const;

export type Feature = keyof typeof FEATURES;

type FeaturesContextType = {
  hasAccess: (feature: Feature) => boolean;
  getUserFeatureType: () => FeatureType;
};

const FeaturesContext = createContext<FeaturesContextType | null>(null);

export function FeaturesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  
  // Check if a user has access to a specific feature
  const hasAccess = (feature: Feature): boolean => {
    if (!user) return false;
    
    const userFeatureType = user.featureType || "BOTH";
    const featureCategory = FEATURES[feature];
    
    // User has access if:
    // 1. The feature is in the BOTH category
    // 2. User has BOTH access
    // 3. User's feature type matches the feature's category
    return (
      featureCategory === "BOTH" || 
      userFeatureType === "BOTH" || 
      userFeatureType === featureCategory
    );
  };
  
  // Get the user's feature type
  const getUserFeatureType = (): FeatureType => {
    return (user?.featureType as FeatureType) || "BOTH";
  };
  
  return (
    <FeaturesContext.Provider value={{ hasAccess, getUserFeatureType }}>
      {children}
    </FeaturesContext.Provider>
  );
}

export function useFeatures() {
  const context = useContext(FeaturesContext);
  
  if (!context) {
    throw new Error("useFeatures must be used within a FeaturesProvider");
  }
  
  return context;
}