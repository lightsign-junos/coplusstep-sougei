import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// 画面が真っ白になる代わりにエラー内容を表示する（原因調査用）
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div style={{ padding: 24, fontFamily: 'sans-serif', color: '#1E293B' }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>エラーが発生しました</h1>
          <p style={{ fontSize: 13, color: '#64748B', marginBottom: 12 }}>
            画面の表示中に問題が発生しました。下記の内容をサポートに伝えてください。
          </p>
          <pre style={{ fontSize: 12, background: '#F1F5F9', padding: 12, borderRadius: 8, overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
            {error.message}
            {'\n'}
            {error.stack}
          </pre>
          <button
            onClick={() => location.reload()}
            style={{ marginTop: 16, padding: '8px 16px', background: '#1E293B', color: 'white', borderRadius: 8, border: 'none', cursor: 'pointer' }}
          >
            再読み込み
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
