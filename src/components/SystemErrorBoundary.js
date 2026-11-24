import { Component } from 'react';
import SystemStatusPage from './SystemStatusPage';

class SystemErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Photobothus UI crashed:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return <SystemStatusPage kind="crash" />;
    }
    return this.props.children;
  }
}

export default SystemErrorBoundary;
