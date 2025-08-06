"use client";

// components/BugsnagErrorBoundary.tsx
import React from "react";

interface BugsnagErrorBoundaryProps {
  children?: React.ReactNode;
}

const BugsnagErrorBoundary: React.FC<BugsnagErrorBoundaryProps> = ({
  children,
}) => {
  const [ErrorBoundary, setErrorBoundary] = React.useState<React.ComponentType<any>>(() => React.Fragment);

  React.useEffect(() => {
    // Only load Bugsnag on the client side
    if (typeof window !== 'undefined') {
      const { Bugsnag } = require('../utils/bugsnag');
      const BugsnagErrorBoundary = Bugsnag.getPlugin?.("react")?.createErrorBoundary(React);
      if (BugsnagErrorBoundary) {
        setErrorBoundary(() => BugsnagErrorBoundary);
      }
    }
  }, []);

  return <ErrorBoundary>{children}</ErrorBoundary>;
};

export default BugsnagErrorBoundary;
