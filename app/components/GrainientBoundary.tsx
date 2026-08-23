import { Component, type ReactNode } from "react";

type GrainientBoundaryProps = {
  children: ReactNode;
};

type GrainientBoundaryState = {
  hasError: boolean;
};

export default class GrainientBoundary extends Component<GrainientBoundaryProps, GrainientBoundaryState> {
  state: GrainientBoundaryState = { hasError: false };

  static getDerivedStateFromError(): GrainientBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
