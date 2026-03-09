import { FileText, Music, Video, Image } from 'lucide-react';
import { EmptyState } from './EmptyState';

export type MediaItem = {
  id: string;
  fileName: string | null;
  mimeType: string | null;
  url: string | null;
};

function isImage(mime?: string | null) {
  return !!mime && mime.startsWith('image/');
}
function isVideo(mime?: string | null) {
  return !!mime && mime.startsWith('video/');
}
function isAudio(mime?: string | null) {
  return !!mime && mime.startsWith('audio/');
}
function isPdf(mime?: string | null) {
  return mime === 'application/pdf';
}

function resolveUrl(url: string | null) {
  if (!url) return '#';
  if (url.startsWith('http')) return url;
  const base =
    (import.meta as any).env?.VITE_API_BASE_URL ?? 'http://localhost:4003';
  return `${base}${url}`;
}

const cardStyle: React.CSSProperties = {
  borderRadius: '9px',
  border: '1px solid #EBEBEB',
  overflow: 'hidden',
  background: '#FAFAFA',
  display: 'flex',
  flexDirection: 'column',
};

const captionStyle: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: '11px',
  color: '#6B7280',
  margin: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontFamily: "'Work Sans', sans-serif",
};

const iconBoxStyle: React.CSSProperties = {
  width: '100%',
  height: '120px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#F3F4F6',
};

function MediaCard({ item }: { item: MediaItem }) {
  const src = resolveUrl(item.url);
  const name = item.fileName ?? item.id;

  if (isImage(item.mimeType)) {
    return (
      <a href={src} target="_blank" rel="noreferrer" style={{ ...cardStyle, textDecoration: 'none' }}>
        <img
          src={src}
          alt={name}
          style={{ width: '100%', height: '120px', objectFit: 'cover', display: 'block' }}
        />
        <p style={captionStyle}>{name}</p>
      </a>
    );
  }

  if (isVideo(item.mimeType)) {
    return (
      <div style={cardStyle}>
        <video
          src={src}
          controls
          preload="metadata"
          style={{ width: '100%', height: '160px', objectFit: 'contain', background: '#000', display: 'block' }}
        />
        <p style={captionStyle}>{name}</p>
      </div>
    );
  }

  if (isAudio(item.mimeType)) {
    return (
      <div style={{ ...cardStyle, gridColumn: 'span 2' }}>
        <div style={{ padding: '14px 14px 10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#EDE9FE', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Music style={{ width: '16px', height: '16px' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Work Sans', sans-serif" }}>
              {name}
            </p>
            <p style={{ fontSize: '10px', color: '#9CA3AF', margin: '2px 0 0', fontFamily: "'Work Sans', sans-serif" }}>
              {item.mimeType}
            </p>
          </div>
        </div>
        <div style={{ padding: '0 14px 14px' }}>
          <audio src={src} controls preload="metadata" style={{ width: '100%', height: '36px' }} />
        </div>
      </div>
    );
  }

  if (isPdf(item.mimeType)) {
    return (
      <a href={src} target="_blank" rel="noreferrer" style={{ ...cardStyle, textDecoration: 'none' }}>
        <div style={iconBoxStyle}>
          <FileText style={{ width: '32px', height: '32px', color: '#DC2626' }} />
        </div>
        <p style={captionStyle}>{name}</p>
      </a>
    );
  }

  // Fallback for unknown types
  return (
    <a href={src} target="_blank" rel="noreferrer" style={{ ...cardStyle, textDecoration: 'none' }}>
      <div style={iconBoxStyle}>
        <Image style={{ width: '32px', height: '32px', color: '#9CA3AF' }} />
      </div>
      <p style={captionStyle}>{name}</p>
    </a>
  );
}

export function MediaGrid({
  items,
  emptyTitle,
  emptyDescription,
}: {
  items: MediaItem[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (items.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
      {items.map((item) => (
        <MediaCard key={item.id} item={item} />
      ))}
    </div>
  );
}
