import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { getFrontendUrl } from '../utils/navigation';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.href = getFrontendUrl();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mb-5 shadow-xl">
            <AlertTriangle className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-2xl font-black mb-2 text-white">
            {this.props.fallbackTitle || "Une anomalie d'affichage est survenue"}
          </h1>
          <p className="text-slate-400 text-sm max-w-md mb-4 leading-relaxed">
            L'interface a rencontré une erreur inattendue lors du rendu. Vos données et sessions sont en sécurité.
          </p>
          {this.state.error?.message && (
            <div className="text-xs font-mono bg-slate-900 border border-slate-800 text-amber-300 p-3 rounded-xl max-w-md mb-6 break-words text-left">
              {this.state.error.message}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={this.handleReload}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-lg"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Recharger l'interface</span>
            </button>
            <button
              onClick={this.handleGoHome}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-md"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retourner à l'accueil</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
