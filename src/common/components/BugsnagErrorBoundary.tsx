// components/BugsnagErrorBoundary.tsx
import React from "react";
import { Bugsnag } from "../utils/bugsnag";

const ErrorBoundary =
  Bugsnag.getPlugin("react")?.createErrorBoundary(React) ?? React.Fragment;

interface BugsnagErrorBoundaryProps {
  children?: React.ReactNode;
}

const BugsnagErrorBoundary: React.FC<BugsnagErrorBoundaryProps> = ({
  children,
}) => <ErrorBoundary>{children}</ErrorBoundary>;

export default BugsnagErrorBoundary;
