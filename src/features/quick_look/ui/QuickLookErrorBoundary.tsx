import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { Icon } from "../../../shared/ui/Icon";

interface Props {
  children: ReactNode;
  resetKey?: string;
  onRetry?: () => void;
  onOpenInMain?: () => void;
  fileName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class QuickLookErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[QuickLookErrorBoundary] Error capturado en visor:", error, errorInfo);
  }

  public override componentDidUpdate(prevProps: Props) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="quicklook-error-boundary-state" role="alert">
          <div className="quicklook-error-icon-wrapper">
            <Icon name="info" />
          </div>
          <div className="quicklook-error-text-wrapper">
            <h3 className="quicklook-error-title">No se pudo cargar la vista previa</h3>
            <p className="quicklook-error-subtitle">
              {this.props.fileName
                ? `Hubo un inconveniente al renderizar «${this.props.fileName}».`
                : "El decodificador del visor encontró un problema inesperado."}
            </p>
          </div>
          <div className="quicklook-error-actions">
            <button
              type="button"
              className="quicklook-error-btn quicklook-error-btn-secondary"
              onClick={this.handleReset}
            >
              <Icon name="refresh" />
              <span>Reintentar</span>
            </button>
            {this.props.onOpenInMain && (
              <button
                type="button"
                className="quicklook-error-btn quicklook-error-btn-primary"
                onClick={this.props.onOpenInMain}
              >
                <Icon name="external-link" />
                <span>Abrir en Prisma</span>
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
