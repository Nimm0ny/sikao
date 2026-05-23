import { useState } from 'react';
import styles from './Avatar.module.css';

/*
 * Avatar — V5 D.3.18 atom (skeleton).
 *
 * Why: token-driven user avatar. `src` may resolve or fail; on `error`
 *      we flip to fallback initials with inverted (text-primary) bg so
 *      contrast holds without exposing a broken-image glyph.
 */

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarStatus = 'online' | 'offline' | 'busy' | 'away';
export type AvatarShape = 'circle' | 'square';

export interface AvatarProps {
  readonly src?: string;
  readonly fallback: string;
  readonly size?: AvatarSize;
  readonly status?: AvatarStatus;
  readonly shape?: AvatarShape;
  readonly alt?: string;
}

export function Avatar({
  src,
  fallback,
  size = 'md',
  status,
  shape = 'circle',
  alt,
}: AvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = typeof src === 'string' && src.length > 0 && !imgFailed;

  return (
    <span className={styles.root} data-size={size} data-shape={shape}>
      {showImage ? (
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- onError is an image-load lifecycle event, not a user-interaction handler
        <img
          className={styles.image}
          src={src}
          alt={alt ?? ''}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className={styles.fallback} aria-label={alt}>
          {fallback}
        </span>
      )}
      {status ? (
        <span
          className={styles.dot}
          data-testid="avatar-status-dot"
          data-status={status}
          aria-hidden="true"
        />
      ) : null}
    </span>
  );
}
